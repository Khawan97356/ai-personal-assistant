"use client";

import { useState } from "react";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function PricingSection() {
  const [annual, setAnnual] = useState(true);

  const tiers = [
    {
      name: "Starter",
      badge: "Pour débuter",
      priceMonthly: 19,
      priceAnnual: 15,
      description: "Idéal pour un usage personnel léger et tester la puissance de la synthèse.",
      features: [
        "1 canal de messagerie (WhatsApp ou Telegram)",
        "Connexion Gmail ou Outlook",
        "1 Briefing quotidien (matin)",
        "Jusqu'à 60 min de transcription audio/mois",
        "Rappels manuels & calendrier basique",
        "Support standard sous 48h",
      ],
      buttonText: "Commencer l'essai gratuit",
      popular: false,
    },
    {
      name: "Pro Agent",
      badge: "Le Plus Populaire",
      priceMonthly: 39,
      priceAnnual: 29,
      description: "La suite complète pour entrepreneurs, freelances et professionnels exigeants.",
      features: [
        "Tous les canaux : Gmail, WhatsApp, Telegram, Outlook, Discord",
        "Briefings matinal & vespéral personnalisables",
        "Transcription vocale illimitée (Whisper v3 Turbo)",
        "Agent d'action autonome avec validation 1-Tap",
        "Synchronisation bidirectionnelle Google Calendar & Exchange",
        "Filtre anti-bruit VIP intelligent",
        "Support prioritaire 7j/7",
      ],
      buttonText: "Activer mon Agent Pro (14j offerts)",
      popular: true,
    },
    {
      name: "Executive & Équipe",
      badge: "Sur-Mesure",
      priceMonthly: 89,
      priceAnnual: 75,
      description: "Pour dirigeants, family offices et équipes nécessitant une confidentialité totale.",
      features: [
        "Tout ce qui est inclus dans le plan Pro",
        "Gestion multi-comptes et délégations d'assistants",
        "Connecteurs CRM & ERP (HubSpot, Salesforce, Notion)",
        "Instance de calcul privée dédiée & Zero-Log certifié",
        "Accord de confidentialité NDA & conformité sur-mesure",
        "Onboarding dédié 1-to-1 avec un ingénieur IA",
      ],
      buttonText: "Réserver un appel de démo",
      popular: false,
    },
  ];

  return (
    <section id="pricing" className="relative py-28 bg-[#08090e] border-t border-zinc-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Tarifs Transparents
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Investissez dans{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">
              votre temps
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-zinc-400">
            14 jours d&apos;essai gratuit sur tous les forfaits. Sans engagement, annulez quand vous voulez.
          </p>

          {/* Billing Switcher */}
          <div className="mt-8 inline-flex items-center gap-3 p-1.5 rounded-2xl bg-zinc-900 border border-zinc-800">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                !annual ? "bg-zinc-800 text-white shadow" : "text-zinc-400 hover:text-white"
              }`}
            >
              Facturation Mensuelle
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                annual
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <span>Facturation Annuelle</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-400/20 text-indigo-200 border border-indigo-400/30">
                -25% (2 mois offerts)
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {tiers.map((tier, idx) => {
            const price = annual ? tier.priceAnnual : tier.priceMonthly;
            return (
              <div
                key={idx}
                className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 ${
                  tier.popular
                    ? "bg-gradient-to-b from-indigo-950/40 via-zinc-900/90 to-zinc-950 border-2 border-indigo-500 shadow-2xl shadow-indigo-500/10 lg:-translate-y-2"
                    : "bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-bold tracking-wide shadow-md">
                    RECOMMANDÉ
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white">{tier.name}</h3>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 font-medium">
                      {tier.badge}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 mb-6 min-h-[36px]">
                    {tier.description}
                  </p>

                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                      {price}€
                    </span>
                    <span className="text-xs text-zinc-400 font-medium">
                      / mois {annual ? "(facturé annuellement)" : ""}
                    </span>
                  </div>

                  <div className="space-y-3 pt-6 border-t border-zinc-800/80 mb-8">
                    {tier.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-3 text-xs text-zinc-300">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Link
                    href="#demo"
                    className={`w-full inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl text-sm font-semibold transition-all ${
                      tier.popular
                        ? "bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-[1.02]"
                        : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white"
                    }`}
                  >
                    <span>{tier.buttonText}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
