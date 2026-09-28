import type {
  PreprocessedUtterance,
  ProcessedUserSpeech,
  SpeakRuntimeOptions,
  TTSAudioResult,
  TTSGenerateOptions,
  VoiceMood,
  VoicePersona,
} from "./types";
import { preprocessForSpeech, inferMoodFromText } from "./voicePreprocessor";
import { processUserSpeech as cleanSpeech } from "./sttPostprocessor";
import { generateWithFallback, hashText, mapMoodToTTSParams } from "./ttsBackends";
import { VoiceCache } from "./audioCache";
import { transcribeAudio } from "@/lib/agent/audio";
import { EXTRA_VOICE_PERSONAS, getAllPersonas } from "./personas";

const DEFAULT_PERSONAS: VoicePersona[] = [
  {
    id: "aria",
    name: "Aria — Voix chaleureuse et complice",
    lang: "fr-FR",
    register: "feminine",
    defaultMood: "warm",
    defaultRate: 1.0,
    defaultPitch: 1.03,
    backendVoiceIds: {
      elevenlabs: process.env.ELEVENLABS_VOICE_ID || "Freya",
      openai: "nova",
      google: "fr-FR-Neural2-A",
    },
    naturalness: { pauseDensity: 0.42, hesitationFrequency: 0.18, breathBreaks: true, rateJitter: 0.035, pitchJitter: 0.025 },
  },
  {
    id: "nova",
    name: "Nova — Voix dynamique et enthousiaste",
    lang: "fr-FR",
    register: "feminine",
    defaultMood: "enthusiastic",
    defaultRate: 1.05,
    defaultPitch: 1.06,
    backendVoiceIds: { elevenlabs: "Alice", openai: "alloy", google: "fr-FR-Neural2-C" },
    naturalness: { pauseDensity: 0.28, hesitationFrequency: 0.1, breathBreaks: true, rateJitter: 0.045, pitchJitter: 0.035 },
  },
  {
    id: "elias",
    name: "Elias — Voix calme, pédagogue et sérieuse",
    lang: "fr-FR",
    register: "masculine",
    defaultMood: "pedagogical",
    defaultRate: 0.98,
    defaultPitch: 0.96,
    backendVoiceIds: { elevenlabs: "Matthew", openai: "onyx", google: "fr-FR-Neural2-B" },
    naturalness: { pauseDensity: 0.5, hesitationFrequency: 0.08, breathBreaks: true, rateJitter: 0.025, pitchJitter: 0.018 },
  },
  {
    id: "juno",
    name: "Juno — Voix neutre, posée et confidente",
    lang: "fr-FR",
    register: "neutral",
    defaultMood: "neutral",
    defaultRate: 1.0,
    defaultPitch: 1.0,
    backendVoiceIds: { elevenlabs: "Josh", openai: "echo", google: "fr-FR-Neural2-D" },
    naturalness: { pauseDensity: 0.32, hesitationFrequency: 0.08, breathBreaks: true, rateJitter: 0.03, pitchJitter: 0.02 },
  },
];

export const DEFAULT_PERSONAS_ORIGINAL_SET = [...DEFAULT_PERSONAS];

export class VoiceEngine {
  private persona: VoicePersona;
  private userId: string;

  constructor(userId: string = "public", personaId: string = "aria") {
    this.userId = userId;
    const found = DEFAULT_PERSONAS.find((p) => p.id === personaId);
    this.persona = found ?? DEFAULT_PERSONAS[0];
  }

  static listPersonas(): VoicePersona[] {
    return getAllPersonas(DEFAULT_PERSONAS);
  }

  setPersona(id: string) {
    const found = DEFAULT_PERSONAS.find((p) => p.id === id);
    if (found) this.persona = found;
  }
  getPersona(): VoicePersona { return { ...this.persona }; }

  prepare(text: string, mood?: VoiceMood, overrides?: { rate?: number; pitch?: number }): PreprocessedUtterance {
    return preprocessForSpeech(text, this.persona, mood ?? this.persona.defaultMood, overrides?.rate, overrides?.pitch);
  }

  async speakServer(
    rawText: string,
    options: TTSGenerateOptions = {}
  ): Promise<TTSAudioResult & { preprocessed: PreprocessedUtterance; fromCache: boolean }> {
    const mood: VoiceMood = options.mood ?? inferMoodFromText(rawText);
    const personaMerged: Partial<VoicePersona> = options.persona ? { ...this.persona, ...options.persona } : this.persona;
    const pre = preprocessForSpeech(rawText, personaMerged, mood, options.rate, options.pitch);
    if (!pre.spokenText) {
      return {
        audio: Buffer.alloc(0),
        format: "audio/mpeg",
        backend: options.backend ?? "browser",
        hash: pre.hash,
        durationSeconds: 0,
        preprocessed: pre,
        fromCache: false,
      };
    }
    const cacheOpts = {
      text: pre.spokenText, mood, rate: pre.rate, pitch: pre.pitch,
      backend: options.backend, personaId: this.persona.id, format: options.format, userId: this.userId,
    };
    if (options.useCache !== false) {
      const cached = VoiceCache.get(cacheOpts);
      if (cached) return { ...cached, preprocessed: pre, fromCache: true };
    }
    const mapped = mapMoodToTTSParams(mood, this.persona, { rate: options.rate ?? pre.rate, pitch: options.pitch ?? pre.pitch });
    const result = await generateWithFallback(pre.spokenText, {
      ...options, mood, persona: personaMerged, rate: mapped.rate, pitch: mapped.pitch,
    });
    if (options.useCache !== false && result.audio && typeof result.audio !== "string") {
      try { VoiceCache.put(cacheOpts, result); } catch { /* ignore */ }
    }
    return { ...result, preprocessed: pre, fromCache: false };
  }

  speakClientHints(rawText: string, options: SpeakRuntimeOptions = {}) {
    const mood: VoiceMood = options.mood ?? inferMoodFromText(rawText) ?? this.persona.defaultMood;
    const persona = options.persona ? { ...this.persona, ...options.persona } : this.persona;
    const pre = preprocessForSpeech(rawText, persona, mood, options.rate, options.pitch);
    const params = mapMoodToTTSParams(mood, persona, { rate: options.rate ?? pre.rate, pitch: options.pitch ?? pre.pitch });
    return {
      preprocessed: pre,
      speechSynthesis: {
        lang: persona.lang || "fr-FR",
        rate: params.rate,
        pitch: params.pitch,
        preferredVoiceName: persona.backendVoiceIds.browser as string | undefined,
        mood,
      },
      hash: pre.hash,
    };
  }

  async transcribeUser(audioBuffer: Buffer, fileName: string = "voice_user_input.ogg") {
    const transcription = await transcribeAudio(audioBuffer, fileName);
    const processed = cleanSpeech(transcription.text);
    return { transcription, processed };
  }

  processUserSay(rawTranscript: string): ProcessedUserSpeech { return cleanSpeech(rawTranscript); }
  hash(pre: PreprocessedUtterance): string { return pre.hash || hashText(pre.spokenText); }
  static inferMood(text: string): VoiceMood { return inferMoodFromText(text); }
}

const engineByUser = new Map<string, VoiceEngine>();
export function getVoiceEngine(userId?: string, personaId?: string): VoiceEngine {
  const uid = userId || "public";
  const key = `${uid}__${personaId ?? "aria"}`;
  if (!engineByUser.has(key)) engineByUser.set(key, new VoiceEngine(uid, personaId));
  return engineByUser.get(key)!;
}