"use client";

import { useState } from "react";
import {
  Sparkles,
  Bot,
  Check,
  Clock,
  CheckCircle2,
  Terminal,
} from "lucide-react";

export default function InteractiveSimulator() {
  const [selectedScenario, setSelectedScenario] = useState<
    "briefing" | "audio" | "telegram" | "email"
  >("briefing");

  const scenarios = {
    briefing: {
      title: "1. Briefing Matinal Omnicanal (8h00)",
      description:
        "L'agent analyse vos boîtes de réception et vos messageries pendant la nuit et vous envoie ce résumé ultra-précis.",
      inputs: [
        {
          source: "Gmail",
          sender: "Client Grand Compte (Marc D.)",
          badge: "bg-red-500/10 text-red-400 border-red-500/20",
          content: "Urgent : Le devis pour le projet Horizon doit être amendé avant 11h.",
        },
        {
          source: "WhatsApp",
          sender: "Équipe Produit (Groupe Sprint)",
          badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          content: "Note vocale de 3 min résumée : Démo validée, déploiement à 15h.",
        },
        {
          source: "Outlook",
          sender: "RH & Admin",
          badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
          content: "Signature du contrat d'alternance requise avant vendredi.",
        },
      ],
      agentOutput: {
        summary:
          "☀️ Bonjour Thomas ! 3 actions critiques aujourd'hui :",
        points: [
          "Devis Marc D. amendé et réexpédié (brouillon prêt à 9h30)",
          "Revue du déploiement produit calée à 15h (Meet généré)",
          "Contrat alternance classé pour signature à 17h",
        ],
        automatedAction: "Calendrier synchronisé • 2 brouillons rédigés • 0 spam toléré",
      },
    },
    audio: {
      title: "2. Vocal WhatsApp converti en Action",
      description:
        "Un client ou collègue vous envoie un long vocal confus ? L'IA en extrait la substance et programme la tâche.",
      inputs: [
        {
          source: "WhatsApp",
          sender: "Émilie (Co-fondatrice)",
          badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          content:
            "🎙️ Vocal (04:12 min) : 'Salut, je sors de réunion avec la banque, ils demandent le bilan prévisionnel 2026 d'ici jeudi après-midi, et n'oublie pas qu'on doit appeler l'avocat demain à 14h pour l'extension de capital...'",
        },
      ],
      agentOutput: {
        summary: "Transcription & Analyse en 1.4 seconde :",
        points: [
          "Tâche créée : Préparer bilan prévisionnel 2026 (Échéance : Jeudi 14h)",
          "Événement ajouté : Appel Avocat (Demain 14h00-14h30) avec rappel 15 min avant",
          "Notification WhatsApp préparée : 'Bien reçu Émilie, tout est consigné dans l'agenda'",
        ],
        automatedAction: "Google Calendar & Notion actualisés sans saisie manuelle",
      },
    },
    telegram: {
      title: "3. Commande Rapide via Telegram",
      description:
        "Donnez un ordre en langage naturel à votre bot privé depuis n'importe où dans le monde.",
      inputs: [
        {
          source: "Telegram",
          sender: "Vous (Message rapide)",
          badge: "bg-sky-500/10 text-sky-400 border-sky-500/20",
          content:
            "« Déplace mon rendez-vous de 15h avec Julien à demain matin 10h, et préviens-le par email poliment. »",
        },
      ],
      agentOutput: {
        summary: "Exécution confirmée en 800ms :",
        points: [
          "Disponibilité vérifiée : Julien et vous êtes tous deux libres demain à 10h00",
          "Ancien créneau de 15h00 libéré dans Google Calendar",
          "Email envoyé à julien@entreprise.com : 'Bonjour Julien, Thomas te propose de reporter notre point à demain 10h...'",
        ],
        automatedAction: "Action terminée avec succès • Log enregistré",
      },
    },
    email: {
      title: "4. Filtre VIP & Brouillons Contextuels",
      description:
        "L'agent rédige vos réponses d'emails en adoptant fidèlement votre ton et votre historique.",
      inputs: [
        {
          source: "Gmail / Outlook",
          sender: "Partenaire Stratégique",
          badge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
          content:
            "« Bonjour Thomas, pouvons-nous intégrer votre solution d'agent IA dans notre stack dès le mois prochain ? Avez-vous une documentation d'API ? »",
        },
      ],
      agentOutput: {
        summary: "Brouillon généré selon vos préférences :",
        points: [
          "Ton chaleureux et professionnel appliqué",
          "Lien vers la documentation API SDK inséré automatiquement",
          "Lien Calendly proposé pour un onboarding personnalisé de 20 min",
        ],
        automatedAction: "Brouillon prêt dans Gmail • Attente de votre clic 'Envoyer'",
      },
    },
  };

  const current = scenarios[selectedScenario];

  return (
    <section id="demo" className="relative py-28 bg-[#08090e] border-t border-zinc-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <Terminal className="w-3.5 h-3.5" />
            Simulateur d&apos;Agent en Temps Réel
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Voyez comment l&apos;agent{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">
              résout vos situations
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-zinc-400">
            Sélectionnez un cas d&apos;usage pour voir l&apos;intelligence artificielle en action.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-12">
          {(
            [
              { id: "briefing", label: "☀️ Briefing Matinal" },
              { id: "audio", label: "🎙️ Vocal WhatsApp" },
              { id: "telegram", label: "⚡ Ordre Telegram" },
              { id: "email", label: "✉️ Brouillon Intelligent" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedScenario(tab.id)}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                selectedScenario === tab.id
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-500"
                  : "bg-zinc-900/80 text-zinc-400 border border-zinc-800 hover:text-white hover:bg-zinc-800/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Interactive Viewer Card */}
        <div className="max-w-4xl mx-auto rounded-3xl bg-zinc-950/90 border border-zinc-800/90 p-6 sm:p-10 shadow-2xl">
          <div className="mb-6">
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
              {current.title}
            </h3>
            <p className="text-sm text-zinc-400">{current.description}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Input messages */}
            <div className="space-y-4">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-500 font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                Flux Entrants Reçus (Bruts)
              </span>

              <div className="space-y-3">
                {current.inputs.map((msg, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${msg.badge}`}>
                        {msg.source}
                      </span>
                      <span className="text-xs text-zinc-300 font-medium">
                        {msg.sender}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                      {msg.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: AI Output & Actions */}
            <div className="flex flex-col justify-between p-6 rounded-2xl bg-indigo-950/20 border border-indigo-500/30">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                      Traitement OmniMind
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Terminé
                  </span>
                </div>

                <p className="text-sm font-semibold text-white mb-3">
                  {current.agentOutput.summary}
                </p>

                <ul className="space-y-2.5 mb-6">
                  {current.agentOutput.points.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-zinc-300">
                      <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-indigo-500/20">
                <div className="flex items-center gap-2 text-xs text-indigo-300 font-medium">
                  <Bot className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>{current.agentOutput.automatedAction}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
