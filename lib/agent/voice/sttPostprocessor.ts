import type { ProcessedUserSpeech } from "./types";

const HESITATION_WORDS = new Set(
  [
    "euh", "euuh", "euuuh", "heu", "hum", "hmm", "mh", "mmh",
    "bah", "ben", "ben alors", "alors alors", "voilà", "et voilà",
    "ouais", "ouai", "bref", "quoi", "tu vois", "tu sais",
    "je veux dire", "enfin", "bon ben", "donc donc", "nan mais",
  ].map((w) => w.toLowerCase())
);

function removeHesitations(text: string): { cleaned: string; removed: string[] } {
  const removed: string[] = [];
  let t = ` ${text.toLowerCase()} `;
  for (const filler of HESITATION_WORDS) {
    const re = new RegExp(`\\b${filler.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    let m = re.exec(t);
    while (m) { removed.push(m[0]); m = re.exec(t); }
    t = t.replace(re, " ");
  }
  return { cleaned: t.replace(/\s*,\s*,+\s*/g, ", ").replace(/\s+/g, " ").trim(), removed };
}

function resolveRetractions(text: string): string {
  let t = text;
  t = t.replace(/[^.!?,;]+[,.]?\s*(non\s+)?en\s+fait\s*,?\s*/gi, "");
  t = t.replace(/[^.!?,;]+\s+—\s+/g, "");
  t = t.replace(/[^.!?]*\bplutôt\s+([^.!?]+)/gi, "$1");
  return t.trim();
}

function completeIfTruncated(cleaned: string): string {
  if (!cleaned) return "";
  let t = cleaned;
  t = t.replace(/^parce que\s*[,，]?/i, "C'est parce que ");
  t = t.replace(/^car\s+/i, "C'est car ");
  t = t.replace(/^que\s+(faire|c'est|tu|veux|pense|faut)\b/i, "Qu'est-ce que $1 ");
  const startsQ = /^(comment|quand|où|pourquoi|qui|que|quoi|combien|est-ce que|est|as-tu|peux-tu|voulez-vous|tu peux|tu as|tu sais)\b/i.test(t);
  if (startsQ && !/[?!.]$/.test(t)) t = t.replace(/[,，\s]+$/, "") + " ?";
  else if (!/[?!.]$/.test(t) && t.length > 15) t = t.replace(/[,，\s]+$/, "") + ".";
  return t;
}

function inferTone(text: string): ProcessedUserSpeech["tone"] {
  if (/\?$/.test(text)) return "question";
  if (/\b(fais|fais-moi|envoie|rappelle|réponds|organise|génère|crée|décris|raconte)\b/i.test(text)) return "command";
  if (/\b(peut-être|je crois|je pense|je ne sais pas si|possible|ça dépend|probablement)\b/i.test(text)) return "uncertain";
  return "statement";
}

function inferUrgency(text: string): ProcessedUserSpeech["urgency"] {
  const t = text.toLowerCase();
  let score = 0;
  if (/\b(urgent|dès que possible|asap|tout de suite|immédiat|dépêche|rapidement|au plus vite)\b/.test(t)) score += 2;
  if (/\b(avant|pour|d'ici)\s+(ce soir|demain|midi|aujourd'hui|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|dans|1h|2h|30min|une heure)\b/.test(t)) score += 1;
  if (/!{1,}$/.test(text)) score += 1;
  return Math.min(2, score) as ProcessedUserSpeech["urgency"];
}

const STOPWORDS = new Set(
  "le la les un une des du de d'à au aux et ou mais donc car ni or je tu il elle on nous vous ils elles me te se y ce cette ces pas plus moins très trop bien aussi avec sans pour sur sous dans par entre jusqu'à comme si que quoi qui quand où comment pourquoi ne n' pas suis es est sommes sont était étais était avait ai as avons ont fais fait faites peux peut pouvez veux veut".split(/\s+/)
);

function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
}

export function processUserSpeech(rawTranscript: string): ProcessedUserSpeech {
  const base = (rawTranscript || "").trim();
  if (!base) {
    return {
      rawTranscript: "",
      cleanedText: "",
      completedText: "",
      tone: "statement",
      urgency: 0,
      keywords: [],
      removedHesitations: [],
    };
  }
  const { cleaned, removed } = removeHesitations(base);
  const resolved = resolveRetractions(cleaned);
  const completed = completeIfTruncated(resolved);
  return {
    rawTranscript: base,
    cleanedText: resolved,
    completedText: completed,
    tone: inferTone(completed),
    urgency: inferUrgency(completed),
    keywords: extractKeywords(completed),
    removedHesitations: removed,
  };
}