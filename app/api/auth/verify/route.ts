import { NextRequest, NextResponse } from "next/server";
import { db, UserRecord } from "@/lib/db/store";
import { setSessionCookie } from "@/lib/auth/session";

const MAX_CODE_ATTEMPTS = 5;
const CODE_PATTERN = /^\d{6}$/;
const TOKEN_MAX_LENGTH = 256;

const INVALID = "Code de vérification ou lien invalide. Veuillez vérifier vos informations.";
const EXPIRED =
  "Ce code ou lien d'accès a expiré. Veuillez demander un nouvel email de confirmation.";

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return fail("Requête invalide.");
    }
    if (!body || typeof body !== "object") return fail("Requête invalide.");

    const { email, code, token } = body;
    let user: UserRecord | undefined;

    if (typeof token === "string" && token.length > 0 && token.length <= TOKEN_MAX_LENGTH) {
      // Lien magique : jeton aléatoire à forte entropie
      user = db.users.getByToken(token);
    } else if (typeof email === "string" && typeof code === "string") {
      // Code PIN à 6 chiffres : limitation des tentatives par compte
      const normalizedEmail = email.trim().toLowerCase();
      if (!CODE_PATTERN.test(code.trim())) return fail(INVALID);

      const account = db.users.getByEmail(normalizedEmail);
      if (account && (account.codeAttempts ?? 0) >= MAX_CODE_ATTEMPTS) {
        return fail("Trop de tentatives infructueuses. Veuillez demander un nouveau code.", 429);
      }

      user = db.users.getByCode(normalizedEmail, code.trim());
      if (!user) {
        if (account) db.users.incrementCodeAttempts(account.id);
        return fail(INVALID);
      }
    }

    if (!user) return fail(INVALID);

    // Fail-closed : une date d'expiration absente est traitée comme expirée
    if (!user.tokenExpiresAt || new Date(user.tokenExpiresAt) < new Date()) {
      return fail(EXPIRED);
    }

    // Activer l'utilisateur et réinitialiser les codes à usage unique
    const verifiedUser = db.users.verifyUser(user.id);
    if (!verifiedUser) {
      return fail("Impossible de valider le compte.", 500);
    }

    const res = NextResponse.json({
      success: true,
      message: `Compte confirmé avec succès ! Bienvenue ${verifiedUser.name}.`,
      user: {
        id: verifiedUser.id,
        email: verifiedUser.email,
        name: verifiedUser.name,
        verified: true,
      },
    });

    setSessionCookie(res, verifiedUser.id);
    return res;
  } catch (error) {
    console.error("Erreur verify:", error);
    return fail("Erreur technique lors de la confirmation d'accès.", 500);
  }
}