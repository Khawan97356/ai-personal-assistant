import fs from "fs";
import path from "path";

export interface VerificationEmailPayload {
  toEmail: string;
  userName: string;
  verificationCode: string;
  verificationToken: string;
  baseUrl: string;
}

export interface SendEmailResult {
  success: boolean;
  method: "resend" | "simulation";
  magicLink: string;
  verificationCode: string;
  message: string;
}

const EMAILS_LOG_FILE = path.join(process.cwd(), ".data", "sent_emails.json");

/**
 * Envoie un email de confirmation pour activer le compte et l'assistant personnel
 */
export async function sendVerificationEmail(
  payload: VerificationEmailPayload
): Promise<SendEmailResult> {
  const { toEmail, userName, verificationCode, verificationToken, baseUrl } = payload;
  const magicLink = `${baseUrl}/auth/verify?token=${verificationToken}&email=${encodeURIComponent(toEmail)}`;

  const subject = "🔐 Confirmez votre accès à votre assistant exécutif OmniMind";

  const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Accès OmniMind</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090a0f; color: #f4f4f5; margin: 0; padding: 40px 20px; }
    .container { max-width: 560px; margin: 0 auto; background: #12131a; border: 1px solid #27272a; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .header { padding: 32px 32px 24px; text-align: center; background: linear-gradient(135deg, rgba(79, 70, 229, 0.15), rgba(168, 85, 247, 0.1)); border-bottom: 1px solid #27272a; }
    .logo { display: inline-block; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
    .logo-badge { background: rgba(99, 102, 241, 0.2); color: #818cf8; font-size: 11px; padding: 3px 8px; border-radius: 9999px; margin-left: 8px; font-weight: 600; border: 1px solid rgba(99,102,241,0.3); }
    .content { padding: 32px; }
    h1 { font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 12px; }
    p { font-size: 14px; line-height: 1.6; color: #a1a1aa; margin-bottom: 24px; }
    .code-box { background: #18181b; border: 1px solid #3f3f46; border-radius: 14px; padding: 20px; text-align: center; margin: 24px 0; }
    .code-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #a1a1aa; margin-bottom: 8px; font-weight: 600; }
    .code-digits { font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #818cf8; font-family: monospace; }
    .btn { display: inline-block; width: 100%; box-sizing: border-box; text-align: center; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 14px 24px; border-radius: 12px; margin-top: 8px; margin-bottom: 24px; }
    .footer { padding: 24px 32px; border-top: 1px solid #27272a; text-align: center; font-size: 12px; color: #71717a; background: #0e0f14; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        OmniMind <span class="logo-badge">AGENT EXÉCUTIF</span>
      </div>
    </div>
    <div class="content">
      <h1>Bonjour ${userName} 👋</h1>
      <p>
        Vous avez demandé à connecter votre compte pour activer votre assistant personnel <strong>OmniMind</strong>.
        Pour finaliser la création de votre espace sécurisé en temps réel, veuillez confirmer votre accès.
      </p>

      <a href="${magicLink}" class="btn">
        🚀 Confirmer et Ouvrir mon Assistant en 1 Clic
      </a>

      <div class="code-box">
        <div class="code-title">Ou utilisez ce code de confirmation à 6 chiffres :</div>
        <div class="code-digits">${verificationCode}</div>
      </div>

      <p style="font-size: 12px; color: #71717a; margin-bottom: 0;">
        Ce lien et ce code sont valables pendant 15 minutes. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.
      </p>
    </div>
    <div class="footer">
      OmniMind AI Assistant • Vos données sont chiffrées de bout en bout • Zero-Knowledge
    </div>
  </div>
</body>
</html>
`;

  // 1. Tenter d'envoyer via Resend si configuré
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "OmniMind <onboarding@resend.dev>",
          to: [toEmail],
          subject,
          html: htmlContent,
        }),
      });

      if (res.ok) {
        console.log(`[Email] Email envoyé avec succès via Resend à ${toEmail}`);
        return {
          success: true,
          method: "resend",
          magicLink,
          verificationCode,
          message: `Email de confirmation envoyé à ${toEmail}`,
        };
      } else {
        const err = await res.text();
        console.warn("[Email] Échec Resend API, repli en mode simulation:", err);
      }
    } catch (err) {
      console.warn("[Email] Erreur réseau Resend:", err);
    }
  }

  // 2. Mode développement / simulation sécurisée (enregistre l'email pour aperçu direct)
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      to: toEmail,
      userName,
      code: verificationCode,
      magicLink,
      subject,
    };

    let existingLogs = [];
    if (fs.existsSync(EMAILS_LOG_FILE)) {
      try {
        existingLogs = JSON.parse(fs.readFileSync(EMAILS_LOG_FILE, "utf-8"));
      } catch {
        existingLogs = [];
      }
    }
    existingLogs.unshift(logEntry);
    fs.writeFileSync(EMAILS_LOG_FILE, JSON.stringify(existingLogs.slice(0, 20), null, 2), "utf-8");
  } catch (err) {
    console.error("Erreur enregistrement log email:", err);
  }

  console.log(`\n======================================================`);
  console.log(`📨 [SIMULATION EMAIL] Confirmation pour ${userName} (${toEmail})`);
  console.log(`🔑 Code à 6 chiffres : ${verificationCode}`);
  console.log(`🔗 Lien Magique : ${magicLink}`);
  console.log(`======================================================\n`);

  return {
    success: true,
    method: "simulation",
    magicLink,
    verificationCode,
    message: `Email préparé pour ${toEmail}. Vous pouvez utiliser le code ${verificationCode} ou le lien magique.`,
  };
}
