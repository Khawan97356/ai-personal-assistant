import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/store";
import { requireAuth } from "@/lib/auth/session";
import { prisma, isPrismaAvailable } from "@/lib/db/prisma";
import { ChannelType, UserPreferences } from "@/lib/agent/types";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;

  const userId = auth.session.user?.id;
  const currentSettings = db.settings.get(userId);

  // Si l'utilisateur est connecté et que son profil a un nom/email plus récent
  if (auth.session.user) {
    if (!currentSettings.userName || currentSettings.userName === "Thomas") {
      currentSettings.userName = auth.session.user.name;
    }
    if (!currentSettings.userEmail || currentSettings.userEmail === "thomas@example.com") {
      currentSettings.userEmail = auth.session.user.email;
    }
  }

  return NextResponse.json({
    success: true,
    settings: currentSettings,
  });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;

  const userId = auth.session.user?.id;

  try {
    const body = await req.json();
    const updates: Partial<UserPreferences> = {};

    if (body.userName !== undefined) updates.userName = String(body.userName).trim();
    if (body.userEmail !== undefined) updates.userEmail = String(body.userEmail).trim();
    if (body.userPhone !== undefined) updates.userPhone = String(body.userPhone).trim();
    if (body.telegramChatId !== undefined) updates.telegramChatId = String(body.telegramChatId).trim();

    // Normalisation du canal favori
    const rawChannel = body.preferredBriefingChannel || body.preferredChannel;
    if (rawChannel) {
      const channel = String(rawChannel).toLowerCase();
      if (["gmail", "whatsapp", "telegram", "outlook", "discord"].includes(channel)) {
        updates.preferredBriefingChannel = channel as ChannelType;
      }
    }

    if (body.morningBriefingTime !== undefined) {
      updates.morningBriefingTime = String(body.morningBriefingTime);
    }
    if (body.eveningBriefingTime !== undefined) {
      updates.eveningBriefingTime = String(body.eveningBriefingTime);
    }

    if (body.requireApprovalBeforeSending !== undefined) {
      updates.requireApprovalBeforeSending = Boolean(body.requireApprovalBeforeSending);
    } else if (body.requireApproval !== undefined) {
      updates.requireApprovalBeforeSending = Boolean(body.requireApproval);
    }

    // Normalisation des contacts VIP
    if (body.vipContacts !== undefined) {
      if (Array.isArray(body.vipContacts)) {
        updates.vipContacts = (body.vipContacts as unknown[]).map((c: unknown) => String(c).trim()).filter(Boolean);
      } else if (typeof body.vipContacts === "string") {
        updates.vipContacts = body.vipContacts
          .split(",")
          .map((c: string) => c.trim())
          .filter(Boolean);
      }
    } else if (body.vipEmails !== undefined) {
      updates.vipContacts = String(body.vipEmails)
        .split(",")
        .map((c: string) => c.trim())
        .filter(Boolean);
    }

    const updated = db.settings.update(updates, userId);

    // Synchronisation PostgreSQL / Prisma si configuré
    if (isPrismaAvailable() && userId) {
      try {
        await prisma.userPreferences.upsert({
          where: { userId },
          update: {
            userName: updated.userName,
            userEmail: updated.userEmail,
            userPhone: updated.userPhone || null,
            telegramChatId: updated.telegramChatId || null,
            preferredBriefingChannel: updated.preferredBriefingChannel,
            morningBriefingTime: updated.morningBriefingTime,
            eveningBriefingTime: updated.eveningBriefingTime,
            requireApprovalBeforeSending: updated.requireApprovalBeforeSending,
            vipContacts: updated.vipContacts,
          },
          create: {
            userId,
            userName: updated.userName,
            userEmail: updated.userEmail,
            userPhone: updated.userPhone || null,
            telegramChatId: updated.telegramChatId || null,
            preferredBriefingChannel: updated.preferredBriefingChannel,
            morningBriefingTime: updated.morningBriefingTime,
            eveningBriefingTime: updated.eveningBriefingTime,
            requireApprovalBeforeSending: updated.requireApprovalBeforeSending,
            vipContacts: updated.vipContacts,
          },
        });

        if (updates.userName) {
          await prisma.user.update({
            where: { id: userId },
            data: { name: updates.userName },
          }).catch(() => {});
        }
      } catch (prismaErr) {
        console.warn("[Settings] Sync Prisma échouée:", prismaErr);
      }
    }

    return NextResponse.json({
      success: true,
      settings: updated,
      message: "Préférences enregistrées avec succès.",
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Erreur mise à jour settings:", err);
    return NextResponse.json(
      { success: false, message: `Erreur lors de la sauvegarde : ${errorMsg}` },
      { status: 500 }
    );
  }
}
