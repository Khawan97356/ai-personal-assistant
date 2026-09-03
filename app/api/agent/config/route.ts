import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const ENV_LOCAL_PATH = path.join(process.cwd(), ".env.local");

// Lit les variables de .env.local ou process.env
function readEnvConfig(): Record<string, string> {
  const config: Record<string, string> = {};
  if (fs.existsSync(ENV_LOCAL_PATH)) {
    const lines = fs.readFileSync(ENV_LOCAL_PATH, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [key, ...rest] = trimmed.split("=");
        config[key.trim()] = rest.join("=").trim();
      }
    }
  }
  return config;
}

// Masque une clé sensible
function mask(value?: string): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.substring(0, 4)}••••${value.substring(value.length - 4)}`;
}

export async function GET() {
  const env = readEnvConfig();

  return NextResponse.json({
    telegram: {
      isConfigured: Boolean(env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN),
      maskedToken: mask(env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN),
      chatId: env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "",
    },
    gemini: {
      isConfigured: Boolean(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY),
      maskedKey: mask(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY),
    },
    openai: {
      isConfigured: Boolean(env.OPENAI_API_KEY || process.env.OPENAI_API_KEY),
      maskedKey: mask(env.OPENAI_API_KEY || process.env.OPENAI_API_KEY),
    },
    groq: {
      isConfigured: Boolean(env.GROQ_API_KEY || process.env.GROQ_API_KEY),
      maskedKey: mask(env.GROQ_API_KEY || process.env.GROQ_API_KEY),
    },
    whatsapp: {
      isConfigured: Boolean(
        (env.WHATSAPP_API_TOKEN || process.env.WHATSAPP_API_TOKEN) &&
        (env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID)
      ),
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || "",
      userPhone: env.WHATSAPP_USER_PHONE || process.env.WHATSAPP_USER_PHONE || "",
    },
    discord: {
      isConfigured: Boolean(env.DISCORD_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL),
      maskedWebhook: mask(env.DISCORD_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL),
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const current = readEnvConfig();

    // Met à jour les valeurs fournies
    const allowedKeys = [
      "TELEGRAM_BOT_TOKEN",
      "TELEGRAM_CHAT_ID",
      "GEMINI_API_KEY",
      "OPENAI_API_KEY",
      "GROQ_API_KEY",
      "WHATSAPP_API_TOKEN",
      "WHATSAPP_PHONE_NUMBER_ID",
      "WHATSAPP_VERIFY_TOKEN",
      "WHATSAPP_USER_PHONE",
      "DISCORD_WEBHOOK_URL",
    ];

    for (const key of allowedKeys) {
      if (body[key] !== undefined && body[key] !== "") {
        current[key] = String(body[key]).trim();
        process.env[key] = current[key];
      }
    }

    // Réécrit .env.local
    const lines = Object.entries(current).map(([k, v]) => `${k}=${v}`);
    fs.writeFileSync(ENV_LOCAL_PATH, lines.join("\n") + "\n", "utf-8");

    return NextResponse.json({
      success: true,
      message: "Variables d'environnement enregistrées dans .env.local avec succès !",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Config save error:", err);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
