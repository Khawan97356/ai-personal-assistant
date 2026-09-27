import { NextRequest, NextResponse } from "next/server";
import { omniAgent } from "@/lib/agent/core";
import { IncomingMessage } from "@/lib/agent/types";
import { requireAuth } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const customMessages: IncomingMessage[] =
      body.messages && Array.isArray(body.messages) && body.messages.length > 0
        ? body.messages
        : await omniAgent.collectRecentMessages();

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
