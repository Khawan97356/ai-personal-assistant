import { prisma, isPrismaAvailable } from "@/lib/db/prisma";
import { db } from "@/lib/db/store";
import { chainAuditLog, signPayload, verifySignature, type SignatureAlgo } from "./signatures";

export interface AuditWriteParams {
  userId?: string | null;
  actorKind: "user" | "system" | "autonomous" | "api_key" | "webhook" | "migration";
  actorId?: string;
  event: string;
  category: "auth" | "memory" | "autonomous" | "vault" | "permission" | "data_export" | "security" | "chat" | "channels" | "task";
  level?: "debug" | "info" | "warn" | "error" | "critical";
  summary: string;
  resourceType?: string; resourceId?: string;
  diffBefore?: unknown; diffAfter?: unknown; metadata?: Record<string, unknown>;
  ipAddress?: string; userAgent?: string; country?: string; requestId?: string; sessionId?: string;
  signAlgo?: SignatureAlgo; sign?: boolean;
}

interface AuditEntry {
  id: string; userId?: string | null; actorKind: AuditWriteParams["actorKind"]; actorId?: string | null;
  event: string; category: AuditWriteParams["category"]; level: NonNullable<AuditWriteParams["level"]>;
  summary: string; resourceType?: string | null; resourceId?: string | null;
  diffBefore?: unknown; diffAfter?: unknown; metadata?: unknown;
  ipAddress?: string | null; userAgent?: string | null; country?: string | null;
  requestId?: string | null; sessionId?: string | null;
  previousHash?: string | null; entryHash: string;
  signatureKind?: string | null; signature?: string | null;
  createdAt: string;
}

const KEY_AUDIT_JSON = "audit_log_v1";
const KEY_AUDIT_LAST_HASH = "audit_last_hash_v1";

function getJsonStore(userId?: string | null): { entries: AuditEntry[] } {
  const key = `${KEY_AUDIT_JSON}:${userId ?? "__system__"}`;
  try {
    const raw = (db as unknown as { get?: (k: string) => unknown }).get?.(key);
    if (raw && typeof raw === "object" && raw !== null && Array.isArray((raw as { entries?: unknown[] }).entries)) return raw as { entries: AuditEntry[] };
  } catch { /* ignore */ }
  return { entries: [] };
}
function setJsonStore(userId: string | null | undefined, shape: { entries: AuditEntry[] }) {
  const key = `${KEY_AUDIT_JSON}:${userId ?? "__system__"}`;
  try { (db as unknown as { set?: (k: string, v: unknown) => void }).set?.(key, { entries: shape.entries.slice(-5000) }); } catch { /* ignore */ }
}
function lastHashFor(userId: string | null | undefined): string | null {
  try { const k = `${KEY_AUDIT_LAST_HASH}:${userId ?? "__system__"}`; const v = (db as unknown as { get?: (k: string) => unknown }).get?.(k); return typeof v === "string" ? v : null; } catch { return null; }
}
function setLastHash(userId: string | null | undefined, hash: string) {
  try { const k = `${KEY_AUDIT_LAST_HASH}:${userId ?? "__system__"}`; (db as unknown as { set?: (k: string, v: unknown) => void }).set?.(k, hash); } catch { /* ignore */ }
}
function makeCuidLike(): string { return "audit_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

export class AuditLogger {
  async write(p: AuditWriteParams) {
    const id = makeCuidLike();
    const createdAt = new Date();
    const level = p.level ?? "info";
    const payloadCore = {
      id, userId: p.userId ?? null, actorKind: p.actorKind, actorId: p.actorId ?? null,
      event: p.event, category: p.category, level, summary: p.summary,
      resourceType: p.resourceType ?? null, resourceId: p.resourceId ?? null,
      diffBefore: p.diffBefore ?? null, diffAfter: p.diffAfter ?? null, metadata: p.metadata ?? null,
      ipAddress: p.ipAddress ?? null, userAgent: p.userAgent ?? null, country: p.country ?? null,
      requestId: p.requestId ?? null, sessionId: p.sessionId ?? null, createdAt: createdAt.toISOString(),
    };
    const previous = lastHashFor(p.userId);
    const { entryHash } = chainAuditLog({ entryHash: previous }, payloadCore);
    const entry: AuditEntry = { ...payloadCore, previousHash: previous, entryHash, createdAt: payloadCore.createdAt };
    const shouldSign = p.sign !== false && (p.sign || p.signAlgo || /^security|audit|vault|autonomous/.test(p.category));
    if (shouldSign) { const s = signPayload(entry, { algo: p.signAlgo }); entry.signatureKind = s.signatureKind; entry.signature = s.signature; }

    if (isPrismaAvailable()) try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "AuditLogEntry" (id, "userId", "actorKind", "actorId", event, category, level, summary, "resourceType", "resourceId", "diffBefore", "diffAfter", metadata, "ipAddress", "userAgent", country, "requestId", "sessionId", "previousHash", "entryHash", "signatureKind", signature, "createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23::timestamptz)`,
        id, payloadCore.userId, payloadCore.actorKind, payloadCore.actorId, payloadCore.event, payloadCore.category, level, payloadCore.summary,
        payloadCore.resourceType, payloadCore.resourceId, JSON.stringify(payloadCore.diffBefore), JSON.stringify(payloadCore.diffAfter), JSON.stringify(payloadCore.metadata),
        payloadCore.ipAddress, payloadCore.userAgent, payloadCore.country, payloadCore.requestId, payloadCore.sessionId,
        entry.previousHash ?? null, entryHash, entry.signatureKind ?? null, entry.signature ?? null, payloadCore.createdAt
      );
    } catch (err) { console.warn("[audit] prisma insert:", err); }

    const shape = getJsonStore(p.userId);
    shape.entries.push(entry);
    setJsonStore(p.userId, shape);
    setLastHash(p.userId, entryHash);
    return { id, entryHash, signature: entry.signature ?? undefined };
  }

  async verifyIntegrity(userId?: string) {
    const failures: Array<{ id: string; reason: string }> = [];
    let entries: AuditEntry[] = [];
    if (isPrismaAvailable()) try {
      const rows = await prisma.$queryRawUnsafe<AuditEntry[]>(
        `SELECT id, "userId" as userId, "actorKind" as actorKind, "actorId" as actorId, event, category, level, summary, "resourceType" as resourceType, "resourceId" as resourceId, "diffBefore" as diffBefore, "diffAfter" as diffAfter, metadata, "ipAddress" as ipAddress, "userAgent" as userAgent, country, "requestId" as requestId, "sessionId" as sessionId, "previousHash" as previousHash, "entryHash" as entryHash, "signatureKind" as signatureKind, signature, "createdAt" as createdAt FROM "AuditLogEntry" ${userId ? `WHERE "userId" = $1` : ""} ORDER BY "createdAt" ASC`,
        ...(userId ? [userId] : []) as never[]
      );
      entries = rows ?? [];
    } catch { /* fallback JSON */ }
    if (entries.length === 0) entries = getJsonStore(userId).entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    let previousValid: string | null = null;
    for (const e of entries) {
      if (e.previousHash && previousValid && e.previousHash !== previousValid) failures.push({ id: e.id, reason: `chaînage cassé (expected ${previousValid.slice(0,12)} got ${e.previousHash.slice(0,12)})` });
      const core = { id: e.id, userId: e.userId ?? null, actorKind: e.actorKind, actorId: e.actorId ?? null, event: e.event, category: e.category, level: e.level, summary: e.summary, resourceType: e.resourceType ?? null, resourceId: e.resourceId ?? null, diffBefore: e.diffBefore ?? null, diffAfter: e.diffAfter ?? null, metadata: e.metadata ?? null, ipAddress: e.ipAddress ?? null, userAgent: e.userAgent ?? null, country: e.country ?? null, requestId: e.requestId ?? null, sessionId: e.sessionId ?? null, createdAt: e.createdAt };
      const recomputed: string = chainAuditLog({ entryHash: e.previousHash ?? null }, core).entryHash;
      if (recomputed !== e.entryHash) failures.push({ id: e.id, reason: "entryHash mismatch" });
      if (e.signature && e.signatureKind) {
        const ok = verifySignature(e, e.signature, e.signatureKind as SignatureAlgo);
        if (!ok) failures.push({ id: e.id, reason: "signature invalide" });
      }
      previousValid = e.entryHash;
    }
    return { valid: failures.length === 0, failures };
  }
}

export const auditLogger = new AuditLogger();