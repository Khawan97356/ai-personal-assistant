import type { PreprocessedUtterance, VoiceMood, VoicePersona } from "./types";

function stripWritingArtifacts(text: string): string {
  return text
    .replace(/[*#_`~\[\]]/g, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "un lien web")
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function inferMoodFromText(text: string): VoiceMood {
  const t = text.toLowerCase();
  if (/!{2,}/.test(text) || /\b(super|génial|superbe|fantastique|excellent|bravo|youpi|ouah)\b/.test(t)) return "enthusiastic";
  if (/\b(d'accord, tu vois|quoi !|petit|allez,|viens)\b/.test(t) || /\(:\)|;\)/.test(text)) return "complicit";
  if (/\b(désolé|je suis désolé|je comprends|je suis là|ça doit être dur|malheureusement)\b/.test(t)) return "empathetic";
  if (/\b(bonjour|salut|coucou|bienvenue|merci|avec plaisir|ça me fait plaisir|bien sûr)\b/.test(t)) return "warm";
  if (/\b(expliqu|étape|note|donc|en fait|tout simplement|règle|principe|méthode|attention)\b/.test(t)) return "pedagogical";
  if (/\b(important|attention|problème|erreur|urgence|risque|nécessaire|obligatoire)\b/.test(t)) return "serious";
  if (text.length < 40 && /^[A-ZÀÂÆÉÈÊËÎÏÔŒÙÛÜ]/.test(text.trim())) return "dynamic";
  return "neutral";
}

const HESITATIONS = ["hmm…", "ok…", "attends…", "eh bien,", "alors,", "bon,", "dis donc,"];

function injectHesitations(text: string, frequency: number, seed: number): string {
  if (frequency <= 0 || text.length < 80) return text;
  const sentences = text.split(/(?<=[.!?])\s+/);
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return sentences
    .map((sent, idx) => {
      if (idx === 0) return sent;
      if (rand() < frequency) {
        const pick = HESITATIONS[Math.floor(rand() * HESITATIONS.length)];
        return `${pick} ${sent.charAt(0).toLowerCase()}${sent.slice(1)}`;
      }
      return sent;
    })
    .join(" ");
}

function injectBreathPauses(text: string, density: number): string {
  let out = text.replace(/\.(?=\s+[A-ZÀÂÆÉÈÊËÎÏÔŒÙÛÜ])/g, "… ");
  if (density >= 0.5) out = out.replace(/,(?=\s)/g, ", ");
  if (density >= 0.35) out = out.replace(/\b(donc|en fait|tu vois|sache|justement)\b/gi, "… $1");
  return out.replace(/(…\s*){2,}/g, "… ").trim();
}

const MAX_BREATH_CHARS = 180;

function splitIntoBreathGroups(text: string): string[] {
  const groups: string[] = [];
  const raw = text.split(/(?<=[.!?…])\s+/);
  for (const chunk of raw) {
    if (chunk.length <= MAX_BREATH_CHARS) {
      groups.push(chunk);
      continue;
    }
    const pieces = chunk.split(/(?<=,)\s+/);
    let acc = "";
    for (const p of pieces) {
      if ((acc + " " + p).length > MAX_BREATH_CHARS && acc) {
        groups.push(acc.trim());
        acc = p;
      } else {
        acc = acc ? `${acc} ${p}` : p;
      }
    }
    if (acc.trim()) groups.push(acc.trim());
  }
  return groups.filter(Boolean);
}

function buildSSML(breathGroups: string[], rate: number, pitch: number): string {
  const ratePct = Math.round((rate - 1) * 100);
  const pitchSt = Math.round((pitch - 1) * 10);
  const body = breathGroups.map((g) => `<s>${g.replace(/[…]/g, ",").trim()}</s>`).join(`<break time="180ms"/>`);
  const prosody = `<prosody rate="${ratePct > 0 ? "+" : ""}${ratePct}%" pitch="${pitchSt > 0 ? "+" : ""}${pitchSt}st">${body}</prosody>`;
  return `<?xml version="1.0"?><speak xmlns="http://www.w3.org/2001/10/synthesis" version="1.0" xml:lang="fr-FR">${prosody}</speak>`;
}

export function preprocessForSpeech(
  rawText: string,
  persona?: Partial<VoicePersona>,
  forcedMood?: VoiceMood,
  overrideRate?: number,
  overridePitch?: number
): PreprocessedUtterance {
  const cleaned = stripWritingArtifacts(rawText);
  if (!cleaned) {
    return {
      rawText,
      spokenText: "",
      mood: forcedMood ?? "neutral",
      rate: overrideRate ?? persona?.defaultRate ?? 1.0,
      pitch: overridePitch ?? persona?.defaultPitch ?? 1.02,
      hash: "0000000000000000",
      breathGroups: [],
    };
  }
  const mood: VoiceMood = forcedMood ?? inferMoodFromText(cleaned);
  const jitterRate = persona?.naturalness?.rateJitter ?? 0.03;
  const jitterPitch = persona?.naturalness?.pitchJitter ?? 0.02;
  const seed = cleaned.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 1000;
  const rand = (min: number, max: number) => {
    const s = (seed * 9301 + 49297) % 233280;
    return min + (s / 233280) * (max - min);
  };
  const baseRate = overrideRate ?? persona?.defaultRate ?? 1.0;
  const basePitch = overridePitch ?? persona?.defaultPitch ?? 1.02;
  const finalRate = Number((baseRate + rand(-jitterRate, jitterRate)).toFixed(3));
  const finalPitch = Number((basePitch + rand(-jitterPitch, jitterPitch)).toFixed(3));
  const withHesitations = injectHesitations(cleaned, persona?.naturalness?.hesitationFrequency ?? 0.12, seed);
  const withBreaths = injectBreathPauses(withHesitations, persona?.naturalness?.pauseDensity ?? 0.35);
  const breathGroups = splitIntoBreathGroups(withBreaths);
  let h = 2166136261;
  const hashStr = withBreaths + mood + finalRate.toFixed(3) + finalPitch.toFixed(3);
  for (let i = 0; i < hashStr.length; i++) {
    h ^= hashStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hash = (h >>> 0).toString(16).padStart(8, "0") + seed.toString(16).padStart(8, "0");
  const ssml = persona?.naturalness?.breathBreaks ? buildSSML(breathGroups, finalRate, finalPitch) : undefined;
  return { rawText, spokenText: withBreaths, ssml, mood, rate: finalRate, pitch: finalPitch, hash, breathGroups };
}