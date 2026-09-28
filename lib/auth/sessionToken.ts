import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "omnimind_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 jours

let devWarningLogged = false;

function getSecret(): string {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.SECURITY_SIGNING_KEY ||
    process.env.SECURITY_MASTER_KEY;

  if (secret && secret.length >= 32) {
    return secret;
  }

  // En environnement de développement local, tolérer un secret de repli pour ne pas bloquer les tests
  if (process.env.NODE_ENV !== "production") {
    if (!devWarningLogged) {
      console.warn(
        "[sessionToken] SESSION_SECRET non configuré ou trop court. Utilisation d'une clé de repli de développement."
      );
      devWarningLogged = true;
    }
    return "omnimind_dev_session_secret_at_least_32_characters_long";
  }

  throw new Error("SESSION_SECRET manquant ou trop court (32 caractères minimum requis en production).");
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

/** Crée un jeton "payload.signature" contenant l'ID utilisateur et une date d'expiration. */
export function createSessionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Retourne l'ID utilisateur si le jeton est authentique et non expiré, sinon null. */
export function verifySessionToken(token: string): string | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;

  let expectedSignature: string;
  try {
    expectedSignature = sign(payload);
  } catch {
    return null;
  }

  const expectedBuf = Buffer.from(expectedSignature, "utf8");
  const receivedBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== receivedBuf.length || !timingSafeEqual(expectedBuf, receivedBuf)) {
    return null;
  }

  try {
    const jsonStr = Buffer.from(payload, "base64url").toString("utf8");
    const { sub, exp } = JSON.parse(jsonStr);
    if (typeof sub !== "string" || typeof exp !== "number") return null;
    if (exp < Date.now() / 1000) return null;
    return sub;
  } catch {
    return null;
  }
}