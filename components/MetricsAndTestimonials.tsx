"use client";

import { Star, CheckCircle2, Users, ShieldCheck, Zap } from "lucide-react";

export default function MetricsAndTestimonials() {
  const metrics = [
    {
      value: "2.8h",
      label: "Économisées par jour",
      sub: "Temps libéré du traitement des messages",
      icon: Zap,
    },
    {
      value: "99.8%",
      label: "Précision de tri",
      sub: "Aucune urgence réelle manquée",
      icon: CheckCircle2,
    },
    {
      value: "+15 000",
      label: "Professionnels actifs",
      sub: "Entrepreneurs, freelances, cadres",
      icon: Users,
    },
    {
      value: "0 Ko",
      label: "Données revendues",
      sub: "Chiffrement Zero-Knowledge complet",
      icon: ShieldCheck,
    },
  ];

  const testimonials = [
    {
      quote:
        "La synthèse des vocaux WhatsApp à elle seule a changé ma vie. Je recevais des dizaines de vocaux de 3 minutes par jour de mes clients. OmniMind les résume en 2 puces et ajoute les rendez-vous sur mon agenda automatiquement.",
      author: "Alexandre Moreau",
      role: "Fondateur & CEO, Studio Nova",
      avatar: "AM",
      rating: 5,
    },
    {
      quote:
        "Le Briefing Matinal à 8h sur Telegram est devenu mon rituel incontournable. L'IA sait exactement ce qui est prioritaire entre mes emails Gmail et mes messages Slack/Discord. Je démarre chaque journée sans le moindre stress.",
      author: "Sarah Benali",
      role: "Directrice des Opérations, FinTech Scale",
      avatar: "SB",
      rating: 5,
    },
    {
      quote:
        "J'avais peur pour la confidentialité de mes emails de direction. L'architecture Zero-Knowledge et le chiffrement de bout en bout m'ont convaincu. C'est le premier assistant IA auquel je fais confiance les yeux fermés.",
      author: "Julien Vasseur",
      role: "Avocat Associé, Droit des Affaires",
      avatar: "JV",
      rating: 5,
    },
  ];

  return (
    <section className="relative py-24 bg-[#08090e] border-t border-zinc-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-24">
          {metrics.map((m, idx) => {
            const Icon = m.icon;
            return (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 text-center hover:border-indigo-500/30 transition-all duration-200"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                  {m.value}
                </div>
                <div className="mt-1 text-sm font-semibold text-zinc-200">
                  {m.label}
                </div>
                <div className="mt-1 text-xs text-zinc-400">
                  {m.sub}
                </div>
              </div>
            );
          })}
        </div>

        {/* Testimonials Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold mb-3">
            <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
            <span>Note moyenne de 4.9 / 5</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Adopté par ceux dont chaque minute compte
          </h2>
        </div>

        {/* Testimonials Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, idx) => (
            <div
              key={idx}
              className="flex flex-col justify-between p-7 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700 transition-all duration-200 shadow-lg"
            >
              <div>
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed italic mb-6">
                  &quot;{t.quote}&quot;
                </p>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-zinc-800/80">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-xs text-white">
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">
                    {t.author}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {t.role}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
