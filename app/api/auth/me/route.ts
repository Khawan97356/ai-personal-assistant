import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    const session = getAuthSession(req);

    if (!session.user || !session.user.verified) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const { user } = session;

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        verified: user.verified,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    console.error("Erreur me:", error);
    return NextResponse.json({ authenticated: false, user: null }, { status: 500 });
  }
}
