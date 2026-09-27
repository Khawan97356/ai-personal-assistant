/**
 * CONTEXT BUILDER
 * =============================================================================
 * Rôle : assembler tous les éléments dont le modèle IA a besoin pour
 * répondre ou décider intelligemment : la demande utilisateur, le plan
 * d'action éventuel, les souvenirs pertinents rappelés (recall.ts), et
 * l'historique récent de la conversation. Le résultat est un `AgentContext`
 * structuré, accompagné d'un prompt texte prêt à être envoyé au modèle.
 *
 * Ce module est une pure fonction d'assemblage : il ne fait aucun appel
 * réseau, ne lit ni n'écrit aucune donnée lui-même.
 * =============================================================================
 */

import type { AgentContext, ConversationTurn, Plan, RecalledMemory } from "./types";

export interface BuildContextInput {
  userRequest: string;
  plan?: Plan | null;
  relevantMemories?: RecalledMemory[];
  recentHistory?: ConversationTurn[];
  /** Nombre maximum de tours d'historique à inclure dans le prompt final. Par défaut : 10. */
  maxHistoryTurns?: number;
}

function formatMemories(memories: RecalledMemory[]): string {
  if (memories.length === 0) return "(aucun souvenir pertinent trouvé)";
  return memories
    .map((m) => `- [${m.type}] ${m.content} (pertinence: ${(m.similarity * 100).toFixed(0)}%)`)
    .join("\n");
}

function formatHistory(history: ConversationTurn[], maxTurns: number): string {
  const recent = history.slice(-maxTurns);
  if (recent.length === 0) return "(aucun historique)";
  return recent.map((turn) => `${turn.role === "user" ? "Utilisateur" : "Assistant"}: ${turn.content}`).join("\n");
}

function formatPlan(plan: Plan | null | undefined): string {
  if (!plan) return "(aucun plan en cours)";
  const stepsText = plan.steps
    .map(
      (step, index) =>
        `  ${index + 1}. ${step.description}${step.tool ? ` [outil: ${step.tool}]` : ""} (risque: ${step.riskLevel})`,
    )
    .join("\n");
  return `But : ${plan.goal}\nÉtapes :\n${stepsText}\nRisques identifiés : ${
    plan.risks.length > 0 ? plan.risks.join(", ") : "aucun"
  }`;
}

/**
 * Construit le contexte final structuré, incluant un prompt texte assemblé
 * prêt à être transmis au modèle IA (dans le champ `composedPrompt`).
 */
export function buildAgentContext(input: BuildContextInput): AgentContext {
  const relevantMemories = input.relevantMemories ?? [];
  const recentHistory = input.recentHistory ?? [];
  const maxHistoryTurns = input.maxHistoryTurns ?? 10;
  const plan = input.plan ?? null;

  const composedPrompt = `Tu es un assistant personnel IA doté d'une mémoire long terme et d'une capacité de planification.

### Souvenirs pertinents sur l'utilisateur
${formatMemories(relevantMemories)}

### Historique récent de la conversation
${formatHistory(recentHistory, maxHistoryTurns)}

### Plan d'action actuel
${formatPlan(plan)}

### Demande actuelle de l'utilisateur
${input.userRequest}

Réponds en tenant compte du contexte ci-dessus. Si un plan d'action est présent et nécessite l'exécution d'outils, rappelle qu'aucune action ne sera exécutée sans validation explicite de l'utilisateur.`;

  return {
    userRequest: input.userRequest,
    plan,
    relevantMemories,
    recentHistory,
    composedPrompt,
  };
}
