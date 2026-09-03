import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/store";

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.cookies.get("omnimind_session")?.value;

    if (!sessionId) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const user = db.users.getById(sessionId);

    if (!user || !user.verified) {
      return NextResponse.json({ authenticated: false, user: null });
    }

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
