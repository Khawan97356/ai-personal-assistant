import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/store";
import { SensitiveVault } from "@/lib/security/vault";

const vault = new SensitiveVault();

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider");
  const origin = req.nextUrl.origin || "http://localhost:3000";
  const redirectUri = `${origin}/dashboard?tab=accounts`;

  if (provider === "google") {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        {
          error: "GOOGLE_CLIENT_ID non configuré. Veuillez renseigner GOOGLE_CLIENT_ID dans vos variables d'environnement.",
        },
        { status: 400 }
      );
    }

    const scopes = [
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" ");

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", `google_${auth.session.user?.id}`);

    return NextResponse.json({ success: true, url: url.toString() });
  }

  if (provider === "microsoft") {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        {
          error: "MICROSOFT_CLIENT_ID non configuré. Veuillez renseigner MICROSOFT_CLIENT_ID dans vos variables d'environnement.",
        },
        { status: 400 }
      );
    }

    const scopes = ["offline_access", "Mail.ReadWrite", "Calendars.ReadWrite", "User.Read"].join(" ");

    const url = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("scope", scopes);
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", `microsoft_${auth.session.user?.id}`);

    return NextResponse.json({ success: true, url: url.toString() });
  }

  return NextResponse.json(
    { error: "Fournisseur non supporté. Choisissez 'google' ou 'microsoft'." },
    { status: 400 }
  );
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;

  const userId = auth.session.user?.id || "usr_dev_admin";

  try {
    const body = await req.json();
    const { provider, code, redirectUri } = body;

    if (!provider || !code) {
      return NextResponse.json(
        { error: "Paramètres 'provider' et 'code' requis." },
        { status: 400 }
      );
    }

    const origin = req.nextUrl.origin || "http://localhost:3000";
    const callbackUri = redirectUri || `${origin}/dashboard?tab=accounts`;

    let connectedEmail = "";
    let refreshToken = "";

    if (provider === "google") {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return NextResponse.json(
          { error: "Configuration OAuth Google incomplète (GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET manquant)." },
          { status: 500 }
        );
      }

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: callbackUri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        return NextResponse.json(
          { error: tokenData.error_description || "Échec de l'échange de token avec Google." },
          { status: 400 }
        );
      }

      refreshToken = tokenData.refresh_token;

      // Récupération de l'email
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userInfoRes.ok) {
        const userInfo = await userInfoRes.json();
        connectedEmail = userInfo.email || "";
      }

      // Mise à jour du compte Gmail
      if (connectedEmail) {
        db.accounts.updateIdentifier("gmail", connectedEmail, userId);
      }
      db.accounts.setStatus("gmail", "connected", userId);

      // Stockage sécurisé du refresh_token dans le coffre-fort
      if (refreshToken) {
        await vault.create({
          userId,
          category: "api_key",
          label: "Google Workspace Refresh Token",
          plaintext: refreshToken,
          allowedActionKeys: ["gmail", "calendar"],
        });
      }

      return NextResponse.json({
        success: true,
        provider: "google",
        email: connectedEmail,
        message: "Compte Gmail & Google Workspace connecté avec succès !",
      });
    }

    if (provider === "microsoft") {
      const clientId = process.env.MICROSOFT_CLIENT_ID;
      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return NextResponse.json(
          { error: "Configuration OAuth Microsoft incomplète (MICROSOFT_CLIENT_ID ou MICROSOFT_CLIENT_SECRET manquant)." },
          { status: 500 }
        );
      }

      const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: callbackUri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        return NextResponse.json(
          { error: tokenData.error_description || "Échec de l'échange de token avec Microsoft." },
          { status: 400 }
        );
      }

      refreshToken = tokenData.refresh_token;

      // Récupération du profil
      const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        connectedEmail = profile.mail || profile.userPrincipalName || "";
      }

      // Mise à jour du compte Outlook
      if (connectedEmail) {
        db.accounts.updateIdentifier("outlook", connectedEmail, userId);
      }
      db.accounts.setStatus("outlook", "connected", userId);

      // Stockage sécurisé du refresh_token dans le coffre-fort
      if (refreshToken) {
        await vault.create({
          userId,
          category: "api_key",
          label: "Microsoft 365 Refresh Token",
          plaintext: refreshToken,
          allowedActionKeys: ["outlook"],
        });
      }

      return NextResponse.json({
        success: true,
        provider: "microsoft",
        email: connectedEmail,
        message: "Compte Outlook / Microsoft 365 connecté avec succès !",
      });
    }

    return NextResponse.json({ error: "Fournisseur non reconnu." }, { status: 400 });
  } catch (err) {
    console.error("[OAuth POST] Erreur:", err);
    return NextResponse.json({ error: "Erreur technique lors de la connexion OAuth." }, { status: 500 });
  }
}
