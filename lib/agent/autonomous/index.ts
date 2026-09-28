export * from "./types";
export * from "./registry";
export * from "./scheduler";
export * from "./store";
export * from "./executor";
export * from "./notifier";
export * from "./specializedActions";

import { AutonomousStore } from "./store";
import { AutonomousExecutor } from "./executor";
import { AutonomousScheduler } from "./scheduler";
import { AutonomousNotifier } from "./notifier";
import type { AutonomyLevel } from "./types";

export interface AutonomousSystem {
  store: AutonomousStore;
  executor: AutonomousExecutor;
  scheduler: AutonomousScheduler;
  notifier: AutonomousNotifier;
  onboard: (opts?: { autonomyLevel: AutonomyLevel }) => Promise<unknown>;
}

export function createAutonomousSystem(userId: string): AutonomousSystem {
  const store = new AutonomousStore();
  const notifier = new AutonomousNotifier();
  const executor = new AutonomousExecutor(store, notifier);
  const scheduler = new AutonomousScheduler({ persistence: store, executor, notifier });
  return {
    store, executor, scheduler, notifier,
    onboard: (opts) => store.createPrescribedActionsFor(userId, opts as never),
  };
}

export function getAutonomousSystem(userId: string) { return createAutonomousSystem(userId); }