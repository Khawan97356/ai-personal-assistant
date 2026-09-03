import { NextRequest, NextResponse } from "next/server";
import { omniAgent } from "@/lib/agent/core";
import { db } from "@/lib/db/store";

export async function GET() {
  const actions = db.actions.getAll();
  return NextResponse.json({
    total: actions.length,
    actions,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { actionId, decision } = body;

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
      db.actions.updateStatus(actionId, "rejected");
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
