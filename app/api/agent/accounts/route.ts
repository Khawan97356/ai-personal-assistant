import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/store";
import { requireAuth } from "@/lib/auth/session";
import { prisma, isPrismaAvailable } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;

  const userId = auth.session.user?.id;
  const accounts = db.accounts.getAll(userId);

  return NextResponse.json({
    success: true,
    accounts,
  });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;

  const userId = auth.session.user?.id;

  try {
    const body = await req.json();
    const { accountId, action = "toggle", identifier } = body;

    if (!accountId) {
      return NextResponse.json(
        { success: false, message: "accountId requis" },
        { status: 400 }
      );
    }

    let updatedAccount = null;

    if (action === "update" && identifier) {
      updatedAccount = db.accounts.updateIdentifier(accountId, identifier, userId);
    } else {
      updatedAccount = db.accounts.toggleStatus(accountId, userId);
    }

    if (!updatedAccount) {
      return NextResponse.json(
        { success: false, message: "Compte introuvable" },
        { status: 404 }
      );
    }

    // Synchronisation PostgreSQL / Prisma si configuré
    if (isPrismaAvailable() && userId) {
      try {
        await prisma.connectedAccount.upsert({
          where: {
            id_userId: {
              id: updatedAccount.id,
              userId,
            },
          },
          update: {
            status: updatedAccount.status,
            identifier: updatedAccount.identifier,
            unreadCount: updatedAccount.unreadCount,
          },
          create: {
            id: updatedAccount.id,
            userId,
            name: updatedAccount.name,
            channel: updatedAccount.channel,
            type: updatedAccount.type,
            status: updatedAccount.status,
            identifier: updatedAccount.identifier,
            unreadCount: updatedAccount.unreadCount,
            iconColor: updatedAccount.iconColor,
            bgColor: updatedAccount.bgColor,
          },
        });
      } catch (prismaErr) {
        console.warn("[Accounts] Sync Prisma échouée:", prismaErr);
      }
    }

    return NextResponse.json({
      success: true,
      account: updatedAccount,
      accounts: db.accounts.getAll(userId),
      message: `Compte ${updatedAccount.name} ${
        updatedAccount.status === "connected" ? "activé" : "désactivé"
      } avec succès.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Erreur action account:", err);
    return NextResponse.json(
      { success: false, message: `Erreur : ${errorMsg}` },
      { status: 500 }
    );
  }
}
