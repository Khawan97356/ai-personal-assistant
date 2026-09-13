import { NextRequest, NextResponse } from "next/server";
import { omniAgent } from "@/lib/agent/core";
import { db } from "@/lib/db/store";
import { requireAuth } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;

  const userId = auth.session.user?.id;
  const actions = db.actions.getAll(userId);
  return NextResponse.json({
    total: actions.length,
    actions,
  });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json();
    const { actionId, decision } = body;
    const userId = auth.session.user?.id;

    if (!actionId || !decision) {
      return NextResponse.json(
        { error: "actionId et decision ('approve' | 'reject') requis." },
        { status: 400 }
      );
    }

    if (decision === "approve") {
      const result = await omniAgent.executeAction(actionId);
      return NextResponse.json(result);
    } else {
      db.actions.updateStatus(actionId, "rejected", userId);
      return NextResponse.json({
        success: true,
        message: "Action rejetée avec succès.",
      });
    }
  } catch (error) {
    console.error("Action approval error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
