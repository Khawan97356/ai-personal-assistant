import { NextRequest, NextResponse } from "next/server";
import { processVoiceAgentConversation } from "@/lib/agent/chat";
import { requireAuth } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json();
    const { message, history } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Le paramètre 'message' est requis." },
        { status: 400 }
      );
    }

    const result = await processVoiceAgentConversation(message, history || []);

    return NextResponse.json({
      success: true,
      thought: result.thought,
      spokenResponse: result.spokenResponse,
      executedAction: result.executedAction,
      suggestedActionId: result.suggestedActionId,
    });
  } catch (error) {
    console.error("Erreur API Chat Agent:", error);
    return NextResponse.json(
      { error: "Erreur lors du traitement de la requête vocale." },
      { status: 500 }
    );
  }
}
