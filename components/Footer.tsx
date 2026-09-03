import Link from "next/link";
import { Sparkles, Globe } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#05060a] border-t border-zinc-900/90 text-zinc-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Col 1: Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                OmniMind
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  AI Agent
                </span>
              </span>
            </Link>

            <p className="text-xs text-zinc-400 leading-relaxed max-w-sm">
              L&apos;agent d&apos;intelligence artificielle personnelle qui unifie Gmail, WhatsApp, Telegram, Outlook et Discord pour résumer, rappeler et agir à votre place.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono text-zinc-400">
                Statut des serveurs : 99.99% Opérationnel
              </span>
            </div>
          </div>

          {/* Col 2: Produit */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">
              Produit
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="#features" className="hover:text-white transition-colors">
                  Synthèse & Briefings
                </Link>
              </li>
              <li>
                <Link href="#features" className="hover:text-white transition-colors">
                  Transcription Vocale
                </Link>
              </li>
              <li>
                <Link href="#bento" className="hover:text-white transition-colors">
                  Rappels & Agenda
                </Link>
              </li>
              <li>
                <Link href="#bento" className="hover:text-white transition-colors">
                  Agent Autonome 1-Tap
                </Link>
              </li>
              <li>
                <Link href="#demo" className="hover:text-white transition-colors">
                  Simulateur Live
                </Link>
              </li>
              <li>
                <Link href="#pricing" className="hover:text-white transition-colors">
                  Grille Tarifaire
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Écosystème */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">
              Intégrations
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="#integrations" className="hover:text-white transition-colors">
                  WhatsApp Cloud
                </Link>
              </li>
              <li>
                <Link href="#integrations" className="hover:text-white transition-colors">
                  Telegram Bot API
                </Link>
              </li>
              <li>
                <Link href="#integrations" className="hover:text-white transition-colors">
                  Gmail & Google Calendar
                </Link>
              </li>
              <li>
                <Link href="#integrations" className="hover:text-white transition-colors">
                  Outlook & Microsoft 365
                </Link>
              </li>
              <li>
                <Link href="#integrations" className="hover:text-white transition-colors">
                  Discord Communities
                </Link>
              </li>
              <li>
                <Link href="#integrations" className="hover:text-white transition-colors">
                  Notion & Slack
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Sécurité & Légal */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">
              Sécurité & Légal
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <a href="#faq" className="hover:text-white transition-colors">
                  Architecture Zero-Knowledge
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">
                  Conformité RGPD
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">
                  Politique de Confidentialité
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">
                  Conditions Générales
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">
                  Rapports d&apos;Audit Sécurité
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 pt-8 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>© 2026 OmniMind Technologies SAS. Tous droits réservés.</p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-zinc-400" /> Français (FR)
            </span>
            <span>Chiffrement E2E Actif</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
