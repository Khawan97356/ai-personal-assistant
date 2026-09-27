/**
 * MOTEUR DE MÉMOIRE UNIFIÉ (MemoryEngine)
 * =============================================================================
 * Point d'entrée SINGLE SOURCE OF TRUTH pour TOUTE gestion de mémoire dans
 * l'application. Ce moteur orchestre :
 *
 *   1. CLASSIFICATION  → classifier.ts détermine si un texte mérite mémorisation
 *   2. EMBEDDING       → embeddings.ts / OpenAI calcule les vecteurs 1536d
 *   3. STOCKAGE        → memoryAdapters.ts écrit en pgvector ET JSON (double écriture)
 *   4. RAPPEL          → recall.ts + vectorMemory.ts font la recherche hybride
 *   5. CONSOLIDATION   → déduplication, apprentissage d'habitudes, fusion
 *   6. CHUNKS          → indexation des fragments de messages/emails pour le RAG
 *
 * Usage:
 *   const engine = MemoryEngine.forUser(userId);
 *   await engine.learnFromConversation(userMessage, assistantReply);
 *   const relevant = await engine.ask("Quel est mon horaire préféré ?");
 * =============================================================================
 */

import { classifyForMemory } from "./brain/classifier";
import { createMemory, remember, learnHabit, forget, getAllMemories } from "./brain/memory";
import { recallRelevantMemories, recallRecent, recallByType } from "./brain/recall";
import {
  StandardEmbeddingClient,
  MultiBackendVectorStore,
} from "./memoryAdapters";
import { saveMemoryChunk, searchSimilarChunks } from "./vectorMemory";
import type {
  EmbeddingClient,
  Memory,
  MemoryType,
  RecalledMemory,
  VectorStore,
  LLMClient,
} from "./brain/types";
import type { IncomingMessage, UserMemory, ChannelType } from "./types";

// ---------------------------------------------------------------------------
// Types publics du moteur
// ---------------------------------------------------------------------------

export interface LearnOptions {
  /** Force le type de mémoire (ignore la classification automatique). */
  forceType?: MemoryType;
  /** Métadonnées arbitraires à attacher au souvenir (source, channel, ...). */
  metadata?: Record<string, unknown>;
  /** Seuil de confiance minimum (0-1) pour accepter la classification. Défaut: 0.45. */
  minConfidence?: number;
  /** Si true, ne déclenche PAS l'apprentissage d'habitude sur les contenus répétitifs. */
  skipHabitInference?: boolean;
}

export interface AskOptions {
  /** Nombre maximum de résultats. Défaut: 5. */
  topK?: number;
  /** Similarité cosinus minimum (0-1). Défaut: 0.7. */
  minSimilarity?: number;
  /** Filtrer par type(s) de mémoire. */
  types?: MemoryType[];
  /** Inclure aussi les chunks RAG (messages, emails). Défaut: true. */
  includeChunks?: boolean;
  /** Pondération hybride : score final = α*sémantique + (1-α)*mots-clés. Défaut: 0.85. */
  hybridAlpha?: number;
}

export interface ConsolidationResult {
  removedDuplicates: number;
  mergedMemories: number;
  reinforcedHabits: number;
}

export interface ChunkIndexResult {
  id: string;
  source: string;
  contentPreview: string;
  similarity?: number;
}

// ---------------------------------------------------------------------------
// Moteur principal
// ---------------------------------------------------------------------------

export class MemoryEngine {
  private userId: string;
  private vectorStore: VectorStore;
  private embeddingClient: EmbeddingClient;
  private llmClient?: LLMClient;

  // Cache local des résultats d'embedding pour éviter les appels redondants
  private embeddingCache: Map<string, number[]> = new Map();

  private constructor(
    userId: string,
    vectorStore: VectorStore,
    embeddingClient: EmbeddingClient,
    llmClient?: LLMClient
  ) {
    this.userId = userId;
    this.vectorStore = vectorStore;
    this.embeddingClient = embeddingClient;
    this.llmClient = llmClient;
  }

  // -------------------------------------------------------------------------
  // Factory : instancie un moteur prêt à l'emploi pour un utilisateur
  // -------------------------------------------------------------------------

  static forUser(userId: string, llmClient?: LLMClient): MemoryEngine {
    return new MemoryEngine(
      userId,
      new MultiBackendVectorStore(userId),
      new StandardEmbeddingClient(),
      llmClient
    );
  }

  // -------------------------------------------------------------------------
  // API ÉCRITURE : apprentissage et mémorisation
  // -------------------------------------------------------------------------

  /**
   * Point d'entrée principal : analyse un texte libre, le classifie, et
   * mémorise l'information si elle est pertinente. Renvoie le souvenir
   * créé (ou null si rien n'a été mémorisé).
   */
  async learn(
    text: string,
    options: LearnOptions = {}
  ): Promise<Memory | null> {
    const trimmed = text.trim();
    if (trimmed.length < 8) return null;

    const forceType = options.forceType;
    const minConfidence = options.minConfidence ?? 0.45;
    const metadata = options.metadata ?? {};

    // 1. Classification (ou forcée)
    let memoryType: MemoryType | null = forceType ?? null;
    let confidence = forceType ? 1 : 0;

    if (!forceType) {
      const classification = await classifyForMemory(trimmed, this.llmClient);
      if (!classification.shouldRemember || !classification.type) return null;
      if (classification.confidence < minConfidence) return null;
      memoryType = classification.type;
      confidence = classification.confidence;
    }

    if (!memoryType) return null;

    // 2. Cas spécial : habitude → apprentissage incrémental avec déduplication
    if (memoryType === "habit" && !options.skipHabitInference) {
      return learnHabit(trimmed, this.embeddingClient, this.vectorStore);
    }

    // 3. Cas général : création + stockage
    return remember(
      memoryType,
      trimmed,
      this.embeddingClient,
      this.vectorStore,
      { ...metadata, confidence }
    );
  }

  /**
   * Mémorise explicitement un fait, préférence, ou habitude — sans
   * classification automatique. À utiliser quand l'appelant sait déjà
   * ce qu'il veut stocker (ex: formulaire de préférences utilisateur).
   */
  async rememberFact(
    type: MemoryType,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<Memory> {
    return remember(type, content, this.embeddingClient, this.vectorStore, metadata);
  }

  /**
   * Extrait et mémorise les informations importantes d'un échange
   * conversationnel complet (message utilisateur + réponse assistant).
   * Renvoie la liste des souvenirs effectivement créés.
   */
  async learnFromConversation(
    userMessage: string,
    assistantReply: string,
    options: LearnOptions = {}
  ): Promise<Memory[]> {
    const created: Memory[] = [];

    // Indexe d'abord les deux messages comme chunks pour le RAG
    await this.indexChunk({
      source: "conversation",
      content: userMessage,
      sourceRef: "user",
    });
    await this.indexChunk({
      source: "conversation",
      content: assistantReply,
      sourceRef: "assistant",
    });

    // Tente d'extraire des souvenirs structurés du message utilisateur
    const fromUser = await this.learn(userMessage, options);
    if (fromUser) created.push(fromUser);

    // Tente d'extraire des souvenirs de la réponse (ex: confirmations)
    if (assistantReply.trim().length > 20) {
      const fromAssistant = await this.learn(assistantReply, {
        ...options,
        skipHabitInference: true,
      });
      if (fromAssistant) created.push(fromAssistant);
    }

    return created;
  }

  /**
   * Indexe un message entrant (email, whatsapp, telegram, ...) pour le RAG :
   *   - Stocke le contenu comme chunk vectoriel
   *   - Tente d'extraire des faits structurés (VIP, contraintes, engagements)
   */
  async ingestIncomingMessage(message: IncomingMessage): Promise<{
    chunked: ChunkIndexResult | null;
    factsExtracted: Memory[];
  }> {
    const factsExtracted: Memory[] = [];

    // 1. Indexation du chunk brut pour recherche sémantique ultérieure
    let chunked: ChunkIndexResult | null = null;
    try {
      const fullText = [message.subject, message.content].filter(Boolean).join(" — ");
      const chunk = await this.indexChunk({
        source: message.channel,
        content: fullText,
        sourceRef: message.id,
      });
      chunked = {
        id: chunk.id,
        source: chunk.source,
        contentPreview: chunk.content.substring(0, 120),
      };
    } catch (err) {
      console.warn("[MemoryEngine] chunk indexation failed:", err);
    }

    // 2. Extraction heuristique d'informations structurées
    const from = message.sender.name.toLowerCase();
    const idf = message.sender.identifier.toLowerCase();
    const content = message.content.toLowerCase();

    // VIP détecté → mémorise la relation
    if (message.sender.isVip) {
      const vipFact = `Le contact "${message.sender.name}" (${message.sender.identifier}) est considéré comme VIP/prioritaire.`;
      const already = await this.ask(`VIP ${message.sender.name}`, { topK: 1 });
      if (already.length === 0 || already[0].similarity < 0.9) {
        const mem = await this.rememberFact(
          "fact",
          vipFact,
          { category: "vip_relation", channel: message.channel, source: "ingest" }
        );
        factsExtracted.push(mem);
      }
    }

    // Mots-clés d'engagement / contrainte
    const ENGAGEMENT_PATTERNS = [
      /avant (le )?\d{1,2}[h\/\-]\d{1,2}/i,
      /d'ici (ce soir|demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i,
      /\b(urgent|prioritaire|asap)\b/i,
    ];
    const isEngagement = ENGAGEMENT_PATTERNS.some((p) => p.test(message.content));
    if (isEngagement && message.sender.isVip) {
      const engagementFact = `Contrainte temporelle : ${message.sender.name} attend une action ou réponse concernant : "${
        message.subject || message.content.substring(0, 80)
      }".`;
      const mem = await this.rememberFact(
        "fact",
        engagementFact,
        { category: "constraint", channel: message.channel, source: "ingest" }
      );
      factsExtracted.push(mem);
    }

    // 3. Tentative d'apprentissage via le classifier sur le contenu
    const classifiedFact = await this.learn(message.content, {
      metadata: { channel: message.channel, from, identifier: idf, source: "ingest" },
    });
    if (classifiedFact) factsExtracted.push(classifiedFact);

    return { chunked, factsExtracted };
  }

  /**
   * Stocke un fragment de texte (chunk) pour la recherche sémantique (RAG).
   * Les chunks sont les éléments bruts : emails, messages, notes, documents.
   */
  async indexChunk(params: {
    source: string;
    content: string;
    sourceRef?: string;
  }): Promise<{ id: string; source: string; content: string }> {
    return saveMemoryChunk({
      userId: this.userId,
      source: params.source,
      content: params.content,
      sourceRef: params.sourceRef,
    });
  }

  // -------------------------------------------------------------------------
  // API LECTURE : rappel et recherche
  // -------------------------------------------------------------------------

  /**
   * Interroge la mémoire : retrouve les souvenirs ET les chunks sémantiquement
   * les plus pertinents pour une requête en langage naturel.
   * C'est l'équivalent d'un "ask memory" hybride.
   */
  async ask(query: string, options: AskOptions = {}): Promise<RecalledMemory[]> {
    const topK = options.topK ?? 5;
    const minSimilarity = options.minSimilarity ?? 0.7;
    const includeChunks = options.includeChunks ?? true;
    const alpha = options.hybridAlpha ?? 0.85;

    // 1. Recherche sémantique dans les souvenirs structurés (brain/memory)
    const semanticMemories = await recallRelevantMemories(
      query,
      this.embeddingClient,
      this.vectorStore,
      {
        topK: topK * 2,
        minSimilarity: Math.min(minSimilarity, 0.5),
        types: options.types,
      }
    );

    // 2. Normalisation du score avec α (hybride sémantique + mots-clés)
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const normalized = semanticMemories.map((m) => {
      let keywordBoost = 0;
      if (queryTerms.length > 0) {
        const contentLower = m.content.toLowerCase();
        const hits = queryTerms.filter((t) => contentLower.includes(t)).length;
        keywordBoost = hits / queryTerms.length; // 0..1
      }
      const hybridScore = alpha * m.similarity + (1 - alpha) * keywordBoost * 0.5;
      return { ...m, similarity: Math.min(1, hybridScore) };
    });

    // 3. Recherche dans les chunks RAG et mappage en RecalledMemory
    if (includeChunks) {
      try {
        const chunks = await searchSimilarChunks(this.userId, query, topK);
        for (const c of chunks) {
          if ((c.similarity ?? 0) >= minSimilarity * 0.85) {
            let keywordBoost = 0;
            if (queryTerms.length > 0) {
              const contentLower = c.content.toLowerCase();
              const hits = queryTerms.filter((t) => contentLower.includes(t)).length;
              keywordBoost = hits / queryTerms.length;
            }
            const hybridScore =
              alpha * (c.similarity ?? 0) + (1 - alpha) * keywordBoost * 0.5;

            normalized.push({
              id: `chunk_${c.id}`,
              type: "fact",
              content: `[source: ${c.source}] ${c.content}`,
              embedding: [], // non nécessaire pour l'affichage
              createdAt: c.createdAt,
              similarity: Math.min(1, hybridScore),
              metadata: {
                category: "chunk",
                source: c.source,
                sourceRef: c.sourceRef,
              },
            });
          }
        }
      } catch (err) {
        console.warn("[MemoryEngine] chunks search skipped:", err);
      }
    }

    // 4. Tri final + seuil + limite
    return normalized
      .sort((a, b) => b.similarity - a.similarity)
      .filter((m) => m.similarity >= minSimilarity)
      .slice(0, topK);
  }

  /**
   * Récupère les souvenirs les plus récents, indépendamment de la
   * pertinence sémantique. Utile pour le fil de continuité ("que s'est-il
   * passé récemment ?").
   */
  async getRecent(limit: number = 10, type?: MemoryType): Promise<Memory[]> {
    return recallRecent(this.vectorStore, limit, type);
  }

  /**
   * Récupère les souvenirs d'un certain type, triés par pertinence
   * vis-à-vis d'une requête.
   */
  async getByType(
    query: string,
    type: MemoryType,
    options: AskOptions = {}
  ): Promise<RecalledMemory[]> {
    const topK = options.topK ?? 5;
    const minSimilarity = options.minSimilarity ?? 0.7;
    return recallByType(query, type, this.embeddingClient, this.vectorStore, {
      topK,
      minSimilarity,
    });
  }

  /**
   * Récupère TOUS les souvenirs stockés pour cet utilisateur.
   * ⚠️ Coûteux : à utiliser pour l'interface d'administration uniquement.
   */
  async getAll(): Promise<Memory[]> {
    return getAllMemories(this.vectorStore);
  }

  /**
   * Récupère les souvenirs sous forme de UserMemory (format compatible avec
   * l'interface historique de l'application).
   */
  async getAllAsUserMemory(): Promise<UserMemory[]> {
    const all = await this.getAll();
    return all.map((m) => {
      const category = (m.metadata?.category as UserMemory["category"]) ??
        (m.type === "preference" ? "preference" :
         m.type === "habit" ? "work_habit" : "constraint");
      return {
        id: m.id,
        userId: this.userId,
        category,
        fact: m.content,
        createdAt: m.createdAt,
      };
    });
  }

  // -------------------------------------------------------------------------
  // MAINTENANCE : consolidation, oubli, nettoyage
  // -------------------------------------------------------------------------

  /**
   * Supprime un souvenir par son identifiant (droit à l'oubli / correction).
   */
  async forget(memoryId: string): Promise<void> {
    return forget(memoryId, this.vectorStore);
  }

  /**
   * Lance une passe de consolidation :
   *   - Supprime les doublons sémantiques proches (>= 0.95 de similarité)
   *   - Fusionne les souvenirs redondants en gardant le plus récent
   *   - Renforce les habitudes qui apparaissent dans plusieurs faits
   */
  async consolidate(options?: {
    similarityThreshold?: number;
  }): Promise<ConsolidationResult> {
    const threshold = options?.similarityThreshold ?? 0.92;
    const result: ConsolidationResult = {
      removedDuplicates: 0,
      mergedMemories: 0,
      reinforcedHabits: 0,
    };

    const all = await getAllMemories(this.vectorStore);
    if (all.length < 2) return result;

    // Calcule tous les embeddings (avec cache) pour comparaison par paires
    const embeddings: Map<string, number[]> = new Map();
    for (const m of all) {
      if (m.embedding && m.embedding.length === 1536) {
        embeddings.set(m.id, m.embedding);
      } else {
        try {
          const e = await this.cachedEmbed(m.content);
          embeddings.set(m.id, e);
        } catch {
          // ignore
        }
      }
    }

    const toDelete = new Set<string>();

    // Paires : comparer chaque mémoire à ses successeurs
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      if (toDelete.has(a.id)) continue;
      const eA = embeddings.get(a.id);
      if (!eA) continue;

      for (let j = i + 1; j < all.length; j++) {
        const b = all[j];
        if (toDelete.has(b.id)) continue;
        const eB = embeddings.get(b.id);
        if (!eB) continue;

        const sim = cosineSimilarityLocal(eA, eB);

        // Doublons quasi-parfaits → garder le plus récent
        if (sim >= threshold && a.type === b.type) {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          toDelete.add(dateA >= dateB ? b.id : a.id);
          result.removedDuplicates++;
          result.mergedMemories++;
        }
      }
    }

    // Applique les suppressions
    for (const id of toDelete) {
      try {
        await forget(id, this.vectorStore);
      } catch (err) {
        console.warn("[MemoryEngine] consolidate forget failed:", id, err);
      }
    }

    // Reinforcement des habitudes : repasse les souvenirs de type "fact"
    // qui correspondent à des répétitions d'habitudes et les transforme
    const factMemories = (await getAllMemories(this.vectorStore)).filter(
      (m) => m.type === "fact"
    );
    for (const fact of factMemories) {
      const habitKeywords = /toujours|généralement|d'habitude|chaque|tous les|souvent/i;
      if (habitKeywords.test(fact.content)) {
        try {
          await learnHabit(fact.content, this.embeddingClient, this.vectorStore, 0.88);
          result.reinforcedHabits++;
        } catch (err) {
          // ignore
        }
      }
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Utilitaires internes
  // -------------------------------------------------------------------------

  private async cachedEmbed(text: string): Promise<number[]> {
    const key = text.substring(0, 200);
    const cached = this.embeddingCache.get(key);
    if (cached) return cached;
    const emb = await this.embeddingClient.embed(text);
    this.embeddingCache.set(key, emb);
    return emb;
  }
}

// ---------------------------------------------------------------------------
// Helpers locaux (ne dépendent pas de l'état du moteur)
// ---------------------------------------------------------------------------

function cosineSimilarityLocal(a: number[], b: number[]): number {
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
// Instance singleton par userId (pour hot-path / réutilisation)
// ---------------------------------------------------------------------------

const engineCache: Map<string, MemoryEngine> = new Map();

export function getMemoryEngine(userId: string, llmClient?: LLMClient): MemoryEngine {
  const key = `${userId}_${llmClient ? "llm" : "no-llm"}`;
  if (!engineCache.has(key)) {
    engineCache.set(key, MemoryEngine.forUser(userId, llmClient));
  }
  return engineCache.get(key)!;
}
