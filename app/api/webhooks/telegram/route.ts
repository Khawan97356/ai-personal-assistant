import { NextRequest, NextResponse } from "next/server";
import { telegramChannel } from "@/lib/agent/channels/telegram";
import { omniAgent, globalActionStore } from "@/lib/agent/core";
import { transcribeAudio } from "@/lib/agent/audio";
import { processVoiceAgentConversation } from "@/lib/agent/chat";
import { saveMemoryChunk } from "@/lib/agent/vectorMemory";
import { db } from "@/lib/db/store";

export async function POST(req: NextRequest) {
  // Sécurisation webhook Telegram via secret token
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const headerSecret = req.headers.get("x-telegram-bot-api-secret-token");
    if (headerSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const update = await req.json();

    // Résolution de l'utilisateur actif
    const allUsers = db.users.getAll();
    const verifiedUser = allUsers.find((u) => u.verified) || allUsers[0];
    const userId = verifiedUser?.id || "usr_dev_admin";

    // 1. Gestion des clics sur les boutons inline (Validation / Rejet d'action)
    if (update.callback_query) {
      const cb = update.callback_query;
      const data: string = cb.data || "";
      const chatId = cb.message?.chat?.id;

      if (data.startsWith("approve:")) {
        const actionId = data.replace("approve:", "");
        const result = await omniAgent.executeAction(actionId);
        await telegramChannel.answerCallbackQuery(cb.id, result.message);
        if (chatId) {
          await telegramChannel.sendMessage(chatId, `✅ *Succès :* ${result.message}`);
        }
      } else if (data.startsWith("reject:")) {
        const actionId = data.replace("reject:", "");
        const action = db.actions.getById(actionId) || globalActionStore.get(actionId);
        if (action) {
          action.status = "rejected";
          db.actions.updateStatus(actionId, "rejected", userId);
        }
        await telegramChannel.answerCallbackQuery(cb.id, "Action rejetée.");
        if (chatId) {
          await telegramChannel.sendMessage(chatId, `❌ L'action a été annulée.`);
        }
      }

      return NextResponse.json({ ok: true });
    }

    // 2. Gestion des messages texte ou vocaux reçus
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;

      // Commande /start ou /help
      if (msg.text === "/start" || msg.text === "/help") {
        const welcomeText =
          `👋 *Bonjour ! Je suis OmniMind, votre assistant personnel IA.*\n\n` +
          `Je suis connecté en direct à vos flux de communication. Voici ce que vous pouvez faire :\n` +
          `• */briefing* : Générer votre synthèse exécutive du moment\n` +
          `• M'envoyer une *note vocale* : Je la transcris et l'analyse immédiatement\n` +
          `• M'écrire un message naturel : _"Valide l'email de Lamy"_, _"Qu'ai-je de prévu cet après-midi ?"_`;
        await telegramChannel.sendMessage(chatId, welcomeText);
        return NextResponse.json({ ok: true });
      }

      // Commande /briefing
      if (msg.text === "/briefing") {
        await telegramChannel.sendMessage(chatId, "⏳ *Génération de votre briefing exécutif en cours...*");

        // Relève réelle des emails (Gmail, Outlook) ou flux prioritaire
        const messages = await omniAgent.collectRecentMessages();
        const report = await omniAgent.generateExecutiveBriefing(messages, "instant");
        await telegramChannel.sendMessage(chatId, report.summaryMarkdown);

        for (const action of report.suggestedActions) {
          await telegramChannel.sendActionProposal(chatId, action.title, action.description, action.id);
        }

        return NextResponse.json({ ok: true });
      }

      // Message vocal reçu (Audio / Voice)
      if (msg.voice) {
        await telegramChannel.sendMessage(chatId, "🎙️ *Note vocale reçue. Téléchargement et analyse IA en cours...*");

        let audioBuffer: Buffer | null = null;
        if (msg.voice.file_id) {
          audioBuffer = await telegramChannel.downloadFileBuffer(msg.voice.file_id);
        }

        const transcription = await transcribeAudio(
          audioBuffer || Buffer.from(""),
          "voice.ogg"
        );

        // Sauvegarde dans la mémoire vectorielle RAG
        await saveMemoryChunk({
          userId,
          source: "telegram",
          content: transcription.text,
          sourceRef: String(msg.message_id),
        }).catch(() => {});

        await telegramChannel.sendMessage(
          chatId,
          `📝 *Transcription :*\n_"${transcription.text}"_`
        );

        // Traitement cognitif autonome par l'agent IA
        const agentResult = await processVoiceAgentConversation(transcription.text, [], userId);
        await telegramChannel.sendMessage(chatId, `🤖 *OmniMind :* ${agentResult.spokenResponse}`);

        // Si l'IA propose une action à valider
        if (agentResult.suggestedActionId) {
          const act = db.actions.getById(agentResult.suggestedActionId, userId);
          if (act) {
            await telegramChannel.sendActionProposal(chatId, act.title, act.description, act.id);
          }
        }

        // Si une action a été exécutée directement
        if (agentResult.executedAction) {
          await telegramChannel.sendMessage(
            chatId,
            `⚡ *Action exécutée :* "${agentResult.executedAction.title}"`
          );
        }

        return NextResponse.json({ ok: true });
      }

      // Ordre textuel libre en langage naturel
      if (msg.text) {
        // Sauvegarde dans la mémoire vectorielle RAG
        await saveMemoryChunk({
          userId,
          source: "telegram",
          content: msg.text,
          sourceRef: String(msg.message_id),
        }).catch(() => {});

        // Traitement cognitif par l'agent OmniMind
        const agentResult = await processVoiceAgentConversation(msg.text, [], userId);
        await telegramChannel.sendMessage(chatId, agentResult.spokenResponse);

        // Si une action a été exécutée sur ordre de l'utilisateur
        if (agentResult.executedAction) {
          await telegramChannel.sendMessage(
            chatId,
            `✅ *Exécuté :* "${agentResult.executedAction.title}"`
          );
        }

        // Si une action est suggérée pour validation 1-Tap
        if (agentResult.suggestedActionId) {
          const act = db.actions.getById(agentResult.suggestedActionId, userId);
          if (act && act.status === "pending_approval") {
            await telegramChannel.sendActionProposal(chatId, act.title, act.description, act.id);
          }
        }

        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook Telegram Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
