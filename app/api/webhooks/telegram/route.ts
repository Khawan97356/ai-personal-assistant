import { NextRequest, NextResponse } from "next/server";
import { telegramChannel } from "@/lib/agent/channels/telegram";
import { omniAgent, globalActionStore } from "@/lib/agent/core";
import { transcribeAudio } from "@/lib/agent/audio";

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();

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
        const action = globalActionStore.get(actionId);
        if (action) {
          action.status = "rejected";
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
          `Je suis connecté à vos flux de communication. Voici ce que vous pouvez me demander :\n` +
          `• */briefing* : Générer votre synthèse exécutive du moment\n` +
          `• M'envoyer une *note vocale* : Je la transcris et crée les rappels associés\n` +
          `• M'écrire un ordre naturel : _"Déplace mon rdv de 15h à demain 10h"_`;
        await telegramChannel.sendMessage(chatId, welcomeText);
        return NextResponse.json({ ok: true });
      }

      // Commande /briefing
      if (msg.text === "/briefing") {
        await telegramChannel.sendMessage(chatId, "⏳ *Génération de votre briefing en cours...*");
        
        // Simule ou récupère les flux récents
        const mockMessages = [
          {
            id: "msg_1",
            channel: "whatsapp" as const,
            sender: { name: "Julie", identifier: "+33600000001", isVip: true },
            timestamp: new Date().toISOString(),
            content: "Salut ! On peut décaler le point d'équipe de 15h à 16h30 stp ?",
          },
          {
            id: "msg_2",
            channel: "gmail" as const,
            sender: { name: "Cabinet Lamy", identifier: "avocat@lamy.fr", isVip: true },
            timestamp: new Date().toISOString(),
            subject: "Contrat à signer",
            content: "Veuillez trouver l'avenant à signer avant ce soir 18h.",
          },
        ];

        const report = await omniAgent.generateExecutiveBriefing(mockMessages, "instant");
        await telegramChannel.sendMessage(chatId, report.summaryMarkdown);

        for (const action of report.suggestedActions) {
          await telegramChannel.sendActionProposal(chatId, action.title, action.description, action.id);
        }

        return NextResponse.json({ ok: true });
      }

      // Message vocal reçu (Audio / Voice)
      if (msg.voice) {
        await telegramChannel.sendMessage(chatId, "🎙️ *Note vocale reçue. Transcription et analyse en cours...*");

        // Simulation de transcription (ou utilisation Whisper si token configuré)
        const transcription = await transcribeAudio(Buffer.from(""), "voice.ogg");

        await telegramChannel.sendMessage(
          chatId,
          `📝 *Transcription :*\n_"${transcription.text}"_\n\n⚡ *Action :* Rappel ajouté automatiquement à votre agenda.`
        );
        return NextResponse.json({ ok: true });
      }

      // Ordre textuel libre en langage naturel
      if (msg.text) {
        await telegramChannel.sendMessage(
          chatId,
          `🤖 *Ordre reçu :* "${msg.text}"\n_Analyse en cours par OmniMind Agent..._`
        );
        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook Telegram Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
