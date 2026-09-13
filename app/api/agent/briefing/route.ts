import { NextRequest, NextResponse } from "next/server";
import { omniAgent } from "@/lib/agent/core";
import { IncomingMessage } from "@/lib/agent/types";
import { requireAuth } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const customMessages: IncomingMessage[] = body.messages || [
      {
        id: "m1",
        channel: "gmail",
        sender: { name: "Client Horizon", identifier: "direction@horizon.io", isVip: true },
        timestamp: new Date().toISOString(),
        subject: "Contrat SaaS & Planning",
        content: "Nous avons validé les termes. Merci d'envoyer le bon de commande signé avant demain midi.",
      },
      {
        id: "m2",
        channel: "whatsapp",
        sender: { name: "Sarah Tech Lead", identifier: "+33612345678", isVip: true },
        timestamp: new Date().toISOString(),
        content: "Point d'équipe déplacé à 16h30 au lieu de 15h. J'ai prévenu les développeurs.",
      },
      {
        id: "m3",
        channel: "telegram",
        sender: { name: "Bot Infra Alert", identifier: "@infra_bot" },
        timestamp: new Date().toISOString(),
        content: "Serveurs de production v2.4 stables. Aucune erreur 500 détectée.",
      },
    ];

    const period = body.period || "morning";
    const report = await omniAgent.generateExecutiveBriefing(customMessages, period);

    // Optionnellement expédie le briefing vers Telegram ou WhatsApp si demandé
    const shouldDispatch = body.dispatch ?? true;
    let dispatched = false;
    if (shouldDispatch) {
      dispatched = await omniAgent.dispatchBriefing(report);
    }

    return NextResponse.json({
      success: true,
      report,
      dispatched,
    });
  } catch (error) {
    console.error("Agent briefing route error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Prise en charge des appels Cron GET
  return POST(req);
}
