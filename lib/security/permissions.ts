import { prisma, isPrismaAvailable } from "@/lib/db/prisma";

export type PermissionEffect = "allow" | "deny";
export interface PermissionCheck { userId: string; scope: string; resourceType?: string; resourceId?: string; context?: Record<string, unknown>; }

const ROLE_BASE_PERMISSIONS: Record<string, string[]> = {
  user: ["memory:read","memory:write","memory:delete","tasks:read","tasks:write","tasks:execute","chat:read","chat:write","profile:read","profile:write","vault:read","vault:write","autonomous:read","autonomous:create","channels:read"],
  manager: ["user","autonomous:run","autonomous:override","channels:send","channels:write","audit:read"],
  admin: ["manager","memory:export","vault:export","admin:settings","admin:users:read"],
  owner: ["admin","admin:users","admin:billing","admin:full","autonomous:full"],
};

function expandScopes(roleScopes: string[]): Set<string> {
  const expanded = new Set<string>();
  const queue = [...roleScopes];
  while (queue.length) {
    const sc = queue.shift()!;
    if (ROLE_BASE_PERMISSIONS[sc]) { queue.push(...ROLE_BASE_PERMISSIONS[sc]); continue; }
    expanded.add(sc);
    if (sc.endsWith(":*")) {
      const base = sc.slice(0, -1);
      for (const sub of ["read","write","delete","export","execute","run","override","full","create","send"]) expanded.add(base + sub);
    }
  }
  return expanded;
}

export interface CheckResult { allowed: boolean; reason?: string; matchedGrantId?: string; }

export async function checkPermission(check: PermissionCheck): Promise<CheckResult> {
  const { userId, scope, resourceType, resourceId } = check;
  let role = "user";
  if (isPrismaAvailable()) try {
    const row = await prisma.$queryRawUnsafe<Array<{ role: string }>>(`SELECT role FROM "User" WHERE id = $1 LIMIT 1`, userId);
    if (row?.[0]?.role) role = row[0].role;
  } catch { /* role=user */ }

  const baseScopes = expandScopes([role]);
  let allowed = baseScopes.has(scope);
  let matchedGrantId: string | undefined;
  let denyOverride = false;

  if (isPrismaAvailable()) try {
    const grants = await prisma.$queryRawUnsafe<Array<{ id: string; scope: string; effect: string; resource_type?: string; resource_id?: string; expires_at?: string }>>(
      `SELECT id, scope, effect, "resourceType" as resource_type, "resourceId" as resource_id, "expiresAt" as expires_at FROM "PermissionGrant" WHERE "userId" = $1`,
      userId
    );
    const now = Date.now();
    for (const g of grants || []) {
      if (g.expires_at && new Date(g.expires_at).getTime() < now) continue;
      if (g.scope !== scope && g.scope !== scope.split(":")[0] + ":*") continue;
      if (resourceType && g.resource_type && g.resource_type !== resourceType) continue;
      if (resourceId && g.resource_id && g.resource_id !== resourceId) continue;
      if (g.effect === "allow") { allowed = true; matchedGrantId = g.id; }
      if (g.effect === "deny") { denyOverride = true; matchedGrantId = g.id; }
    }
  } catch { /* ignore */ }

  if (denyOverride) return { allowed: false, matchedGrantId, reason: "deny grant override" };
  if (allowed) return { allowed: true, matchedGrantId };
  return { allowed: false, reason: `scope ${scope} not granted to role ${role}` };
}

export async function requirePermission(check: PermissionCheck): Promise<void> {
  const r = await checkPermission(check);
  if (!r.allowed) { const e = new Error(`FORBIDDEN: ${check.scope} ${r.reason || ""}`.trim()); (e as { code?: string }).code = "PERMISSION_DENIED"; throw e; }
}

export async function grantPermission(params: { userId: string; scope: string; effect?: PermissionEffect; grantedBy?: string; resourceType?: string; resourceId?: string; expiresAt?: Date; conditions?: Record<string, unknown>; }) {
  if (!isPrismaAvailable()) return null;
  try {
    const row = await prisma.$executeRawUnsafe(
      `INSERT INTO "PermissionGrant" ("userId", scope, effect, "grantedBy", "resourceType", "resourceId", "expiresAt", conditions) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT ("userId", scope, "resourceType", "resourceId") DO UPDATE SET effect = EXCLUDED.effect, "grantedBy" = EXCLUDED."grantedBy", "expiresAt" = EXCLUDED."expiresAt", conditions = EXCLUDED.conditions RETURNING id`,
      params.userId, params.scope, params.effect ?? "allow", params.grantedBy ?? "system", params.resourceType ?? null, params.resourceId ?? null, params.expiresAt ?? null, JSON.stringify(params.conditions ?? null)
    );
    void row;
    return { ok: true };
  } catch (err) { console.warn("[permissions] grant:", err); return null; }
}