import type { VoicePersona } from "./types";

export const EXTRA_VOICE_PERSONAS: VoicePersona[] = [
  { id: "camille", name: "Camille — Experte facturation & compta", lang: "fr-FR", register: "feminine", defaultMood: "pedagogical", defaultRate: 0.96, defaultPitch: 1.0,
    backendVoiceIds: { elevenlabs: process.env.ELEVENLABS_VOICE_CAMILLE || "Drew", openai: "nova", google: "fr-FR-Neural2-A" },
    naturalness: { pauseDensity: 0.55, hesitationFrequency: 0.05, breathBreaks: true, rateJitter: 0.02, pitchJitter: 0.015 } },
  { id: "victor",  name: "Victor — Chef de projet & agenda",     lang: "fr-FR", register: "masculine", defaultMood: "dynamic",      defaultRate: 1.02, defaultPitch: 0.98,
    backendVoiceIds: { elevenlabs: process.env.ELEVENLABS_VOICE_VICTOR || "Matthew", openai: "onyx", google: "fr-FR-Neural2-B" },
    naturalness: { pauseDensity: 0.45, hesitationFrequency: 0.08, breathBreaks: true, rateJitter: 0.03, pitchJitter: 0.02 } },
  { id: "jeanne",  name: "Jeanne — Senior douce & rassurante",   lang: "fr-FR", register: "feminine", defaultMood: "empathetic",   defaultRate: 0.94, defaultPitch: 0.98,
    backendVoiceIds: { elevenlabs: process.env.ELEVENLABS_VOICE_JEANNE || "Gigi", openai: "shimmer", google: "fr-FR-Neural2-C" },
    naturalness: { pauseDensity: 0.55, hesitationFrequency: 0.22, breathBreaks: true, rateJitter: 0.025, pitchJitter: 0.02 } },
  { id: "lily",    name: "Lily — Jeune dynamique & fun",        lang: "fr-FR", register: "feminine", defaultMood: "enthusiastic", defaultRate: 1.08, defaultPitch: 1.08,
    backendVoiceIds: { elevenlabs: process.env.ELEVENLABS_VOICE_LILY || "Alice", openai: "alloy", google: "fr-FR-Neural2-A" },
    naturalness: { pauseDensity: 0.3, hesitationFrequency: 0.2, breathBreaks: true, rateJitter: 0.05, pitchJitter: 0.04 } },
  { id: "paul",    name: "Paul — Stratège & complice",          lang: "fr-FR", register: "masculine", defaultMood: "complicit",    defaultRate: 1.0,  defaultPitch: 1.0,
    backendVoiceIds: { elevenlabs: process.env.ELEVENLABS_VOICE_PAUL || "Josh", openai: "echo", google: "fr-FR-Neural2-D" },
    naturalness: { pauseDensity: 0.4, hesitationFrequency: 0.18, breathBreaks: true, rateJitter: 0.035, pitchJitter: 0.025 } },
  { id: "sasha",   name: "Sasha — Neutre & professionnelle",    lang: "fr-FR", register: "neutral",  defaultMood: "serious",      defaultRate: 1.0,  defaultPitch: 1.0,
    backendVoiceIds: { elevenlabs: process.env.ELEVENLABS_VOICE_SASHA || "Charlie", openai: "fable", google: "fr-FR-Neural2-D" },
    naturalness: { pauseDensity: 0.3, hesitationFrequency: 0.02, breathBreaks: false, rateJitter: 0.015, pitchJitter: 0.01 } },
];

export function getAllPersonas(baseDefault: VoicePersona[]): VoicePersona[] {
  const ids = new Set(baseDefault.map((p) => p.id));
  const merged = [...baseDefault];
  for (const p of EXTRA_VOICE_PERSONAS) if (!ids.has(p.id)) { ids.add(p.id); merged.push(p); }
  return merged;
}