/**
 * CLASSIFIER
 * =============================================================================
 * Rôle : décider si une information mérite d'être mémorisée sur le long
 * terme, et si oui, de quel type de souvenir il s'agit (fait, préférence,
 * habitude, tâche).
 *
 * SÉCURITÉ : ce module agit comme un filtre de confidentialité avant toute
 * écriture en mémoire. Aucune donnée qui ressemble à un secret (mot de
 * passe, clé API, numéro de carte bancaire, ...) n'est jamais mémorisée,
 * quelle que soit l'opinion du LLM sur le sujet. Ce garde-fou est
 * prioritaire et non contournable (voir `containsSensitiveData`), et il est
 * réutilisé en défense en profondeur par memory.ts.
 * =============================================================================
 */

import type { ClassificationResult, LLMClient, MemoryType } from "./types";

// ---------------------------------------------------------------------------
// Filtre de sécurité : données qui ne doivent JAMAIS être mémorisées
// ---------------------------------------------------------------------------

const SENSITIVE_PATTERNS: RegExp[] = [
  /\b\d{13,19}\b/, // numéros de carte bancaire potentiels
  /\bpassword\s*[:=]\s*\S+/i,
  /\bmot de passe\s*[:=]?\s*\S+/i,
  /\b(sk|pk)_(live|test)_[a-zA-Z0-9]{10,}/, // clés API type Stripe
  /\bapi[_-]?key\s*[:=]\s*\S+/i,
  /\b\d{3}-\d{2}-\d{4}\b/, // format type numéro de sécurité sociale US
];

/** Détecte si un texte ressemble à une donnée sensible (identifiants, secrets, informations bancaires). */
export function containsSensitiveData(text: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

// ---------------------------------------------------------------------------
// Heuristiques locales (rapides, sans appel LLM)
// ---------------------------------------------------------------------------

const HABIT_HINTS = [/tous les jours/i, /chaque matin/i, /chaque soir/i, /d'habitude/i, /toujours/i, /généralement/i];
const PREFERENCE_HINTS = [/j'aime/i, /je préfère/i, /je n'aime pas/i, /je déteste/i, /mon .* préféré/i, /ma .* préférée/i];
const FACT_HINTS = [/je m'appelle/i, /j'habite/i, /je travaille/i, /mon anniversaire/i, /je suis/i];
const TASK_HINTS = [/rappelle-moi/i, /n'oublie pas/i, /il faut que je/i, /je dois/i, /à faire/i];

function heuristicClassification(text: string): { type: MemoryType; confidence: number } | null {
  if (HABIT_HINTS.some((r) => r.test(text))) return { type: "habit", confidence: 0.6 };
  if (TASK_HINTS.some((r) => r.test(text))) return { type: "task", confidence: 0.6 };
  if (PREFERENCE_HINTS.some((r) => r.test(text))) return { type: "preference", confidence: 0.6 };
  if (FACT_HINTS.some((r) => r.test(text))) return { type: "fact", confidence: 0.6 };
  return null;
}

// ---------------------------------------------------------------------------
// Classification assistée par LLM
// ---------------------------------------------------------------------------

interface RawClassificationJSON {
  shouldRemember?: unknown;
  type?: unknown;
  confidence?: unknown;
  reason?: unknown;
}

function buildClassifierPrompt(text: string): string {
  return `Tu es le module de mémorisation d'un assistant personnel. Détermine si le message suivant contient une information suffisamment importante et durable pour être mémorisée sur le long terme à propos de l'utilisateur.

Message :
"""
${text}
"""

Types possibles : "habit" (habitude récurrente), "fact" (fait stable, ex: nom, métier, ville), "preference" (goût, préférence), "task" (tâche ou rappel à faire).

Ne retiens PAS : le small talk, les questions ponctuelles sans valeur durable, les informations déjà évidentes, ou toute donnée sensible (mots de passe, identifiants, informations bancaires).

Réponds STRICTEMENT en JSON, sans texte autour :
{
  "shouldRemember": true|false,
  "type": "habit"|"fact"|"preference"|"task"|null,
  "confidence": 0.0-1.0,
  "reason": "courte justification"
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

function isMemoryType(value: unknown): value is MemoryType {
  return value === "habit" || value === "fact" || value === "preference" || value === "task";
}

/**
 * Détermine si un texte doit être mémorisé et sous quel type.
 * Si un `LLMClient` est fourni, il est utilisé pour une classification fine ;
 * sinon (ou en cas d'échec de l'appel), une heuristique locale prend le relais.
 */
export async function classifyForMemory(text: string, llm?: LLMClient): Promise<ClassificationResult> {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return { shouldRemember: false, type: null, confidence: 1, reason: "Texte vide." };
  }

  // Garde-fou de sécurité : prioritaire sur tout le reste, jamais contournable.
  if (containsSensitiveData(trimmed)) {
    return {
      shouldRemember: false,
      type: null,
      confidence: 1,
      reason:
        "Le contenu ressemble à une donnée sensible (identifiants, informations bancaires...) et ne sera pas mémorisé.",
    };
  }

  if (llm) {
    try {
      const raw = await llm.generate(buildClassifierPrompt(trimmed), { temperature: 0, maxTokens: 300 });
      const parsed = JSON.parse(extractJsonBlock(raw)) as RawClassificationJSON;

      const type = isMemoryType(parsed.type) ? parsed.type : null;
      const shouldRemember = parsed.shouldRemember === true && type !== null;
      const confidence = typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5;
      const reason =
        typeof parsed.reason === "string" && parsed.reason.trim().length > 0 ? parsed.reason.trim() : "Non spécifié.";

      return { shouldRemember, type, confidence, reason };
    } catch (error) {
      console.error("[brain/classifier] Classification LLM indisponible, repli sur l'heuristique :", error);
      // On continue vers le repli heuristique ci-dessous plutôt que d'échouer.
    }
  }

  const heuristic = heuristicClassification(trimmed);
  if (heuristic) {
    return {
      shouldRemember: true,
      type: heuristic.type,
      confidence: heuristic.confidence,
      reason: "Classification heuristique locale (aucun LLM disponible ou échec de l'appel).",
    };
  }

  return {
    shouldRemember: false,
    type: null,
    confidence: 0.5,
    reason: "Aucun signal suffisant pour justifier une mémorisation.",
  };
}
