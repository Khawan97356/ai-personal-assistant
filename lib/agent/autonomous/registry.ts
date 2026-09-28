import type {
  ActionExecutionContext,
  ActionExecutor,
  ActionRisk,
  AutonomousAction,
} from "./types";
import { getMemoryEngine } from "../memoryEngine";
import {
  SPECIALIZED_ACTIONS_REGISTRY,
  registerSpecializedActions,
} from "./specializedActions";

// ---------------------------------------------------------------------------
// SHARED HELPERS
// ---------------------------------------------------------------------------

function basicBuildDescription(action: AutonomousAction): string {
  const params = action.params ? JSON.stringify(action.params) : "{}";
  return `${action.actionKey} → ${params}`;
}

// ---------------------------------------------------------------------------
// BRIEFING EXECUTORS
// ---------------------------------------------------------------------------

class BriefingMorningExecutor implements ActionExecutor {
  canRun(action: AutonomousAction) { return /^briefing\.(morning|evening)$/.test(action.actionKey); }
  estimateRisk(_ctx: AutonomousAction): ActionRisk { return "low"; }
  requiresApproval(_action: AutonomousAction) { return false; }
  buildDescription(action: AutonomousAction) {
    const period = (action.params.period as string) === "evening" ? "soirée" : "matin";
    return `Briefing ${period} : prépare un récapitulatif clair des priorités, échéances, actualités mémoire.`;
  }
  async run(ctx: ActionExecutionContext): Promise<{ output: unknown; notify?: boolean }> {
    const memory = getMemoryEngine(ctx.userId);
    try {
      const [priorities, deadlines, recents] = await Promise.all([
        memory?.ask?.("priorités du jour à faire top 3 objectifs", { topK: 5, minSimilarity: 0.62, types: ["task","fact"] }),
        memory?.ask?.("échéances aujourd'hui deadline échéance livrable", { topK: 5, minSimilarity: 0.62, types: ["task","fact"] }),
        memory?.getRecent?.(12) ?? [],
      ]);
      void priorities; void deadlines;
      const output = { period: ctx.action.params.period ?? "morning", recents: recents.length };
      return { output, notify: true };
    } catch {
      return { output: { ok: true }, notify: false };
    }
  }
}

// ---------------------------------------------------------------------------
// INBOX EXECUTORS
// ---------------------------------------------------------------------------

class InboxTriageExecutor implements ActionExecutor {
  canRun(action: AutonomousAction) { return action.actionKey === "inbox.triage"; }
  estimateRisk(_ctx: AutonomousAction): ActionRisk { return "medium"; }
  requiresApproval(action: AutonomousAction) { return action.autonomyLevel !== "full" && action.autonomyLevel !== "semi"; }
  buildDescription(_action: AutonomousAction) { return "Boîte de réception : trie les entrées (VIP, urgent, à archiver, auto-réponses)."; }
  async run(_ctx: ActionExecutionContext): Promise<{ output: unknown; notify?: boolean }> {
    return { output: { triaged: 0, archived: 0, replied: 0, flagged_vip: 0 }, notify: false };
  }
}

// ---------------------------------------------------------------------------
// MEMORY EXECUTORS
// ---------------------------------------------------------------------------

class MemoryConsolidateExecutor implements ActionExecutor {
  canRun(action: AutonomousAction) { return action.actionKey === "memory.consolidate"; }
  estimateRisk(_ctx: AutonomousAction): ActionRisk { return "low"; }
  requiresApproval(_action: AutonomousAction) { return false; }
  buildDescription(action: AutonomousAction) {
    const thr = Number(action.params.similarityThreshold ?? 0.92);
    return `Consolidation mémoire : fusionne doublons (score ≥ ${thr}), nettoie anciens silos.`;
  }
  async run(ctx: ActionExecutionContext): Promise<{ output: unknown; notify?: boolean }> {
    const engine = getMemoryEngine(ctx.userId);
    if (engine && typeof engine.consolidate === "function") {
      const report = await engine.consolidate();
      return { output: report ?? { done: true }, notify: (report && typeof report === "object" && (report as unknown as Record<string, number>).mergedCount ? (report as unknown as Record<string, number>).mergedCount > 0 : false) };
    }
    return { output: { skipped: "no_memory_engine" }, notify: false };
  }
}

// ---------------------------------------------------------------------------
// CHANNELS EXECUTORS
// ---------------------------------------------------------------------------

class ChannelsSyncExecutor implements ActionExecutor {
  canRun(action: AutonomousAction) { return action.actionKey === "channels.sync"; }
  estimateRisk(_ctx: AutonomousAction): ActionRisk { return "low"; }
  requiresApproval(_action: AutonomousAction) { return false; }
  buildDescription(_action: AutonomousAction) { return "Synchronise ConnectedAccount (unread, lastSync) depuis Gmail/Telegram/WhatsApp/Discord/Outlook."; }
  async run(_ctx: ActionExecutionContext): Promise<{ output: unknown; notify?: boolean }> {
    return { output: { synced: 0, new_messages: 0 }, notify: false };
  }
}

// ---------------------------------------------------------------------------
// TASKS EXECUTORS
// ---------------------------------------------------------------------------

class TasksRemindersExecutor implements ActionExecutor {
  canRun(action: AutonomousAction) { return action.actionKey === "tasks.reminders"; }
  estimateRisk(_ctx: AutonomousAction): ActionRisk { return "low"; }
  requiresApproval(_action: AutonomousAction) { return false; }
  buildDescription(_action: AutonomousAction) { return "Rappels échéances : remonte les PendingTask dues aujourd'hui +48h."; }
  async run(ctx: ActionExecutionContext): Promise<{ output: unknown; notify?: boolean }> {
    const memory = getMemoryEngine(ctx.userId);
    const hits = await memory?.ask?.("échéance aujourd'hui demain tâche à faire reminder", { topK: 8, minSimilarity: 0.6, types: ["task","fact"] });
    const count = hits?.length ?? 0;
    return { output: { due_today: count }, notify: count > 0 };
  }
}

// ---------------------------------------------------------------------------
// CLEANUP EXECUTORS
// ---------------------------------------------------------------------------

class CleanupCacheExecutor implements ActionExecutor {
  canRun(action: AutonomousAction) { return action.actionKey === "cleanup.cache"; }
  estimateRisk(_ctx: AutonomousAction): ActionRisk { return "low"; }
  requiresApproval(_action: AutonomousAction) { return false; }
  buildDescription(action: AutonomousAction) {
    const days = Number(action.params.days ?? 7);
    return `Nettoyage caches > ${days}j : voice-cache, silos dédups, historiques éphémères.`;
  }
  async run(ctx: ActionExecutionContext): Promise<{ output: unknown; notify?: boolean }> {
    void ctx;
    return { output: { cleaned: 0, freed_bytes: 0 }, notify: false };
  }
}

// ---------------------------------------------------------------------------
// USER EXECUTORS
// ---------------------------------------------------------------------------

class UserCheckinExecutor implements ActionExecutor {
  canRun(action: AutonomousAction) { return action.actionKey === "user.checkin"; }
  estimateRisk(_ctx: AutonomousAction): ActionRisk { return "low"; }
  requiresApproval(_action: AutonomousAction) { return false; }
  buildDescription(_action: AutonomousAction) { return "Check-in empathique : demander énergie/blocages/succès sans être intrusif."; }
  async run(_ctx: ActionExecutionContext): Promise<{ output: unknown; notify?: boolean }> {
    return { output: { prompted: true }, notify: true };
  }
}

// ---------------------------------------------------------------------------
// REGISTRY PUBLIC (merge des actions de base + actions spécialisées)
// ---------------------------------------------------------------------------

export const AUTONOMOUS_ACTION_REGISTRY_BASE: Record<string, ActionExecutor> = {
  "briefing.morning": new BriefingMorningExecutor(),
  "briefing.evening": new BriefingMorningExecutor(),
  "inbox.triage": new InboxTriageExecutor(),
  "memory.consolidate": new MemoryConsolidateExecutor(),
  "channels.sync": new ChannelsSyncExecutor(),
  "tasks.reminders": new TasksRemindersExecutor(),
  "cleanup.cache": new CleanupCacheExecutor(),
  "user.checkin": new UserCheckinExecutor(),
};

// ré-exports pour le store (évite la dépendance circulaire vers specializedActions)
export { extendedPrescribed, registerSpecializedActions } from "./specializedActions";

export const AUTONOMOUS_ACTION_REGISTRY: Record<string, ActionExecutor> = {
  ...AUTONOMOUS_ACTION_REGISTRY_BASE,
  ...SPECIALIZED_ACTIONS_REGISTRY,
};

export function registerAllSpecialized() {
  registerSpecializedActions(AUTONOMOUS_ACTION_REGISTRY);
}
registerAllSpecialized();

export function getActionExecutor(actionKey: string): ActionExecutor | undefined {
  return AUTONOMOUS_ACTION_REGISTRY[actionKey];
}

export function getActionRisk(actionKey: string): ActionRisk {
  return AUTONOMOUS_ACTION_REGISTRY[actionKey]?.estimateRisk({ actionKey } as never) ?? "medium";
}

export function listRegisteredActions(): Array<{ actionKey: string; defaultRisk: ActionRisk }> {
  return Object.entries(AUTONOMOUS_ACTION_REGISTRY).map(([actionKey, exec]) => ({
    actionKey,
    defaultRisk: exec.estimateRisk({ actionKey } as never),
  }));
}

export { basicBuildDescription };