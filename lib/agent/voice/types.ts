/**
 * TYPES DU MODULE DE VOIX
 * Contrats unifiés pour le moteur de voix humaine :
 * identité vocale, tonalités émotionnelles, backends TTS, post-traitement STT.
 */

// ---------------------------------------------------------------------------
// Identité et tonalité vocale
// ---------------------------------------------------------------------------

/** Intention / humeur à appliquer sur la phrase parlée. */
export type VoiceMood =
  | "neutral"      // Posé, standard
  | "warm"         // Chaleureux, amical
  | "enthusiastic" // Enthousiaste, énergique
  | "serious"      // Calme, sérieux, précis
  | "complicit"    // Complice, souriant
  | "pedagogical"  // Clair, posé, pédagogique (explications tech)
  | "dynamic"      // Dynamique, direct (réponses rapides)
  | "empathetic";  // Doux, empathique

/** Profil vocal complet → personnalité durable de la voix. */
export interface VoicePersona {
  id: string;
  name: string;
  lang: "fr-FR" | "en-US" | string;
  register: "feminine" | "masculine" | "neutral";
  defaultMood: VoiceMood;
  defaultRate: number;
  defaultPitch: number;
  backendVoiceIds: Partial<Record<TTSBackend, string>>;
  naturalness: {
    pauseDensity: number;
    hesitationFrequency: number;
    breathBreaks: boolean;
    rateJitter: number;
    pitchJitter: number;
  };
}

// ---------------------------------------------------------------------------
// Backends de synthèse vocale (TTS)
// ---------------------------------------------------------------------------

export type TTSBackend = "auto" | "browser" | "openai" | "elevenlabs" | "google";

export interface TTSAudioResult {
  audio: Buffer | string;
  format: "audio/mpeg" | "audio/ogg" | "audio/wav" | "audio/mp4";
  durationSeconds?: number;
  backend: TTSBackend;
  hash: string;
}

export interface TTSGenerateOptions {
  backend?: TTSBackend;
  persona?: Partial<VoicePersona>;
  mood?: VoiceMood;
  rate?: number;
  pitch?: number;
  format?: TTSAudioResult["format"];
  useCache?: boolean;
}

// ---------------------------------------------------------------------------
// Pré-traitement texte → "humanisation" avant TTS
// ---------------------------------------------------------------------------

export interface PreprocessedUtterance {
  rawText: string;
  spokenText: string;
  ssml?: string;
  mood: VoiceMood;
  rate: number;
  pitch: number;
  hash: string;
  breathGroups: string[];
}

// ---------------------------------------------------------------------------
// Post-traitement STT → nettoyage de la transcription utilisateur
// ---------------------------------------------------------------------------

export interface ProcessedUserSpeech {
  rawTranscript: string;
  cleanedText: string;
  completedText: string;
  tone: "question" | "command" | "statement" | "uncertain";
  urgency: 0 | 1 | 2;
  keywords: string[];
  removedHesitations: string[];
}

// ---------------------------------------------------------------------------
// API runtime speak()
// ---------------------------------------------------------------------------

export interface SpeakRuntimeOptions extends TTSGenerateOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
  onBoundary?: (index: number, text: string) => void;
  interruptCurrent?: boolean;
}