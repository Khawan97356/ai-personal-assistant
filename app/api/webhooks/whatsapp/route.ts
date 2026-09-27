import { NextRequest, NextResponse } from "next/server";
import { whatsAppChannel } from "@/lib/agent/channels/whatsapp";
import { omniAgent, globalActionStore } from "@/lib/agent/core";
import { transcribeAudio } from "@/lib/agent/audio";
import { processVoiceAgentConversation } from "@/lib/agent/chat";
import { saveMemoryChunk } from "@/lib/agent/vectorMemory";
import { db } from "@/lib/db/store";

// 1. Validation de l'URL par Meta WhatsApp Cloud (GET Handshake)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "omnimind_secret_verify_token";

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// 2. Réception des événements et messages WhatsApp (POST)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return NextResponse.json({ status: "ignored" });
    }

    const from = message.from;

    // Résolution de l'utilisateur actif
    const allUsers = db.users.getAll();
    const verifiedUser = allUsers.find((u) => u.verified) || allUsers[0];
    const userId = verifiedUser?.id || "usr_dev_admin";

    // 1. Réponse à un bouton interactif 1-Tap (Valider / Rejeter)
    if (message.type === "interactive") {
      const buttonId = message.interactive?.button_reply?.id;

      if (buttonId?.startsWith("approve_")) {
        const actionId = buttonId.replace("approve_", "");
        const res = await omniAgent.executeAction(actionId);
        await whatsAppChannel.sendMessage(from, `✅ ${res.message}`);
      } else if (buttonId?.startsWith("reject_")) {
        const actionId = buttonId.replace("reject_", "");
        const action = db.actions.getById(actionId) || globalActionStore.get(actionId);
        if (action) {
          action.status = "rejected";
          db.actions.updateStatus(actionId, "rejected", userId);
        }
        await whatsAppChannel.sendMessage(from, "❌ Action annulée.");
      }
      return NextResponse.json({ status: "ok" });
    }

    // 2. Message vocal WhatsApp (Audio / PTT)
    if (message.type === "audio") {
      await whatsAppChannel.sendMessage(
        from,
        "🎙️ *Note vocale reçue. Téléchargement et analyse IA en cours...*"
      );

      let audioBuffer: Buffer | null = null;
      if (message.audio?.id) {
        audioBuffer = await whatsAppChannel.downloadMediaBuffer(message.audio.id);
      }

      if (audioBuffer) {
        try {
          const transcription = await transcribeAudio(audioBuffer, "whatsapp_voice.ogg");

          // Indexation RAG dans la mémoire vectorielle
          await saveMemoryChunk({
            userId,
            source: "whatsapp",
            content: transcription.text,
            sourceRef: message.id,
          }).catch(() => {});

          await whatsAppChannel.sendMessage(
            from,
            `📝 *Transcription :*\n"${transcription.text}"`
          );

          // Analyse cognitive autonome
          const agentResult = await processVoiceAgentConversation(transcription.text, [], userId);
          await whatsAppChannel.sendMessage(from, `🤖 ${agentResult.spokenResponse}`);

          // Envoi de boutons interactifs si une action est proposée
          if (agentResult.suggestedActionId) {
            const act = db.actions.getById(agentResult.suggestedActionId, userId);
            if (act && act.status === "pending_approval") {
              await whatsAppChannel.sendInteractiveAction(from, act.title, act.id);
            }
          }

          // Notification si action exécutée
          if (agentResult.executedAction) {
            await whatsAppChannel.sendMessage(
              from,
              `⚡ *Action exécutée :* "${agentResult.executedAction.title}"`
            );
          }
        } catch (err) {
          console.error("WhatsApp audio processing error:", err);
          await whatsAppChannel.sendMessage(
            from,
            "⚠️ Erreur lors du traitement de la note vocale. Veuillez réessayer."
          );
        }
      }

      return NextResponse.json({ status: "ok" });
    }

    // 3. Message texte simple ou ordre
    if (message.type === "text") {
      const text = message.text?.body || "";

      // Demande de briefing exécutif
      if (text.toLowerCase().includes("briefing") || text.toLowerCase().includes("résumé")) {
        await whatsAppChannel.sendMessage(from, "⏳ *Préparation de votre briefing exécutif en cours...*");

        const messages = await omniAgent.collectRecentMessages();
        const report = await omniAgent.generateExecutiveBriefing(messages, "instant");

        await whatsAppChannel.sendMessage(from, report.summaryMarkdown);

        // Envoyer les actions avec boutons interactifs 1-Tap
        for (const action of report.suggestedActions) {
          await whatsAppChannel.sendInteractiveAction(from, action.title, action.id);
        }

        return NextResponse.json({ status: "ok" });
      }

      // Ordre naturel libre ou dialogue avec l'agent
      // Indexation RAG vectorielle
      await saveMemoryChunk({
        userId,
        source: "whatsapp",
        content: text,
        sourceRef: message.id,
      }).catch(() => {});

      const agentResult = await processVoiceAgentConversation(text, [], userId);
      await whatsAppChannel.sendMessage(from, agentResult.spokenResponse);

      // Si une action a été exécutée
      if (agentResult.executedAction) {
        await whatsAppChannel.sendMessage(
          from,
          `✅ *Action exécutée :* "${agentResult.executedAction.title}"`
        );
      }

      // Si une action est proposée
      if (agentResult.suggestedActionId) {
        const act = db.actions.getById(agentResult.suggestedActionId, userId);
        if (act && act.status === "pending_approval") {
          await whatsAppChannel.sendInteractiveAction(from, act.title, act.id);
        }
      }

      return NextResponse.json({ status: "ok" });
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook WhatsApp Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
