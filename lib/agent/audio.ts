/**
 * Service de transcription audio pour les messages vocaux WhatsApp et Telegram.
 * Compatible avec l'API Whisper d'OpenAI ou Groq Whisper Turbo.
 */

export interface TranscriptionResult {
  text: string;
  durationSeconds?: number;
  language?: string;
  confidence?: number;
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  fileName: string = "voice_note.ogg"
): Promise<TranscriptionResult> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY;

  if (!apiKey) {
    console.warn("TranscribeAudio: Aucune clé API OpenAI/Groq trouvée, mode simulation.");
    return {
      text: "Bonjour ! Peux-tu me confirmer si la réunion de validation budgétaire est maintenue pour demain 14h ? Merci !",
      durationSeconds: 15,
      language: "fr",
      confidence: 0.98,
    };
  }

  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/ogg" });
    formData.append("file", blob, fileName);
    formData.append("model", process.env.GROQ_API_KEY ? "whisper-large-v3" : "whisper-1");
    formData.append("language", "fr");

    const endpoint = process.env.GROQ_API_KEY
      ? "https://api.groq.com/openai/v1/audio/transcriptions"
      : "https://api.openai.com/v1/audio/transcriptions";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Whisper API Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return {
      text: data.text,
      language: data.language || "fr",
      durationSeconds: data.duration,
    };
  } catch (error) {
    console.error("Erreur lors de la transcription audio :", error);
    throw error;
  }
}
