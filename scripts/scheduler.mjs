/**
 * Planificateur de briefings et synchronisations automatiques pour OmniMind.
 * Exécute les tâches Cron en continu pour serveurs autonomes, conteneurs Docker ou dev local.
 * Usage: node scripts/scheduler.mjs
 */

import cron from "node-cron";
import fs from "fs";
import path from "path";

// Lecture de .env.local
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

const SERVER_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET || process.env.AGENT_SECRET;

async function triggerBriefing(period = "morning") {
  console.log(`⏰ [Scheduler] Déclenchement automatique du Briefing (${period})...`);
  try {
    const res = await fetch(`${SERVER_URL}/api/agent/briefing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(CRON_SECRET ? { Authorization: `Bearer ${CRON_SECRET}` } : {}),
      },
      body: JSON.stringify({ period, dispatch: true }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      console.log(`✅ [Scheduler] Briefing ${period} généré et expédié avec succès !`);
    } else {
      console.warn(`⚠️ [Scheduler] Réponse du briefing :`, data);
    }
  } catch (err) {
    console.error(`❌ [Scheduler] Erreur lors de l'appel au serveur Next.js :`, err.message);
  }
}

console.log("⏱️ OmniMind Scheduler démarré avec succès !");
console.log("📅 Tâches planifiées actives :");
console.log("  • 08:00 (Tous les jours) : Briefing Matinal & Synthèse des Urgences");
console.log("  • 19:00 (Tous les jours) : Briefing du Soir & Bilan des Décisions");
console.log("En attente des prochains créneaux...\n");

// 1. Briefing matinal à 08h00 du lundi au dimanche
cron.schedule("0 8 * * *", () => {
  triggerBriefing("morning");
});

// 2. Briefing du soir à 19h00 du lundi au dimanche
cron.schedule("0 19 * * *", () => {
  triggerBriefing("evening");
});
