import { prisma, isPrismaAvailable } from "@/lib/db/prisma";
import { db } from "@/lib/db/store";
import { generateDataKey, wrapDataKey, unwrapDataKey, encryptString, decryptString, blindChecksum } from "./encryption";
import { requirePermission } from "./permissions";
import { auditLogger } from "./audit";

const KEY_VAULT_JSON = "sensitive_vault_v1";

export interface VaultCreateParams {
  userId: string;
  category: "password"|"api_key"|"bank"|"id_card"|"address"|"contact"|"health"|"other";
  label: string; plaintext: string; allowedActionKeys?: string[]; expiresAt?: Date;
  metadata?: Record<string, unknown>; grantor?: string; requestId?: string; ipAddress?: string;
}
export interface VaultReadOptions { actorUserId: string; actionKey?: string; requestId?: string; ipAddress?: string; }
interface VaultRow { id: string; label: string; category: string; createdAt: string; rotationEpoch: number; ciphertext: string; nonce: string; wrappedDataKey: string; encryptionAlgo: string; checksum: string; allowedActionKeys: string[]; }

export class SensitiveVault {
  async create(p: VaultCreateParams): Promise<{ id: string }> {
    await requirePermission({ userId: p.userId, scope: "vault:write" });
    const dek = generateDataKey();
    const enc = encryptString(p.userId, p.plaintext, dek);
    const wrapped = wrapDataKey(p.userId, dek);
    const id = "vault_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const row = {
      id, userId: p.userId, category: p.category, label: p.label, encryptionAlgo: enc.algo, keyDerivation: "HKDF-SHA256",
      wrappedDataKey: wrapped, ciphertext: enc.ciphertext, nonce: enc.nonce, checksum: blindChecksum(p.plaintext),
      rotationEpoch: 1, lastRotatedAt: new Date().toISOString(),
      allowedActionKeys: JSON.stringify(p.allowedActionKeys ?? ["*"]),
      expiresAt: p.expiresAt ? p.expiresAt.toISOString() : null,
      metadata: JSON.stringify(p.metadata ?? {}),
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    if (isPrismaAvailable()) try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "SensitiveDataVaultItem" (id, "userId", category, label, "encryptionAlgo", "keyDerivation", "wrappedDataKey", ciphertext, nonce, checksum, "rotationEpoch", "lastRotatedAt", "allowedActionKeys", "expiresAt", metadata, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::timestamptz,$13::jsonb,$14::timestamptz,$15::jsonb,$16::timestamptz,$17::timestamptz)`,
        id, p.userId, p.category, p.label, row.encryptionAlgo, row.keyDerivation, row.wrappedDataKey, row.ciphertext, row.nonce, row.checksum, row.rotationEpoch, row.lastRotatedAt, row.allowedActionKeys, row.expiresAt, row.metadata, row.createdAt, row.updatedAt
      );
    } catch (err) { console.warn("[vault] prisma create:", err); }
    try {
      const key = `${KEY_VAULT_JSON}:${p.userId}`;
      const raw = (db as unknown as { get?: (k: string) => unknown }).get?.(key);
      const list = Array.isArray(raw) ? raw : []; list.push(row);
      (db as unknown as { set?: (k: string, v: unknown) => void }).set?.(key, list);
    } catch { /* ignore */ }
    await auditLogger.write({ userId: p.userId, actorKind: "user", actorId: p.grantor, event: "vault.created", category: "vault", level: "info", summary: `Vault item créé: ${p.label} (${p.category})`, resourceType: "SensitiveDataVaultItem", resourceId: id, metadata: { category: p.category, label: p.label }, requestId: p.requestId, ipAddress: p.ipAddress });
    return { id };
  }

  async read(id: string, opts: VaultReadOptions) {
    await requirePermission({ userId: opts.actorUserId, scope: "vault:read" });
    const item = (await this.listByUser(opts.actorUserId)).find((r) => r.id === id) ?? null;
    if (!item) return null;
    if (opts.actionKey) {
      if (!item.allowedActionKeys.includes("*") && !item.allowedActionKeys.includes(opts.actionKey)) {
        await auditLogger.write({ userId: opts.actorUserId, actorKind: "autonomous", actorId: opts.actionKey, event: "vault.access_denied_scope", category: "security", level: "warn", summary: `Accès vault refusé: item ${id} hors scope pour ${opts.actionKey}`, resourceType: "SensitiveDataVaultItem", resourceId: id, requestId: opts.requestId, ipAddress: opts.ipAddress, sign: true });
        return null;
      }
    }
    try {
      const dek = unwrapDataKey(opts.actorUserId, item.wrappedDataKey);
      const res = decryptString(opts.actorUserId, dek, { ciphertext: item.ciphertext, nonce: item.nonce, algo: item.encryptionAlgo, checksum: item.checksum });
      if (!res.checksumValid) {
        await auditLogger.write({ userId: opts.actorUserId, actorKind: "user", event: "vault.checksum_mismatch", category: "security", level: "critical", summary: `Checksum invalide vault ${id}`, resourceType: "SensitiveDataVaultItem", resourceId: id, sign: true, requestId: opts.requestId, ipAddress: opts.ipAddress });
        return null;
      }
      await auditLogger.write({ userId: opts.actorUserId, actorKind: opts.actionKey ? "autonomous" : "user", actorId: opts.actionKey ?? opts.actorUserId, event: "vault.read", category: "vault", level: "debug", summary: `Lecture vault item: ${item.label}`, resourceType: "SensitiveDataVaultItem", resourceId: id, requestId: opts.requestId, ipAddress: opts.ipAddress });
      return { plaintext: res.plaintext, label: item.label, category: item.category };
    } catch (err) {
      await auditLogger.write({ userId: opts.actorUserId, actorKind: "user", event: "vault.decrypt_failed", category: "security", level: "error", summary: `Déchiffrement échoué vault ${id}: ${err instanceof Error ? err.message : String(err)}`, resourceType: "SensitiveDataVaultItem", resourceId: id, sign: true, requestId: opts.requestId, ipAddress: opts.ipAddress });
      return null;
    }
  }

  async listLabels(userId: string) {
    await requirePermission({ userId, scope: "vault:read" });
    return (await this.listByUser(userId)).map((r) => ({ id: r.id, label: r.label, category: r.category, createdAt: r.createdAt, rotationEpoch: r.rotationEpoch }));
  }

  async rotateKey(id: string, actorUserId: string): Promise<boolean> {
    await requirePermission({ userId: actorUserId, scope: "vault:write" });
    const item = (await this.listByUser(actorUserId)).find((r) => r.id === id);
    if (!item) return false;
    const dekOld = unwrapDataKey(actorUserId, item.wrappedDataKey);
    const { plaintext } = decryptString(actorUserId, dekOld, { ciphertext: item.ciphertext, nonce: item.nonce, algo: item.encryptionAlgo, checksum: item.checksum });
    const dekNew = generateDataKey();
    const enc = encryptString(actorUserId, plaintext, dekNew);
    const wrapped = wrapDataKey(actorUserId, dekNew);
    const rotationEpoch = (item.rotationEpoch || 1) + 1;
    const updatedAt = new Date().toISOString();
    if (isPrismaAvailable()) try {
      await prisma.$executeRawUnsafe(`UPDATE "SensitiveDataVaultItem" SET "wrappedDataKey" = $1, ciphertext = $2, nonce = $3, checksum = $4, "rotationEpoch" = $5, "lastRotatedAt" = $6::timestamptz, "updatedAt" = $7::timestamptz WHERE id = $8 AND "userId" = $9`, wrapped, enc.ciphertext, enc.nonce, enc.checksum, rotationEpoch, updatedAt, updatedAt, id, actorUserId);
    } catch (err) { console.warn("[vault] prisma rotate:", err); }
    try {
      const k = `${KEY_VAULT_JSON}:${actorUserId}`;
      const raw = (db as unknown as { get?: (k: string) => unknown }).get?.(k) as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(raw)) {
        const i = raw.findIndex((r) => String(r.id) === String(id));
        if (i >= 0) { raw[i] = { ...raw[i], wrappedDataKey: wrapped, ciphertext: enc.ciphertext, nonce: enc.nonce, checksum: enc.checksum, rotationEpoch, lastRotatedAt: updatedAt, updatedAt }; (db as unknown as { set?: (k: string, v: unknown) => void }).set?.(k, raw); }
      }
    } catch { /* ignore */ }
    await auditLogger.write({ userId: actorUserId, actorKind: "user", event: "vault.key_rotated", category: "security", level: "warn", summary: `Rotation clef vault ${id} (epoch ${rotationEpoch})`, resourceType: "SensitiveDataVaultItem", resourceId: id, sign: true });
    return true;
  }

  async delete(id: string, actorUserId: string): Promise<boolean> {
    await requirePermission({ userId: actorUserId, scope: "vault:write" });
    if (isPrismaAvailable()) try { await prisma.$executeRawUnsafe(`DELETE FROM "SensitiveDataVaultItem" WHERE id = $1 AND "userId" = $2`, id, actorUserId); } catch (err) { console.warn("[vault] prisma delete:", err); }
    try {
      const k = `${KEY_VAULT_JSON}:${actorUserId}`;
      const raw = (db as unknown as { get?: (k: string) => unknown }).get?.(k) as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(raw)) (db as unknown as { set?: (k: string, v: unknown) => void }).set?.(k, raw.filter((r) => String(r.id) !== String(id)));
    } catch { /* ignore */ }
    await auditLogger.write({ userId: actorUserId, actorKind: "user", event: "vault.deleted", category: "vault", level: "warn", summary: `Suppression vault item ${id}`, resourceType: "SensitiveDataVaultItem", resourceId: id, sign: true });
    return true;
  }

  private async listByUser(userId: string): Promise<VaultRow[]> {
    const out: VaultRow[] = [];
    if (isPrismaAvailable()) try {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string; label: string; category: string; createdAt: Date; rotationEpoch: number; ciphertext: string; nonce: string; wrappedDataKey: string; encryptionAlgo: string; checksum: string; allowedActionKeys: unknown }>>(
        `SELECT id, label, category, "createdAt", "rotationEpoch", ciphertext, nonce, "wrappedDataKey", "encryptionAlgo", checksum, "allowedActionKeys" FROM "SensitiveDataVaultItem" WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
        userId
      );
      for (const r of rows || []) {
        out.push({ id: r.id, label: r.label, category: r.category, createdAt: new Date(r.createdAt).toISOString(), rotationEpoch: Number(r.rotationEpoch) || 1, ciphertext: r.ciphertext, nonce: r.nonce, wrappedDataKey: r.wrappedDataKey, encryptionAlgo: r.encryptionAlgo, checksum: r.checksum, allowedActionKeys: typeof r.allowedActionKeys === "string" ? JSON.parse(r.allowedActionKeys) as string[] : Array.isArray(r.allowedActionKeys) ? r.allowedActionKeys as string[] : ["*"] });
      }
    } catch { /* ignore */ }
    if (out.length === 0) {
      const k = `${KEY_VAULT_JSON}:${userId}`;
      const raw = (db as unknown as { get?: (k: string) => unknown }).get?.(k) as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(raw)) for (const r of raw) out.push({ id: String(r.id), label: String(r.label), category: String(r.category), createdAt: String(r.createdAt ?? new Date().toISOString()), rotationEpoch: Number(r.rotationEpoch) || 1, ciphertext: String(r.ciphertext), nonce: String(r.nonce), wrappedDataKey: String(r.wrappedDataKey), encryptionAlgo: String(r.encryptionAlgo || "AES-256-GCM"), checksum: String(r.checksum), allowedActionKeys: Array.isArray(r.allowedActionKeys) ? r.allowedActionKeys as string[] : typeof r.allowedActionKeys === "string" ? JSON.parse(r.allowedActionKeys) as string[] : ["*"] });
    }
    return out;
  }
}

export const sensitiveVault = new SensitiveVault();