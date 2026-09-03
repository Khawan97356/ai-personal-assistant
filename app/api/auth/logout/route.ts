import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ success: true, message: "Déconnexion réussie." });
  res.cookies.set("omnimind_session", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
  return res;
}
