// Utilitaire audio pour synthèse vocale (TTS), reconnaissance vocale (STT) et effets sonores

// Bip d'activation ou de réflexion futuriste avec Web Audio API
export function playChime(type: "start" | "thinking" | "success" | "done" = "start") {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === "start") {
      // Bip ascendant moderne
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === "thinking") {
      // Tonalité douce de traitement
      osc.type = "triangle";
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(480, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === "success") {
      // Double bip harmonique de confirmation
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else {
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
  } catch (err) {
    console.debug("Web Audio effect unavailable:", err);
  }
}

export interface SpeakOptions {
  mode?: "robot" | "natural";
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

// Fonction de prononciation vocale intelligente
export function speakText(text: string, options: SpeakOptions = {}) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    console.warn("La synthèse vocale n'est pas supportée par ce navigateur.");
    options.onEnd?.();
    return;
  }

  // Nettoyer les balises Markdown, émojis et espaces superflus pour une diction fluide
  const cleanText = text
    .replace(/[*#_`~[\]]/g, "")
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "") // Retirer les émojis complexes qui font bégayer certains moteurs TTS
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanText) {
    options.onEnd?.();
    return;
  }

  // Annuler proprement toute lecture en cours
  window.speechSynthesis.cancel();

  // Débloquer l'état figé éventuel de Chrome (bug connu SpeechSynthesis paused)
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }

  const isRobot = options.mode === "robot";

  // Petit délai de 50ms pour laisser le navigateur réinitialiser la file d'attente audio
  setTimeout(() => {
    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = "fr-FR";
      utterance.rate = options.rate ?? (isRobot ? 1.05 : 1.0);
      utterance.pitch = options.pitch ?? (isRobot ? 0.75 : 1.02);

      // Sélectionner la meilleure voix française disponible
      const voices = window.speechSynthesis.getVoices();
      const frVoices = voices.filter((v) => v.lang.startsWith("fr") || v.lang.includes("FR"));

      if (frVoices.length > 0) {
        if (isRobot) {
          // Voix plus grave ou voix système
          utterance.voice = frVoices[0];
        } else {
          // Voix naturelle
          const best = frVoices.find(
            (v) =>
              v.name.includes("Google") ||
              v.name.includes("Natural") ||
              v.name.includes("Thomas") ||
              v.name.includes("Siri")
          );
          if (best) utterance.voice = best;
        }
      }

      utterance.onstart = () => {
        options.onStart?.();
      };

      utterance.onend = () => {
        options.onEnd?.();
      };

      utterance.onerror = (event: unknown) => {
        const errorType = (event as { error?: string })?.error;
        // 'canceled' ou 'interrupted' arrivent normalement quand on arrête ou relance la voix
        if (errorType === "canceled" || errorType === "interrupted") {
          options.onEnd?.();
          return;
        }

        // Si l'erreur est 'not-allowed', c'est que l'utilisateur n'a pas encore interagi avec la page
        if (errorType === "not-allowed") {
          console.warn("Synthèse vocale : interaction utilisateur requise par le navigateur.");
          options.onEnd?.();
          return;
        }

        console.warn("Synthèse vocale (information) :", errorType || event);
        options.onError?.(event);
        options.onEnd?.();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("Erreur d'initialisation de l'élocution:", err);
      options.onEnd?.();
    }
  }, 50);
}

// Arrêter la voix en cours
export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

