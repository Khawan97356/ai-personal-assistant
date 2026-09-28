import type {
  AutonomousAction, AutonomousRun, AutonomyLevel, ActionRisk, ActionTrigger,
} from "./types";
import type { AutonomousPersistence } from "./scheduler";
import { prisma, isPrismaAvailable } from "@/lib/db/prisma";
import { db } from "@/lib/db/store";
import { makeId } from "./scheduler";
import { getActionExecutor, basicBuildDescription, extendedPrescribed } from "./registry";

const KEY_ACTIONS = "autonomous_actions_v1";
const KEY_RUNS = "autonomous_runs_v1";

function now() { return new Date().toISOString(); }

function defaultAction(input: {
  userId: string; actionKey: string; name?: string; description?: string;
  trigger?: Partial<ActionTrigger> & { kind: ActionTrigger["kind"] };
  autonomyLevel?: AutonomyLevel;
  params?: Record<string, unknown>; tags?: string[];
}): AutonomousAction {
  const { userId, actionKey } = input;
  const exec = getActionExecutor(actionKey);
  const risk: ActionRisk = exec
    ? exec.estimateRisk({ actionKey } as never)
    : "medium";
  const trigger: ActionTrigger = input.trigger
    ? ({ kind: "scheduled", cron: "*/15 * * * *", ...input.trigger } as ActionTrigger)
    : { kind: "scheduled", cron: "*/15 * * * *" };
  const id = makeId("aut");
  return {
    id, actionKey,
    name: input.name || actionKey,
    description: exec
      ? exec.buildDescription({ actionKey, name: input.name || actionKey } as never)
      : input.description || basicBuildDescription({ id, actionKey, name: input.name || actionKey } as never),
    userId, trigger,
    autonomyLevel: input.autonomyLevel ?? "semi",
    risk, params: input.params ?? {},
    status: "scheduled", runCount: 0, history: [],
    createdAt: now(), updatedAt: now(),
    enabled: true, tags: input.tags,
  };
}

interface JsonDb { actions: AutonomousAction[]; runs: AutonomousRun[]; }

function loadJson(userId: string): JsonDb {
  try {
    const raw = (db as unknown as { get?: (k: string) => unknown }).get?.(`${KEY_ACTIONS}:${userId}`);
    const rawRuns = (db as unknown as { get?: (k: string) => unknown }).get?.(`${KEY_RUNS}:${userId}`);
    return {
      actions: Array.isArray(raw) ? (raw as AutonomousAction[]) : [],
      runs: Array.isArray(rawRuns) ? (rawRuns as AutonomousRun[]) : [],
    };
  } catch { return { actions: [], runs: [] }; }
}
function saveJson(userId: string, shape: JsonDb) {
  try {
    (db as unknown as { set?: (k: string, v: unknown) => void }).set?.(`${KEY_ACTIONS}:${userId}`, shape.actions);
    (db as unknown as { set?: (k: string, v: unknown) => void }).set?.(`${KEY_RUNS}:${userId}`, shape.runs);
  } catch { /* ignore */ }
}

export class AutonomousStore implements AutonomousPersistence {
  async createAction(input: Parameters<typeof defaultAction>[0]): Promise<AutonomousAction> {
    const action = defaultAction(input);
    await this.saveAction(action);
    return action;
  }

  async listEnabledActions(userId?: string): Promise<AutonomousAction[]> {
    const prismaList: AutonomousAction[] = await (async () => {
      if (!isPrismaAvailable()) return [];
      try {
        const rows = await prisma.$queryRawUnsafe<Array<{ data?: string; id?: string }>>(
          `SELECT id, data::text as data FROM "AutonomousAction" WHERE enabled = true ${userId ? `AND "userId" = $1` : ""}`,
          ...(userId ? [userId] : []) as never[]
        );
        return (rows || []).map((r) => {
          if (typeof r.data === "string") return JSON.parse(r.data) as AutonomousAction;
          return r as unknown as AutonomousAction;
        });
      } catch { return []; }
    })();

    const jsonList = userId ? loadJson(userId).actions : [];
    const seen = new Set<string>();
    const merged: AutonomousAction[] = [];
    for (const a of [...prismaList, ...jsonList]) if (!seen.has(a.id)) { seen.add(a.id); merged.push(a); }
    return merged.filter((a) => a.enabled);
  }

  async saveAction(action: AutonomousAction): Promise<void> {
    action.updatedAt = now();
    if (isPrismaAvailable()) {
      try {
        const dataStr = JSON.stringify(action);
        await prisma.$executeRawUnsafe(
          `INSERT INTO "AutonomousAction" (id, "userId", "actionKey", status, enabled, data, "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz)
           ON CONFLICT (id) DO UPDATE SET
             status = EXCLUDED.status, enabled = EXCLUDED.enabled,
             data = EXCLUDED.data, "updatedAt" = EXCLUDED."updatedAt"`,
          action.id, action.userId, action.actionKey, action.status, action.enabled, dataStr, action.updatedAt
        );
      } catch (err) { console.warn("[autonomous/store] prisma save:", err); }
    }
    const shape = loadJson(action.userId);
    const idx = shape.actions.findIndex((a) => a.id === action.id);
    if (idx >= 0) shape.actions[idx] = action; else shape.actions.push(action);
    saveJson(action.userId, shape);
  }

  async getActionById(id: string): Promise<AutonomousAction | undefined> {
    if (isPrismaAvailable()) {
      try {
        const rows = await prisma.$queryRawUnsafe<Array<{ data?: string }>>(
          `SELECT data::text as data FROM "AutonomousAction" WHERE id = $1 LIMIT 1`, id
        );
        if (rows?.[0]?.data) return JSON.parse(rows[0].data) as AutonomousAction;
      } catch { /* ignore */ }
    }
    return undefined;
  }

  async findActionsByTriggerKind(kind: AutonomousAction["trigger"]["kind"]): Promise<AutonomousAction[]> {
    const all = await this.listEnabledActions();
    return all.filter((a) => a.trigger.kind === kind);
  }

  async saveRun(run: AutonomousRun): Promise<void> {
    if (isPrismaAvailable()) {
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "AutonomousRun" (id, "actionId", status, "startedAt", "endedAt", output, error, duration_ms)
           VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6::jsonb, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
             status = EXCLUDED.status, "endedAt" = EXCLUDED."endedAt",
             output = EXCLUDED.output, error = EXCLUDED.error, duration_ms = EXCLUDED.duration_ms`,
          run.id, run.actionId, run.status, run.startedAt,
          run.endedAt ?? null, JSON.stringify(run.output ?? null),
          run.errorMessage ?? null, run.durationMs ?? null
        );
      } catch (err) { console.warn("[autonomous/store] prisma run:", err); }
    }
    const action = await this.getActionById(run.actionId);
    const uid = action?.userId ?? "unknown";
    const shape = loadJson(uid);
    const idx = shape.runs.findIndex((r) => r.id === run.id);
    if (idx >= 0) shape.runs[idx] = run; else shape.runs.push(run);
    saveJson(uid, shape);
  }

  async decideApproval(actionId: string, decision: { approved: boolean; approverId?: string; reason?: string }) {
    const action = await this.getActionById(actionId);
    if (!action) return undefined;
    action.approval = { ...decision, decidedAt: now() };
    action.status = decision.approved ? "scheduled" : "rejected";
    await this.saveAction(action);
    return action;
  }

  async disableAction(id: string) {
    const action = await this.getActionById(id);
    if (!action) return undefined;
    action.enabled = false; action.status = "cancelled";
    await this.saveAction(action);
    return action;
  }

  async createPrescribedActionsFor(userId: string, opts: { autonomyLevel: AutonomyLevel } = { autonomyLevel: "semi" }) {
    const defaults: Parameters<typeof defaultAction>[0][] = [
      { userId, actionKey: "briefing.morning", name: "Briefing Matin", trigger: { kind: "scheduled", cron: "0 9 * * *" }, autonomyLevel: opts.autonomyLevel, params: { period: "morning", channels: ["app","telegram"] }, tags: ["daily","briefing"] },
      { userId, actionKey: "briefing.evening", name: "Rapport Soir",  trigger: { kind: "scheduled", cron: "0 19 * * 1-5" }, autonomyLevel: opts.autonomyLevel, params: { period: "evening", channels: ["app"] }, tags: ["daily","briefing"] },
      { userId, actionKey: "inbox.triage",  name: "Tri Boîte de réception", trigger: { kind: "scheduled", cron: "*/20 * * * *" }, autonomyLevel: opts.autonomyLevel, tags: ["inbox","realtime"] },
      { userId, actionKey: "channels.sync", name: "Synchro canaux", trigger: { kind: "scheduled", cron: "*/10 * * * *" }, autonomyLevel: opts.autonomyLevel, tags: ["channels"] },
      { userId, actionKey: "memory.consolidate", name: "Consolidation mémoire", trigger: { kind: "scheduled", cron: "30 2 * * *" }, autonomyLevel: "semi", params: { similarityThreshold: 0.92 }, tags: ["memory","maintenance"] },
      { userId, actionKey: "tasks.reminders", name: "Rappels échéances", trigger: { kind: "scheduled", cron: "0 8 * * *" }, autonomyLevel: opts.autonomyLevel, params: { channels: ["app","telegram"] }, tags: ["reminders","tasks"] },
      { userId, actionKey: "cleanup.cache", name: "Nettoyage cache", trigger: { kind: "scheduled", cron: "15 3 * * 0" }, autonomyLevel: "semi", params: { days: 7 }, tags: ["maintenance"] },
      { userId, actionKey: "user.checkin", name: "Check-in empathique", trigger: { kind: "scheduled", cron: "30 17 * * 2,4" }, autonomyLevel: opts.autonomyLevel, params: { channels: ["app","telegram"] }, tags: ["engagement"] },
    ];

    const extended = extendedPrescribed(userId, opts).map((e) => ({
      userId: e.userId, actionKey: e.actionKey, name: e.name,
      trigger: e.trigger as ActionTrigger & { kind: ActionTrigger["kind"] },
      autonomyLevel: e.autonomyLevel, params: e.params ?? {}, tags: e.tags ?? [],
    }));

    return Promise.all([...defaults, ...extended].map((d) => this.createAction(d)));
  }
}