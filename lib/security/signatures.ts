import {
  createHmac,
  createHash,
  sign as cryptoSign,
  verify as cryptoVerify,
  generateKeyPairSync,
} from "node:crypto";

export type SignatureAlgo = "HMAC_SHA256" | "HMAC_SHA384" | "ED25519";
const DEFAULT_ALGO: SignatureAlgo = "HMAC_SHA256";

function getHmacKey(): string {
  const key = process.env.SECURITY_SIGNING_KEY || process.env.SECURITY_MASTER_KEY;
  if (!key) throw new Error("SECURITY_SIGNING_KEY ou SECURITY_MASTER_KEY manquant pour la signature des actions.");
  return key;
}

let edCache: { publicKeyPem: string; privateKeyPem: string } | null = null;
export function getEdKeypair(): { publicKeyPem: string; privateKeyPem: string } {
  if (edCache) return edCache;
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  edCache = { publicKeyPem: publicKey, privateKeyPem: privateKey };
  return edCache;
}

export function canonicalize(obj: unknown): string {
  return JSON.stringify(obj, (_k, v) =>
    typeof v === "bigint" ? v.toString() : v instanceof Buffer ? v.toString("base64") : v
  );
}
function hashObject(input: unknown): string { return createHash("sha256").update(canonicalize(input)).digest("hex"); }

export interface SignResult { signatureKind: SignatureAlgo; signature: string; signatory: string; }

export function signPayload(payload: unknown, options?: { algo?: SignatureAlgo; signatory?: string }): SignResult {
  const algo = options?.algo ?? (process.env.SECURITY_SIGNATURE_ALGO as SignatureAlgo | undefined) ?? DEFAULT_ALGO;
  const message = hashObject(payload);
  if (algo === "HMAC_SHA256" || algo === "HMAC_SHA384") {
    const sha = algo === "HMAC_SHA256" ? "sha256" : "sha384";
    const sig = createHmac(sha, getHmacKey()).update(message).digest("base64");
    return { signatureKind: algo, signature: sig, signatory: options?.signatory ?? "omnimind-hmac" };
  }
  if (algo === "ED25519") {
    const { privateKeyPem } = getEdKeypair();
    const sig = cryptoSign(null, Buffer.from(message), privateKeyPem).toString("base64");
    return { signatureKind: algo, signature: sig, signatory: options?.signatory ?? "omnimind-ed25519" };
  }
  throw new Error(`algo signature invalide: ${algo}`);
}

export function verifySignature(payload: unknown, sig: string, algo: SignatureAlgo = DEFAULT_ALGO, publicKeyPem?: string): boolean {
  try {
    const message = hashObject(payload);
    if (algo === "HMAC_SHA256" || algo === "HMAC_SHA384") {
      const sha = algo === "HMAC_SHA256" ? "sha256" : "sha384";
      return createHmac(sha, getHmacKey()).update(message).digest("base64") === sig;
    }
    if (algo === "ED25519") {
      const pub = publicKeyPem ?? getEdKeypair().publicKeyPem;
      return cryptoVerify(null, Buffer.from(message), pub, Buffer.from(sig, "base64"));
    }
    return false;
  } catch { return false; }
}

export function chainAuditLog(previousEntry: { entryHash?: string | null | undefined } | null | undefined, current: unknown) {
  const previousHash = previousEntry?.entryHash ?? "0".repeat(64);
  const inner = hashObject(current);
  const entryHash = createHash("sha256").update(previousHash + "\n" + inner).digest("hex");
  return { entryHash };
}