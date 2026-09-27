import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getMemoryEngine } from "@/lib/agent/memoryEngine";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "list";
    const query = searchParams.get("q") || "";
    const topK = Math.min(20, parseInt(searchParams.get("limit") || "10", 10));
    const userId = auth.session.user?.id || "usr_dev_admin";
    const engine = getMemoryEngine(userId);

    // GET /api/agent/memory?action=list → tous les souvenirs
    if (action === "list") {
      const all = await engine.getAllAsUserMemory();
      return NextResponse.json({
        success: true,
        total: all.length,
        memories: all.slice(0, topK * 5),
      });
    }

    // GET /api/agent/memory?action=ask&q=... → recherche hybride
    if (action === "ask" && query) {
      const recalled = await engine.ask(query, {
        topK,
        minSimilarity: 0.6,
        includeChunks: true,
        hybridAlpha: 0.8,
      });
      return NextResponse.json({
        success: true,
        query,
        results: recalled.map((r) => ({
          id: r.id,
          type: r.type,
          content: r.content,
          similarity: r.similarity,
          createdAt: r.createdAt,
          metadata: r.metadata || {},
        })),
      });
    }

    // GET /api/agent/memory?action=recent → derniers souvenirs
    if (action === "recent") {
      const recent = await engine.getRecent(topK);
      return NextResponse.json({
        success: true,
        memories: recent.map((m) => ({
          id: m.id,
          type: m.type,
          content: m.content,
          createdAt: m.createdAt,
          metadata: m.metadata || {},
        })),
      });
    }

    // GET /api/agent/memory?action=stats → statistiques
    if (action === "stats") {
      const all = await engine.getAll();
      const byType: Record<string, number> = {};
      for (const m of all) {
        byType[m.type] = (byType[m.type] || 0) + 1;
      }
      return NextResponse.json({
        success: true,
        totalMemories: all.length,
        byType,
        userId,
      });
    }

    return NextResponse.json(
      { error: "Action invalide. Utilisez action=list|ask|recent|stats." },
      { status: 400 }
    );
  } catch (err) {
    console.error("Memory GET error:", err);
    return NextResponse.json(
      { error: "Erreur lecture mémoire.", details: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json();
    const action = body.action || "remember";
    const userId = auth.session.user?.id || "usr_dev_admin";
    const engine = getMemoryEngine(userId);

    // POST { action: "remember", type, content, metadata }
    if (action === "remember") {
      const { type, content, metadata } = body;
      if (!content || !type) {
        return NextResponse.json(
          { error: "Champs 'type' et 'content' requis." },
          { status: 400 }
        );
      }
      const mem = await engine.rememberFact(type, content, metadata);
      return NextResponse.json({ success: true, memory: mem });
    }

    // POST { action: "learn", text, options }
    if (action === "learn") {
      const { text, options } = body;
      if (!text) {
        return NextResponse.json({ error: "'text' requis." }, { status: 400 });
      }
      const mem = await engine.learn(text, options || {});
      return NextResponse.json({
        success: true,
        learned: mem !== null,
        memory: mem,
      });
    }

    // POST { action: "chunk", source, content, sourceRef }
    if (action === "chunk") {
      const { source, content, sourceRef } = body;
      if (!source || !content) {
        return NextResponse.json(
          { error: "'source' et 'content' requis." },
          { status: 400 }
        );
      }
      const chunk = await engine.indexChunk({ source, content, sourceRef });
      return NextResponse.json({ success: true, chunk });
    }

    // POST { action: "consolidate", similarityThreshold }
    if (action === "consolidate") {
      const result = await engine.consolidate({
        similarityThreshold: body.similarityThreshold,
      });
      return NextResponse.json({ success: true, consolidation: result });
    }

    return NextResponse.json(
      { error: "Action invalide. Utilisez remember|learn|chunk|consolidate." },
      { status: 400 }
    );
  } catch (err) {
    console.error("Memory POST error:", err);
    return NextResponse.json(
      { error: "Erreur écriture mémoire.", details: String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json(
        { error: "Identifiant 'id' du souvenir requis." },
        { status: 400 }
      );
    }
    const userId = auth.session.user?.id || "usr_dev_admin";
    const engine = getMemoryEngine(userId);
    await engine.forget(id);
    return NextResponse.json({ success: true, deletedId: id });
  } catch (err) {
    console.error("Memory DELETE error:", err);
    return NextResponse.json(
      { error: "Erreur suppression mémoire.", details: String(err) },
      { status: 500 }
    );
  }
}
