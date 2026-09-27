/**
 * Système de Mémoire Long Terme & RAG Vectoriel pour OmniMind AI.
 * Gère le stockage et la recherche sémantique par similarité cosinus (pgvector).
 * Fonctionne avec PostgreSQL (pgvector) et possède un fallback local en mémoire.
 */

import { prisma, isPrismaAvailable } from "@/lib/db/prisma";
import { getEmbedding, cosineSimilarity } from "./embeddings";
import { UserMemory } from "./types";

export interface MemoryChunkRecord {
  id: string;
  userId: string;
  source: string;
  sourceRef?: string | null;
  content: string;
  createdAt: string;
  similarity?: number;
}

// Cache local en mémoire pour le développement sans PostgreSQL local
const inMemoryChunks: Array<{
  id: string;
  userId: string;
  source: string;
  sourceRef?: string | null;
  content: string;
  embedding: number[];
  createdAt: string;
}> = [];

const inMemoryFactEmbeddings: Map<string, number[]> = new Map();

/**
 * Enregistre un fragment de texte (email, message, note) dans la mémoire vectorielle
 */
export async function saveMemoryChunk(params: {
  userId: string;
  source: string;
  content: string;
  sourceRef?: string;
}): Promise<MemoryChunkRecord> {
  const { userId, source, content, sourceRef } = params;
  const id = `chk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const createdAt = new Date().toISOString();

  // 1. Calcul de l'embedding 1536d
  const embedding = await getEmbedding(content);

  // 2. Persistance dans PostgreSQL pgvector si disponible
  if (isPrismaAvailable()) {
    try {
      const vectorStr = `[${embedding.join(",")}]`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "MemoryChunk" (id, "userId", source, "sourceRef", content, embedding, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6::vector, NOW())`,
        id,
        userId,
        source,
        sourceRef || null,
        content,
        vectorStr
      );
    } catch (err) {
      console.warn("[VectorMemory] Échec insertion pgvector, conservation en cache mémoire:", err);
    }
  }

  // 3. Toujours synchroniser le cache mémoire
  const chunkItem = {
    id,
    userId,
    source,
    sourceRef: sourceRef || null,
    content,
    embedding,
    createdAt,
  };
  inMemoryChunks.unshift(chunkItem);

  return {
    id,
    userId,
    source,
    sourceRef: sourceRef || null,
    content,
    createdAt,
  };
}

/**
 * Recherche les fragments sémantiquement les plus proches d'une requête utilisateur
 */
export async function searchSimilarChunks(
  userId: string,
  query: string,
  limit: number = 5
): Promise<MemoryChunkRecord[]> {
  const queryEmbedding = await getEmbedding(query);

  // 1. Recherche pgvector native dans PostgreSQL
  if (isPrismaAvailable()) {
    try {
      const vectorStr = `[${queryEmbedding.join(",")}]`;
      const rows = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          userId: string;
          source: string;
          sourceRef: string | null;
          content: string;
          createdAt: Date;
          similarity: number;
        }>
      >(
        `SELECT id, "userId", source, "sourceRef", content, "createdAt",
                (1 - (embedding <=> $1::vector)) as similarity
         FROM "MemoryChunk"
         WHERE "userId" = $2
         ORDER BY embedding <=> $1::vector ASC
         LIMIT $3`,
        vectorStr,
        userId,
        limit
      );

      if (rows && rows.length > 0) {
        return rows.map((r) => ({
          id: r.id,
          userId: r.userId,
          source: r.source,
          sourceRef: r.sourceRef,
          content: r.content,
          createdAt: r.createdAt.toISOString(),
          similarity: Number(r.similarity),
        }));
      }
    } catch (err) {
      console.warn("[VectorMemory] Recherche pgvector échouée, basculement en cache mémoire:", err);
    }
  }

  // 2. Fallback de recherche par similarité cosinus en mémoire
  const userChunks = inMemoryChunks.filter((c) => c.userId === userId);
  const scored = userChunks.map((chunk) => ({
    id: chunk.id,
    userId: chunk.userId,
    source: chunk.source,
    sourceRef: chunk.sourceRef,
    content: chunk.content,
    createdAt: chunk.createdAt,
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  return scored.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}

/**
 * Indexe un fait ou une contrainte utilisateur (UserMemory) avec son embedding vectoriel
 */
export async function indexUserMemoryFact(memory: {
  id: string;
  userId: string;
  fact: string;
  category: string;
}): Promise<void> {
  const embedding = await getEmbedding(memory.fact);
  inMemoryFactEmbeddings.set(memory.id, embedding);

  if (isPrismaAvailable()) {
    try {
      const vectorStr = `[${embedding.join(",")}]`;
      await prisma.$executeRawUnsafe(
        `UPDATE "UserMemory" SET embedding = $1::vector WHERE id = $2`,
        vectorStr,
        memory.id
      );
    } catch (err) {
      console.warn("[VectorMemory] Erreur mise à jour embedding UserMemory:", err);
    }
  }
}

/**
 * Recherche sémantique dans les souvenirs et faits de l'utilisateur (RAG hybride)
 */
export async function searchSemanticUserMemories(
  userId: string,
  query: string,
  allMemories: UserMemory[],
  limit: number = 5
): Promise<UserMemory[]> {
  const queryEmbedding = await getEmbedding(query);

  // 1. Essai pgvector direct sur la table UserMemory
  if (isPrismaAvailable()) {
    try {
      const vectorStr = `[${queryEmbedding.join(",")}]`;
      const rows = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          userId: string;
          category: string;
          fact: string;
          createdAt: Date;
          similarity: number;
        }>
      >(
        `SELECT id, "userId", category, fact, "createdAt",
                (1 - (embedding <=> $1::vector)) as similarity
         FROM "UserMemory"
         WHERE "userId" = $2 AND embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector ASC
         LIMIT $3`,
        vectorStr,
        userId,
        limit
      );

      if (rows && rows.length > 0) {
        return rows.map((r) => ({
          id: r.id,
          userId: r.userId,
          category: r.category as UserMemory["category"],
          fact: r.fact,
          createdAt: r.createdAt.toISOString(),
        }));
      }
    } catch (err) {
      console.warn("[VectorMemory] Recherche vectorielle UserMemory:", err);
    }
  }

  // 2. Fallback hybride en mémoire (similarité cosinus + mots-clés)
  const scored = await Promise.all(
    allMemories.map(async (m) => {
      let emb = inMemoryFactEmbeddings.get(m.id);
      if (!emb) {
        emb = await getEmbedding(m.fact);
        inMemoryFactEmbeddings.set(m.id, emb);
      }
      const sim = cosineSimilarity(queryEmbedding, emb);
      const containsWord = query
        .toLowerCase()
        .split(/\s+/)
        .some((w) => w.length > 2 && m.fact.toLowerCase().includes(w));
      return { memory: m, score: sim + (containsWord ? 0.3 : 0) };
    })
  );

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.memory);
}
