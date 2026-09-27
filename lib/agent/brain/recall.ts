/**
 * RECALL
 * =============================================================================
 * Rôle : retrouver, parmi les souvenirs stockés (voir memory.ts), ceux qui
 * sont pertinents pour la demande actuelle de l'utilisateur. C'est le
 * "rappel" qui permet au cerveau de prendre des décisions informées par le
 * passé (habitudes, préférences, faits connus, tâches en cours).
 *
 * Ce module est en pure lecture : il n'écrit jamais dans la base vectorielle.
 * =============================================================================
 */

import type { EmbeddingClient, Memory, MemoryType, RecalledMemory, VectorStore } from "./types";

export interface RecallOptions {
  /** Nombre maximum de souvenirs à renvoyer. Par défaut : 5. */
  topK?: number;
  /** Seuil minimum de similarité cosinus (entre -1 et 1) pour qu'un souvenir soit retenu. Par défaut : 0.75. */
  minSimilarity?: number;
  /** Restreint la recherche à certains types de souvenirs. */
  types?: MemoryType[];
}

const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SIMILARITY = 0.75;

/**
 * Recherche les souvenirs les plus pertinents pour une requête donnée.
 * La requête est transformée en embedding, comparée à tous les souvenirs
 * stockés via la base vectorielle, puis filtrée par similarité minimale et
 * type éventuel.
 */
export async function recallRelevantMemories(
  query: string,
  embeddingClient: EmbeddingClient,
  vectorStore: VectorStore,
  options: RecallOptions = {},
): Promise<RecalledMemory[]> {
  const topK = options.topK ?? DEFAULT_TOP_K;
  const minSimilarity = options.minSimilarity ?? DEFAULT_MIN_SIMILARITY;

  if (!query || query.trim().length === 0) return [];

  const queryEmbedding = await embeddingClient.embed(query);

  // On interroge un peu plus large que topK pour compenser le filtrage
  // ultérieur par type/similarité sans multiplier les allers-retours réseau.
  const candidates = await vectorStore.query(queryEmbedding, Math.max(topK * 4, 20));

  const filtered = candidates.filter((memory) => {
    if (memory.similarity < minSimilarity) return false;
    if (options.types && options.types.length > 0 && !options.types.includes(memory.type)) return false;
    return true;
  });

  return filtered.slice(0, topK);
}

/**
 * Variante pratique pour ne rappeler qu'un seul type de souvenir, par
 * exemple uniquement les habitudes pour adapter le ton d'une réponse.
 */
export async function recallByType(
  query: string,
  type: MemoryType,
  embeddingClient: EmbeddingClient,
  vectorStore: VectorStore,
  options: Omit<RecallOptions, "types"> = {},
): Promise<RecalledMemory[]> {
  return recallRelevantMemories(query, embeddingClient, vectorStore, { ...options, types: [type] });
}

/**
 * Renvoie les souvenirs les plus récents, indépendamment de leur pertinence
 * sémantique. Utile pour donner un fil de continuité (ex : "quelles tâches
 * ai-je créées récemment ?") en complément du rappel par similarité.
 */
export async function recallRecent(vectorStore: VectorStore, limit: number = 10, type?: MemoryType): Promise<Memory[]> {
  const all = await vectorStore.getAll();
  const filtered = type ? all.filter((m) => m.type === type) : all;
  return filtered
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}
