"use client";

import {
  FileText,
  CalendarCheck,
  Bot,
  Mic,
  Filter,
  Shield,
  CheckCircle,
  Sparkles,
} from "lucide-react";

export default function FeatureList() {
  const features = [
    {
      icon: FileText,
      iconColor: "text-indigo-400",
      accentBg: "bg-indigo-500/10 border-indigo-500/20",
      title: "Synthèse & Briefings Omnicanaux",
      subtitle: "Ne lisez plus 200 messages éparpillés.",
      description:
        "Chaque matin et soir, recevez un compte-rendu ultra-concis sur Telegram ou WhatsApp. OmniMind regroupe les échanges clés de Gmail, WhatsApp, Outlook et Discord en 3 sections actionnables : Urgences, Décisions prises, et Actions à mener.",
      bullets: [
        "Filtrage sémantique sans perte d'information critique",
        "Score d'urgence calculé par IA pour chaque conversation",
        "Envoyé directement sur votre canal de prédilection à l'heure voulue",
      ],
    },
    {
      icon: CalendarCheck,
      iconColor: "text-purple-400",
      accentBg: "bg-purple-500/10 border-purple-500/20",
      title: "Rappels Prédictifs & Détection d'Engagements",
      subtitle: "Ne laissez plus jamais un engagement passer entre les mailles du filet.",
      description:
        "Un client vous dit sur WhatsApp 'On se cale un appel mardi à 14h' ? Un collaborateur mentionne un livrable pour jeudi ? OmniMind détecte automatiquement la promesse, vérifie vos disponibilités sur Google Calendar ou Outlook, et prépare le rappel.",
      bullets: [
        "Création automatique d'événements avec lien de visio intégré",
        "Détection des délais implicites ('je te l'envoie en fin de journée')",
        "Rappels contextuels avec le lien direct vers le message source",
      ],
    },
    {
      icon: Bot,
      iconColor: "text-pink-400",
      accentBg: "bg-pink-500/10 border-pink-500/20",
      title: "Agent d'Action Autonome avec Validation",
      subtitle: "Une IA qui ne se contente pas de discuter : elle agit.",
      description:
        "Besoin de reporter un rendez-vous ? L'agent rédige les emails aux participants, propose 3 nouveaux créneaux selon votre agenda et met à jour les calendriers une fois le créneau choisi. En mode 'Human-in-the-Loop', vous validez chaque action d'un clic.",
      bullets: [
        "Préparation de brouillons d'emails calqués sur votre style rédactionnel",
        "Délégation de micro-tâches répétitives en langage naturel",
        "Boutons d'approbation 'Valider' / 'Modifier' directement dans vos messageries",
      ],
    },
    {
      icon: Mic,
      iconColor: "text-emerald-400",
      accentBg: "bg-emerald-500/10 border-emerald-500/20",
      title: "Transcription & Synthèse Audio Instantanée",
      subtitle: "Fini la torture des messages vocaux de 4 minutes.",
      description:
        "Transférez n'importe quelle note vocale WhatsApp ou Telegram à votre assistant. En 2 secondes, obtenez la transcription exacte mot à mot, le résumé des points clés et la liste des tâches à accomplir.",
      bullets: [
        "Traitement audio ultra-rapide (Whisper v3 haute fidélité)",
        "Compréhension des accents, jargon technique et termes multilingues",
        "Possibilité de répondre par vocal : l'IA synthétise ou envoie en texte poli",
      ],
    },
    {
      icon: Filter,
      iconColor: "text-amber-400",
      accentBg: "bg-amber-500/10 border-amber-500/20",
      title: "Filtre VIP & Bouclier Anti-Surcharge",
      subtitle: "Reprenez le contrôle total de votre temps et de votre attention.",
      description:
        "Identifiez vos contacts clés (associés, clients stratégiques, famille). OmniMind met sous silence les spams, newsletters et discussions de groupe secondaires, tout en vous garantissant de ne jamais rater une urgence réelle.",
      bullets: [
        "Règles dynamiques par niveau de priorité (VIP, Équipe, Neutre, Bruit)",
        "Mode 'Deep Work' : seules les urgences absolues brisent le silence",
        "Statistiques hebdomadaires sur votre temps de communication",
      ],
    },
    {
      icon: Shield,
      iconColor: "text-cyan-400",
      accentBg: "bg-cyan-500/10 border-cyan-500/20",
      title: "Confidentialité & Chiffrement de Bout en Bout",
      subtitle: "Vos correspondances privées restent strictement privées.",
      description:
        "Architecture 'Zero-Knowledge' : vos messages ne sont jamais stockés en clair, vos identifiants sont chiffrés et isolés, et aucune de vos données n'est utilisée pour entraîner des modèles publics d'intelligence artificielle.",
      bullets: [
        "Chiffrement AES-256 au repos et TLS 1.3 en transit",
        "Conformité intégrale avec le RGPD européen et normes ISO 27001",
        "Suppression totale de vos données sur simple demande en un clic",
      ],
    },
  ];

  return (
    <section id="features" className="relative py-28 bg-[#08090e] border-t border-zinc-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Fonctionnalités Clés
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Tout ce dont vous avez besoin pour{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">
              automatiser votre quotidien
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-zinc-400 leading-relaxed">
            Conçu pour les entrepreneurs, managers, freelances et créateurs qui reçoivent trop de sollicitations pour tout traiter manuellement.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="group relative flex flex-col justify-between p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/5"
              >
                <div>
                  <div
                    className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${item.accentBg} mb-6 group-hover:scale-110 transition-transform duration-200`}
                  >
                    <Icon className={`w-6 h-6 ${item.iconColor}`} />
                  </div>

                  <h3 className="text-xl font-bold text-white mb-1 group-hover:text-indigo-300 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs font-medium text-indigo-400/90 mb-3">
                    {item.subtitle}
                  </p>

                  <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                    {item.description}
                  </p>
                </div>

                <div className="pt-5 border-t border-zinc-800/80 space-y-2.5">
                  {item.bullets.map((bullet, bIdx) => (
                    <div key={bIdx} className="flex items-start gap-2.5 text-xs text-zinc-300">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="leading-snug">{bullet}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
