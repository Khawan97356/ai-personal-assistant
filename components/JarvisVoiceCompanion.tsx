"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic,
  Volume2,
  VolumeX,
  Sparkles,
  Brain,
  Square,
  Send,
  X,
  CheckCircle2,
  Bot,
} from "lucide-react";
import { speakText, stopSpeaking, playChime } from "@/lib/audio/speech";

interface VoiceCompanionProps {
  isOpen: boolean;
  onClose: () => void;
  onActionExecuted?: () => void;
}

// Interface simplifiée pour la reconnaissance vocale
interface BrowserSpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal?: boolean;
    };
    length: number;
  };
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: () => void;
  onresult: (event: BrowserSpeechRecognitionEvent) => void;
  onerror: (event: unknown) => void;
  onend: () => void;
}

export default function JarvisVoiceCompanion({
  isOpen,
  onClose,
  onActionExecuted,
}: VoiceCompanionProps) {
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [textInput, setTextInput] = useState("");

  const [currentThought, setCurrentThought] = useState<string | null>(null);
  const [currentResponse, setCurrentResponse] = useState<string>(
    "Bonjour Thomas ! Je suis connecté à tes flux. Parle-moi ou pose-moi une question."
  );
  const [voiceMode, setVoiceMode] = useState<"robot" | "natural">("robot");
  const [isMuted, setIsMuted] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const [history, setHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const isMountedRef = useRef(true);
  const latestTranscriptRef = useRef("");
  const sendToAgentRef = useRef<(text: string) => Promise<void>>(async () => {});

  // Initialisation de la reconnaissance vocale Web Speech API
  useEffect(() => {
    isMountedRef.current = true;
    if (typeof window !== "undefined") {
      const SpeechRecognitionClass =
        (window as unknown as { SpeechRecognition?: new () => BrowserSpeechRecognition }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => BrowserSpeechRecognition }).webkitSpeechRecognition;

      if (SpeechRecognitionClass) {
        const recognition = new SpeechRecognitionClass();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "fr-FR";

        recognition.onstart = () => {
          if (isMountedRef.current) setIsListening(true);
        };

        recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
          let currentText = "";
          for (let i = 0; i < event.results.length; i++) {
            currentText += event.results[i][0].transcript;
          }
          latestTranscriptRef.current = currentText;
          if (isMountedRef.current) {
            setTranscript(currentText);
          }
        };

        recognition.onerror = (err: unknown) => {
          console.warn("Speech recognition error:", err);
          if (isMountedRef.current) setIsListening(false);
        };

        recognition.onend = () => {
          if (isMountedRef.current) {
            setIsListening(false);
            const spoken = latestTranscriptRef.current.trim();
            if (spoken.length > 1) {
              latestTranscriptRef.current = "";
              sendToAgentRef.current(spoken);
            }
          }
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      isMountedRef.current = false;
      stopSpeaking();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Déclencher la réponse vocale
  const speakResponse = useCallback(
    (text: string) => {
      if (isMuted) return;
      setIsSpeaking(true);
      speakText(text, {
        mode: voiceMode,
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    },
    [isMuted, voiceMode]
  );

  // Envoi du message au moteur de raisonnement de l'agent
  const sendToAgent = useCallback(
    async (messageText: string) => {
      if (!messageText.trim() || isThinking) return;

      stopSpeaking();
      setIsThinking(true);
      setCurrentThought("Analyse autonome de votre demande et consultation de vos flux...");
      playChime("thinking");

      const newHistory = [...history, { role: "user" as const, content: messageText }];
      setHistory(newHistory);
      setTranscript("");
      setTextInput("");

      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageText,
            history: newHistory,
          }),
        });

        const data = await res.json();
        if (data.success) {
          setCurrentThought(data.thought);
          setCurrentResponse(data.spokenResponse);

          setHistory([
            ...newHistory,
            { role: "assistant" as const, content: data.spokenResponse },
          ]);

          if (data.executedAction) {
            setActionNotice(`Action exécutée : ${data.executedAction.title}`);
            playChime("success");
            onActionExecuted?.();
            setTimeout(() => setActionNotice(null), 5000);
          }

          // Lecture vocale de la réponse
          speakResponse(data.spokenResponse);
        } else {
          setCurrentResponse("Je n'ai pas pu analyser la demande. Réessayez s'il vous plaît.");
        }
      } catch (err) {
        console.error("Erreur agent chat:", err);
        setCurrentResponse("Désolé, une erreur de communication est survenue.");
      } finally {
        setIsThinking(false);
      }
    },
    [history, isThinking, onActionExecuted, speakResponse]
  );

  useEffect(() => {
    sendToAgentRef.current = sendToAgent;
  }, [sendToAgent]);

  // Démarrer l'écoute au micro
  const toggleListening = () => {
    stopSpeaking();
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      const spoken = latestTranscriptRef.current.trim();
      if (spoken.length > 1) {
        latestTranscriptRef.current = "";
        sendToAgent(spoken);
      }
    } else {
      setTranscript("");
      latestTranscriptRef.current = "";
      playChime("start");
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.warn("Could not start recognition:", e);
      }
    }
  };

  // Interrompre la parole
  const handleStopSpeaking = () => {
    stopSpeaking();
    setIsSpeaking(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl bg-zinc-950 border border-indigo-500/30 shadow-2xl shadow-indigo-500/10 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  OmniMind Jarvis Live
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {voiceMode === "robot" ? "Voix Robotique" : "Voix Naturelle"}
                </span>
              </div>
              <p className="text-xs text-zinc-400">Assistant vocal autonome à raisonnement profond</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Mode Robotique / Naturel */}
            <button
              onClick={() => {
                const next = voiceMode === "robot" ? "natural" : "robot";
                setVoiceMode(next);
                playChime("start");
              }}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                voiceMode === "robot"
                  ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
              }`}
              title="Basculer le style de voix (Robot / Naturel)"
            >
              <Bot className="w-4 h-4" />
              <span className="hidden sm:inline">{voiceMode === "robot" ? "Robot" : "Naturel"}</span>
            </button>

            {/* Mute toggle */}
            <button
              onClick={() => {
                if (!isMuted) stopSpeaking();
                setIsMuted(!isMuted);
              }}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isMuted
                  ? "bg-red-500/20 border-red-500/30 text-red-400"
                  : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white"
              }`}
              title={isMuted ? "Son coupé" : "Son activé"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Close button */}
            <button
              onClick={() => {
                stopSpeaking();
                onClose();
              }}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Central Visualizer / Pulsing Orb */}
        <div className="py-8 px-6 flex flex-col items-center justify-center bg-radial from-indigo-950/40 via-zinc-950 to-zinc-950">
          <div className="relative flex items-center justify-center mb-6">
            {/* Halo arrière-plan dynamique */}
            <div
              className={`absolute rounded-full filter blur-2xl transition-all duration-700 pointer-events-none ${
                isThinking
                  ? "w-44 h-44 bg-purple-600/40 animate-pulse"
                  : isSpeaking
                  ? "w-48 h-48 bg-indigo-500/50 animate-ping"
                  : isListening
                  ? "w-48 h-48 bg-emerald-500/40 animate-pulse"
                  : "w-36 h-36 bg-indigo-600/20"
              }`}
            />

            {/* L'Orbe interactif */}
            <button
              onClick={toggleListening}
              className={`relative z-10 w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl cursor-pointer ${
                isListening
                  ? "bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/50 scale-105"
                  : isThinking
                  ? "bg-gradient-to-tr from-purple-700 via-indigo-600 to-pink-600 animate-spin-slow shadow-purple-500/40"
                  : isSpeaking
                  ? "bg-gradient-to-tr from-indigo-600 via-purple-600 to-sky-500 shadow-indigo-500/50 scale-105"
                  : "bg-gradient-to-tr from-zinc-900 via-indigo-950 to-zinc-900 border border-indigo-500/40 hover:border-indigo-400 hover:scale-102"
              }`}
            >
              {isListening ? (
                <>
                  <Mic className="w-9 h-9 text-white animate-bounce" />
                  <span className="text-[10px] font-bold text-emerald-100 uppercase tracking-wider mt-1">
                    J&apos;écoute...
                  </span>
                </>
              ) : isThinking ? (
                <>
                  <Brain className="w-9 h-9 text-purple-200 animate-pulse" />
                  <span className="text-[10px] font-bold text-purple-200 uppercase tracking-wider mt-1">
                    Réflexion...
                  </span>
                </>
              ) : isSpeaking ? (
                <>
                  <Volume2 className="w-9 h-9 text-white animate-pulse" />
                  <span className="text-[10px] font-bold text-indigo-100 uppercase tracking-wider mt-1">
                    Je parle
                  </span>
                </>
              ) : (
                <>
                  <Mic className="w-8 h-8 text-indigo-300" />
                  <span className="text-[11px] font-semibold text-zinc-300 mt-1">
                    Clique pour parler
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Statut sous l'orbe */}
          <div className="flex items-center gap-2 mb-2">
            {isSpeaking && (
              <button
                onClick={handleStopSpeaking}
                className="px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs flex items-center gap-1.5 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <Square className="w-3 h-3 text-red-400 fill-red-400" />
                <span>Interrompre la voix</span>
              </button>
            )}
            {isListening && (
              <span className="text-xs text-emerald-400 animate-pulse font-medium">
                🎙️ Parlez maintenant, l&apos;IA vous écoute...
              </span>
            )}
          </div>

          {/* Retranscription en direct de ce que dit l'utilisateur */}
          {transcript && (
            <div className="w-full text-center px-4 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800 text-sm text-zinc-200 mb-4 animate-in fade-in">
              <span className="text-xs text-zinc-500 mr-2">Vous :</span>
              &laquo; {transcript} &raquo;
            </div>
          )}

          {/* Bannière d'exécution d'action */}
          {actionNotice && (
            <div className="w-full mb-4 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-300 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span className="font-semibold">{actionNotice}</span>
            </div>
          )}
        </div>

        {/* Section Cerveau / Raisonnement Autonome (Le Thinking Process) */}
        <div className="px-6 py-4 bg-zinc-900/40 border-t border-zinc-800/80 space-y-3 max-h-64 overflow-y-auto">
          {currentThought && (
            <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
                <Brain className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                <span>Raisonnement interne autonome de l&apos;IA</span>
              </div>
              <p className="text-xs text-purple-200/80 leading-relaxed font-mono whitespace-pre-wrap">
                {currentThought}
              </p>
            </div>
          )}

          {/* Réponse formulée */}
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span className="font-semibold text-indigo-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                OmniMind
              </span>
              {isSpeaking && (
                <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Lecture audio en cours
                </span>
              )}
            </div>
            <p className="text-sm text-white leading-relaxed font-sans">{currentResponse}</p>
          </div>
        </div>

        {/* Suggestions rapides & Barre de saisie texte alternative */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 space-y-3">
          {/* Quick Prompts */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-zinc-500 shrink-0 text-[11px] font-semibold">Exemples :</span>
            {[
              "De quoi a l'air ma journée ?",
              "Quelles sont mes urgences ?",
              "Valide l'action pour le cabinet Lamy",
              "Résume mes messages WhatsApp",
              "Donne-moi une recommandation",
            ].map((prompt, i) => (
              <button
                key={i}
                onClick={() => sendToAgent(prompt)}
                disabled={isThinking}
                className="shrink-0 px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-indigo-500/50 hover:bg-indigo-950/30 text-zinc-300 text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Text Input fallback */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendToAgent(textInput);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Ou écris directement une commande..."
              disabled={isThinking}
              className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              type="submit"
              disabled={isThinking || !textInput.trim()}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
