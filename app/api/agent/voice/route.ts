import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getVoiceEngine, VoiceEngine } from "@/lib/agent/voice/voiceEngine";
import type { VoiceMood } from "@/lib/agent/voice/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "personas";
  const text = searchParams.get("text") || "";
  const mood = (searchParams.get("mood") || undefined) as VoiceMood | undefined;
  const personaId = searchParams.get("persona") || undefined;
  const userId = auth.session.user?.id || "usr_dev_admin";
  const engine = getVoiceEngine(userId, personaId);
  try {
    if (action === "personas") return NextResponse.json({ success: true, personas: VoiceEngine.listPersonas(), current: engine.getPersona() });
    if (action === "prepare") {
      if (!text) return NextResponse.json({ error: "'text' requis" }, { status: 400 });
      return NextResponse.json({ success: true, prepared: engine.prepare(text, mood) });
    }
    if (action === "client-hints") {
      if (!text) return NextResponse.json({ error: "'text' requis" }, { status: 400 });
      return NextResponse.json({ success: true, hints: engine.speakClientHints(text, { mood }) });
    }
    if (action === "infer-mood") return NextResponse.json({ success: true, mood: VoiceEngine.inferMood(text) });
    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (err) {
    console.error("[voice/GET] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  const userId = auth.session.user?.id || "usr_dev_admin";
  const ct = req.headers.get("content-type") || "";

  if (ct.includes("multipart/form-data")) {
    try {
      const form = await req.formData();
      const file = form.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "fichier audio 'file' requis" }, { status: 400 });
      const personaId = (form.get("persona") as string) || undefined;
      const engine = getVoiceEngine(userId, personaId);
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await engine.transcribeUser(buffer, file.name);
      return NextResponse.json({ success: true, ...result });
    } catch (err) {
      console.error("[voice/transcribe] error:", err);
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  try {
    const body = await req.json();
    const action: string = body.action || "speak";
    const personaId: string | undefined = body.persona;
    const engine = getVoiceEngine(userId, personaId);

    if (action === "processUserSay") {
      const raw = String(body.text || "");
      return NextResponse.json({ success: true, processed: engine.processUserSay(raw) });
    }
    if (action === "prepare") {
      const text = String(body.text || "");
      const mood = (body.mood as VoiceMood) || undefined;
      return NextResponse.json({ success: true, prepared: engine.prepare(text, mood) });
    }
    if (action === "speak") {
      const text = String(body.text || "");
      const opts = body.options || {};
      const result = await engine.speakServer(text, opts);
      if (result.backend === "browser" || !result.audio || typeof result.audio === "string") {
        return NextResponse.json({
          success: true,
          audio: null,
          backend: "browser",
          preprocessed: result.preprocessed,
          clientHints: engine.speakClientHints(text, opts),
          fromCache: result.fromCache,
        });
      }
      const ext = result.format === "audio/ogg" ? "ogg" : result.format === "audio/wav" ? "wav" : "mp3";
      const disposition = `attachment; filename="voice-${result.hash}.${ext}"`;
      const headers = new Headers();
      headers.set("Content-Type", result.format);
      headers.set("Content-Length", String(Buffer.isBuffer(result.audio) ? result.audio.length : 0));
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      headers.set("ETag", `"${result.hash}"`);
      headers.set("Content-Disposition", disposition);
      headers.set("X-Voice-Backend", result.backend);
      headers.set("X-Voice-Cache", result.fromCache ? "HIT" : "MISS");
      headers.set("X-Voice-Mood", result.preprocessed.mood);
      headers.set(
        "X-Voice-Meta",
        encodeURIComponent(JSON.stringify({
          rate: result.preprocessed.rate,
          pitch: result.preprocessed.pitch,
          mood: result.preprocessed.mood,
          breathGroups: result.preprocessed.breathGroups.length,
          hash: result.hash,
        }))
      );
      const audioBuffer = Buffer.isBuffer(result.audio) ? result.audio : Buffer.alloc(0);
      return new NextResponse(new Uint8Array(audioBuffer), { status: 200, headers });
    }
    return NextResponse.json({ error: "Action inconnue. Utilisez speak | transcribe | processUserSay | prepare." }, { status: 400 });
  } catch (err) {
    console.error("[voice/POST] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}