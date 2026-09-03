import { NextRequest, NextResponse } from "next/server";
import { db, UserRecord } from "@/lib/db/store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, code, token } = body;

    let user: UserRecord | undefined;

    if (token && typeof token === "string") {
      user = db.users.getByToken(token);
    } else if (email && code) {
      user = db.users.getByCode(String(email), String(code));
    }

    if (!user) {
      return NextResponse.json(
        { error: "Code de vérification ou lien invalide. Veuillez vérifier vos informations." },
        { status: 400 }
      );
    }

    // Vérifier l'expiration
    if (user.tokenExpiresAt && new Date(user.tokenExpiresAt) < new Date()) {
      return NextResponse.json(
        { error: "Ce code ou lien d'accès a expiré. Veuillez demander un nouvel email de confirmation." },
        { status: 400 }
      );
    }

    // Activer l'utilisateur
    const verifiedUser = db.users.verifyUser(user.id);
    if (!verifiedUser) {
      return NextResponse.json(
        { error: "Impossible de valider le compte." },
        { status: 500 }
      );
    }

    // Créer la réponse et configurer le cookie de session
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

    // Cookie de session persistant 30 jours
    res.cookies.set("omnimind_session", verifiedUser.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 jours
      path: "/",
    });

    return res;
  } catch (error) {
    console.error("Erreur verify:", error);
    return NextResponse.json(
      { error: "Erreur technique lors de la confirmation d'accès." },
      { status: 500 }
    );
  }
}
