"use client";

import {
  Check,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function IntegrationsSection() {
  const integrations = [
    {
      name: "Gmail & Google Workspace",
      category: "Emails & Calendriers",
      iconColor: "text-red-400",
      bgColor: "from-red-500/10 to-transparent",
      borderColor: "group-hover:border-red-500/40",
      description:
        "Tri intelligent des newsletters, détection des urgences VIP, génération automatique de brouillons conformes à votre ton.",
      features: ["Lecture sémantique", "Brouillons en 1 clic", "Google Calendar sync"],
      status: "Connexion 1-Clic OAuth",
    },
    {
      name: "WhatsApp Personal & Business",
      category: "Messagerie Instantanée",
      iconColor: "text-emerald-400",
      bgColor: "from-emerald-500/10 to-transparent",
      borderColor: "group-hover:border-emerald-500/40",
      description:
        "Fini les vocaux interminables : transcription instantanée et résumés en 3 puces. Détection d'engagements et de rendez-vous.",
      features: ["Transcription vocale", "Rappels automatiques", "Mode veille silencieux"],
      status: "Chiffré de bout en bout",
    },
    {
      name: "Telegram Bot & Canaux",
      category: "Automatisation Rapide",
      iconColor: "text-sky-400",
      bgColor: "from-sky-500/10 to-transparent",
      borderColor: "group-hover:border-sky-500/40",
      description:
        "Votre hub de commande préféré. Envoyez un ordre par texte ou vocal à votre bot privé, recevez le résumé instantané de votre journée.",
      features: ["Bot privé ultra-réactif", "Synthèse de chaînes", "Commandes naturelles"],
      status: "API Officielle Sécurisée",
    },
    {
      name: "Outlook & Microsoft 365",
      category: "Productivité Entreprise",
      iconColor: "text-blue-400",
      bgColor: "from-blue-500/10 to-transparent",
      borderColor: "group-hover:border-blue-500/40",
      description:
        "Synchronisation fluide avec Exchange et Teams. Priorisation de votre boîte de réception professionnelle et gestion des créneaux libres.",
      features: ["Filtre VIP Enterprise", "Conflits de réunion résolus", "MS Teams recap"],
      status: "Certifié Microsoft Graph",
    },
    {
      name: "Discord Communities",
      category: "Serveurs & Projets",
      iconColor: "text-indigo-400",
      bgColor: "from-indigo-500/10 to-transparent",
      borderColor: "group-hover:border-indigo-500/40",
      description:
        "Ne manquez plus les mentions critiques dans 20 serveurs différents. L'IA extrait uniquement les annonces et messages vous concernant.",
      features: ["Filtre de mentions @vous", "Digest des canaux clés", "Alertes tickets"],
      status: "Bot vérifié",
    },
    {
      name: "Notion & Apple Notes",
      category: "Second Cerveau",
      iconColor: "text-amber-400",
      bgColor: "from-amber-500/10 to-transparent",
      borderColor: "group-hover:border-amber-500/40",
      description:
        "Sauvegarde instantanée des idées, tâches et résumés directement dans vos bases de données ou vos carnets de notes structurés.",
      features: ["Synchro bidirectionnelle", "Formatage Markdown", "Tags intelligents"],
      status: "Sync temps réel",
    },
  ];

  return (
    <section id="integrations" className="relative py-24 bg-[#08090e] border-t border-zinc-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <Zap className="w-3.5 h-3.5" />
            Écosystème Connecté & Instantané
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Vos applications favorites, enfin réunies dans{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">
              un seul cerveau
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-zinc-400">
            Fini le basculement permanent entre 6 fenêtres. OmniMind unifie vos flux en arrière-plan et ne vous dérange que pour l&apos;essentiel.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations.map((item, idx) => (
            <div
              key={idx}
              className={`group relative rounded-2xl p-7 bg-zinc-900/50 border border-zinc-800/90 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/5 bg-gradient-to-b ${item.bgColor} ${item.borderColor}`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                  {item.category}
                </span>
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-zinc-800/80 text-zinc-300 border border-zinc-700/60">
                  {item.status}
                </span>
              </div>

              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">
                {item.name}
              </h3>

              <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                {item.description}
              </p>

              <div className="space-y-2 pt-4 border-t border-zinc-800/60">
                {item.features.map((feat, fIdx) => (
                  <div key={fIdx} className="flex items-center gap-2 text-xs text-zinc-300">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Integration banner callout */}
        <div className="mt-12 rounded-2xl p-6 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-zinc-900/50 border border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                Sécurité Zero-Retention & API Officielles
              </h4>
              <p className="text-xs text-zinc-400">
                Vos clés et jetons d&apos;accès sont chiffrés en AES-256 avec isolation matérielle. Vos conversations ne sont jamais utilisées pour entraîner des modèles publics.
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
              Conforme RGPD & SOC-2 Type II
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
