import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json();
    const { service, credentials } = body;

    if (!service || !credentials) {
      return NextResponse.json(
        { success: false, message: "Service et identifiants requis." },
        { status: 400 }
      );
    }

    // 1. Test Telegram Bot
    if (service === "telegram") {
      const token = credentials.token || process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        return NextResponse.json({
          success: false,
          message: "Token Telegram non renseigné.",
        });
      }

      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const data = await res.json();
        if (data.ok && data.result) {
          return NextResponse.json({
            success: true,
            message: `Bot connecté avec succès : @${data.result.username} (${data.result.first_name})`,
            details: {
              botUsername: data.result.username,
              botName: data.result.first_name,
            },
          });
        } else {
          return NextResponse.json({
            success: false,
            message: `Erreur Telegram : ${data.description || "Token invalide."}`,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({
          success: false,
          message: `Échec de connexion aux serveurs Telegram : ${msg}`,
        });
      }
    }

    // 2. Test Discord Webhook
    if (service === "discord") {
      const webhookUrl = credentials.webhookUrl || process.env.DISCORD_WEBHOOK_URL;
      if (!webhookUrl || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
        return NextResponse.json({
          success: false,
          message: "URL de Webhook Discord invalide (doit débuter par https://discord.com/api/webhooks/).",
        });
      }

      try {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "OmniMind AI Assistant",
            content: "🟢 **Test de Connexion Réussi !** Votre Webhook Discord est opérationnel.",
          }),
        });

        if (res.ok || res.status === 204) {
          return NextResponse.json({
            success: true,
            message: "Message de test envoyé avec succès sur votre salon Discord !",
          });
        } else {
          return NextResponse.json({
            success: false,
            message: `Erreur Discord (${res.status}) : Impossible d'envoyer le message de test.`,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({
          success: false,
          message: `Échec d'envoi Discord : ${msg}`,
        });
      }
    }

    // 3. Test OpenAI API Key
    if (service === "openai") {
      const apiKey = credentials.apiKey || process.env.OPENAI_API_KEY;
      if (!apiKey || !apiKey.startsWith("sk-")) {
        return NextResponse.json({
          success: false,
          message: "Clé API OpenAI invalide (doit débuter par sk-).",
        });
      }

      try {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) {
          return NextResponse.json({
            success: true,
            message: "Clé OpenAI validée avec succès ! Modèles GPT & Whisper disponibles.",
          });
        } else {
          const data = await res.json().catch(() => ({}));
          return NextResponse.json({
            success: false,
            message: `OpenAI : ${data.error?.message || "Clé refusée ou expirée."}`,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({
          success: false,
          message: `Échec de connexion à OpenAI : ${msg}`,
        });
      }
    }

    // 4. Test Groq API Key
    if (service === "groq") {
      const apiKey = credentials.apiKey || process.env.GROQ_API_KEY;
      if (!apiKey || !apiKey.startsWith("gsk_")) {
        return NextResponse.json({
          success: false,
          message: "Clé API Groq invalide (doit débuter par gsk_).",
        });
      }

      try {
        const res = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) {
          return NextResponse.json({
            success: true,
            message: "Clé Groq validée avec succès ! Whisper Large v3 Turbo ultra-rapide actif.",
          });
        } else {
          return NextResponse.json({
            success: false,
            message: "Clé Groq non reconnue ou expirée.",
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({
          success: false,
          message: `Échec de connexion à Groq : ${msg}`,
        });
      }
    }

    // 5. Test WhatsApp
    if (service === "whatsapp") {
      const token = credentials.token || process.env.WHATSAPP_API_TOKEN;
      const phoneId = credentials.phoneId || process.env.WHATSAPP_PHONE_NUMBER_ID;

      if (!token || !phoneId) {
        return NextResponse.json({
          success: false,
          message: "Jeton API et Phone Number ID requis pour WhatsApp Cloud.",
        });
      }

      try {
        const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          return NextResponse.json({
            success: true,
            message: `Numéro WhatsApp Cloud vérifié : ${data.display_phone_number || data.id}`,
          });
        } else {
          return NextResponse.json({
            success: false,
            message: `Meta API : ${data.error?.message || "Identifiants refusés."}`,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({
          success: false,
          message: `Échec de validation Meta : ${msg}`,
        });
      }
    }

    return NextResponse.json({
      success: false,
      message: `Service "${service}" non pris en charge.`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Test connection error:", error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
