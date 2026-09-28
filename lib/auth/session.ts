import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db, UserRecord } from "@/lib/db/store";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  verifySessionToken,
} from "./sessionToken";

export { SESSION_COOKIE, SESSION_TTL_SECONDS };

export interface AuthSession {
  user: UserRecord | null;
  isServiceRole: boolean;
}

/** Comparaison à temps constant (on hache d'abord pour égaliser les longueurs). */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function hasValidServiceToken(req: NextRequest): boolean {
  const header = req.headers.get("authorization");
  if (!header || !/^Bearer\s+/i.test(header)) return false;

  const token = header.replace(/^Bearer\s+/i, "").trim();
  // On accepte l'un ou l'autre secret (Vercel Cron utilise CRON_SECRET, les scripts AGENT_SECRET).
  const secrets = [process.env.CRON_SECRET, process.env.AGENT_SECRET].filter(
    (s): s is string => Boolean(s)
  );
  return secrets.some((secret) => safeEqual(token, secret));
}

/**
 * Vérifie l'authentification d'une requête API :
 * 1. Jeton de service (Authorization: Bearer <CRON_SECRET | AGENT_SECRET>)
 * 2. Cookie de session signé et non expiré (HMAC-SHA256)
 * 3. Mode dev local tolérant si aucun utilisateur n'est encore vérifié ou si ALLOW_DEV_AUTH=true
 */
export function getAuthSession(req: NextRequest): AuthSession {
  if (hasValidServiceToken(req)) {
    return { user: null, isServiceRole: true };
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (cookie) {
    const userId = verifySessionToken(cookie);
    if (userId) {
      const user = db.users.getById(userId);
      if (user && user.verified) {
        return { user, isServiceRole: false };
      }
    }
  }

  // En environnement de développement local : fallback pour tester immédiatement l'interface
  if (process.env.NODE_ENV === "development") {
    const allUsers = db.users.getAll();
    const verifiedUsers = allUsers.filter((u) => u.verified);
    if (verifiedUsers.length === 0 || process.env.ALLOW_DEV_AUTH === "true") {
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
  }

  return { user: null, isServiceRole: false };
}

/** Garde d'authentification synchrone pour routes API privées. */
export function requireAuth(
  req: NextRequest
):
  | { session: AuthSession; errorResponse?: never }
  | { session?: never; errorResponse: NextResponse } {
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

/** À appeler dans la route de login/magic link une fois l'utilisateur vérifié. */
export function setSessionCookie(res: NextResponse, userId: string): void {
  res.cookies.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** À appeler dans la route de déconnexion. */
export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}