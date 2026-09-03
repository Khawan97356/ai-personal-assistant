"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  LayoutDashboard,
  CheckCircle2,
  Clock,
  Zap,
  MessageCircle,
  Layers,
  Settings,
  Shield,
  ArrowLeft,
  RefreshCw,
  Check,
  ExternalLink,
  X,
  Key,
  AlertCircle,
  Mic,
} from "lucide-react";
import { ActionProposal, SummaryReport } from "@/lib/agent/types";
import JarvisVoiceCompanion from "@/components/JarvisVoiceCompanion";
import { speakText } from "@/lib/audio/speech";

type TabType = "overview" | "actions" | "briefings" | "accounts" | "settings";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [actions, setActions] = useState<ActionProposal[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const [latestReport, setLatestReport] = useState<SummaryReport | null>(null);
  const [generatingBriefing, setGeneratingBriefing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal de configuration des clés API
  const [configModalAccount, setConfigModalAccount] = useState<string | null>(null);
  const [configForm, setConfigForm] = useState({
    token: "",
    chatId: "",
    webhookUrl: "",
    apiKey: "",
    phoneId: "",
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  // Comptes connectés
  const [accounts, setAccounts] = useState([
    {
      id: "gmail",
      name: "Gmail & Google Workspace",
      type: "Email & Calendar",
      status: "connected",
      email: "thomas.dev@gmail.com",
      unreadCount: 8,
      iconColor: "text-red-400",
      bgColor: "bg-red-500/10 border-red-500/20",
    },
    {
      id: "whatsapp",
      name: "WhatsApp Business Cloud",
      type: "Messagerie Instantanée",
      status: "connected",
      email: "+33 6 12 34 56 78",
      unreadCount: 14,
      iconColor: "text-emerald-400",
      bgColor: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      id: "telegram",
      name: "Telegram Bot Privé",
      type: "Commandes Rapides",
      status: "connected",
      email: "@OmniMindThomasBot",
      unreadCount: 3,
      iconColor: "text-sky-400",
      bgColor: "bg-sky-500/10 border-sky-500/20",
    },
    {
      id: "outlook",
      name: "Outlook / Microsoft 365",
      type: "Email Professionnel",
      status: "disconnected",
      email: "Non connecté",
      unreadCount: 0,
      iconColor: "text-blue-400",
      bgColor: "bg-blue-500/10 border-blue-500/20",
    },
    {
      id: "discord",
      name: "Discord Bot & Webhook",
      type: "Communautés & Veille",
      status: "connected",
      email: "Serveur Tech Scale",
      unreadCount: 22,
      iconColor: "text-indigo-400",
      bgColor: "bg-indigo-500/10 border-indigo-500/20",
    },
  ]);

  // Paramètres utilisateur
  const [settings, setSettings] = useState({
    morningBriefingTime: "08:00",
    eveningBriefingTime: "19:00",
    preferredChannel: "telegram",
    requireApproval: true,
    vipEmails: "client@important.com, marc@societe.fr, avocat@lamy.fr",
    workingDays: "Lun - Ven",
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Chargement des actions
  const fetchActions = async () => {
    setLoadingActions(true);
    try {
      const res = await fetch("/api/agent/actions");
      const data = await res.json();
      if (data.actions) {
        setActions(data.actions);
      }
    } catch (err) {
      console.error("Error fetching actions:", err);
    } finally {
      setLoadingActions(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetch("/api/agent/actions")
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.actions) {
          setActions(data.actions);
        }
      })
      .catch((err) => console.error("Error fetching actions:", err));

    return () => {
      isMounted = false;
    };
  }, []);

  // Déclencher un briefing en direct
  const triggerBriefing = async () => {
    setGeneratingBriefing(true);
    try {
      const res = await fetch("/api/agent/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: "instant", dispatch: false }),
      });
      const data = await res.json();
      if (data.report) {
        setLatestReport(data.report);
        showToast("✨ Briefing exécutif généré avec succès !");
        const count = data.report.suggestedActions?.length || 0;
        speakText(`Briefing généré. ${count} recommandations d'actions prêtes pour validation.`, { mode: "robot" });
        fetchActions();
      }
    } catch (err) {
      console.error("Erreur briefing:", err);
      showToast("❌ Erreur lors de la génération du briefing.");
    } finally {
      setGeneratingBriefing(false);
    }
  };

  // Approuver ou rejeter une action
  const handleDecision = async (actionId: string, decision: "approve" | "reject") => {
    try {
      const res = await fetch("/api/agent/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, decision }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(decision === "approve" ? "✅ Action validée et exécutée !" : "❌ Action annulée.");
        if (decision === "approve") {
          speakText("Action validée et exécutée avec succès.", { mode: "robot" });
        }
        fetchActions();
      }
    } catch (err) {
      console.error("Erreur action:", err);
    }
  };

  // Basculer un compte
  const toggleAccount = (id: string) => {
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === id) {
          const newStatus = acc.status === "connected" ? "disconnected" : "connected";
          showToast(newStatus === "connected" ? `Compte ${acc.name} connecté !` : `Compte ${acc.name} déconnecté.`);
          return { ...acc, status: newStatus };
        }
        return acc;
      })
    );
  };

  // Ouvrir le modal de configuration
  const openConfigModal = (accountId: string) => {
    setConfigModalAccount(accountId);
    setTestResult(null);
  };

  // Tester la connexion API en direct
  const runTestConnection = async () => {
    if (!configModalAccount) return;
    setTestingConnection(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/agent/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: configModalAccount,
          credentials: {
            token: configForm.token,
            webhookUrl: configForm.webhookUrl,
            apiKey: configForm.apiKey,
            phoneId: configForm.phoneId,
          },
        }),
      });
      const data = await res.json();
      setTestResult({ success: data.success, message: data.message });
      if (data.success) {
        showToast("✅ Test réussi !");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({ success: false, message: `Erreur : ${msg}` });
    } finally {
      setTestingConnection(false);
    }
  };

  // Enregistrer les clés dans .env.local
  const saveConfiguration = async () => {
    setSavingConfig(true);
    try {
      const payload: Record<string, string> = {};
      if (configModalAccount === "telegram") {
        if (configForm.token) payload.TELEGRAM_BOT_TOKEN = configForm.token;
        if (configForm.chatId) payload.TELEGRAM_CHAT_ID = configForm.chatId;
      } else if (configModalAccount === "discord") {
        if (configForm.webhookUrl) payload.DISCORD_WEBHOOK_URL = configForm.webhookUrl;
      } else if (configModalAccount === "openai") {
        if (configForm.apiKey) payload.OPENAI_API_KEY = configForm.apiKey;
      } else if (configModalAccount === "groq") {
        if (configForm.apiKey) payload.GROQ_API_KEY = configForm.apiKey;
      } else if (configModalAccount === "whatsapp") {
        if (configForm.token) payload.WHATSAPP_API_TOKEN = configForm.token;
        if (configForm.phoneId) payload.WHATSAPP_PHONE_NUMBER_ID = configForm.phoneId;
      }

      const res = await fetch("/api/agent/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        showToast("💾 Configuration enregistrée dans .env.local !");
        setConfigModalAccount(null);
      } else {
        showToast(`❌ Erreur : ${data.message}`);
      }
    } catch (err) {
      console.error("Save config error:", err);
      showToast("❌ Erreur lors de l'enregistrement.");
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07080d] text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 px-5 py-3 rounded-xl bg-zinc-900 border border-indigo-500/40 text-white text-sm shadow-2xl shadow-indigo-500/20 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#08090e]/90 backdrop-blur-xl border-b border-zinc-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Retour au site</span>
          </Link>
          <div className="h-4 w-[1px] bg-zinc-800" />
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold text-white tracking-tight">
                OmniMind Console
              </span>
              <span className="hidden md:inline ml-2 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Agent Actif (v2.4)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsVoiceOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <Mic className="w-3.5 h-3.5 animate-pulse text-emerald-200" />
            <span>Mode Vocal Jarvis</span>
          </button>
          <button
            onClick={triggerBriefing}
            disabled={generatingBriefing}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generatingBriefing ? "animate-spin" : ""}`} />
            <span>{generatingBriefing ? "Génération..." : "Générer Briefing"}</span>
          </button>
          <div className="w-8 h-8 rounded-full bg-indigo-950 border border-indigo-500/30 text-indigo-300 flex items-center justify-center text-xs font-bold">
            TH
          </div>
        </div>
      </header>

      {/* Main Layout with Sidebar */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 gap-8">
        {/* Left Sidebar Tabs */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 space-y-1">
          {/* Bouton Proéminent Vocal Jarvis */}
          <button
            onClick={() => setIsVoiceOpen(true)}
            className="w-full mb-3 flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-indigo-950/70 via-purple-950/50 to-zinc-900 border border-indigo-500/40 text-indigo-200 hover:border-indigo-400 hover:scale-[1.01] text-xs font-bold transition-all shadow-lg shadow-indigo-500/10 cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                <Mic className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div>
                <div className="text-white text-xs font-semibold">Parler à Jarvis</div>
                <div className="text-[10px] text-emerald-400 font-medium">Réflexion & Voix Live</div>
              </div>
            </div>
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          </button>
          {[
            { id: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
            { id: "actions", label: "Actions 1-Tap", icon: Zap, badge: actions.filter((a) => a.status === "pending_approval").length },
            { id: "briefings", label: "Briefings Exécutifs", icon: Sparkles },
            { id: "accounts", label: "Comptes Connectés", icon: Layers, badge: accounts.filter((a) => a.status === "connected").length },
            { id: "settings", label: "Paramètres Agent", icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? "text-indigo-400" : "text-zinc-400"}`} />
                  <span>{tab.label}</span>
                </div>
                {typeof tab.badge === "number" && tab.badge > 0 && (
                  <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
                    isActive ? "bg-indigo-500 text-white" : "bg-zinc-800 text-zinc-300"
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-8 mt-6 border-t border-zinc-800/80 space-y-3">
            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Zero-Knowledge Mode</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Vos flux sont chiffrés. Aucun contenu n&apos;est utilisé pour le réentraînement.
              </p>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          {/* Mobile Tabs Bar */}
          <div className="flex lg:hidden overflow-x-auto gap-2 pb-4 mb-6 border-b border-zinc-800">
            {[
              { id: "overview", label: "Aperçu" },
              { id: "actions", label: "Actions" },
              { id: "briefings", label: "Briefings" },
              { id: "accounts", label: "Comptes" },
              { id: "settings", label: "Paramètres" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-900 text-zinc-400"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-8">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Messages Traités", value: "47", change: "+18% aujourd'hui", icon: MessageCircle, color: "text-indigo-400" },
                  { label: "Actions 1-Tap Exécutées", value: "6", change: "100% validées", icon: Zap, color: "text-purple-400" },
                  { label: "Temps Économisé", value: "2.4h", change: "Cette journée", icon: Clock, color: "text-emerald-400" },
                  { label: "Précision Tri VIP", value: "99.8%", change: "0 faux positif", icon: CheckCircle2, color: "text-sky-400" },
                ].map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <div key={i} className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                      <div className="flex items-center justify-between text-zinc-400 mb-3">
                        <span className="text-xs font-medium">{stat.label}</span>
                        <Icon className={`w-4 h-4 ${stat.color}`} />
                      </div>
                      <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                        {stat.value}
                      </div>
                      <span className="text-[11px] text-zinc-400 mt-1 block">
                        {stat.change}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Quick Actions & Pending Approvals */}
              <div className="rounded-2xl p-6 bg-zinc-900/40 border border-zinc-800/80">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white">
                      Actions en attente de votre approbation
                    </h3>
                  </div>
                  <span className="text-xs text-zinc-400">
                    {actions.filter((a) => a.status === "pending_approval").length} action(s) requise(s)
                  </span>
                </div>

                {actions.filter((a) => a.status === "pending_approval").length === 0 ? (
                  <div className="py-8 text-center text-xs text-zinc-500">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400/60 mx-auto mb-2" />
                    Toutes vos actions sont à jour ! Aucune approbation en attente.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {actions
                      .filter((a) => a.status === "pending_approval")
                      .slice(0, 3)
                      .map((act) => (
                        <div
                          key={act.id}
                          className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                {act.channel}
                              </span>
                              <span className="text-xs font-semibold text-white">
                                {act.title}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400">{act.description}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleDecision(act.id, "approve")}
                              className="px-3.5 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-600/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Valider</span>
                            </button>
                            <button
                              onClick={() => handleDecision(act.id, "reject")}
                              className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-xs hover:text-white transition-colors cursor-pointer"
                            >
                              Rejeter
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Connected channels status overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-2xl p-6 bg-zinc-900/40 border border-zinc-800/80">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    Flux Actifs Aujourd&apos;hui
                  </h3>
                  <div className="space-y-3">
                    {accounts.map((acc) => (
                      <div key={acc.id} className="flex items-center justify-between text-xs py-1.5">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              acc.status === "connected" ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
                            }`}
                          />
                          <span className="text-zinc-200 font-medium">{acc.name}</span>
                        </div>
                        <span className="text-zinc-400 font-mono">
                          {acc.status === "connected" ? `${acc.unreadCount} traités` : "Inactif"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl p-6 bg-gradient-to-br from-indigo-950/30 to-purple-950/20 border border-indigo-500/20 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                      Briefing du Jour Prêt
                    </span>
                    <h4 className="text-base font-bold text-white mt-2">
                      Synthèse Matinale (08:00 CEST)
                    </h4>
                    <p className="text-xs text-zinc-300 mt-2 leading-relaxed">
                      3 urgences traitées, 1 réunion déplacée avec succès à 16h30, et 0 email spam parvenu jusqu&apos;à vous.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("briefings")}
                    className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-indigo-300 hover:text-white cursor-pointer"
                  >
                    <span>Consulter le rapport complet</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ACTIONS 1-TAP */}
          {activeTab === "actions" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Centre d&apos;Approbation des Actions</h2>
                  <p className="text-xs text-zinc-400">
                    Validez en un clic les brouillons d&apos;emails, réunions ou messages préparés par votre agent.
                  </p>
                </div>
                <button
                  onClick={fetchActions}
                  className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white"
                  title="Rafraîchir"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingActions ? "animate-spin" : ""}`} />
                </button>
              </div>

              <div className="space-y-4">
                {actions.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl bg-zinc-900/30 border border-zinc-800/80">
                    <Zap className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                    <p className="text-sm text-zinc-400">Aucune action enregistrée pour le moment.</p>
                    <button
                      onClick={triggerBriefing}
                      className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white cursor-pointer"
                    >
                      Déclencher un briefing pour générer des actions
                    </button>
                  </div>
                ) : (
                  actions.map((act) => (
                    <div
                      key={act.id}
                      className={`p-5 rounded-2xl border transition-all ${
                        act.status === "pending_approval"
                          ? "bg-zinc-900/70 border-zinc-700/80 shadow-lg"
                          : act.status === "executed"
                          ? "bg-zinc-950/40 border-emerald-500/20 opacity-80"
                          : "bg-zinc-950/40 border-zinc-800/50 opacity-50"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                            {act.channel}
                          </span>
                          <h4 className="text-sm font-bold text-white">{act.title}</h4>
                        </div>
                        <span
                          className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${
                            act.status === "pending_approval"
                              ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                              : act.status === "executed"
                              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                              : "bg-red-500/10 text-red-300 border border-red-500/20"
                          }`}
                        >
                          {act.status === "pending_approval"
                            ? "En attente de validation"
                            : act.status === "executed"
                            ? "Exécuté avec succès"
                            : "Rejeté"}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-300 mb-4">{act.description}</p>

                      {/* Payload preview */}
                      {act.payload && (
                        <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs text-zinc-400 font-mono mb-4">
                          {act.payload.to && <div>Destinataire : {String(act.payload.to)}</div>}
                          {act.payload.subject && <div>Sujet : {String(act.payload.subject)}</div>}
                          {act.payload.body && (
                            <div className="mt-1 text-zinc-300 whitespace-pre-wrap font-sans">
                              &quot;{String(act.payload.body)}&quot;
                            </div>
                          )}
                          {act.payload.eventStart && (
                            <div>Début : {new Date(String(act.payload.eventStart)).toLocaleString("fr-FR")}</div>
                          )}
                        </div>
                      )}

                      {act.status === "pending_approval" && (
                        <div className="flex items-center gap-3 pt-2">
                          <button
                            onClick={() => handleDecision(act.id, "approve")}
                            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            <span>Approuver & Exécuter</span>
                          </button>
                          <button
                            onClick={() => handleDecision(act.id, "reject")}
                            className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-xs font-semibold hover:text-white transition-colors cursor-pointer"
                          >
                            Rejeter
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: BRIEFINGS */}
          {activeTab === "briefings" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Briefings Exécutifs</h2>
                  <p className="text-xs text-zinc-400">
                    Historique et génération instantanée de vos résumés d&apos;activité consolidés.
                  </p>
                </div>
                <button
                  onClick={triggerBriefing}
                  disabled={generatingBriefing}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{generatingBriefing ? "Synthèse en cours..." : "Générer un Briefing"}</span>
                </button>
              </div>

              {latestReport ? (
                <div className="p-6 sm:p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                    <div>
                      <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                        Rapport Généré
                      </span>
                      <h3 className="text-lg font-bold text-white mt-1">
                        Briefing du {new Date(latestReport.generatedAt).toLocaleString("fr-FR")}
                      </h3>
                    </div>
                    <span className="text-xs text-zinc-400 font-mono">
                      {latestReport.totalMessagesAnalyzed} messages traités
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-3">
                      Urgences & Priorités
                    </h4>
                    <ul className="space-y-2">
                      {latestReport.criticalPoints.map((pt, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-zinc-200">
                          <span className="text-red-400 font-bold">•</span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-3">
                      Décisions & Avancements
                    </h4>
                    <ul className="space-y-2">
                      {latestReport.decisionsTaken.map((dec, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-zinc-200">
                          <span className="text-emerald-400 font-bold">•</span>
                          <span>{dec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs text-zinc-300 whitespace-pre-wrap font-sans">
                    {latestReport.summaryMarkdown}
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                  <Sparkles className="w-10 h-10 text-indigo-400/60 mx-auto mb-3" />
                  <p className="text-sm text-zinc-300 font-medium">
                    Prêt à synthétiser vos canaux
                  </p>
                  <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                    Cliquez sur le bouton ci-dessus pour lancer la fusion de vos messages Gmail, WhatsApp, Telegram et Discord.
                  </p>
                  <button
                    onClick={triggerBriefing}
                    className="mt-5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Générer mon premier briefing
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CONNECTED ACCOUNTS */}
          {activeTab === "accounts" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Centre de Connexion des Canaux</h2>
                <p className="text-xs text-zinc-400">
                  Gérez l&apos;accès à vos messageries et calendriers. Activez ou désactivez les flux en un clic.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                          {acc.type}
                        </span>
                        <span
                          className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${
                            acc.status === "connected"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                          }`}
                        >
                          {acc.status === "connected" ? "Connecté" : "Déconnecté"}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-white mb-1">{acc.name}</h3>
                      <p className="text-xs text-zinc-400 font-mono mb-6">{acc.email}</p>
                    </div>

                    <div className="pt-4 border-t border-zinc-800/60 flex items-center justify-between">
                      <button
                        onClick={() => openConfigModal(acc.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800/80 border border-zinc-700/80 text-zinc-300 hover:text-white hover:bg-zinc-700/80 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Key className="w-3 h-3 text-indigo-400" />
                        <span>Configurer</span>
                      </button>
                      <button
                        onClick={() => toggleAccount(acc.id)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          acc.status === "connected"
                            ? "bg-zinc-800 text-zinc-300 hover:text-red-400 hover:bg-zinc-700"
                            : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/20"
                        }`}
                      >
                        {acc.status === "connected" ? "Désactiver" : "Connecter"}
                      </button>
                    </div>
                  </div>
                ))}

                {/* Modèles IA (OpenAI / Groq Whisper) */}
                <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/30 to-purple-950/20 border border-indigo-500/30 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-semibold">
                        Modèles d&apos;IA & Transcription
                      </span>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                        GPT-4o & Whisper Turbo
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white mb-1">Cerveau IA & Audio</h3>
                    <p className="text-xs text-zinc-400 mb-6">
                      Requis pour la synthèse de texte avancée et la transcription instantanée des messages vocaux WhatsApp / Telegram.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-indigo-500/20 flex items-center gap-3">
                    <button
                      onClick={() => openConfigModal("openai")}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Key className="w-3 h-3" />
                      <span>Clé OpenAI</span>
                    </button>
                    <button
                      onClick={() => openConfigModal("groq")}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Key className="w-3 h-3" />
                      <span>Clé Groq</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: AGENT SETTINGS */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Paramètres de l&apos;Agent Autonome</h2>
                <p className="text-xs text-zinc-400">
                  Ajustez les heures d&apos;envoi, vos contacts prioritaires et le niveau d&apos;autonomie.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-6 max-w-2xl">
                <div>
                  <label className="text-xs font-semibold text-zinc-200 block mb-2">
                    Horaire du Briefing Matinal
                  </label>
                  <input
                    type="time"
                    value={settings.morningBriefingTime}
                    onChange={(e) => setSettings({ ...settings, morningBriefingTime: e.target.value })}
                    className="px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-200 block mb-2">
                    Canal favori de réception
                  </label>
                  <select
                    value={settings.preferredChannel}
                    onChange={(e) => setSettings({ ...settings, preferredChannel: e.target.value })}
                    className="px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="telegram">Telegram Bot (@OmniMindThomasBot)</option>
                    <option value="whatsapp">WhatsApp (+33 6 12 34 56 78)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-200 block mb-2">
                    Contacts VIP (Notifications prioritaires)
                  </label>
                  <textarea
                    rows={3}
                    value={settings.vipEmails}
                    onChange={(e) => setSettings({ ...settings, vipEmails: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    placeholder="email1@exemple.com, +33600000000..."
                  />
                </div>

                <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-white block">
                      Validation Humaine Requise (1-Tap)
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      L&apos;IA ne valide aucun email ni réunion sans votre accord explicite.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.requireApproval}
                    onChange={(e) => setSettings({ ...settings, requireApproval: e.target.checked })}
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                <button
                  onClick={() => showToast("Paramètres sauvegardés avec succès !")}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Sauvegarder les Préférences
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Configuration Modal */}
      {configModalAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl bg-zinc-900 border border-zinc-800 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white uppercase tracking-tight">
                    Configurer {configModalAccount}
                  </h3>
                  <span className="text-[11px] text-zinc-400">Paramétrage direct & sécurisé</span>
                </div>
              </div>
              <button
                onClick={() => setConfigModalAccount(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Guide contextuel */}
            <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs text-zinc-300 space-y-1.5 leading-relaxed">
              <span className="text-indigo-400 font-bold block mb-1">💡 Comment obtenir vos accès ?</span>
              {configModalAccount === "telegram" && (
                <>
                  <p>1. Ouvrez l&apos;application Telegram et cherchez le compte officiel <strong>@BotFather</strong>.</p>
                  <p>2. Tapez <code>/newbot</code>, choisissez un nom puis copiez le <strong>Token API</strong> obtenu.</p>
                  <p>3. Pour votre <strong>Chat ID</strong>, envoyez un message au bot <strong>@userinfobot</strong>.</p>
                </>
              )}
              {configModalAccount === "discord" && (
                <>
                  <p>1. Sur votre serveur Discord, ouvrez les <strong>Paramètres du salon</strong>.</p>
                  <p>2. Rendez-vous dans <strong>Intégrations &gt; Webhooks</strong> et cliquez sur <strong>Nouveau Webhook</strong>.</p>
                  <p>3. Cliquez sur <strong>Copier l&apos;URL du Webhook</strong> et collez-la ci-dessous.</p>
                </>
              )}
              {configModalAccount === "openai" && (
                <>
                  <p>1. Connectez-vous à <strong>platform.openai.com</strong> puis allez dans <strong>API Keys</strong>.</p>
                  <p>2. Créez une nouvelle clé secrète (débute par <code>sk-</code>).</p>
                </>
              )}
              {configModalAccount === "groq" && (
                <>
                  <p>1. Rendez-vous sur <strong>console.groq.com/keys</strong> (gratuit et ultra-rapide).</p>
                  <p>2. Créez une clé API (débute par <code>gsk_</code>).</p>
                </>
              )}
              {configModalAccount === "whatsapp" && (
                <>
                  <p>1. Rendez-vous sur <strong>developers.facebook.com</strong> dans votre application WhatsApp Cloud.</p>
                  <p>2. Copiez votre <strong>Phone Number ID</strong> et votre <strong>Jeton d&apos;accès temporaire ou système</strong>.</p>
                </>
              )}
              {configModalAccount === "gmail" && (
                <p>Pour Gmail, configurez vos identifiants OAuth dans votre Google Cloud Console (voir .env.example).</p>
              )}
              {configModalAccount === "outlook" && (
                <p>Pour Outlook, configurez une application Azure Active Directory avec les droits Microsoft Graph.</p>
              )}
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {configModalAccount === "telegram" && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Token HTTP API du Bot
                    </label>
                    <input
                      type="password"
                      placeholder="123456789:ABCdefGHIjklMNO..."
                      value={configForm.token}
                      onChange={(e) => setConfigForm({ ...configForm, token: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Votre Chat ID Telegram Personnel (Optionnel pour test)
                    </label>
                    <input
                      type="text"
                      placeholder="987654321"
                      value={configForm.chatId}
                      onChange={(e) => setConfigForm({ ...configForm, chatId: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </>
              )}

              {configModalAccount === "discord" && (
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    URL du Webhook Discord
                  </label>
                  <input
                    type="password"
                    placeholder="https://discord.com/api/webhooks/..."
                    value={configForm.webhookUrl}
                    onChange={(e) => setConfigForm({ ...configForm, webhookUrl: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              )}

              {(configModalAccount === "openai" || configModalAccount === "groq") && (
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Clé API {configModalAccount === "openai" ? "OpenAI (sk-...)" : "Groq (gsk_...)"}
                  </label>
                  <input
                    type="password"
                    placeholder={configModalAccount === "openai" ? "sk-proj-..." : "gsk_..."}
                    value={configForm.apiKey}
                    onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              )}

              {configModalAccount === "whatsapp" && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Phone Number ID Meta
                    </label>
                    <input
                      type="text"
                      placeholder="100012345678901"
                      value={configForm.phoneId}
                      onChange={(e) => setConfigForm({ ...configForm, phoneId: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Jeton d&apos;accès WhatsApp Cloud API
                    </label>
                    <input
                      type="password"
                      placeholder="EAAG..."
                      value={configForm.token}
                      onChange={(e) => setConfigForm({ ...configForm, token: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Test result status feedback */}
            {testResult && (
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                  testResult.success
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-red-500/10 border-red-500/30 text-red-300"
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span className="leading-snug">{testResult.message}</span>
              </div>
            )}

            {/* Modal Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={runTestConnection}
                disabled={testingConnection}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? "animate-spin" : ""}`} />
                <span>{testingConnection ? "Test en cours..." : "Tester la connexion"}</span>
              </button>
              <button
                onClick={saveConfiguration}
                disabled={savingConfig}
                className="w-full sm:flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
              >
                <span>{savingConfig ? "Enregistrement..." : "Enregistrer dans .env.local"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button pour Jarvis Live (accessible partout) */}
      <button
        onClick={() => setIsVoiceOpen(true)}
        className="fixed bottom-6 right-6 z-40 p-3.5 sm:px-4 sm:py-3 rounded-full bg-gradient-to-r from-emerald-500 via-teal-600 to-indigo-600 text-white shadow-xl shadow-emerald-500/25 hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5 border border-emerald-400/30 cursor-pointer"
        title="Ouvrir le Mode Vocal Jarvis"
      >
        <Mic className="w-5 h-5 animate-pulse" />
        <span className="hidden sm:inline text-xs font-bold tracking-tight">Parler à Jarvis</span>
      </button>

      {/* Modal Compagnon Vocal Jarvis */}
      <JarvisVoiceCompanion
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onActionExecuted={fetchActions}
      />
    </div>
  );
}
