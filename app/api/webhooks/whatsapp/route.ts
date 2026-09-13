import { NextRequest, NextResponse } from "next/server";
import { whatsAppChannel } from "@/lib/agent/channels/whatsapp";
import { omniAgent } from "@/lib/agent/core";
import { transcribeAudio } from "@/lib/agent/audio";

// 1. Validation de l'URL par Meta WhatsApp Cloud (GET)
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

    // Réponse à un bouton interactif (Valider / Rejeter)
    if (message.type === "interactive") {
      const buttonId = message.interactive?.button_reply?.id;
      if (buttonId?.startsWith("approve_")) {
        const actionId = buttonId.replace("approve_", "");
        const res = await omniAgent.executeAction(actionId);
        await whatsAppChannel.sendMessage(from, `✅ ${res.message}`);
      } else if (buttonId?.startsWith("reject_")) {
        await whatsAppChannel.sendMessage(from, "❌ Action annulée.");
      }
      return NextResponse.json({ status: "ok" });
    }

    // Message vocal WhatsApp
    if (message.type === "audio") {
      await whatsAppChannel.sendMessage(
        from,
        "🎙️ Vocal bien reçu. Téléchargement et transcription en cours..."
      );

      let audioBuffer: Buffer | null = null;
      if (message.audio?.id) {
        audioBuffer = await whatsAppChannel.downloadMediaBuffer(message.audio.id);
      }

      if (audioBuffer) {
        try {
          const transcription = await transcribeAudio(audioBuffer, "whatsapp_voice.ogg");
          await whatsAppChannel.sendMessage(
            from,
            `📝 *Transcription OmniMind :*\n"${transcription.text}"\n\n⚡ *Statut :* Actions et rappels analysés.`
          );
        } catch (err) {
          console.error("WhatsApp transcription error:", err);
        }
      }

      return NextResponse.json({ status: "ok" });
    }

    // Message texte simple
    if (message.type === "text") {
      const text = message.text?.body || "";
      if (text.toLowerCase().includes("briefing") || text.toLowerCase().includes("résumé")) {
        await whatsAppChannel.sendMessage(from, "⏳ Préparation de votre briefing exécutif...");
      } else {
        await whatsAppChannel.sendMessage(
          from,
          `🤖 Message bien reçu : "${text}". L'agent OmniMind s'en occupe.`
        );
      }
      return NextResponse.json({ status: "ok" });
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook WhatsApp Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
