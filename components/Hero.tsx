"use client";

import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Shield,
  Zap,
  Clock,
  CheckCircle2,
  Play,
  Mail,
  Calendar,
  Bot,
  BellRing,
  Cpu,
} from "lucide-react";

export default function Hero() {

  const streamItems = [
    {
      app: "WhatsApp",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      iconColor: "text-emerald-400",
      from: "Julie — Directrice Produit",
      time: "Il y a 3 min",
      type: "Note vocale (3:45 min)",
      summary:
        "Validation du budget Q3 + demande de décaler le point sync de 15h à 16h30.",
      action: "Calendrier mis à jour & notification envoyée",
      actionStatus: "Auto-exécuté",
    },
    {
      app: "Gmail",
      badgeColor: "bg-red-500/10 text-red-400 border-red-500/20",
      iconColor: "text-red-400",
      from: "Cabinet Lamy & Associés",
      time: "Il y a 11 min",
      type: "Email important • Contrat SaaS",
      summary:
        "Avenant juridique prêt pour signature électronique avant demain 18h.",
      action: "Brouillon de réponse généré + Rappel fixé à 10h",
      actionStatus: "En attente de validation",
    },
    {
      app: "Telegram",
      badgeColor: "bg-sky-500/10 text-sky-400 border-sky-500/20",
      iconColor: "text-sky-400",
      from: "Canal Dev Ops & Infra",
      time: "Il y a 24 min",
      type: "34 messages non lus synthétisés",
      summary:
        "Mise en production réussie v2.4, aucune régression signalée sur les API webhook.",
      action: "Condensé en 2 puces clés dans le Daily Briefing",
      actionStatus: "Synthétisé",
    },
    {
      app: "Discord",
      badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      iconColor: "text-indigo-400",
      from: "Serveur VIP Community",
      time: "Il y a 40 min",
      type: "Ticket support prioritaire #892",
      summary:
        "Question sur l'intégration Outlook Calendrier par un utilisateur Enterprise.",
      action: "Réponse automatique suggérée par l'agent IA",
      actionStatus: "Traité",
    },
  ];

  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
      {/* Background Glows and Grids */}
      <div className="absolute inset-0 bg-grid-pattern opacity-60 pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-gradient-to-br from-indigo-600/20 via-purple-600/15 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Eyebrow / Pill */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-700/80 shadow-inner backdrop-blur-md hover:border-indigo-500/50 transition-all duration-300">
            <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
            <span className="text-xs font-semibold text-zinc-300">
              OmniMind 2.0 • Moteur d’Agent Autonome Multi-Canaux
            </span>
            <span className="text-xs font-bold text-indigo-400 flex items-center gap-1">
              Nouveau <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Hero Title */}
        <div className="mt-8 text-center max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
            L&apos;IA personnelle qui{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">
              centralise vos canaux
            </span>{" "}
            et agit pour vous.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-zinc-300 font-normal max-w-3xl mx-auto leading-relaxed">
            Connectez <span className="text-white font-medium">WhatsApp, Telegram, Gmail, Outlook et Discord</span> en un instant.
            OmniMind écoute, résume vos flux chaotiques, planifie vos rappels prédictifs et exécute vos tâches récurrentes comme un véritable chef de cabinet virtuel.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="#demo"
            className="w-full sm:w-auto relative group inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-base font-semibold text-white shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <span>Démarrer l&apos;essai gratuit (14 jours)</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>

          <a
            href="#demo"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-2xl bg-zinc-900/80 border border-zinc-700/80 text-base font-medium text-zinc-200 hover:text-white hover:bg-zinc-800/80 hover:border-zinc-600 transition-all duration-200"
          >
            <Play className="w-4 h-4 text-indigo-400 fill-indigo-400" />
            <span>Tester le simulateur en direct</span>
          </a>
        </div>

        {/* Value metrics pill */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm text-zinc-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Aucune carte bancaire requise</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400" />
            <span>Chiffrement Zero-Knowledge & RGPD</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-400" />
            <span>Configuration en 90 secondes chrono</span>
          </div>
        </div>

        {/* Interactive Simulated Agent Hub Preview */}
        <div className="mt-16 sm:mt-20 relative mx-auto max-w-5xl">
          {/* Ambient rim glow */}
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-pink-500/20 blur-xl opacity-60 group-hover:opacity-100 transition duration-1000" />

          <div className="relative rounded-2xl border border-zinc-800/90 bg-[#0c0e18]/90 backdrop-blur-2xl shadow-2xl overflow-hidden">
            {/* Top Mock Window Bar */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800/80 bg-zinc-950/60">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/70" />
                <span className="w-3 h-3 rounded-full bg-amber-500/70" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
                <span className="ml-3 text-xs font-mono text-zinc-400 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-indigo-400" />
                  omnimind-core // session_live_agent
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  5 Canaux Connectés
                </span>
              </div>
            </div>

            {/* Dashboard Content */}
            <div className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Live Agent Synthesis */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-4 rounded-xl p-5 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-zinc-800/80">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                      </div>
                      <span className="font-semibold text-sm text-white">
                        Briefing & Actions du Jour
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-500">08:30 CEST</span>
                  </div>

                  <div className="mt-4 p-3.5 rounded-lg bg-indigo-950/30 border border-indigo-500/20">
                    <p className="text-xs text-indigo-200 leading-relaxed">
                      Bonjour Thomas. J&apos;ai filtré <strong>47 messages</strong> reçus cette nuit. Voici vos 3 priorités absolues :
                    </p>
                    <ul className="mt-2.5 space-y-2 text-xs text-zinc-300">
                      <li className="flex items-start gap-2">
                        <span className="text-indigo-400 font-bold">•</span>
                        <span>
                          <strong>15:00</strong> déplacé à <strong>16:30</strong> avec Julie (WhatsApp validé).
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-indigo-400 font-bold">•</span>
                        <span>
                          <strong>Contrat SaaS</strong> à signer avant 18h (email Lamy).
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-indigo-400 font-bold">•</span>
                        <span>
                          <strong>Infra Prod :</strong> stable, 0 bug critique (Discord & Telegram).
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-4 space-y-2">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                      Actions Pré-Exécutées par l&apos;Agent
                    </span>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
                        <span className="flex items-center gap-2 text-zinc-300">
                          <Calendar className="w-3.5 h-3.5 text-blue-400" />
                          Google Calendar Sync (16:30)
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">
                          Synchronisé
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
                        <span className="flex items-center gap-2 text-zinc-300">
                          <Mail className="w-3.5 h-3.5 text-red-400" />
                          Brouillon de confirmation préparé
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-medium border border-indigo-500/20">
                          Prêt à l&apos;envoi
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-indigo-400" /> Modèle : Omni-Agent v4.2
                  </span>
                  <span className="text-emerald-400 font-mono font-medium">99.8% Précision</span>
                </div>
              </div>

              {/* Right Column: Multi-channel live streams */}
              <div className="lg:col-span-7 space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <BellRing className="w-3.5 h-3.5 text-indigo-400" />
                    Flux Multicanal Traité en Temps Réel
                  </span>
                  <span className="text-[11px] text-zinc-500">Filtré & Sécurisé E2E</span>
                </div>

                <div className="space-y-3">
                  {streamItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 hover:bg-zinc-900/90 transition-all duration-200"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded border ${item.badgeColor}`}
                          >
                            {item.app}
                          </span>
                          <span className="text-xs font-semibold text-white">
                            {item.from}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {item.time}
                        </span>
                      </div>

                      <div className="text-xs text-zinc-400 font-medium mb-1">
                        {item.type}
                      </div>

                      <p className="text-xs text-zinc-300 leading-snug">
                        &quot;{item.summary}&quot;
                      </p>

                      <div className="mt-2.5 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400 flex items-center gap-1.5">
                          <Zap className="w-3 h-3 text-amber-400" />
                          {item.action}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {item.actionStatus}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
