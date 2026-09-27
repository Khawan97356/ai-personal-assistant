/**
 * CRITIC
 * =============================================================================
 * Rôle : auditer un plan produit par planner.ts AVANT toute validation
 * humaine et avant toute exécution. Le critic vérifie :
 *   - la cohérence structurelle du plan (ids uniques, dépendances valides,
 *     absence de cycles) ;
 *   - la sécurité (outils réellement disponibles, validation humaine
 *     obligatoire pour toute étape à risque moyen ou plus) ;
 *   - optionnellement, via un LLM, la cohérence sémantique et la
 *     faisabilité globale du plan par rapport à son objectif.
 *
 * Le critic peut :
 *   1. Rejeter un plan (isValid = false) si des problèmes bloquants et non
 *      corrigibles existent (plan vide, dépendance circulaire).
 *   2. Corriger automatiquement un plan pour les problèmes récupérables
 *      (ex: outil inconnu neutralisé, validation humaine manquante ajoutée)
 *      et renvoyer un `correctedPlan`.
 *
 * Le critic n'exécute jamais rien et ne modifie jamais un plan "en place" :
 * il renvoie toujours un nouvel objet, le plan d'origine restant intact.
 * =============================================================================
 */

import type { CriticIssue, CriticResult, LLMClient, Plan, PlanStep, RiskLevel, ToolRegistry } from "./types";

const RISK_ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };

// ---------------------------------------------------------------------------
// Vérifications structurelles (déterministes, sans appel LLM)
// ---------------------------------------------------------------------------

function checkStructure(plan: Plan, availableTools: ToolRegistry): CriticIssue[] {
  const issues: CriticIssue[] = [];

  if (plan.steps.length === 0) {
    issues.push({ stepId: null, severity: "high", message: "Le plan ne contient aucune étape." });
    return issues; // inutile de poursuivre les vérifications sur un plan vide
  }

  const seenIds = new Set<string>();
  const stepIds = new Set(plan.steps.map((s) => s.id));

  for (const step of plan.steps) {
    // Identifiants dupliqués
    if (seenIds.has(step.id)) {
      issues.push({ stepId: step.id, severity: "high", message: "Identifiant d'étape dupliqué." });
    }
    seenIds.add(step.id);

    // Outil référencé mais inexistant dans le registre
    if (step.tool && !availableTools[step.tool]) {
      issues.push({
        stepId: step.id,
        severity: "critical",
        message: `L'outil "${step.tool}" n'existe pas dans le registre d'outils disponibles.`,
      });
    }

    // Dépendances pointant vers des étapes inconnues
    for (const depId of step.dependsOn) {
      if (!stepIds.has(depId)) {
        issues.push({
          stepId: step.id,
          severity: "high",
          message: `Dépendance vers une étape inconnue : "${depId}".`,
        });
      }
    }

    // Une étape avec un outil à risque medium+ doit exiger une validation humaine
    const toolRisk = step.tool ? availableTools[step.tool]?.riskLevel : "low";
    if (toolRisk && RISK_ORDER[toolRisk] >= RISK_ORDER.medium && !step.requiresValidation) {
      issues.push({
        stepId: step.id,
        severity: "critical",
        message: "Étape à risque moyen ou plus sans validation humaine requise.",
      });
    }

    // Étape sans description exploitable
    if (!step.description || step.description.trim().length < 3) {
      issues.push({ stepId: step.id, severity: "medium", message: "Description d'étape manquante ou trop courte." });
    }
  }

  // Détection de cycle dans le graphe de dépendances (DFS classique)
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stepsById = new Map(plan.steps.map((s) => [s.id, s]));

  function hasCycle(stepId: string): boolean {
    if (visited.has(stepId)) return false;
    if (visiting.has(stepId)) return true;
    visiting.add(stepId);
    const step = stepsById.get(stepId);
    if (step) {
      for (const dep of step.dependsOn) {
        if (hasCycle(dep)) return true;
      }
    }
    visiting.delete(stepId);
    visited.add(stepId);
    return false;
  }

  for (const step of plan.steps) {
    if (hasCycle(step.id)) {
      issues.push({ stepId: step.id, severity: "critical", message: "Dépendance circulaire détectée dans le plan." });
      break;
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Corrections automatiques pour les problèmes récupérables
// ---------------------------------------------------------------------------

function autoCorrect(plan: Plan, availableTools: ToolRegistry): Plan {
  const correctedSteps: PlanStep[] = plan.steps.map((step) => {
    let next: PlanStep = { ...step };

    // Neutralise les outils inconnus plutôt que de laisser une étape
    // pointer vers un outil qui n'existe pas.
    if (next.tool && !availableTools[next.tool]) {
      next = { ...next, tool: null, requiresValidation: true };
    }

    // Force la validation humaine pour toute étape à risque moyen ou plus,
    // que ce risque vienne de l'outil ou de l'étape elle-même.
    const toolRisk = next.tool ? availableTools[next.tool]?.riskLevel : "low";
    if ((toolRisk && RISK_ORDER[toolRisk] >= RISK_ORDER.medium) || RISK_ORDER[next.riskLevel] >= RISK_ORDER.medium) {
      next = { ...next, requiresValidation: true };
    }

    return next;
  });

  // Nettoie les dépendances pointant vers des ids qui n'existent plus.
  const validIds = new Set(correctedSteps.map((s) => s.id));
  const cleanedSteps = correctedSteps.map((s) => ({
    ...s,
    dependsOn: s.dependsOn.filter((id) => validIds.has(id)),
  }));

  const riskLevel = cleanedSteps.reduce<RiskLevel>(
    (max, s) => (RISK_ORDER[s.riskLevel] > RISK_ORDER[max] ? s.riskLevel : max),
    "low",
  );

  return { ...plan, steps: cleanedSteps, riskLevel };
}

// ---------------------------------------------------------------------------
// Revue sémantique optionnelle via LLM
// ---------------------------------------------------------------------------

interface SemanticReviewJSON {
  isCoherent?: unknown;
  isFeasible?: unknown;
  concerns?: unknown;
}

function buildCriticPrompt(plan: Plan): string {
  return `Tu es un auditeur de sécurité qui relit un plan d'action avant qu'il soit exécuté par un agent IA.
Évalue si ce plan est cohérent avec son objectif, réalisable, et s'il présente des risques pour l'utilisateur (actions irréversibles, financières, envoi de données à des tiers, etc.).

Plan à auditer (JSON) :
${JSON.stringify({ goal: plan.goal, steps: plan.steps, risks: plan.risks }, null, 2)}

Réponds STRICTEMENT avec un objet JSON, sans texte autour :
{
  "isCoherent": true|false,
  "isFeasible": true|false,
  "concerns": ["préoccupation 1", "préoccupation 2"]
}`;
}

function extractJsonBlock(raw: string): string {
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) return fencedMatch[1].trim();
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1);
  }
  return raw.trim();
}

async function semanticReview(plan: Plan, llm: LLMClient): Promise<CriticIssue[]> {
  try {
    const raw = await llm.generate(buildCriticPrompt(plan), { temperature: 0, maxTokens: 600 });
    const parsed = JSON.parse(extractJsonBlock(raw)) as SemanticReviewJSON;
    const issues: CriticIssue[] = [];

    if (parsed.isCoherent === false) {
      issues.push({ stepId: null, severity: "high", message: "Le plan a été jugé incohérent avec son objectif." });
    }
    if (parsed.isFeasible === false) {
      issues.push({ stepId: null, severity: "high", message: "Le plan a été jugé non réalisable en l'état." });
    }
    if (Array.isArray(parsed.concerns)) {
      for (const concern of parsed.concerns) {
        if (typeof concern === "string" && concern.trim().length > 0) {
          issues.push({ stepId: null, severity: "medium", message: concern.trim() });
        }
      }
    }
    return issues;
  } catch (error) {
    // Un échec de la revue sémantique n'invalide pas le plan : on retombe
    // simplement sur les vérifications structurelles, toujours fiables.
    console.error("[brain/critic] Revue sémantique indisponible :", error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

export interface CriticOptions {
  /** Si fourni, active une revue sémantique du plan via un LLM en plus des vérifications structurelles. */
  llm?: LLMClient;
}

/**
 * Audite un plan et renvoie un verdict de validité, la liste des problèmes
 * détectés, et une version corrigée du plan quand c'est possible.
 */
export async function reviewPlan(
  plan: Plan,
  availableTools: ToolRegistry,
  options: CriticOptions = {},
): Promise<CriticResult> {
  const structuralIssues = checkStructure(plan, availableTools);
  const semanticIssues = options.llm ? await semanticReview(plan, options.llm) : [];
  const allIssues = [...structuralIssues, ...semanticIssues];

  // Problèmes que l'auto-correction ne peut structurellement pas réparer.
  const isUnrecoverable =
    plan.steps.length === 0 || structuralIssues.some((i) => i.message.includes("Dépendance circulaire"));

  if (isUnrecoverable) {
    return { isValid: false, issues: allIssues, correctedPlan: null };
  }

  if (allIssues.length === 0) {
    return { isValid: true, issues: [], correctedPlan: null };
  }

  // Tente une correction automatique, puis revérifie le plan corrigé pour
  // s'assurer qu'aucun problème critique ne subsiste.
  const correctedPlan = autoCorrect(plan, availableTools);
  const remainingIssues = checkStructure(correctedPlan, availableTools);
  const stillCritical = remainingIssues.some((i) => i.severity === "critical");

  return {
    isValid: !stillCritical,
    issues: allIssues,
    correctedPlan: stillCritical ? null : correctedPlan,
  };
}
