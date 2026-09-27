/**
 * Service de génération d'embeddings vectoriels pour le système RAG d'OmniMind.
 * Dimension standard : 1536 (OpenAI text-embedding-3-small ou text-embedding-ada-002).
 */

export const EMBEDDING_DIMENSION = 1536;

/**
 * Calcule la similarité cosinus entre deux vecteurs
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Génère un vecteur unitaire déterministe pour tests / fallback hors ligne
 */
function generateDeterministicFallbackEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSION).fill(0);
  let hash = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }

  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    // Pseudo random generator basé sur le hash du texte
    const x = Math.sin(hash + i * 37) * 10000;
    vector[i] = x - Math.floor(x);
  }

  // Normalisation unitaire
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return vector.map((v) => (norm > 0 ? v / norm : 0));
}

/**
 * Génère l'embedding d'un texte unique (dimension 1536)
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const cleanText = text.replace(/\n+/g, " ").trim();
  if (!cleanText) {
    return new Array<number>(EMBEDDING_DIMENSION).fill(0);
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: cleanText.substring(0, 8000),
          dimensions: EMBEDDING_DIMENSION,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const embedding = data.data?.[0]?.embedding;
        if (Array.isArray(embedding) && embedding.length === EMBEDDING_DIMENSION) {
          return embedding;
        }
      } else {
        const err = await response.text();
        console.warn("[Embeddings] Erreur API OpenAI, utilisation du fallback:", err);
      }
    } catch (err) {
      console.warn("[Embeddings] Échec réseau OpenAI Embeddings, repli fallback:", err);
    }
  }

  return generateDeterministicFallbackEmbedding(cleanText);
}

/**
 * Génère des embeddings par lot (batch)
 */
export async function getBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const cleanTexts = texts.map((t) => t.replace(/\n+/g, " ").trim().substring(0, 8000));
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey && cleanTexts.length > 0) {
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: cleanTexts,
          dimensions: EMBEDDING_DIMENSION,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const items = data.data as Array<{ embedding: number[]; index: number }>;
        if (Array.isArray(items) && items.length === cleanTexts.length) {
          return items.sort((a, b) => a.index - b.index).map((item) => item.embedding);
        }
      }
    } catch (err) {
      console.warn("[Embeddings] Erreur batch embeddings, repli individuel:", err);
    }
  }

  // Fallback
  return Promise.all(cleanTexts.map((t) => getEmbedding(t)));
}
