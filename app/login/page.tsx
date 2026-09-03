"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  Mail,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
  RefreshCw,
  AlertCircle,
  KeyRound,
  User,
} from "lucide-react";
import { playChime } from "@/lib/audio/speech";

export default function LoginPage() {
  const router = useRouter();

  // Form State
  const [step, setStep] = useState<"input" | "verify">("input");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Dev preview
  const [devInfo, setDevInfo] = useState<{
    code: string;
    magicLink: string;
    method: string;
  } | null>(null);

  // Étape 1 : Demande d'accès par email
  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Veuillez saisir une adresse email valide.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Impossible d'envoyer l'email.");
      }

      playChime("start");
      setSuccessNotice(data.message);
      if (data.devCode) {
        setDevInfo({
          code: data.devCode,
          magicLink: data.devMagicLink,
          method: data.method,
        });
      }
      setStep("verify");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // Étape 2 : Confirmation avec le code reçu par email
  const handleVerifyCode = async (codeToVerify?: string) => {
    const finalCode = (codeToVerify || code).trim();
    if (finalCode.length < 6) {
      setErrorMsg("Veuillez saisir le code à 6 chiffres reçu par email.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: finalCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Code invalide.");
      }

      playChime("success");
      setSuccessNotice(`Accès validé avec succès ! Bienvenue ${data.user.name}.`);

      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07080d] text-white flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 group mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">OmniMind</span>
          </Link>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {step === "input"
              ? "Créer ou Connecter votre Compte"
              : "Vérifiez votre boîte de réception"}
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-zinc-400 max-w-sm mx-auto">
            {step === "input"
              ? "Recevez un email de confirmation pour activer votre assistant exécutif personnel et vos accès en temps réel."
              : `Nous avons envoyé un lien d'accès et un code de confirmation à ${email}.`}
          </p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/60">
          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successNotice && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{successNotice}</span>
            </div>
          )}

          {step === "input" ? (
            /* STEP 1: DEMANDE D'ACCÈS */
            <form onSubmit={handleRequestAccess} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Votre Prénom ou Nom
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Khawan"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Adresse Email Professionnelle *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@entreprise.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:scale-[1.01] active:scale-[0.99] text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Envoi de l&apos;email en cours...</span>
                    </>
                  ) : (
                    <>
                      <span>Recevoir mon email de confirmation</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-zinc-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero-Spam • Connexion chiffrée de bout en bout</span>
              </div>
            </form>
          ) : (
            /* STEP 2: VALIDATION DU CODE */
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-2 text-center">
                  Entrez le code à 6 chiffres reçu par email
                </label>
                <div className="relative flex justify-center">
                  <input
                    type="text"
                    maxLength={6}
                    value={code}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setCode(val);
                      if (val.length === 6) {
                        handleVerifyCode(val);
                      }
                    }}
                    placeholder="••••••"
                    className="w-56 text-center tracking-[8px] font-mono text-2xl py-3 rounded-2xl bg-zinc-950/90 border border-indigo-500/50 text-indigo-200 focus:outline-none focus:border-indigo-400 transition-all shadow-inner"
                    autoFocus
                  />
                </div>
              </div>

              <button
                onClick={() => handleVerifyCode()}
                disabled={loading || code.length < 6}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-semibold text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Vérification en cours...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Confirmer et Ouvrir ma Console</span>
                  </>
                )}
              </button>

              {/* Dev Simulation helper box */}
              {devInfo && (
                <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-indigo-400" />
                      Aperçu Immédiat (Mode Test)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-200 font-mono">
                      Code : {devInfo.code}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Vous pouvez cliquer sur le bouton ci-dessous pour remplir automatiquement le code et activer votre compte sans quitter cette page :
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      onClick={() => {
                        setCode(devInfo.code);
                        handleVerifyCode(devInfo.code);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer"
                    >
                      ⚡ Remplir & Valider le Code ({devInfo.code})
                    </button>
                    <a
                      href={devInfo.magicLink}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 hover:text-white transition-colors text-center"
                    >
                      Tester le Lien Magique
                    </a>
                  </div>
                </div>
              )}

              <div className="pt-2 text-center">
                <button
                  onClick={() => setStep("input")}
                  className="text-xs text-zinc-400 hover:text-white underline underline-offset-4 cursor-pointer"
                >
                  Changer d&apos;adresse email
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-xs text-zinc-400 hover:text-white transition-colors inline-flex items-center gap-1.5"
          >
            <span>&larr; Revenir au site d&apos;accueil</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
