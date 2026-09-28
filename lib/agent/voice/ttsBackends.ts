import type { TTSAudioResult, TTSBackend, TTSGenerateOptions, VoiceMood } from "./types";

export function hashText(text: string, opts: Record<string, unknown> = {}): string {
  const data = text + "|" + JSON.stringify(opts);
  let h1 = 0xdeadbeef ^ 0,
    h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < data.length; i++) {
    const ch = data.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  return hex.padStart(16, "0").slice(-16);
}

export function mapMoodToTTSParams(
  mood: VoiceMood,
  personaDefault:
    | Partial<import("./types").VoicePersona>
    | { rate?: number; pitch?: number; defaultRate?: number; defaultPitch?: number }
    | undefined,
  override: { rate?: number; pitch?: number }
) {
  const pRate =
    (personaDefault as import("./types").VoicePersona)?.defaultRate ??
    (personaDefault as { rate?: number })?.rate;
  const pPitch =
    (personaDefault as import("./types").VoicePersona)?.defaultPitch ??
    (personaDefault as { pitch?: number })?.pitch;
  const base = {
    rate: override.rate ?? pRate ?? 1.0,
    pitch: override.pitch ?? pPitch ?? 1.02,
  };
  switch (mood) {
    case "enthusiastic":
      return { rate: Math.min(1.3, base.rate * 1.12), pitch: base.pitch + 0.06 };
    case "dynamic":
      return { rate: Math.min(1.25, base.rate * 1.08), pitch: base.pitch + 0.02 };
    case "serious":
      return { rate: base.rate * 0.92, pitch: Math.max(0.85, base.pitch - 0.04) };
    case "pedagogical":
      return { rate: base.rate * 0.95, pitch: base.pitch };
    case "warm":
      return { rate: base.rate * 0.98, pitch: base.pitch + 0.03 };
    case "empathetic":
      return { rate: base.rate * 0.9, pitch: Math.max(0.9, base.pitch - 0.02) };
    case "complicit":
      return { rate: base.rate * 1.02, pitch: base.pitch + 0.04 };
    default:
      return base;
  }
}

export function pickBestAvailableBackend(): TTSBackend {
  if (typeof process !== "undefined" && process.env) {
    if (process.env.ELEVENLABS_API_KEY) return "elevenlabs";
    if (process.env.OPENAI_API_KEY) return "openai";
    if (process.env.GOOGLE_TTS_API_KEY) return "google";
  }
  return "browser";
}

export async function generateElevenLabs(
  text: string,
  options: TTSGenerateOptions
): Promise<TTSAudioResult> {
  if (typeof process === "undefined" || !process.env.ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY non définie");
  }
  const voiceId =
    options.persona?.backendVoiceIds?.elevenlabs ||
    process.env.ELEVENLABS_VOICE_ID ||
    "Freya";
  const params = mapMoodToTTSParams(options.mood ?? "warm", options.persona, {
    rate: options.rate,
    pitch: options.pitch,
  });
  const outputFormat =
    options.format === "audio/ogg"
      ? "ogg_vorbis"
      : options.format === "audio/wav"
      ? "pcm_highest"
      : "mp3_44100_128";
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: "POST",
      headers: {
        "Xi-Api-Key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.82,
          speed: params.rate,
          use_speaker_boost: true,
        },
        output_format: outputFormat,
      }),
    }
  );
  if (!response.ok) throw new Error(`ElevenLabs TTS ${response.status}: ${await response.text()}`);
  const ab = await response.arrayBuffer();
  const fmt = (outputFormat.startsWith("mp3")
    ? "audio/mpeg"
    : outputFormat.startsWith("ogg")
    ? "audio/ogg"
    : "audio/wav") as TTSAudioResult["format"];
  return {
    audio: Buffer.from(ab),
    format: fmt,
    backend: "elevenlabs",
    hash: hashText(text, { mood: options.mood, rate: params.rate, pitch: params.pitch }),
  };
}

export async function generateOpenAI(
  text: string,
  options: TTSGenerateOptions
): Promise<TTSAudioResult> {
  if (typeof process === "undefined" || !process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY non définie");
  }
  const voiceId =
    options.persona?.backendVoiceIds?.openai ||
    process.env.OPENAI_TTS_VOICE ||
    "nova";
  const params = mapMoodToTTSParams(options.mood ?? "warm", options.persona, {
    rate: options.rate,
    pitch: options.pitch,
  });
  const format =
    options.format === "audio/ogg"
      ? "opus"
      : options.format === "audio/wav"
      ? "wav"
      : options.format === "audio/mp4"
      ? "aac"
      : "mp3";
  const instructions =
    options.mood === "warm"
      ? "Parle de manière chaleureuse, naturelle et expressive."
      : options.mood === "serious"
      ? "Parle calmement, posément et avec précision."
      : options.mood === "enthusiastic"
      ? "Parle avec enthousiasme et énergie positive."
      : options.mood === "pedagogical"
      ? "Parle clairement, comme un enseignant pédagogue."
      : options.mood === "empathetic"
      ? "Parle avec douceur et empathie."
      : undefined;
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      input: text,
      voice: voiceId,
      response_format: format,
      speed: Math.max(0.25, Math.min(4, params.rate)),
      instructions,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI TTS ${response.status}: ${await response.text()}`);
  const ab = await response.arrayBuffer();
  const fmt =
    format === "mp3"
      ? "audio/mpeg"
      : format === "opus"
      ? "audio/ogg"
      : format === "wav"
      ? "audio/wav"
      : "audio/mp4";
  return {
    audio: Buffer.from(ab),
    format: fmt as TTSAudioResult["format"],
    backend: "openai",
    hash: hashText(text, { mood: options.mood, rate: params.rate }),
  };
}

export async function generateGoogle(
  text: string,
  options: TTSGenerateOptions
): Promise<TTSAudioResult> {
  if (typeof process === "undefined" || !process.env.GOOGLE_TTS_API_KEY) {
    throw new Error("GOOGLE_TTS_API_KEY non définie");
  }
  const lang = options.persona?.lang || "fr-FR";
  const gender =
    options.persona?.register === "masculine"
      ? "MALE"
      : options.persona?.register === "feminine"
      ? "FEMALE"
      : "NEUTRAL";
  const params = mapMoodToTTSParams(options.mood ?? "warm", options.persona, {
    rate: options.rate,
    pitch: options.pitch,
  });
  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_TTS_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: lang, ssmlGender: gender, name: `${lang}-Neural2-B` },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: Math.max(0.25, Math.min(2, params.rate)),
          pitch: (params.pitch - 1) * 20,
        },
      }),
    }
  );
  if (!response.ok) throw new Error(`Google TTS ${response.status}: ${await response.text()}`);
  const { audioContent } = (await response.json()) as { audioContent: string };
  return {
    audio: Buffer.from(audioContent, "base64"),
    format: "audio/mpeg",
    backend: "google",
    hash: hashText(text, { mood: options.mood, rate: params.rate }),
  };
}

export async function generateWithFallback(
  text: string,
  options: TTSGenerateOptions
): Promise<TTSAudioResult> {
  const preferred =
    options.backend && options.backend !== "auto"
      ? [options.backend]
      : [pickBestAvailableBackend(), "openai", "google", "browser"].filter(
          (v, i, a) => a.indexOf(v) === i
        );
  for (const backend of preferred) {
    try {
      if (backend === "elevenlabs") return await generateElevenLabs(text, options);
      if (backend === "openai") return await generateOpenAI(text, options);
      if (backend === "google") return await generateGoogle(text, options);
      if (backend === "browser") {
        return { audio: "", format: "audio/mpeg", backend: "browser", hash: hashText(text, { mood: options.mood }) };
      }
    } catch (err) {
      console.warn(`[voice] backend ${backend} échoué → fallback`);
    }
  }
  return { audio: "", format: "audio/mpeg", backend: "browser", hash: hashText(text, { mood: options.mood }) };
}