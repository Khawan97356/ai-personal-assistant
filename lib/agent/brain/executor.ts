/**
 * EXECUTOR
 * =============================================================================
 * Rôle : exécuter un plan, étape par étape, en appelant les outils réels
 * (email, calendrier, API, fichiers, ...), et en journalisant chaque action.
 *
 * SÉCURITÉ — DOUBLE GARDE-FOU :
 *   1. Le plan dans son ENSEMBLE doit avoir été explicitement approuvé par
 *      un humain (`planValidation.status === "approved" | "modified"`).
 *      Sans cela, l'executor refuse de faire quoi que ce soit.
 *   2. Chaque étape dont `requiresValidation` est true (typiquement toute
 *      étape appelant un outil, ou dont le risque est moyen ou plus) doit
 *      en plus recevoir une confirmation individuelle juste avant son
 *      exécution, via `requestStepValidation`. Un plan globalement approuvé
 *      ne permet donc jamais de sauter la confirmation d'une action risquée.
 *
 * Si une étape échoue ou est refusée, toutes les étapes qui en dépendent
 * sont automatiquement sautées (statut "skipped") plutôt qu'exécutées dans
 * un état incohérent.
 * =============================================================================
 */

import type {
  ExecutionLogEntry,
  ExecutionResult,
  Plan,
  PlanStep,
  PlanValidationResult,
  ToolRegistry,
  ValidationStatus,
} from "./types";

export interface ExecutorOptions {
  /** Registre des outils exécutables (email, calendrier, API, fichiers, ...). */
  tools: ToolRegistry;
  /**
   * Callback OBLIGATOIRE de validation humaine, appelé pour chaque étape
   * dont `requiresValidation` est true, juste avant son exécution.
   */
  requestStepValidation: (step: PlanStep, plan: Plan) => Promise<ValidationStatus>;
  /** Callback optionnel pour persister chaque entrée de log au fur et à mesure (audit trail). */
  onLog?: (entry: ExecutionLogEntry) => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Tri topologique des étapes selon leurs dépendances
// ---------------------------------------------------------------------------

function topologicalSort(steps: PlanStep[]): PlanStep[] {
  const stepsById = new Map<string, PlanStep>(steps.map((s) => [s.id, s]));
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const step of steps) {
    inDegree.set(step.id, 0);
    dependents.set(step.id, []);
  }

  for (const step of steps) {
    for (const depId of step.dependsOn) {
      if (!stepsById.has(depId)) continue; // dépendance invalide, ignorée (nettoyée en amont par le critic)
      inDegree.set(step.id, (inDegree.get(step.id) ?? 0) + 1);
      const list = dependents.get(depId) ?? [];
      list.push(step.id);
      dependents.set(depId, list);
    }
  }

  const queue: string[] = steps.filter((s) => (inDegree.get(s.id) ?? 0) === 0).map((s) => s.id);
  const ordered: PlanStep[] = [];
  const orderedIds = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (currentId === undefined) break;

    const currentStep = stepsById.get(currentId);
    if (currentStep && !orderedIds.has(currentId)) {
      ordered.push(currentStep);
      orderedIds.add(currentId);
    }

    for (const dependentId of dependents.get(currentId) ?? []) {
      inDegree.set(dependentId, (inDegree.get(dependentId) ?? 0) - 1);
      if ((inDegree.get(dependentId) ?? 0) <= 0) queue.push(dependentId);
    }
  }

  // Filet de sécurité : si un cycle résiduel empêche le tri complet (ne
  // devrait pas arriver après passage par le critic), on ajoute les étapes
  // restantes dans leur ordre d'origine pour ne jamais en perdre.
  if (ordered.length < steps.length) {
    for (const step of steps) {
      if (!orderedIds.has(step.id)) {
        ordered.push(step);
        orderedIds.add(step.id);
      }
    }
  }

  return ordered;
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

/**
 * Exécute un plan préalablement audité par critic.ts. Aucune action n'est
 * déclenchée si le plan n'a pas été approuvé par un humain, et chaque étape
 * sensible reçoit une confirmation individuelle supplémentaire.
 */
export async function executePlan(
  plan: Plan,
  planValidation: PlanValidationResult,
  options: ExecutorOptions,
): Promise<ExecutionResult> {
  const logs: ExecutionLogEntry[] = [];
  const results: Record<string, unknown> = {};

  const timestamp = (): string => new Date().toISOString();

  // --- Garde-fou n°1 : approbation globale du plan -------------------------
  if (planValidation.status !== "approved" && planValidation.status !== "modified") {
    const entry: ExecutionLogEntry = {
      stepId: "plan",
      timestamp: timestamp(),
      status: "skipped",
      error: `Exécution refusée : le plan n'a pas été approuvé par l'utilisateur (statut: ${planValidation.status}).`,
    };
    logs.push(entry);
    await options.onLog?.(entry);
    return { success: false, logs, results };
  }

  const effectivePlan =
    planValidation.status === "modified" && planValidation.modifiedPlan ? planValidation.modifiedPlan : plan;

  const orderedSteps = topologicalSort(effectivePlan.steps);
  const failedStepIds = new Set<string>();
  let overallSuccess = true;

  for (const step of orderedSteps) {
    // Une étape dépendant d'une étape échouée/sautée est automatiquement sautée.
    const blocked = step.dependsOn.some((depId) => failedStepIds.has(depId));
    if (blocked) {
      const entry: ExecutionLogEntry = {
        stepId: step.id,
        timestamp: timestamp(),
        status: "skipped",
        error: "Étape sautée car une dépendance a échoué ou a été refusée.",
      };
      logs.push(entry);
      await options.onLog?.(entry);
      failedStepIds.add(step.id);
      overallSuccess = false;
      continue;
    }

    // --- Garde-fou n°2 : validation humaine individuelle pour les étapes sensibles ---
    if (step.requiresValidation) {
      const stepStatus = await options.requestStepValidation(step, effectivePlan);
      if (stepStatus !== "approved") {
        const entry: ExecutionLogEntry = {
          stepId: step.id,
          timestamp: timestamp(),
          status: "skipped",
          error: `Étape non approuvée par l'utilisateur (statut: ${stepStatus}).`,
        };
        logs.push(entry);
        await options.onLog?.(entry);
        failedStepIds.add(step.id);
        overallSuccess = false;
        continue;
      }
    }

    // Étape purement cognitive (pas d'outil) : rien à exécuter techniquement,
    // on la journalise comme réussie (ex : étape de réflexion ou de synthèse).
    if (!step.tool) {
      const entry: ExecutionLogEntry = {
        stepId: step.id,
        timestamp: timestamp(),
        status: "success",
        output: step.description,
      };
      logs.push(entry);
      await options.onLog?.(entry);
      results[step.id] = step.description;
      continue;
    }

    const tool = options.tools[step.tool];
    if (!tool) {
      const entry: ExecutionLogEntry = {
        stepId: step.id,
        timestamp: timestamp(),
        status: "error",
        error: `Outil "${step.tool}" introuvable dans le registre.`,
      };
      logs.push(entry);
      await options.onLog?.(entry);
      failedStepIds.add(step.id);
      overallSuccess = false;
      continue;
    }

    try {
      const toolResult = await tool.execute(step.params ?? {});
      if (toolResult.success) {
        const entry: ExecutionLogEntry = {
          stepId: step.id,
          timestamp: timestamp(),
          status: "success",
          output: toolResult.data,
        };
        logs.push(entry);
        await options.onLog?.(entry);
        results[step.id] = toolResult.data;
      } else {
        const entry: ExecutionLogEntry = {
          stepId: step.id,
          timestamp: timestamp(),
          status: "error",
          error: toolResult.error ?? "Échec inconnu de l'outil.",
        };
        logs.push(entry);
        await options.onLog?.(entry);
        failedStepIds.add(step.id);
        overallSuccess = false;
      }
    } catch (error) {
      const entry: ExecutionLogEntry = {
        stepId: step.id,
        timestamp: timestamp(),
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      };
      logs.push(entry);
      await options.onLog?.(entry);
      failedStepIds.add(step.id);
      overallSuccess = false;
    }
  }

  return { success: overallSuccess, logs, results };
}
