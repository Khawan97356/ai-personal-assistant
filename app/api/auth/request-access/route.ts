import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db/store";
import { sendVerificationEmail } from "@/lib/email/sender";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Veuillez renseigner une adresse email valide." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const displayName = (name && typeof name === "string" ? name.trim() : "") || normalizedEmail.split("@")[0];

    // Générer un token sécurisé et un code à 6 chiffres
    const verificationToken = crypto.randomBytes(24).toString("hex");
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    // Enregistrer ou mettre à jour dans la base
    const user = db.users.createOrUpdateVerification(
      normalizedEmail,
      displayName,
      verificationToken,
      verificationCode,
      expiresAt
    );

    // Déterminer l'URL de base pour le lien magique
    const origin = req.nextUrl.origin || "http://localhost:3000";

    // Expédier l'email de confirmation
    const emailResult = await sendVerificationEmail({
      toEmail: normalizedEmail,
      userName: user.name,
      verificationCode,
      verificationToken,
      baseUrl: origin,
    });

    const isDev = process.env.NODE_ENV !== "production";

    return NextResponse.json({
      success: true,
      message: `Un email de confirmation a été envoyé à ${normalizedEmail}.`,
      email: normalizedEmail,
      name: user.name,
      // Fourni uniquement en environnement de développement local
      ...(isDev
        ? {
            devCode: emailResult.verificationCode,
            devMagicLink: emailResult.magicLink,
            method: emailResult.method,
          }
        : {}),
    });
  } catch (error) {
    console.error("Erreur request-access:", error);
    return NextResponse.json(
      { error: "Erreur technique lors de la création de la demande d'accès." },
      { status: 500 }
    );
  }
}
