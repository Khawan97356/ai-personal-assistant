/**
 * MEMORY
 * =============================================================================
 * Rôle : gérer la mémoire long terme de l'agent. Chaque souvenir important
 * (fait, préférence, habitude, tâche) est transformé en embedding vectoriel
 * et stocké dans une base vectorielle.
 *
 * Ce module ne dépend d'AUCUNE base de données spécifique : il travaille à
 * travers l'interface `VectorStore` définie dans types.ts. Une implémentation
 * simple en mémoire (`InMemoryVectorStore`) est fournie par défaut pour le
 * développement local ou les tests ; en production, on branche un store
 * persistant (Pinecone, Weaviate, Supabase/pgvector, Chroma, ...) qui
 * implémente la même interface, sans rien changer au reste du module.
 *
 * SÉCURITÉ : aucun secret ni donnée sensible ne doit être stocké en clair.
 * `createMemory` réutilise le détecteur de données sensibles de
 * classifier.ts comme défense en profondeur : même si classifier.ts n'a pas
 * été appelé en amont, memory.ts refuse d'enregistrer un contenu suspect.
 * =============================================================================
 */

import type { EmbeddingClient, Memory, MemoryType, RecalledMemory, VectorStore } from "./types";
import { containsSensitiveData } from "./classifier";

// ---------------------------------------------------------------------------
// Utilitaires locaux
// ---------------------------------------------------------------------------

function generateId(prefix: string): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  const random = g.crypto?.randomUUID
    ? g.crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random}`;
}

/** Similarité cosinus entre deux vecteurs de même dimension. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ---------------------------------------------------------------------------
// Implémentation par défaut : store vectoriel en mémoire (dev / tests)
// ---------------------------------------------------------------------------

/**
 * Implémentation minimale de `VectorStore` gardant tout en RAM.
 * À utiliser uniquement en développement : les souvenirs sont perdus au
 * redémarrage du process. Pour la production, fournissez votre propre
 * implémentation (Pinecone, pgvector, Weaviate, ...) respectant la même
 * interface `VectorStore` définie dans types.ts.
 */
export class InMemoryVectorStore implements VectorStore {
  private memories: Map<string, Memory> = new Map();

  async upsert(memory: Memory): Promise<void> {
    this.memories.set(memory.id, memory);
  }

  async query(embedding: number[], topK: number): Promise<RecalledMemory[]> {
    const scored: RecalledMemory[] = Array.from(this.memories.values()).map((memory) => ({
      ...memory,
      similarity: cosineSimilarity(embedding, memory.embedding),
    }));
    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, topK);
  }

  async delete(id: string): Promise<void> {
    this.memories.delete(id);
  }

  async getAll(): Promise<Memory[]> {
    return Array.from(this.memories.values());
  }
}

// ---------------------------------------------------------------------------
// Création et stockage de souvenirs
// ---------------------------------------------------------------------------

/**
 * Construit un objet `Memory` complet à partir d'un contenu texte, en
 * calculant son embedding via le client fourni.
 *
 * Lève une erreur si le contenu ressemble à une donnée sensible : c'est un
 * invariant de sécurité non contournable, quel que soit l'appelant.
 */
export async function createMemory(
  type: MemoryType,
  content: string,
  embeddingClient: EmbeddingClient,
  metadata?: Record<string, unknown>,
): Promise<Memory> {
  if (containsSensitiveData(content)) {
    throw new Error(
      "[brain/memory] Refus de mémoriser un contenu qui ressemble à une donnée sensible (identifiants, informations bancaires, ...).",
    );
  }

  const embedding = await embeddingClient.embed(content);
  return {
    id: generateId("mem"),
    type,
    content,
    embedding,
    createdAt: new Date().toISOString(),
    metadata,
  };
}

/** Persiste un souvenir dans la base vectorielle. */
export async function storeMemory(memory: Memory, vectorStore: VectorStore): Promise<void> {
  await vectorStore.upsert(memory);
}

/**
 * Fonction de confort combinant création + stockage en un seul appel.
 * C'est le point d'entrée principal pour "mémoriser" une information.
 */
export async function remember(
  type: MemoryType,
  content: string,
  embeddingClient: EmbeddingClient,
  vectorStore: VectorStore,
  metadata?: Record<string, unknown>,
): Promise<Memory> {
  const memory = await createMemory(type, content, embeddingClient, metadata);
  await storeMemory(memory, vectorStore);
  return memory;
}

/** Supprime un souvenir (droit à l'oubli / correction d'une information erronée). */
export async function forget(id: string, vectorStore: VectorStore): Promise<void> {
  await vectorStore.delete(id);
}

/** Liste tous les souvenirs stockés, tous types confondus. */
export async function getAllMemories(vectorStore: VectorStore): Promise<Memory[]> {
  return vectorStore.getAll();
}

// ---------------------------------------------------------------------------
// Apprentissage des habitudes
// ---------------------------------------------------------------------------

const HABIT_SIMILARITY_THRESHOLD = 0.9;

/**
 * Apprend une habitude observée. Si une habitude très similaire existe déjà
 * en mémoire, son "score de confiance" et son compteur d'occurrences sont
 * renforcés plutôt que de créer un doublon. Sinon, une nouvelle habitude est
 * créée avec un faible score de confiance initial.
 *
 * C'est ce mécanisme qui permet au cerveau d'apprendre progressivement les
 * habitudes de l'utilisateur (ex : "se couche généralement vers 23h",
 * "préfère les réunions le matin") au fil des observations répétées.
 */
export async function learnHabit(
  observedContent: string,
  embeddingClient: EmbeddingClient,
  vectorStore: VectorStore,
  similarityThreshold: number = HABIT_SIMILARITY_THRESHOLD,
): Promise<Memory> {
  if (containsSensitiveData(observedContent)) {
    throw new Error("[brain/memory] Refus d'apprendre une habitude contenant une donnée sensible.");
  }

  const embedding = await embeddingClient.embed(observedContent);
  const candidates = await vectorStore.query(embedding, 5);
  const existingHabit = candidates.find((m) => m.type === "habit" && m.similarity >= similarityThreshold);

  if (existingHabit) {
    const previousOccurrences =
      typeof existingHabit.metadata?.occurrences === "number" ? existingHabit.metadata.occurrences : 1;
    const occurrences = previousOccurrences + 1;

    const updated: Memory = {
      ...existingHabit,
      metadata: {
        ...existingHabit.metadata,
        occurrences,
        lastObservedAt: new Date().toISOString(),
        // Converge asymptotiquement vers 1 sans jamais l'atteindre : plus une
        // habitude est observée, plus elle devient fiable.
        confidence: Math.min(1, occurrences / (occurrences + 2)),
      },
    };
    await vectorStore.upsert(updated);
    return updated;
  }

  const newHabit: Memory = {
    id: generateId("mem"),
    type: "habit",
    content: observedContent,
    embedding,
    createdAt: new Date().toISOString(),
    metadata: { occurrences: 1, lastObservedAt: new Date().toISOString(), confidence: 1 / 3 },
  };
  await vectorStore.upsert(newHabit);
  return newHabit;
}
