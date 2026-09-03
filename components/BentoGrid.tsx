"use client";

import {
  Sparkles,
  Mic,
  Calendar,
  CheckCircle2,
  Clock,
  Shield,
  Zap,
  Layers,
} from "lucide-react";

export default function BentoGrid() {
  return (
    <section id="bento" className="relative py-28 bg-[#08090e] border-t border-zinc-900 overflow-hidden">
      {/* Background accents */}
      <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <Layers className="w-3.5 h-3.5" />
            Architecture Bento-Grid
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Conçu pour une productivité{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400">
              hors du commun
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-zinc-400">
            Chaque module a été taillé pour transformer le désordre numérique en clarté absolue.
          </p>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-12 gap-6">
          {/* Card 1: Main Omnichannel Briefing (7 cols) */}
          <div className="col-span-12 lg:col-span-7 relative group rounded-3xl p-7 sm:p-8 bg-gradient-to-b from-zinc-900/70 to-zinc-950/80 border border-zinc-800/80 hover:border-indigo-500/40 transition-all duration-300 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-semibold">
                  Synthèse Unifiée
                </span>
              </div>
              <span className="text-[11px] font-mono text-zinc-500">Mise à jour en direct</span>
            </div>

            <h3 className="text-2xl font-bold text-white mb-2">
              Le Briefing Quotidien Intelligent
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-xl mb-6">
              Tous vos flux entrants (Gmail, WhatsApp, Telegram, Outlook, Discord) digérés en 30 secondes chrono, classés par priorité réelle.
            </p>

            {/* Visual simulation inside card */}
            <div className="rounded-2xl bg-zinc-950/80 border border-zinc-800/90 p-5 space-y-3.5 shadow-inner">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs">
                <div className="flex items-center gap-2 text-zinc-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Briefing Exécutif — 08:00 CEST</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-mono">
                  3 canaux fusionnés
                </span>
              </div>

              {/* Feed items */}
              <div className="space-y-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-start gap-3">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 shrink-0 mt-0.5 font-bold">
                    URGENT
                  </span>
                  <div>
                    <span className="text-white font-medium">Client Grand Compte (Gmail) :</span>
                    <p className="text-zinc-400 text-[11px] mt-0.5">
                      Demande de révision du devis avant 11h. Brouillon calculé avec réduction 8% préparé.
                    </p>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-start gap-3">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 mt-0.5 font-bold">
                    ACTÉ
                  </span>
                  <div>
                    <span className="text-white font-medium">Marc & Équipe Technique (WhatsApp) :</span>
                    <p className="text-zinc-400 text-[11px] mt-0.5">
                      Point d&apos;avancement déplacé à 15h30. Google Meet et invitation envoyés à 4 personnes.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Audio Voice-to-Action (5 cols) */}
          <div className="col-span-12 lg:col-span-5 relative group rounded-3xl p-7 sm:p-8 bg-gradient-to-b from-zinc-900/70 to-zinc-950/80 border border-zinc-800/80 hover:border-purple-500/40 transition-all duration-300 shadow-xl overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Mic className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-mono uppercase tracking-wider text-purple-400 font-semibold">
                    Audio & Vocaux
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono">
                  Whisper v3 Turbo
                </span>
              </div>

              <h3 className="text-2xl font-bold text-white mb-2">
                Fini les vocaux de 5 minutes
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                Transférez n&apos;importe quel vocal WhatsApp ou Telegram. L&apos;IA extrait le résumé et les actions en 2 secondes.
              </p>
            </div>

            {/* Audio waveform mockup */}
            <div className="rounded-2xl bg-zinc-950/80 border border-zinc-800/90 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-medium text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Vocal WhatsApp (03:42)
                </span>
                <span className="font-mono text-[11px] text-zinc-500">Transcrit en 1.1s</span>
              </div>

              {/* Fake waveform bars */}
              <div className="flex items-center gap-1 h-8 px-1">
                {[30, 45, 80, 60, 25, 90, 75, 40, 60, 85, 95, 30, 70, 50, 65, 80, 40, 90, 55, 30, 70, 40, 20].map(
                  (height, i) => (
                    <div
                      key={i}
                      style={{ height: `${height}%` }}
                      className={`flex-1 rounded-full transition-all duration-300 ${
                        i < 14
                          ? "bg-purple-500/80"
                          : "bg-zinc-700/50"
                      }`}
                    />
                  )
                )}
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800/80 text-[11px] text-zinc-300">
                <span className="text-purple-400 font-semibold">Action détectée :</span> Préparer la proposition commerciale pour vendredi 14h.
              </div>
            </div>
          </div>

          {/* Card 3: Autonomous Agent Loop (4 cols) */}
          <div className="col-span-12 md:col-span-6 lg:col-span-4 relative group rounded-3xl p-7 bg-gradient-to-b from-zinc-900/70 to-zinc-950/80 border border-zinc-800/80 hover:border-pink-500/40 transition-all duration-300 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
                  <Zap className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono uppercase tracking-wider text-pink-400 font-semibold">
                  Exécution Autonome
                </span>
              </div>

              <h3 className="text-xl font-bold text-white mb-2">
                Validation &laquo; 1-Tap &raquo;
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                L&apos;IA prépare le travail, rédige les courriels, pré-remplit les calendriers et attend votre accord d&apos;un seul clic.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 space-y-3">
              <div className="text-xs text-zinc-300 font-medium flex items-center justify-between">
                <span>Confirmation d&apos;envoi d&apos;email</span>
                <span className="text-[10px] text-amber-400 font-mono">En attente</span>
              </div>
              <p className="text-[11px] text-zinc-400 line-clamp-2">
                &quot;Bonjour Antoine, suite à notre échange WhatsApp, je vous confirme notre rendez-vous mardi...&quot;
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button className="py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold hover:bg-emerald-600/30 transition-colors">
                  Approuver
                </button>
                <button className="py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs hover:text-white transition-colors">
                  Modifier
                </button>
              </div>
            </div>
          </div>

          {/* Card 4: Smart Predictive Calendar (4 cols) */}
          <div className="col-span-12 md:col-span-6 lg:col-span-4 relative group rounded-3xl p-7 bg-gradient-to-b from-zinc-900/70 to-zinc-950/80 border border-zinc-800/80 hover:border-blue-500/40 transition-all duration-300 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Calendar className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono uppercase tracking-wider text-blue-400 font-semibold">
                  Calendrier Prédictif
                </span>
              </div>

              <h3 className="text-xl font-bold text-white mb-2">
                Zéro Conflit d&apos;Agenda
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                Détection automatique des dates dans vos conversations et synchronisation instantanée entre Google Calendar et Outlook.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-zinc-200">14:00 • Démo Investisseurs</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-medium">Confirmé</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-950/40 border border-indigo-500/30">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-indigo-200">16:30 • Déplacé auto (sync Julie)</span>
                </div>
                <span className="text-[10px] text-indigo-300 font-mono">Résolu</span>
              </div>
            </div>
          </div>

          {/* Card 5: Bank-Grade Privacy (4 cols) */}
          <div className="col-span-12 lg:col-span-4 relative group rounded-3xl p-7 bg-gradient-to-b from-zinc-900/70 to-zinc-950/80 border border-zinc-800/80 hover:border-emerald-500/40 transition-all duration-300 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Shield className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                  Sécurité & Éthique
                </span>
              </div>

              <h3 className="text-xl font-bold text-white mb-2">
                Vos Données Ne Sont Jamais Vendues
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                Chiffrement de bout en bout, architecture isolée, conformité stricte au RGPD. Vos flux ne nourrissent aucun LLM public.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-zinc-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Chiffrement matériel AES-256</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Hébergement souverain européen</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Suppression en 1 clic sans trace</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
