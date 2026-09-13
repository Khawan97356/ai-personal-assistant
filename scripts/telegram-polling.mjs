/**
 * Script de développement local pour Telegram Bot (Long-Polling)
 * Permet de tester le bot en local sans avoir besoin de tunnel public ngrok / webhook HTTPS.
 * Usage: node scripts/telegram-polling.mjs
 */

import fs from "fs";
import path from "path";

// Lecture manuelle de .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [k, ...rest] = trimmed.split("=");
      if (!process.env[k.trim()]) {
        process.env[k.trim()] = rest.join("=").trim();
      }
    }
  }
}

const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
  console.log("ℹ️ TELEGRAM_BOT_TOKEN non configuré dans .env.local. Ajoutez votre token Telegram pour lancer l'écoute.");
  process.exit(0);
}

const baseUrl = `https://api.telegram.org/bot${botToken}`;

async function main() {
  console.log("🤖 OmniMind — Démarrage du mode Long Polling Telegram pour le développement...");

  // 1. Supprimer le webhook existant pour réactiver getUpdates
  try {
    const delRes = await fetch(`${baseUrl}/deleteWebhook?drop_pending_updates=false`);
    const delData = await delRes.json();
    if (delData.ok) {
      console.log("✅ Webhook Telegram désactivé avec succès. Prêt pour le polling local.");
    }
  } catch (err) {
    console.warn("⚠️ Attention lors de la suppression du webhook:", err);
  }

  // 2. Vérifier l'identité du bot
  try {
    const meRes = await fetch(`${baseUrl}/getMe`);
    const meData = await meRes.json();
    if (meData.ok) {
      console.log(`🤖 Bot actif : @${meData.result.username} (${meData.result.first_name})`);
      console.log("📡 Écoute des messages en temps réel... (Ctrl+C pour quitter)\n");
    }
  } catch (err) {
    console.error("❌ Erreur connexion Telegram:", err);
    process.exit(1);
  }

  let offset = 0;

  // 3. Boucle de polling
  while (true) {
    try {
      const pollRes = await fetch(`${baseUrl}/getUpdates?offset=${offset}&timeout=20`);
      if (!pollRes.ok) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      const pollData = await pollRes.json();
      if (pollData.ok && Array.isArray(pollData.result)) {
        for (const update of pollData.result) {
          offset = update.update_id + 1;
          console.log(`📩 [Update #${update.update_id}] Reçu`);

          // Transmettre à la route webhook locale
          try {
            const webhookRes = await fetch("http://localhost:3000/api/webhooks/telegram", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(process.env.TELEGRAM_WEBHOOK_SECRET
                  ? { "x-telegram-bot-api-secret-token": process.env.TELEGRAM_WEBHOOK_SECRET }
                  : {}),
              },
              body: JSON.stringify(update),
            });
            const resData = await webhookRes.json().catch(() => ({}));
            console.log("⚡ Traité par webhook local :", resData);
          } catch {
            console.warn("Serveur local Next.js (port 3000) non joignable. Assurez-vous que 'npm run dev' est lancé.");
          }
        }
      }
    } catch (err) {
      console.error("Erreur cycle polling Telegram:", err);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

main().catch((err) => {
  console.error("Fatal polling error:", err);
  process.exit(1);
});
