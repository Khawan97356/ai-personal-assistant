/**
 * PLANNER
 * =============================================================================
 * Rôle : transformer une demande utilisateur en langage naturel en un plan
 * d'action structuré, multi-étapes, avec identification des outils requis
 * et détection des risques.
 *
 * Le planner ne connaît PAS le fournisseur de LLM utilisé : il reçoit un
 * `LLMClient` injecté (Anthropic, OpenAI, modèle local, ...), ce qui garde
 * le module extensible et testable indépendamment du reste de l'application.
 *
 * SÉCURITÉ : le planner ne déclenche JAMAIS d'action. Il ne fait que
 * produire une PROPOSITION de plan, qui doit ensuite passer par critic.ts
 * puis par une validation humaine explicite avant tout passage à executor.ts.
 * Le planner applique en plus un filet de sécurité indépendant du LLM : des
 * mots-clés sensibles augmentent mécaniquement le niveau de risque, même si
 * le modèle sous-estime un risque.
 * =============================================================================
 */

import type {
  ConversationTurn,
  LLMClient,
  Plan,
  PlanStep,
  RecalledMemory,
  RiskLevel,
  ToolRegistry,
} from "./types";

// ---------------------------------------------------------------------------
// Utilitaires locaux
// ---------------------------------------------------------------------------

/** Génère un identifiant court et raisonnablement unique, sans dépendance externe. */
function generateId(prefix: string): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  const random = g.crypto?.randomUUID
    ? g.crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random}`;
}

const RISK_ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };

function maxRiskLevel(levels: RiskLevel[]): RiskLevel {
  return levels.reduce<RiskLevel>((max, level) => (RISK_ORDER[level] > RISK_ORDER[max] ? level : max), "low");
}

/**
 * Mots-clés qui augmentent mécaniquement le niveau de risque perçu d'une
 * action, indépendamment de ce que dit le LLM. Ceci sert de filet de
 * sécurité : même si le modèle sous-estime un risque, cette heuristique
 * peut le rattraper.
 */
const HIGH_RISK_KEYWORDS = [
  "supprimer",
  "delete",
  "effacer",
  "virer de l'argent",
  "payer",
  "paiement",
  "transférer des fonds",
  "vendre",
  "acheter",
  "résilier",
  "annuler l'abonnement",
  "envoyer à tous",
  "diffuser publiquement",
  "publier",
];

const MEDIUM_RISK_KEYWORDS = [
  "envoyer un email",
  "envoyer un message",
  "créer un événement",
  "planifier",
  "réserver",
  "modifier",
  "partager",
];

/** Détecte les mots-clés sensibles présents dans un texte (insensible à la casse). */
export function detectRiskKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const keyword of HIGH_RISK_KEYWORDS) {
    if (lower.includes(keyword)) found.push(keyword);
  }
  for (const keyword of MEDIUM_RISK_KEYWORDS) {
    if (lower.includes(keyword)) found.push(keyword);
  }
  return found;
}

function riskLevelFromKeywords(text: string): RiskLevel {
  const lower = text.toLowerCase();
  if (HIGH_RISK_KEYWORDS.some((k) => lower.includes(k))) return "high";
  if (MEDIUM_RISK_KEYWORDS.some((k) => lower.includes(k))) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Construction du prompt envoyé au LLM
// ---------------------------------------------------------------------------

export interface PlannerInput {
  userRequest: string;
  availableTools: ToolRegistry;
  llm: LLMClient;
  recentHistory?: ConversationTurn[];
  relevantMemories?: RecalledMemory[];
}

function buildPlannerPrompt(input: PlannerInput): string {
  const toolsDescription = Object.values(input.availableTools)
    .map((tool) => `- ${tool.name} (risque: ${tool.riskLevel}): ${tool.description}`)
    .join("\n");

  const historyText = (input.recentHistory ?? [])
    .slice(-10)
    .map((turn) => `${turn.role}: ${turn.content}`)
    .join("\n");

  const memoriesText = (input.relevantMemories ?? [])
    .map((mem) => `- [${mem.type}] ${mem.content}`)
    .join("\n");

  return `Tu es le module de planification d'un assistant personnel IA.
Tu ne DOIS JAMAIS exécuter d'action toi-même : tu proposes uniquement un plan.

Demande de l'utilisateur :
"""
${input.userRequest}
"""

Outils disponibles :
${toolsDescription || "(aucun outil disponible)"}

Historique récent de la conversation :
${historyText || "(aucun)"}

Souvenirs pertinents sur l'utilisateur :
${memoriesText || "(aucun)"}

Réponds STRICTEMENT avec un objet JSON valide (aucun texte avant/après, aucun bloc markdown), au format suivant :
{
  "goal": "reformulation claire et concise du but de l'utilisateur",
  "steps": [
    {
      "description": "description humaine de l'étape",
      "tool": "nom_exact_de_l_outil_ou_null",
      "params": {},
      "riskLevel": "low|medium|high|critical"
    }
  ],
  "risks": ["risque identifié 1", "risque identifié 2"]
}

Règles :
- Décompose la demande en étapes atomiques et ordonnées.
- N'utilise que des noms d'outils présents dans la liste ci-dessus, sinon mets "tool": null.
- Sois honnête sur les risques : toute action irréversible, financière, ou touchant des tiers doit être signalée.
- Si la demande est ambiguë ou incomplète, crée une étape unique de type clarification (tool: null) au lieu d'inventer des détails.`;
}

// ---------------------------------------------------------------------------
// Parsing et validation de la réponse du LLM
// ---------------------------------------------------------------------------

interface RawPlanStep {
  description?: unknown;
  tool?: unknown;
  params?: unknown;
  riskLevel?: unknown;
}

interface RawPlanJSON {
  goal?: unknown;
  steps?: unknown;
  risks?: unknown;
}

/** Extrait le premier bloc JSON valide d'une réponse texte (au cas où le LLM ajoute du texte parasite). */
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

function isRiskLevel(value: unknown): value is RiskLevel {
  return value === "low" || value === "medium" || value === "high" || value === "critical";
}

/**
 * Valide et normalise le JSON brut renvoyé par le LLM en un `Plan` fortement
 * typé. Toute donnée manquante ou incohérente est corrigée avec des valeurs
 * sûres par défaut (principe de sécurité : en cas de doute, le risque est
 * considéré comme plus élevé, jamais plus faible).
 */
function normalizePlan(raw: RawPlanJSON, availableTools: ToolRegistry, userRequest: string): Plan {
  const goal = typeof raw.goal === "string" && raw.goal.trim().length > 0 ? raw.goal.trim() : userRequest;

  const rawSteps: RawPlanStep[] = Array.isArray(raw.steps) ? (raw.steps as RawPlanStep[]) : [];

  const steps: PlanStep[] = rawSteps.map((rawStep, index) => {
    const description =
      typeof rawStep.description === "string" && rawStep.description.trim().length > 0
        ? rawStep.description.trim()
        : `Étape ${index + 1} (description manquante)`;

    const toolName = typeof rawStep.tool === "string" ? rawStep.tool : null;
    const tool = toolName && availableTools[toolName] ? toolName : null;

    const params =
      rawStep.params && typeof rawStep.params === "object" && !Array.isArray(rawStep.params)
        ? (rawStep.params as Record<string, unknown>)
        : {};

    const keywordRisk = riskLevelFromKeywords(description);
    const declaredRisk = isRiskLevel(rawStep.riskLevel) ? rawStep.riskLevel : "low";
    const toolRisk = tool ? availableTools[tool].riskLevel : "low";
    // On ne fait jamais confiance aveuglément au modèle pour sous-estimer un
    // risque : on retient toujours le niveau le plus élevé des 3 sources.
    const riskLevel = maxRiskLevel([keywordRisk, declaredRisk, toolRisk]);

    return {
      id: generateId("step"),
      description,
      tool,
      params,
      riskLevel,
      // Toute étape qui appelle un outil, ou dont le risque est >= medium,
      // exigera une re-confirmation humaine individuelle dans l'executor.
      requiresValidation: tool !== null || RISK_ORDER[riskLevel] >= RISK_ORDER.medium,
      dependsOn: [] as string[],
    };
  });

  // Par défaut, chaque étape dépend de la précédente (exécution séquentielle
  // simple). Un planner plus avancé pourrait produire un graphe de
  // dépendances plus riche ; cette structure reste compatible.
  for (let i = 1; i < steps.length; i++) {
    steps[i].dependsOn = [steps[i - 1].id];
  }

  const tools = Array.from(new Set(steps.map((s) => s.tool).filter((t): t is string => t !== null)));

  const declaredRisks = Array.isArray(raw.risks)
    ? raw.risks.filter((r): r is string => typeof r === "string" && r.trim().length > 0)
    : [];
  const heuristicRisks = detectRiskKeywords(userRequest);
  const risks = Array.from(new Set([...declaredRisks, ...heuristicRisks]));

  const stepsRiskLevel = maxRiskLevel(steps.map((s) => s.riskLevel));
  const riskLevel = risks.length > 0 ? maxRiskLevel([stepsRiskLevel, "medium"]) : stepsRiskLevel;

  return {
    id: generateId("plan"),
    goal,
    steps,
    tools,
    risks,
    riskLevel,
    createdAt: new Date().toISOString(),
  };
}

/** Construit un plan de repli minimal et sûr si le LLM échoue ou renvoie une réponse inexploitable. */
function buildFallbackPlan(userRequest: string): Plan {
  const stepId = generateId("step");
  return {
    id: generateId("plan"),
    goal: userRequest,
    steps: [
      {
        id: stepId,
        description:
          "Je n'ai pas pu générer un plan fiable pour cette demande. Merci de préciser ce que tu attends exactement avant que je propose des actions.",
        tool: null,
        params: {},
        riskLevel: "low",
        requiresValidation: true,
        dependsOn: [],
      },
    ],
    tools: [],
    risks: ["Plan généré en mode dégradé : la demande n'a pas pu être décomposée automatiquement."],
    riskLevel: "medium",
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

/**
 * Analyse la demande utilisateur et génère un plan d'action structuré.
 * Ne déclenche AUCUNE action : c'est une pure fonction de réflexion.
 */
export async function createPlan(input: PlannerInput): Promise<Plan> {
  const prompt = buildPlannerPrompt(input);

  let rawResponse: string;
  try {
    rawResponse = await input.llm.generate(prompt, { temperature: 0.2, maxTokens: 1500 });
  } catch (error) {
    console.error("[brain/planner] Échec de l'appel au LLM :", error);
    return buildFallbackPlan(input.userRequest);
  }

  try {
    const jsonBlock = extractJsonBlock(rawResponse);
    const parsed = JSON.parse(jsonBlock) as RawPlanJSON;
    return normalizePlan(parsed, input.availableTools, input.userRequest);
  } catch (error) {
    console.error("[brain/planner] Réponse du LLM non parsable en JSON :", error, rawResponse);
    return buildFallbackPlan(input.userRequest);
  }
}
