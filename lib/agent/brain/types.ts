/**
 * ============================================================================
 * BRAIN MODULE — Types partagés
 * ============================================================================
 * Ce fichier centralise TOUS les types utilisés par les autres modules du
 * "cerveau" de l'agent. Aucun autre fichier ne doit redéfinir ces types.
 *
 *   classifier.ts       -> décide si une information doit être mémorisée
 *   memory.ts           -> stocke les souvenirs (embeddings + base vectorielle)
 *   recall.ts           -> retrouve les souvenirs pertinents pour une demande
 *   context-builder.ts  -> assemble demande + plan + souvenirs + historique
 *   planner.ts          -> transforme une demande en plan d'action structuré
 *   critic.ts           -> audite un plan (cohérence, sécurité, faisabilité)
 *   executor.ts         -> exécute un plan APPROUVÉ PAR UN HUMAIN, étape par étape
 *
 * Flux type d'une requête utilisateur :
 *   1. recall.ts rappelle les souvenirs pertinents pour la demande
 *   2. context-builder.ts assemble le contexte final pour le modèle IA
 *   3. Si une action est demandée : planner.ts propose un plan
 *   4. critic.ts audite ce plan et le corrige automatiquement si possible
 *   5. Le plan est présenté à l'utilisateur pour VALIDATION HUMAINE explicite
 *   6. Si (et seulement si) approuvé : executor.ts exécute les étapes,
 *      avec re-confirmation individuelle pour les étapes à risque
 *   7. classifier.ts + memory.ts mémorisent les informations importantes
 *      issues de l'échange (faits, préférences, habitudes, tâches)
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Niveaux de risque & validation humaine
// ---------------------------------------------------------------------------

/** Niveau de risque associé à une étape, un outil, ou un plan complet. */
export type RiskLevel = "low" | "medium" | "high" | "critical";

/** Statut de validation humaine d'un plan ou d'une étape. */
export type ValidationStatus = "pending" | "approved" | "rejected" | "modified";

/** Résultat renvoyé par la couche applicative lorsqu'elle soumet un plan à l'utilisateur. */
export interface PlanValidationResult {
  status: ValidationStatus;
  /** Version modifiée du plan par l'utilisateur, uniquement si status === "modified". */
  modifiedPlan?: Plan;
}

/**
 * Fonction fournie par la couche applicative (ex: route API Next.js, UI de
 * chat) qui présente le plan à l'utilisateur et attend sa décision.
 * Le module brain ne décide jamais lui-même : il délègue toujours ce choix.
 */
export type HumanValidationCallback = (plan: Plan) => Promise<PlanValidationResult>;

// ---------------------------------------------------------------------------
// Outils (email, calendrier, API, fichiers, ...)
// ---------------------------------------------------------------------------

/** Résultat générique renvoyé par l'exécution d'un outil. */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Contrat qu'un outil doit respecter pour être appelable par l'executor.
 * Chaque intégration concrète (envoi d'email, création d'événement,
 * appel API, écriture de fichier, ...) implémente cette interface.
 */
export interface Tool {
  /** Identifiant unique de l'outil, ex: "send_email", "create_calendar_event". */
  name: string;
  /** Description utilisée par le planner pour choisir le bon outil. */
  description: string;
  /** Niveau de risque intrinsèque de l'outil (ex: envoyer un email = medium). */
  riskLevel: RiskLevel;
  /** Exécute l'outil avec les paramètres fournis par le plan. */
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

/** Registre des outils disponibles, indexé par nom. */
export type ToolRegistry = Record<string, Tool>;

// ---------------------------------------------------------------------------
// Plan / étapes
// ---------------------------------------------------------------------------

export interface PlanStep {
  id: string;
  /** Description humainement lisible de l'étape. */
  description: string;
  /** Nom de l'outil requis, ou null si l'étape est purement cognitive/informative. */
  tool: string | null;
  /** Paramètres à transmettre à l'outil lors de l'exécution. */
  params?: Record<string, unknown>;
  /** Risque estimé pour cette étape précise. */
  riskLevel: RiskLevel;
  /** Cette étape nécessite-t-elle une re-confirmation humaine juste avant son exécution ? */
  requiresValidation: boolean;
  /** Ids des étapes qui doivent être terminées avec succès avant celle-ci. */
  dependsOn: string[];
}

export interface Plan {
  id: string;
  /** But global reformulé de la demande utilisateur. */
  goal: string;
  /** Liste des étapes (ordre logique, dépendances explicites via dependsOn). */
  steps: PlanStep[];
  /** Liste des outils nécessaires (union des tools des steps). */
  tools: string[];
  /** Risques globaux identifiés sur l'ensemble du plan, en langage naturel. */
  risks: string[];
  /** Niveau de risque global (le plus élevé parmi toutes les étapes). */
  riskLevel: RiskLevel;
  createdAt: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// Critic
// ---------------------------------------------------------------------------

export interface CriticIssue {
  /** Id de l'étape concernée, ou null si le problème est global au plan. */
  stepId: string | null;
  severity: RiskLevel;
  message: string;
}

export interface CriticResult {
  isValid: boolean;
  issues: CriticIssue[];
  /** Plan corrigé automatiquement si le critic a pu résoudre les problèmes. */
  correctedPlan: Plan | null;
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export interface ExecutionLogEntry {
  stepId: string;
  timestamp: string; // ISO 8601
  status: "success" | "error" | "skipped";
  output?: unknown;
  error?: string;
}

export interface ExecutionResult {
  success: boolean;
  logs: ExecutionLogEntry[];
  /** Résultats indexés par id d'étape. */
  results: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Mémoire
// ---------------------------------------------------------------------------

export type MemoryType = "habit" | "fact" | "preference" | "task";

export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  embedding: number[];
  createdAt: string; // ISO 8601
  /** Métadonnées libres (occurrences, confiance, source, tags, ...). */
  metadata?: Record<string, unknown>;
}

/** Un souvenir enrichi de son score de similarité vis-à-vis d'une requête. */
export interface RecalledMemory extends Memory {
  /** Similarité cosinus avec la requête, entre -1 et 1. */
  similarity: number;
}

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

export interface ClassificationResult {
  shouldRemember: boolean;
  type: MemoryType | null;
  confidence: number; // 0 - 1
  reason: string;
}

// ---------------------------------------------------------------------------
// Contexte / historique de conversation
// ---------------------------------------------------------------------------

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: string; // ISO 8601
}

export interface AgentContext {
  userRequest: string;
  plan: Plan | null;
  relevantMemories: RecalledMemory[];
  recentHistory: ConversationTurn[];
  /** Prompt final assemblé, prêt à être envoyé au modèle IA. */
  composedPrompt: string;
}

// ---------------------------------------------------------------------------
// Clients externes injectables (LLM, embeddings, stockage vectoriel)
// ---------------------------------------------------------------------------
// Le module brain ne dépend d'AUCUN fournisseur précis : on injecte ces
// interfaces depuis la couche applicative (ex: un adaptateur Claude/OpenAI
// pour LLMClient, un adaptateur OpenAI/Voyage pour EmbeddingClient, un
// adaptateur Pinecone/pgvector/Weaviate pour VectorStore). Cela garde le
// cerveau testable, portable et remplaçable sans toucher à sa logique.

export interface LLMClient {
  generate: (
    prompt: string,
    options?: { temperature?: number; maxTokens?: number },
  ) => Promise<string>;
}

export interface EmbeddingClient {
  embed: (text: string) => Promise<number[]>;
}

export interface VectorStore {
  upsert: (memory: Memory) => Promise<void>;
  query: (embedding: number[], topK: number) => Promise<RecalledMemory[]>;
  delete: (id: string) => Promise<void>;
  getAll: () => Promise<Memory[]>;
}
