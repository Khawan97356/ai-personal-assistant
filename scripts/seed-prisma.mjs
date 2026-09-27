/**
 * Script de migration et d'initialisation de la base PostgreSQL / pgvector pour OmniMind.
 * Lit les données de .data/db.json et les injecte dans PostgreSQL via Prisma.
 * Usage: node scripts/seed-prisma.mjs
 */

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

// Lecture de .env.local si existant
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

if (!process.env.DATABASE_URL) {
  console.error("❌ ERREUR: DATABASE_URL n'est pas configuré dans votre environnement ou .env.local.");
  console.log("Exemple: DATABASE_URL=\"postgresql://postgres:password@localhost:5432/omnimind?schema=public\"");
  process.exit(1);
}

const prisma = new PrismaClient();
const DB_FILE = path.join(process.cwd(), ".data", "db.json");

async function main() {
  console.log("🚀 Démarrage de la migration vers PostgreSQL & pgvector...\n");

  // 1. Activation de l'extension pgvector
  try {
    await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS vector;");
    console.log("✅ Extension pgvector vérifiée et active dans PostgreSQL.");
  } catch (err) {
    console.warn("⚠️ Avertissement lors de la création de l'extension vector (droits admin requis) :", err.message);
  }

  // 2. Lecture du fichier source db.json
  if (!fs.existsSync(DB_FILE)) {
    console.log("ℹ️ Aucun fichier .data/db.json trouvé, rien à migrer.");
    return;
  }

  const raw = fs.readFileSync(DB_FILE, "utf-8");
  const data = JSON.parse(raw);

  // 3. Migration des utilisateurs
  const users = data.users || [];
  console.log(`\n📦 Migration de ${users.length} utilisateur(s)...`);
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        verified: u.verified,
        lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt) : null,
      },
      create: {
        id: u.id,
        email: u.email,
        name: u.name,
        verified: u.verified,
        createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
        lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt) : null,
      },
    });
    console.log(`  • Utilisateur synchronisé : ${u.name} (${u.email})`);
  }

  // S'assurer qu'un utilisateur dev_admin existe pour les données orphelines
  const adminUser = await prisma.user.upsert({
    where: { email: data.settings?.userEmail || "willis.palmot@gmail.com" },
    update: { name: data.settings?.userName || "Khawan" },
    create: {
      id: "usr_dev_admin",
      email: data.settings?.userEmail || "willis.palmot@gmail.com",
      name: data.settings?.userName || "Khawan",
      verified: true,
    },
  });

  const defaultUserId = adminUser.id;

  // 4. Migration des Préférences
  if (data.settings) {
    console.log("\n⚙️ Migration des préférences utilisateur...");
    await prisma.userPreferences.upsert({
      where: { userId: defaultUserId },
      update: {
        userName: data.settings.userName || "Khawan",
        userEmail: data.settings.userEmail || "",
        userPhone: data.settings.userPhone || null,
        telegramChatId: data.settings.telegramChatId || null,
        preferredBriefingChannel: data.settings.preferredBriefingChannel || "telegram",
        morningBriefingTime: data.settings.morningBriefingTime || "08:00",
        eveningBriefingTime: data.settings.eveningBriefingTime || "19:00",
        requireApprovalBeforeSending: data.settings.requireApprovalBeforeSending ?? true,
        vipContacts: data.settings.vipContacts || [],
      },
      create: {
        userId: defaultUserId,
        userName: data.settings.userName || "Khawan",
        userEmail: data.settings.userEmail || "",
        userPhone: data.settings.userPhone || null,
        telegramChatId: data.settings.telegramChatId || null,
        preferredBriefingChannel: data.settings.preferredBriefingChannel || "telegram",
        morningBriefingTime: data.settings.morningBriefingTime || "08:00",
        eveningBriefingTime: data.settings.eveningBriefingTime || "19:00",
        requireApprovalBeforeSending: data.settings.requireApprovalBeforeSending ?? true,
        vipContacts: data.settings.vipContacts || [],
      },
    });
    console.log("  • Préférences enregistrées avec succès.");
  }

  // 5. Migration des Comptes Connectés
  const accounts = data.accounts || [];
  console.log(`\n🔗 Migration de ${accounts.length} compte(s) connecté(s)...`);
  for (const acc of accounts) {
    await prisma.connectedAccount.upsert({
      where: {
        id_userId: {
          id: acc.id,
          userId: defaultUserId,
        },
      },
      update: {
        name: acc.name,
        status: acc.status,
        identifier: acc.identifier,
        unreadCount: acc.unreadCount,
      },
      create: {
        id: acc.id,
        userId: defaultUserId,
        name: acc.name,
        channel: acc.channel,
        type: acc.type,
        status: acc.status,
        identifier: acc.identifier,
        unreadCount: acc.unreadCount,
        iconColor: acc.iconColor,
        bgColor: acc.bgColor,
      },
    });
    console.log(`  • Compte synchronisé : ${acc.name} (${acc.status})`);
  }

  // 6. Migration des Actions
  const actions = data.actions || [];
  console.log(`\n⚡ Migration de ${actions.length} action(s)...`);
  for (const act of actions) {
    const actUserId = act.userId || defaultUserId;
    await prisma.actionProposal.upsert({
      where: { id: act.id },
      update: {
        status: act.status,
      },
      create: {
        id: act.id,
        userId: actUserId,
        type: act.type,
        channel: act.channel,
        title: act.title,
        description: act.description,
        status: act.status,
        payload: act.payload || {},
        createdAt: act.createdAt ? new Date(act.createdAt) : new Date(),
      },
    });
  }
  console.log(`  • ${actions.length} action(s) injectée(s).`);

  // 7. Migration des Souvenirs & Faits (UserMemory)
  const memories = data.memories || [];
  console.log(`\n🧠 Migration de ${memories.length} souvenir(s) / contrainte(s)...`);
  for (const mem of memories) {
    const memUserId = mem.userId || defaultUserId;
    await prisma.userMemory.upsert({
      where: { id: mem.id },
      update: {
        fact: mem.fact,
        category: mem.category,
      },
      create: {
        id: mem.id,
        userId: memUserId,
        fact: mem.fact,
        category: mem.category,
        createdAt: mem.createdAt ? new Date(mem.createdAt) : new Date(),
      },
    });
    console.log(`  • Mémoire : [${mem.category}] "${mem.fact}"`);
  }

  console.log("\n🎉 Migration PostgreSQL & Prisma complétée avec succès !");
}

main()
  .catch((e) => {
    console.error("❌ Erreur pendant la migration :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
