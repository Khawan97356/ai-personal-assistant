export type ActionTriggerKind = "scheduled" | "event" | "threshold" | "memory" | "conversation" | "manual";

export interface ActionTrigger {
  kind: ActionTriggerKind;
  cron?: string;
  eventName?: string;
  threshold?: {
    metric: string;
    op: ">" | "<" | ">=" | "<=" | "==" | "!=";
    value: number | string | boolean;
    cooldownMs?: number;
  };
  memoryPattern?: { memoryType?: string; containsKeywords?: string[] };
}

export type AutonomyLevel = "observe" | "suggest" | "semi" | "full";
export type ActionRisk = "low" | "medium" | "high";
export type AutonomousActionStatus =
  | "draft" | "scheduled" | "awaiting_approval" | "running" | "paused"
  | "success" | "failed" | "rejected" | "cancelled";

export interface ApprovalDecision {
  approved: boolean;
  approverId?: string;
  reason?: string;
  decidedAt: string;
}

export interface AutonomousAction {
  id: string;
  actionKey: string;
  name: string;
  description: string;
  userId: string;
  trigger: ActionTrigger;
  autonomyLevel: AutonomyLevel;
  risk: ActionRisk;
  params: Record<string, unknown>;
  status: AutonomousActionStatus;
  runCount: number;
  lastRunAt?: string;
  nextRunAt?: string;
  approval?: ApprovalDecision;
  history: AutonomousRun[];
  createdAt: string;
  updatedAt: string;
  enabled: boolean;
  tags?: string[];
  transient?: boolean;
}

export interface AutonomousRun {
  id: string;
  actionId: string;
  startedAt: string;
  endedAt?: string;
  status: "running" | "success" | "failed" | "cancelled";
  durationMs?: number;
  inputSnapshot?: Record<string, unknown>;
  output?: unknown;
  errorMessage?: string;
  notifiedVia?: Array<"email" | "telegram" | "discord" | "whatsapp" | "app">;
}

export interface ActionExecutionContext {
  action: AutonomousAction;
  userId: string;
  runId: string;
  notifier?: Notifier;
  metrics?: Record<string, number | string | boolean>;
  memory?: unknown;
  signal?: AbortSignal;
}

export interface ActionExecutor {
  canRun(action: AutonomousAction): boolean;
  run(ctx: ActionExecutionContext): Promise<{ output: unknown; notify?: boolean }>;
  estimateRisk(action: AutonomousAction): ActionRisk;
  requiresApproval(action: AutonomousAction): boolean;
  buildDescription(action: AutonomousAction): string;
}

export interface Notifier {
  send(
    userId: string,
    payload: {
      title: string;
      body: string;
      channels?: Array<"email" | "telegram" | "discord" | "whatsapp" | "app">;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void>;
}

export interface SchedulerTickResult {
  triggered: string[];
  scheduled: string[];
  errors: Array<{ actionId: string; message: string }>;
}