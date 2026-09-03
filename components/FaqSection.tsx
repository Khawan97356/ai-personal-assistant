"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: "Comment OmniMind se connecte-t-il à WhatsApp et Telegram ?",
      a: "La connexion s'effectue en quelques secondes. Pour Telegram, vous discutez directement avec votre bot privé OmniMind sécurisé par un jeton unique. Pour WhatsApp, nous utilisons l'API officielle WhatsApp Cloud ou un jumelage sécurisé par QR Code. Vous pouvez révoquer l'accès à tout instant depuis votre espace personnel.",
    },
    {
      q: "Mes emails et conversations privées sont-ils stockés ou analysés ?",
      a: "Non. Nous appliquons une politique stricte de Zero-Data Retention. Les messages entrants sont analysés à la volée en mémoire vive chiffrée, puis immédiatement purgés dès que le résumé ou l'action est généré. Vos données ne sont jamais vendues, ni utilisées pour réentraîner des modèles publics.",
    },
    {
      q: "L'IA peut-elle envoyer des messages ou modifier mon agenda sans mon accord ?",
      a: "Par défaut, OmniMind fonctionne en mode 'Human-in-the-Loop' (Validation Humaine). L'IA rédige les brouillons d'emails et pré-remplit les rendez-vous, mais attend votre confirmation via un simple bouton 'Valider' sur Telegram ou WhatsApp. Vous pouvez néanmoins activer l'automatisation totale pour des expéditeurs de confiance désignés.",
    },
    {
      q: "Est-ce compatible avec mon smartphone (iOS et Android) ?",
      a: "Oui, à 100%. Puisque OmniMind communique directement via vos applications existantes (WhatsApp, Telegram, Gmail, Outlook), vous n'avez même pas besoin d'installer une application supplémentaire sur votre téléphone ! Vous recevez vos alertes et donnez vos ordres vocalement ou par écrit comme à un contact normal.",
    },
    {
      q: "Puis-je connecter plusieurs comptes Gmail et Outlook en même temps ?",
      a: "Oui ! Les forfaits Pro et Enterprise permettent de connecter simultanément plusieurs comptes (par exemple votre Gmail personnel + votre Outlook d'entreprise + votre serveur Discord d'équipe). L'agent consolide tout dans un flux cohérent.",
    },
    {
      q: "Comment fonctionne l'essai gratuit de 14 jours ?",
      a: "Vous bénéficiez d'un accès illimité à toutes les fonctionnalités du forfait Pro pendant 14 jours. Aucune carte bancaire n'est exigée à l'inscription. Si vous décidez de ne pas poursuivre, votre compte bascule simplement en mode passif sans aucun frais.",
    },
  ];

  return (
    <section id="faq" className="relative py-24 bg-[#08090e] border-t border-zinc-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <HelpCircle className="w-3.5 h-3.5" />
            Questions Fréquentes
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Tout ce que vous devez savoir
          </h2>
          <p className="mt-3 text-base text-zinc-400">
            Une question sans réponse ? Notre équipe technique vous répond en direct sur Discord et Telegram.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 hover:bg-zinc-800/40 transition-colors cursor-pointer"
                >
                  <span className="text-base font-semibold text-white">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-zinc-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-indigo-400" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-1 text-sm text-zinc-300 leading-relaxed border-t border-zinc-800/50">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
