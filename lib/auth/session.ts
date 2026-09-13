import { NextRequest, NextResponse } from "next/server";
import { db, UserRecord } from "@/lib/db/store";

export interface AuthSession {
  user: UserRecord | null;
  isServiceRole: boolean;
}

/**
 * Vérifie l'authentification d'une requête API :
 * 1. Clé secrète Cron / Service (Authorization: Bearer <token>)
 * 2. Cookie de session utilisateur (omnimind_session)
 * 3. En environnement de développement local, tolérance d'initialisation si aucun utilisateur n'est encore configuré.
 */
export function getAuthSession(req: NextRequest): AuthSession {
  // 1. Vérifier le jeton de service (Bearer CRON_SECRET ou AGENT_SECRET)
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const serviceSecret = process.env.CRON_SECRET || process.env.AGENT_SECRET;
    if (serviceSecret && token === serviceSecret) {
      return { user: null, isServiceRole: true };
    }
  }

  // 2. Vérifier le cookie de session utilisateur
  const sessionId = req.cookies.get("omnimind_session")?.value;
  if (sessionId) {
    const user = db.users.getById(sessionId);
    if (user && user.verified) {
      return { user, isServiceRole: false };
    }
  }

  // 3. Mode dev fallback : si aucun utilisateur vérifié n'existe encore en base locale
  const allUsers = db.users.getAll();
  const verifiedUsers = allUsers.filter((u) => u.verified);
  if (process.env.NODE_ENV === "development" && verifiedUsers.length === 0) {
    return {
      user: {
        id: "usr_dev_admin",
        email: "dev@localhost",
        name: "Dev Admin",
        verified: true,
        createdAt: new Date().toISOString(),
      },
      isServiceRole: false,
    };
  }

  return { user: null, isServiceRole: false };
}

/**
 * Garde d'authentification pour routes API privées
 */
export function requireAuth(req: NextRequest): { session: AuthSession; errorResponse?: never } | { session?: never; errorResponse: NextResponse } {
  const session = getAuthSession(req);
  if (!session.user && !session.isServiceRole) {
    return {
      errorResponse: NextResponse.json(
        { error: "Accès refusé. Veuillez vous connecter." },
        { status: 401 }
      ),
    };
  }
  return { session };
}
