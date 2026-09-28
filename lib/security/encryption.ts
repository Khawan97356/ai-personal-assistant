import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm"; const KEY_BYTES = 32; const IV_BYTES = 12; const TAG_LENGTH_BITS = 128;

function masterKey(): Buffer {
  const raw = process.env.SECURITY_MASTER_KEY || process.env.NEXTAUTH_SECRET || process.env.CRON_SECRET;
  if (!raw) throw new Error("SECURITY_MASTER_KEY manquant (minimum 32 caractères).");
  return scryptSync(raw, "omnimind-kek-root-salt", KEY_BYTES);
}

export function hash256(input: Buffer | string): string { return createHash("sha256").update(input).digest("hex"); }

function deriveUserKey(userId: string): Buffer {
  const salt = Buffer.from("omnimind:user:kek:salt:" + userId.slice(0, 32), "utf8");
  const prk = createHmac("sha256", masterKey()).update(Buffer.concat([salt, Buffer.from(userId, "utf8")])).digest();
  return createHmac("sha256", prk).update("kek-v1").digest().slice(0, KEY_BYTES);
}

export interface EncryptResult { ciphertext: string; nonce: string; algo: string; checksum: string; }
export interface DecryptResult { plaintext: string; checksumValid: boolean; }

export function generateDataKey(): Buffer { return randomBytes(KEY_BYTES); }

export function wrapDataKey(userId: string, dek: Buffer): string {
  const kek = deriveUserKey(userId);
  const iv = randomBytes(IV_BYTES);
  const c = createCipheriv(ALGO, kek, iv, { authTagLength: TAG_LENGTH_BITS / 8 });
  const c1 = c.update(dek); const c2 = c.final(); const tag = c.getAuthTag();
  return Buffer.concat([iv, tag, c1, c2]).toString("base64");
}

export function unwrapDataKey(userId: string, wrapped: string): Buffer {
  const kek = deriveUserKey(userId);
  const buf = Buffer.from(wrapped, "base64");
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_LENGTH_BITS / 8);
  const ct = buf.subarray(IV_BYTES + TAG_LENGTH_BITS / 8);
  const d = createDecipheriv(ALGO, kek, iv, { authTagLength: TAG_LENGTH_BITS / 8 });
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

export function encryptString(_userId: string, plaintext: string, dek?: Buffer): EncryptResult {
  const key = dek || generateDataKey();
  const iv = randomBytes(IV_BYTES);
  const c = createCipheriv(ALGO, key, iv, { authTagLength: TAG_LENGTH_BITS / 8 });
  const p1 = c.update(plaintext, "utf8"); const p2 = c.final(); const tag = c.getAuthTag();
  return { ciphertext: Buffer.concat([iv, tag, p1, p2]).toString("base64"), nonce: iv.toString("base64"), algo: ALGO, checksum: hash256(plaintext) };
}

export function decryptString(_userId: string, dek: Buffer, payload: EncryptResult & { checksum?: string }): DecryptResult {
  const buf = Buffer.from(payload.ciphertext, "base64");
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_LENGTH_BITS / 8);
  const ct = buf.subarray(IV_BYTES + TAG_LENGTH_BITS / 8);
  const d = createDecipheriv(ALGO, dek, iv, { authTagLength: TAG_LENGTH_BITS / 8 });
  d.setAuthTag(tag);
  const plain = Buffer.concat([d.update(ct), d.final()]).toString("utf8");
  return { plaintext: plain, checksumValid: !payload.checksum || payload.checksum === hash256(plain) };
}

export function blindChecksum(secret: string): string {
  return hash256(Buffer.from("omnimind:blind-checksum:v1:" + secret, "utf8"));
}