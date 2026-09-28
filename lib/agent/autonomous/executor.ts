import type { AutonomousAction, AutonomousRun, Notifier } from "./types";
import { getActionExecutor } from "./registry";
import { makeId, type AutonomousPersistence } from "./scheduler";

export class AutonomousExecutor {
  constructor(
    private persistence: AutonomousPersistence,
    private notifier?: Notifier
  ) {}

  async planApproval(action: AutonomousAction): Promise<AutonomousAction> {
    action.status = "awaiting_approval";
    action.updatedAt = new Date().toISOString();
    await this.persistence.saveAction(action);
    return action;
  }

  async runAction(action: AutonomousAction, overrides?: Partial<{ signal: AbortSignal; metrics: Record<string, number|string|boolean> }>) {
    const exec = getActionExecutor(action.actionKey);
    if (!exec) throw new Error(`no executor for actionKey=${action.actionKey}`);
    if (!exec.canRun(action)) throw new Error(`action ${action.id} canRun=false`);

    const runId = makeId("run");
    const startedAt = new Date();
    const run: AutonomousRun = {
      id: runId, actionId: action.id, status: "running",
      startedAt: startedAt.toISOString(),
      inputSnapshot: { params: action.params, trigger: action.trigger, metrics: overrides?.metrics ?? {} },
    };
    await this.persistence.saveRun(run);

    const ctx = {
      action, userId: action.userId, runId,
      notifier: this.notifier, metrics: overrides?.metrics ?? {}, signal: overrides?.signal,
    };

    let notify = false; let output: unknown = null;
    try {
      const res = await exec.run(ctx as never);
      output = res.output; notify = !!res.notify;
      const endedAt = new Date();
      run.status = "success"; run.endedAt = endedAt.toISOString();
      run.durationMs = endedAt.getTime() - startedAt.getTime(); run.output = output;
      if (notify) await this.notifier?.send(action.userId, {
        title: `✅ ${action.name} — réussie`,
        body: typeof output === "string" ? output.substring(0, 400) : `${action.name} — exécutée.`,
        channels: ["app"], metadata: { actionId: action.id, runId, status: "success" },
      });
    } catch (err) {
      const endedAt = new Date();
      run.status = "failed"; run.endedAt = endedAt.toISOString();
      run.durationMs = endedAt.getTime() - startedAt.getTime();
      run.errorMessage = err instanceof Error ? err.message : String(err);
      await this.notifier?.send(action.userId, {
        title: `⚠️ ${action.name} — échec`,
        body: run.errorMessage || "Erreur inconnue.",
        channels: ["app"], metadata: { actionId: action.id, runId, status: "failed" },
      });
      throw err;
    } finally {
      await this.persistence.saveRun(run);
    }
    return { run, output, notify };
  }
}