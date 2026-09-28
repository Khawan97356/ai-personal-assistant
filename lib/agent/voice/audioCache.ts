import type { TTSAudioResult } from "./types";
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";

class LRU<K, V> {
  private map = new Map<K, { v: V; used: number }>();
  constructor(private max: number) {}
  get(k: K): V | undefined {
    const e = this.map.get(k);
    if (!e) return undefined;
    e.used = Date.now();
    return e.v;
  }
  set(k: K, v: V) {
    this.map.set(k, { v, used: Date.now() });
    if (this.map.size > this.max) {
      const oldest = [...this.map.entries()].sort((a, b) => a[1].used - b[1].used)[0];
      if (oldest) this.map.delete(oldest[0]);
    }
  }
}

const memCache = new LRU<string, TTSAudioResult & { userId?: string }>(400);

function cacheRootDir(): string {
  const base = process.env.VOICE_CACHE_DIR
    ? path.resolve(process.env.VOICE_CACHE_DIR)
    : path.resolve(process.cwd(), ".data", "voice-cache");
  try { fs.mkdirSync(base, { recursive: true }); } catch { /* ignore */ }
  return base;
}

function cacheKey(opts: {
  text: string; mood?: string; rate?: number; pitch?: number; backend?: string; personaId?: string; format?: string;
}): string {
  return createHash("sha256").update(JSON.stringify(opts)).digest("hex").substring(0, 16);
}

function filePath(userId: string, hash: string, ext: string): string {
  const dir = path.join(cacheRootDir(), userId || "public");
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
  return path.join(dir, `${hash}.${ext}`);
}

const EXT_BY_FORMAT: Record<string, string> = { "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/wav": "wav", "audio/mp4": "m4a" };

export function getCachedAudio(
  options: Parameters<typeof cacheKey>[0] & { userId?: string }
): TTSAudioResult | null {
  const hash = cacheKey(options);
  const userId = options.userId ?? "public";
  const fromMem = memCache.get(hash + userId);
  if (fromMem) return fromMem;
  const ext = EXT_BY_FORMAT[options.format ?? "audio/mpeg"] ?? "mp3";
  const fp = filePath(userId, hash, ext);
  try {
    if (fs.existsSync(fp)) {
      const audio = fs.readFileSync(fp);
      const metaPath = fp + ".meta.json";
      let backend: TTSAudioResult["backend"] = "openai";
      let fmt: TTSAudioResult["format"] = (options.format as TTSAudioResult["format"]) ?? "audio/mpeg";
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
          backend = meta.backend;
          fmt = meta.format;
        } catch { /* ignore */ }
      }
      const result: TTSAudioResult = { audio, format: fmt, backend, hash };
      memCache.set(hash + userId, { ...result, userId });
      return result;
    }
  } catch { /* ignore */ }
  return null;
}

export function putCachedAudio(
  options: Parameters<typeof cacheKey>[0] & { userId?: string },
  result: TTSAudioResult
): void {
  const hash = cacheKey(options);
  const userId = options.userId ?? "public";
  memCache.set(hash + userId, { ...result, userId });
  try {
    const ext = EXT_BY_FORMAT[result.format] ?? "mp3";
    const fp = filePath(userId, hash, ext);
    if (typeof result.audio === "string") return;
    fs.writeFileSync(fp, result.audio);
    try {
      fs.writeFileSync(
        fp + ".meta.json",
        JSON.stringify({
          backend: result.backend,
          format: result.format,
          durationSeconds: result.durationSeconds,
          createdAt: Date.now(),
          textSnippet: (options.text || "").substring(0, 80),
        })
      );
    } catch { /* ignore */ }
  } catch (err) {
    console.warn("[voice-cache] put failed:", err);
  }
}

export const VoiceCache = { key: cacheKey, get: getCachedAudio, put: putCachedAudio };