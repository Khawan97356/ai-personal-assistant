import type {
  AutonomousAction,
  AutonomousRun, SchedulerTickResult,
} from "./types";

const CRON_TZ_OFFSET =
  (Intl.DateTimeFormat().resolvedOptions().timeZone === "Europe/Paris" ||
    (process.env.TZ || "").toLowerCase().includes("paris"))
    ? 2
    : 0;

// Cron parser minimaliste 5-champs avec dépendance optionnelle node:cron-parser
async function cronNextAtSafe(expr: string, from: Date = new Date()) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { parse } = require("node:cron-parser");
    const p = parse(expr, { currentDate: from });
    const d = new Date(p.next().toDate().getTime() + CRON_TZ_OFFSET * 3600_000);
    return d;
  } catch {
    return undefined;
  }
}

function matchesThreshold(
  action: AutonomousAction,
  metrics: Record<string, number | string | boolean>
): boolean {
  const t = action.trigger.threshold;
  if (!t) return false;
  const v = metrics[t.metric];
  if (v === undefined) return false;
  switch (t.op) {
    case ">": return Number(v) > Number(t.value);
    case "<": return Number(v) < Number(t.value);
    case ">=": return Number(v) >= Number(t.value);
    case "<=": return Number(v) <= Number(t.value);
    case "==": return String(v) === String(t.value);
    case "!=": return String(v) !== String(t.value);
    default: return false;
  }
}

export interface AutonomousPersistence {
  listEnabledActions(userId?: string): Promise<AutonomousAction[]>;
  saveAction(action: AutonomousAction): Promise<void>;
  getActionById(id: string): Promise<AutonomousAction | undefined>;
  findActionsByTriggerKind(kind: AutonomousAction["trigger"]["kind"]): Promise<AutonomousAction[]>;
  saveRun(run: AutonomousRun): Promise<void>;
}

export interface AutonomousExecutorFacade {
  runAction(action: AutonomousAction, overrides?: Partial<{ signal: AbortSignal }>): Promise<{ run: AutonomousRun; output: unknown; notify: boolean }>;
  planApproval(action: AutonomousAction): Promise<AutonomousAction>;
}

export class AutonomousScheduler {
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private thresholdCooldown = new Map<string, number>();

  constructor(
    private deps: { persistence: AutonomousPersistence; executor: AutonomousExecutorFacade; notifier?: unknown },
    private tickIntervalMs = 60_000
  ) {}

  start() {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => {
      void this.tick().catch((e) => console.error("[scheduler] tick:", e));
    }, this.tickIntervalMs);
    void this.tick().catch((e) => console.error("[scheduler] first tick:", e));
  }

  stop() { if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; } }

  async planNext(action: AutonomousAction): Promise<AutonomousAction> {
    if (action.trigger.kind === "scheduled" && action.trigger.cron) {
      const next = await cronNextAtSafe(action.trigger.cron);
      action.nextRunAt = next ? next.toISOString() : action.nextRunAt;
    }
    action.updatedAt = new Date().toISOString();
    await this.deps.persistence.saveAction(action);
    return action;
  }

  async tick(metrics: Record<string, number | string | boolean> = {}): Promise<SchedulerTickResult> {
    const result: SchedulerTickResult = { triggered: [], scheduled: [], errors: [] };
    const now = Date.now();
    const actions = await this.deps.persistence.listEnabledActions();

    for (const action of actions) {
      try {
        let fire = false;
        if (action.trigger.kind === "scheduled" && action.trigger.cron) {
          if (!action.nextRunAt) {
            await this.planNext(action);
            result.scheduled.push(action.id);
          } else if (now >= new Date(action.nextRunAt).getTime()) {
            fire = true;
          }
        } else if (action.trigger.kind === "threshold" && action.trigger.threshold) {
          if (matchesThreshold(action, metrics)) {
            const key = `th_${action.id}_${action.trigger.threshold.metric}`;
            const cd = action.trigger.threshold.cooldownMs ?? 600_000;
            if (now - (this.thresholdCooldown.get(key) ?? 0) >= cd) {
              this.thresholdCooldown.set(key, now);
              fire = true;
            }
          }
        } else {
          continue;
        }
        if (fire) {
          const planned = await this.scheduleRun(action);
          if (planned) result.triggered.push(action.id);
          const res = await this.planNext(action);
          if (res.nextRunAt) result.scheduled.push(action.id);
        }
      } catch (err) {
        result.errors.push({ actionId: action.id, message: String(err) });
      }
    }
    return result;
  }

  async fireEvent(eventName: string, payload?: Record<string, unknown>): Promise<string[]> {
    const candidates = (await this.deps.persistence.listEnabledActions()).filter((a: AutonomousAction) => {
      if (a.trigger.kind === "event") return a.trigger.eventName === eventName;
      if (a.trigger.kind === "memory") return !!payload;
      return false;
    });
    const triggered: string[] = [];
    for (const a of candidates) if (await this.scheduleRun(a, payload)) triggered.push(a.id);
    return triggered;
  }

  private async scheduleRun(action: AutonomousAction, _payload?: Record<string, unknown>): Promise<boolean> {
    if (!action.enabled) return false;
    const { getActionExecutor } = await import("./registry");
    const exec = getActionExecutor(action.actionKey);
    if (!exec || !exec.canRun(action)) return false;
    if (exec.requiresApproval(action) && action.autonomyLevel !== "full") {
      action.status = "awaiting_approval";
      action.approval = undefined;
      action.updatedAt = new Date().toISOString();
      await this.deps.persistence.saveAction(action);
      return false;
    }
    action.status = "running";
    action.runCount = (action.runCount || 0) + 1;
    action.lastRunAt = new Date().toISOString();
    action.updatedAt = action.lastRunAt;
    await this.deps.persistence.saveAction(action);
    try {
      await this.deps.executor.runAction(action);
      action.status = "success";
      action.updatedAt = new Date().toISOString();
      await this.deps.persistence.saveAction(action);
      return true;
    } catch {
      action.status = "failed";
      action.updatedAt = new Date().toISOString();
      await this.deps.persistence.saveAction(action);
      return false;
    }
  }
}

export function makeId(prefix: string = "act"): string {
  const rand = (): string => Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand()}`;
}