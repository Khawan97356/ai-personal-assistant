/**
 * ADAPTATEURS DU MOTEUR DE MÉMOIRE
 * =============================================================================
 * Ponts entre les interfaces abstraites du module "brain" (VectorStore,
 * EmbeddingClient) et les implémentations concrètes du projet :
 *   - PostgreSQL / pgvector via Prisma (production)
 *   - Fichier JSON via lib/db/store (développement / fallback)
 *   - OpenAI Embeddings API via lib/agent/embeddings
 *
 * Ces adaptateurs permettent au MemoryEngine unifié de fonctionner avec
 * n'importe quelle combinaison de backend sans changer sa logique interne.
 * =============================================================================
 */

import type { Memory, MemoryType, RecalledMemory, VectorStore, EmbeddingClient } from "./brain/types";
import { cosineSimilarity } from "./embeddings";
import { prisma, isPrismaAvailable } from "@/lib/db/prisma";
import { db } from "@/lib/db/store";
import { getEmbedding } from "./embeddings";
import type { UserMemory } from "./types";

// ---------------------------------------------------------------------------
// Mappage bidirectionnel entre les types "brain" et les types persistés
// ---------------------------------------------------------------------------

const CATEGORY_TO_TYPE: Record<UserMemory["category"], MemoryType> = {
  preference: "preference",
  constraint: "fact",
  vip_relation: "fact",
  work_habit: "habit",
};

const TYPE_TO_CATEGORY: Partial<Record<MemoryType, UserMemory["category"]>> = {
  preference: "preference",
  habit: "work_habit",
  fact: "constraint",
  task: "constraint",
};

function memoryFromUserMemory(um: UserMemory, embedding: number[]): Memory {
  return {
    id: um.id,
    type: CATEGORY_TO_TYPE[um.category] ?? "fact",
    content: um.fact,
    embedding,
    createdAt: um.createdAt,
    metadata: { category: um.category, persistence: "json" },
  };
}

// ---------------------------------------------------------------------------
// Adaptateur 1 : OpenAI EmbeddingClient pour le module brain
// ---------------------------------------------------------------------------

export class StandardEmbeddingClient implements EmbeddingClient {
  async embed(text: string): Promise<number[]> {
    return getEmbedding(text);
  }
}

// ---------------------------------------------------------------------------
// Adaptateur 2 : Prisma/pgvector VectorStore
// ---------------------------------------------------------------------------

export class PrismaVectorStore implements VectorStore {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async upsert(memory: Memory): Promise<void> {
    if (!isPrismaAvailable()) return;

    const category = TYPE_TO_CATEGORY[memory.type] ?? "preference";
    const vectorStr = `[${memory.embedding.join(",")}]`;

    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "UserMemory" (id, "userId", category, fact, "createdAt", embedding)
         VALUES ($1, $2, $3::text, $4, $5::timestamptz, $6::vector)
         ON CONFLICT (id) DO UPDATE SET
           category = EXCLUDED.category,
           fact = EXCLUDED.fact,
           embedding = EXCLUDED.embedding`,
        memory.id,
        this.userId,
        category,
        memory.content,
        new Date(memory.createdAt).toISOString(),
        vectorStr
      );
    } catch (err) {
      console.warn("[MemoryEngine] PrismaVectorStore upsert failed:", err);
    }
  }

  async query(queryEmbedding: number[], topK: number): Promise<RecalledMemory[]> {
    if (!isPrismaAvailable()) return [];

    try {
      const vectorStr = `[${queryEmbedding.join(",")}]`;
      const rows = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          category: string;
          fact: string;
          createdAt: Date;
          similarity: number;
        }>
      >(
        `SELECT id, category, fact, "createdAt",
                (1 - (embedding <=> $1::vector)) as similarity
         FROM "UserMemory"
         WHERE "userId" = $2 AND embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector ASC
         LIMIT $3`,
        vectorStr,
        this.userId,
        topK
      );

      return Promise.all(
        (rows || []).map(async (r) => {
          let emb: number[];
          try {
            emb = await getEmbedding(r.fact);
          } catch {
            emb = new Array(1536).fill(0);
          }
          return {
            id: r.id,
            type: (CATEGORY_TO_TYPE[(r.category as UserMemory["category"])] ?? "fact"),
            content: r.fact,
            embedding: emb,
            createdAt: r.createdAt.toISOString(),
            similarity: Number(r.similarity),
            metadata: { category: r.category, persistence: "pgvector" },
          } as RecalledMemory;
        })
      );
    } catch (err) {
      console.warn("[MemoryEngine] PrismaVectorStore query failed:", err);
      return [];
    }
  }

  async delete(id: string): Promise<void> {
    if (!isPrismaAvailable()) return;
    try {
      await prisma.userMemory.deleteMany({ where: { id, userId: this.userId } });
    } catch (err) {
      console.warn("[MemoryEngine] PrismaVectorStore delete failed:", err);
    }
  }

  async getAll(): Promise<Memory[]> {
    if (!isPrismaAvailable()) return [];
    try {
      const rows = await prisma.userMemory.findMany({ where: { userId: this.userId } });
      return Promise.all(
        rows.map(async (r) => {
          let emb: number[];
          try {
            emb = await getEmbedding(r.fact);
          } catch {
            emb = new Array(1536).fill(0);
          }
          return memoryFromUserMemory(
            {
              id: r.id,
              userId: r.userId,
              category: r.category as UserMemory["category"],
              fact: r.fact,
              createdAt: r.createdAt.toISOString(),
            },
            emb
          );
        })
      );
    } catch (err) {
      console.warn("[MemoryEngine] PrismaVectorStore getAll failed:", err);
      return [];
    }
  }
}

// ---------------------------------------------------------------------------
// Adaptateur 3 : JSON File VectorStore (fallback local)
// ---------------------------------------------------------------------------

export class JsonFileVectorStore implements VectorStore {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  private async computeEmbedding(content: string, existingEmbedding?: number[]): Promise<number[]> {
    if (existingEmbedding && existingEmbedding.length === 1536) return existingEmbedding;
    try {
      return getEmbedding(content);
    } catch {
      return new Array(1536).fill(0);
    }
  }

  async upsert(memory: Memory): Promise<void> {
    const existing = db.memories.getAll(this.userId).find((m) => m.id === memory.id);
    if (existing) {
      db.memories.delete(memory.id, this.userId);
    }
    const category = TYPE_TO_CATEGORY[memory.type] ?? "preference";
    db.memories.add({
      userId: this.userId,
      fact: memory.content,
      category,
    });
  }

  async query(queryEmbedding: number[], topK: number): Promise<RecalledMemory[]> {
    const userMemories = db.memories.getAll(this.userId);

    const scored = await Promise.all(
      userMemories.map(async (um) => {
        const emb = await this.computeEmbedding(um.fact);
        return {
          memory: memoryFromUserMemory(um, emb),
          similarity: cosineSimilarity(queryEmbedding, emb),
        };
      })
    );

    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .map(({ memory, similarity }) => ({ ...memory, similarity }));
  }

  async delete(id: string): Promise<void> {
    db.memories.delete(id, this.userId);
  }

  async getAll(): Promise<Memory[]> {
    const userMemories = db.memories.getAll(this.userId);
    return Promise.all(
      userMemories.map(async (um) => {
        const emb = await this.computeEmbedding(um.fact);
        return memoryFromUserMemory(um, emb);
      })
    );
  }
}

// ---------------------------------------------------------------------------
// Adaptateur 4 : VectorStore Multi-backend (Prisma + JSON fallback)
// ---------------------------------------------------------------------------

export class MultiBackendVectorStore implements VectorStore {
  private primary: VectorStore;
  private secondary: VectorStore;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.primary = new PrismaVectorStore(userId);
    this.secondary = new JsonFileVectorStore(userId);
  }

  async upsert(memory: Memory): Promise<void> {
    await Promise.allSettled([this.primary.upsert(memory), this.secondary.upsert(memory)]);
  }

  async query(queryEmbedding: number[], topK: number): Promise<RecalledMemory[]> {
    const [primaryResult, secondaryResult] = await Promise.allSettled([
      this.primary.query(queryEmbedding, topK * 2),
      this.secondary.query(queryEmbedding, topK * 2),
    ]);

    const primaryList =
      primaryResult.status === "fulfilled" ? primaryResult.value : [];
    const secondaryList =
      secondaryResult.status === "fulfilled" ? secondaryResult.value : [];

    const seen = new Set<string>();
    const merged: RecalledMemory[] = [];

    for (const m of [...primaryList, ...secondaryList]) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        merged.push(m);
      }
    }

    return merged.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }

  async delete(id: string): Promise<void> {
    await Promise.allSettled([this.primary.delete(id), this.secondary.delete(id)]);
  }

  async getAll(): Promise<Memory[]> {
    const [primaryResult, secondaryResult] = await Promise.allSettled([
      this.primary.getAll(),
      this.secondary.getAll(),
    ]);

    const primaryList =
      primaryResult.status === "fulfilled" ? primaryResult.value : [];
    const secondaryList =
      secondaryResult.status === "fulfilled" ? secondaryResult.value : [];

    const seen = new Set<string>();
    const merged: Memory[] = [];
    for (const m of [...primaryList, ...secondaryList]) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        merged.push(m);
      }
    }
    return merged;
  }

  getUserId(): string {
    return this.userId;
  }
}
