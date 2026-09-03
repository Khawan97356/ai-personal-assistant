"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { playChime } from "@/lib/audio/speech";

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>("Validation de votre lien d'accès sécurisé...");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Lien de confirmation manquant ou invalide.");
      return;
    }

    let isMounted = true;

    fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Échec de validation du token.");
        }
        if (isMounted) {
          playChime("success");
          setStatus("success");
          setMessage(`Bienvenue ${data.user.name} ! Votre accès à OmniMind est validé.`);
          setTimeout(() => {
            router.push("/dashboard");
            router.refresh();
          }, 1500);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setStatus("error");
          setMessage(err instanceof Error ? err.message : "Erreur de validation.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, email, router]);

  return (
    <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/90 rounded-3xl p-8 shadow-2xl shadow-black/60 text-center space-y-4">
      {status === "loading" && (
        <>
          <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin mx-auto mb-2" />
          <h2 className="text-lg font-bold text-white">Vérification en cours</h2>
          <p className="text-xs text-zinc-400">{message}</p>
        </>
      )}

      {status === "success" && (
        <>
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-in zoom-in-50" />
          <h2 className="text-xl font-bold text-white">Accès Confirmé avec Succès !</h2>
          <p className="text-xs text-zinc-300">{message}</p>
          <p className="text-[11px] text-zinc-500">Redirection automatique vers votre console...</p>
        </>
      )}

      {status === "error" && (
        <>
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">Lien Expiré ou Invalide</h2>
          <p className="text-xs text-red-300">{message}</p>
          <div className="pt-4">
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
            >
              Demander un nouveau lien de confirmation
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-[#07080d] text-white flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2.5 group mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-xl font-bold text-white">OmniMind</span>
          </Link>
        </div>

        <Suspense
          fallback={
            <div className="p-8 text-center bg-zinc-900/60 rounded-3xl border border-zinc-800 text-xs text-zinc-400">
              Chargement...
            </div>
          }
        >
          <VerifyContent />
        </Suspense>
      </div>
    </div>
  );
}
