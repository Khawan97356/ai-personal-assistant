import type { ActionExecutionContext, ActionExecutor, ActionRisk, AutonomousAction, AutonomyLevel } from "./types";
import { getMemoryEngine } from "../memoryEngine";

export const ACTION_KEY_INVOICES = "invoices.reminders";
class InvoicesRemindersExecutor implements ActionExecutor {
  canRun(a: AutonomousAction) { return a.actionKey === ACTION_KEY_INVOICES && a.enabled; }
  estimateRisk(): ActionRisk { return "low"; }
  requiresApproval(a: AutonomousAction) { return !!a.params?.notifyExternalContact && a.autonomyLevel !== "full"; }
  buildDescription(a: AutonomousAction) {
    const h = (a.params.horizonDays as number) ?? 7;
    return `${a.name} — Détecte les factures à payer dans les ${h}j : liste fournisseurs / montants / échéances.`;
  }
  async run(ctx: ActionExecutionContext) {
    const horizon = (ctx.action.params.horizonDays as number) ?? 7;
    const memory = getMemoryEngine(ctx.userId);
    const queries = [
      `facture à payer échéance dans ${horizon} jours fournisseur montant`,
      `paiement facture régler avant`,
      `échéance abonnement paiement mois`,
    ];
    const hitsByQuery = await Promise.all(
      queries.map((q) => memory.ask(q, { topK: 6, minSimilarity: 0.62, types: ["fact","task"] }))
    );
    const seen = new Set<string>();
    const candidates = hitsByQuery.flat().filter((h) => {
      if (seen.has(h.id)) return false; seen.add(h.id);
      return /factur|paiem|échéan|régler|payer|abonn|quittanc|due|imp[aô]t|tva|loyer|euros?|€|(\d{1,3}([.,]\d{3})*[.,]\d{2}\s*(€|euros?))/i.test(h.content);
    });
    type T = { fact: string; similarity: number; amount?: string; dueDate?: string; vendor?: string };
    const extracted: T[] = candidates.map((h) => {
      const f = h.content;
      const amount = f.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})\s*(?:€|euros?)|\d+\s*(?:€|euros?))/i)?.[0];
      const due = f.match(/(?:avant|échéance|date de paiement|payable le|pour le)\s+(\d{1,2}\s*\/?\s*\d{1,2}\s*\/?\s*\d{0,4}|(?:ce |demain|aujourd'hui|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|fin mois|mois prochain)\b)/i)?.[1];
      const vendor = f.match(/(?:facture|paiement|règlement|avis d'échéance)[\s,:]+(?:de |pour |chez )?([A-ZÉÈ][\wéèêàâçùûô'-]{2,}(?:\s+[A-ZÉÈ][\wéèêàâçùûô'-]{2,}){0,4})/)?.[1];
      return { fact: f, similarity: h.similarity, amount, dueDate: due, vendor };
    });
    if (!extracted.length) return { output: { horizonDays: horizon, found: 0, list: [] }, notify: false };
    const summary = extracted.slice(0, 8).map((i, idx) => {
      const parts = [
        `${idx+1}. ${i.vendor ? `Fournisseur **${i.vendor}**` : "Facture identifiée"}`,
        i.amount ? `Montant ${i.amount}` : null,
        i.dueDate ? `Échéance ${i.dueDate}` : null,
      ].filter(Boolean);
      return `${parts.join(" · ")} — ${i.fact.substring(0, 180)}`;
    }).join("\n");
    await ctx.notifier?.send(ctx.userId, {
      title: `💰 Rappel factures — ${extracted.length} échéance(s) -${horizon}j`,
      body: `${summary}\n\nPense à vérifier avant échéance.`,
      channels: (ctx.action.params.channels as never) ?? ["app","telegram","email"],
      metadata: { count: extracted.length, horizonDays: horizon, list: extracted },
    });
    return { output: { horizonDays: horizon, found: extracted.length, list: extracted }, notify: true };
  }
}

export const ACTION_KEY_AGENDA = "agenda.prepare";
class AgendaPrepareExecutor implements ActionExecutor {
  canRun(a: AutonomousAction) { return a.actionKey === ACTION_KEY_AGENDA && a.enabled; }
  estimateRisk(): ActionRisk { return "low"; } requiresApproval() { return false; }
  buildDescription(a: AutonomousAction) { return `${a.name} — Compile ton agenda : réunions, deadlines, projets, récents.`; }
  async run(ctx: ActionExecutionContext) {
    const memory = getMemoryEngine(ctx.userId);
    const [rv, dl, prj, rec] = await Promise.all([
      memory.ask("réunion rendez-vous appel visio aujourd'hui demain participants", { topK: 6, minSimilarity: 0.6 }),
      memory.ask("deadline échéance rendre livrable contraintes avant aujourd'hui demain", { topK: 6, minSimilarity: 0.62 }),
      memory.ask("projet avancement objectif priorité semaine tâche", { topK: 6, minSimilarity: 0.6 }),
      memory.getRecent(8),
    ]);
    const sec = (title: string, items: { content: string; similarity?: number }[]) => items.length
      ? `### ${title}\n${items.map((it, i) => `• ${i+1}. ${it.content.substring(0, 200)}`).join("\n")}` : null;
    const sections = [
      sec("🔔 Réunions & points prévus", rv), sec("⏳ Deadlines & livrables", dl),
      sec("🧭 Projets & avancement", prj),
      rec.length ? `### 🧠 Récents\n${rec.slice(0, 4).map((w, i) => `• ${i+1}. ${w.content.substring(0, 160)}`).join("\n")}` : null,
    ].filter(Boolean);
    if (!sections.length) return { output: { prepared: false, sections: 0 }, notify: false };
    const body = `🗓️ Point agenda\n\n${sections.join("\n\n")}`;
    await ctx.notifier?.send(ctx.userId, { title: "🗓️ Ton agenda préparé", body: body.substring(0, 2000), channels: (ctx.action.params.channels as never) ?? ["app"], metadata: { rv: rv.length, dl: dl.length, prj: prj.length } });
    return { output: { prepared: true, rv: rv.length, dl: dl.length, prj: prj.length }, notify: true };
  }
}

export const ACTION_KEY_PROJECTS_HEALTH = "projects.healthcheck";
class ProjectsHealthExecutor implements ActionExecutor {
  canRun(a: AutonomousAction) { return a.actionKey === ACTION_KEY_PROJECTS_HEALTH && a.enabled; }
  estimateRisk(): ActionRisk { return "low"; } requiresApproval() { return false; }
  buildDescription(a: AutonomousAction) { return `${a.name} — Point santé projets : blocages, retard, risques, bonnes dynamiques.`; }
  async run(ctx: ActionExecutionContext) {
    const memory = getMemoryEngine(ctx.userId);
    const hits = await memory.ask("projet blocage bloqué avancement problème retard priorité élevée à risque jalon fin échéance client", { topK: 12, minSimilarity: 0.58 });
    if (!hits.length) return { output: { projects: 0, atRisk: 0 }, notify: false };
    const RISK = /bloqu|retard|problème|risque|urgence|critique|priorité élevée|impossible|en retard|en panne/i;
    const POS = /terminé|fini|livré|bon|avancé|ok|validé|approuvé|on track|au top/i;
    const scored = hits.map((h) => ({
      content: h.content, risk: RISK.test(h.content) ? 2 : /préoccup|à surveiller|à faire attention|priorit/.test(h.content) ? 1 : 0,
      positivity: POS.test(h.content) ? 1 : 0, createdAt: h.createdAt, id: h.id,
    }));
    const atRisk = scored.filter((p) => p.risk >= 1);
    const healthy = scored.filter((p) => p.positivity && !p.risk);
    const lines = [
      `🔍 Projets surveillés : ${scored.length}`, `⚠️ À risque / bloqués : ${atRisk.length}`, `✅ Bonne dynamique : ${healthy.length}`, "",
      atRisk.length ? "### À risque" : "",
      ...atRisk.slice(0, 5).map((p, i) => `• ${i+1}. [risque ${p.risk}/2] ${p.content.substring(0, 200)}`),
    ].filter(Boolean);
    await ctx.notifier?.send(ctx.userId, { title: "📊 Santé des projets", body: lines.join("\n").substring(0, 2000), channels: (ctx.action.params.channels as never) ?? ["app"], metadata: { projects: scored.length, atRisk: atRisk.length, healthy: healthy.length } });
    return { output: { projects: scored.length, atRisk: atRisk.length, healthy: healthy.length }, notify: true };
  }
}

export const ACTION_KEY_WEEK_PLAN = "week.plan";
class WeekPlanExecutor implements ActionExecutor {
  canRun(a: AutonomousAction) { return a.actionKey === ACTION_KEY_WEEK_PLAN && a.enabled; }
  estimateRisk(): ActionRisk { return "low"; } requiresApproval() { return false; }
  buildDescription(a: AutonomousAction) { return `${a.name} — Prépare ta semaine : objectifs top 3, échéances, rendez-vous clés.`; }
  async run(ctx: ActionExecutionContext) {
    const memory = getMemoryEngine(ctx.userId);
    const [sr, sd, so] = await Promise.all([
      memory.ask("réunion semaine cette semaine rendez-vous client", { topK: 10, minSimilarity: 0.58 }),
      memory.ask("échéance deadline livrable semaine prochain semaine", { topK: 10, minSimilarity: 0.6 }),
      memory.ask("objectif semaine priorité projet 3 objectifs clefs roc", { topK: 6, minSimilarity: 0.58 }),
    ]);
    if (!sr.length && !sd.length && !so.length) return { output: { planned: false }, notify: false };
    const top3 = so.length > 0
      ? so.slice(0, 3).map((o, i) => `${i+1}. ${o.content.substring(0, 140)}`).join("\n")
      : "À te fixer (aucun objectif semaine encore en mémoire).";
    const body =
      `🗓️ Organisation de la semaine\n\n### Priorités (top 3)\n${top3}\n\n` +
      `### Échéances (${sd.length})\n${sd.slice(0, 6).map((d) => `• ${d.content.substring(0, 160)}`).join("\n")}` +
      (sr.length ? `\n\n### Rendez-vous clés (${sr.length})\n${sr.slice(0, 6).map((r) => `• ${r.content.substring(0, 160)}`).join("\n")}` : "");
    await ctx.notifier?.send(ctx.userId, { title: "🎯 Préparation de semaine", body: body.substring(0, 2000), channels: (ctx.action.params.channels as never) ?? ["app","email"], metadata: { reunions: sr.length, deadlines: sd.length, objectifs: so.length } });
    return { output: { reunions: sr.length, deadlines: sd.length, objectifs: so.length }, notify: true };
  }
}

export const ACTION_KEY_WEEKLY_REVIEW = "review.weekly";
class WeeklyReviewExecutor implements ActionExecutor {
  canRun(a: AutonomousAction) { return a.actionKey === ACTION_KEY_WEEKLY_REVIEW && a.enabled; }
  estimateRisk(): ActionRisk { return "low"; } requiresApproval() { return false; }
  buildDescription(a: AutonomousAction) { return `${a.name} — Vendredi soir : bilan semaine (réussites, frictions, leçons).`; }
  async run(ctx: ActionExecutionContext) {
    const memory = getMemoryEngine(ctx.userId);
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const recent = (await memory.getRecent(40)).filter((m) => m.createdAt >= since);
    const WIN = /\b(terminé|fini|livré|validé|approuvé|réussi|succès|bravo|bien|gagné|bonus|augment|signé|clôturé|clos|dossier|résolu)\b/i;
    const FRIC = /\b(bloqué|problème|retard|erreur|bug|raté|échec|difficile|frustrant|stress|perte|manque|dette|oubli|confus)\b/i;
    const wins = recent.filter((m) => WIN.test(m.content));
    const frics = recent.filter((m) => FRIC.test(m.content));
    if (!wins.length && !frics.length) return { output: { reviewed: false }, notify: false };
    const body =
      `📆 Revue hebdomadaire\n\n✅ Ce qui a bien marché (${wins.length})\n${wins.slice(0, 6).map((m) => `• ${m.content.substring(0, 160)}`).join("\n")}` +
      (frics.length ? `\n\n⚠️ Points de friction (${frics.length})\n${frics.slice(0, 6).map((m) => `• ${m.content.substring(0, 160)}`).join("\n")}` : "") +
      `\n\n🌱 Petites leçons :\n• Concentre-toi d'abord sur les priorités à risque avant le reste.`;
    await ctx.notifier?.send(ctx.userId, { title: "📆 Revue hebdomadaire — Bilan", body: body.substring(0, 2000), channels: (ctx.action.params.channels as never) ?? ["app","email"], metadata: { wins: wins.length, frictions: frics.length } });
    return { output: { wins: wins.length, frictions: frics.length }, notify: true };
  }
}

export const ACTION_KEY_NEWSLETTER_DIGEST = "newsletter.digest";
class NewsletterDigestExecutor implements ActionExecutor {
  canRun(a: AutonomousAction) { return a.actionKey === ACTION_KEY_NEWSLETTER_DIGEST && a.enabled; }
  estimateRisk(): ActionRisk { return "low"; } requiresApproval() { return false; }
  buildDescription(a: AutonomousAction) { return `${a.name} — Digest newsletters : top 5 actualités les plus pertinentes.`; }
  async run(ctx: ActionExecutionContext) {
    const memory = getMemoryEngine(ctx.userId);
    const hits = await memory.ask("newsletter newsletter hebdo lettre info résumé article blog actualité publication", { topK: 20, minSimilarity: 0.55, types: ["fact"], includeChunks: true });
    if (!hits.length) return { output: { found: 0 }, notify: false };
    const summary = hits.slice(0, 5).map((h, i) => `• ${i+1}. ${h.content.substring(0, 200)}`).join("\n");
    await ctx.notifier?.send(ctx.userId, { title: "📰 Digest newsletters", body: `Voici les ${Math.min(5, hits.length)} news les plus pertinentes :\n\n${summary}`, channels: (ctx.action.params.channels as never) ?? ["app","email"], metadata: { count: hits.length } });
    return { output: { found: hits.length, summarized: Math.min(5, hits.length) }, notify: true };
  }
}

export const ACTION_KEY_DIGITAL_HEALTHCHECK = "digital.healthcheck";
class DigitalHealthExecutor implements ActionExecutor {
  canRun(a: AutonomousAction) { return a.actionKey === ACTION_KEY_DIGITAL_HEALTHCHECK && a.enabled; }
  estimateRisk(): ActionRisk { return "medium"; }
  requiresApproval(a: AutonomousAction) { return a.autonomyLevel === "observe" || a.autonomyLevel === "suggest"; }
  buildDescription(a: AutonomousAction) { return `${a.name} — Check hygiène digitale mensuel (mdp, 2FA, sauvegardes, mises à jour).`; }
  async run(ctx: ActionExecutionContext) {
    const memory = getMemoryEngine(ctx.userId);
    const already = await memory.ask("mot de passe sauvegarde 2fa mise à jour sécurité", { topK: 3, minSimilarity: 0.7 });
    const checklist = [
      "🔐 Mot de passe maître revu ces 90 derniers jours ?",
      "☁️ Dernière sauvegarde complète (NAS/cloud/clé USB) ?",
      "💾 Espace disque libre > 15% sur l'ordinateur principal ?",
      "🛡️ 2FA activé sur comptes critiques (Google/Apple/banque/mails pro) ?",
      "🧱 Mises à jour OS + outils clés appliquées ?",
      "📫 Boîte mail < 500 non lus + newsletters triées ?",
      "🔑 Clés de récupération 2FA stockées en lieu sûr ?",
    ];
    const body = `🩺 Check-up hygiène digitale\n\n${checklist.join("\n")}` +
      (already.length ? `\n\n💡 Mémoire récente :\n${already.map((a) => `• ${a.content.substring(0, 140)}`).join("\n")}` : "") +
      `\n\nTu peux marquer les points faits — on revérifie le mois prochain !`;
    await ctx.notifier?.send(ctx.userId, { title: "🩺 Hygiène digitale du mois", body: body.substring(0, 2400), channels: (ctx.action.params.channels as never) ?? ["app","email"], metadata: { checklistLength: checklist.length } });
    return { output: { checklistLength: checklist.length }, notify: true };
  }
}

export const ACTION_KEY_FINANCE_SNAPSHOT = "finance.snapshot";
class FinanceSnapshotExecutor implements ActionExecutor {
  canRun(a: AutonomousAction) { return a.actionKey === ACTION_KEY_FINANCE_SNAPSHOT && a.enabled; }
  estimateRisk(): ActionRisk { return "medium"; }
  requiresApproval(a: AutonomousAction) { return a.autonomyLevel === "observe" || a.autonomyLevel === "suggest"; }
  buildDescription(a: AutonomousAction) { return `${a.name} — Fin de mois : point rapide finances (entrées / sorties / anomalies).`; }
  async run(ctx: ActionExecutionContext) {
    const memory = getMemoryEngine(ctx.userId);
    const hits = await memory.ask("salaire revenu paiement reçu dépense importante facture paiement achat important épargne placement", { topK: 12, minSimilarity: 0.58, types: ["fact"] });
    if (!hits.length) return { output: { found: 0 }, notify: false };
    const IN = /salaire|revenu|reçu|vir(ement|e) reçu|encaissé|bonus|remboursement/i;
    const OUT = /dépense|achat|payé|facturé|dépenser|facture|paiement|règlement|abonnement|retrait/i;
    const inc = hits.filter((h) => IN.test(h.content));
    const outC = hits.filter((h) => OUT.test(h.content) && !inc.includes(h));
    const body =
      `💸 Point rapide financier\n\n➕ Entrées (${inc.length})\n${inc.slice(0, 5).map((h) => `• ${h.content.substring(0, 160)}`).join("\n")}` +
      `\n\n➖ Sorties (${outC.length})\n${outC.slice(0, 5).map((h) => `• ${h.content.substring(0, 160)}`).join("\n")}` +
      `\n\n💡 Pense à consolider dans ton suivi budget.`;
    await ctx.notifier?.send(ctx.userId, { title: "💸 Point finances", body: body.substring(0, 2000), channels: (ctx.action.params.channels as never) ?? ["app","email"], metadata: { in: inc.length, out: outC.length, total: hits.length } });
    return { output: { in: inc.length, out: outC.length, total: hits.length }, notify: true };
  }
}

export const SPECIALIZED_ACTIONS_REGISTRY: Record<string, ActionExecutor> = {
  [ACTION_KEY_INVOICES]: new InvoicesRemindersExecutor(),
  [ACTION_KEY_AGENDA]: new AgendaPrepareExecutor(),
  [ACTION_KEY_PROJECTS_HEALTH]: new ProjectsHealthExecutor(),
  [ACTION_KEY_WEEK_PLAN]: new WeekPlanExecutor(),
  [ACTION_KEY_WEEKLY_REVIEW]: new WeeklyReviewExecutor(),
  [ACTION_KEY_NEWSLETTER_DIGEST]: new NewsletterDigestExecutor(),
  [ACTION_KEY_DIGITAL_HEALTHCHECK]: new DigitalHealthExecutor(),
  [ACTION_KEY_FINANCE_SNAPSHOT]: new FinanceSnapshotExecutor(),
};

export function registerSpecializedActions(target: Record<string, ActionExecutor>) {
  Object.assign(target, SPECIALIZED_ACTIONS_REGISTRY);
}

export function extendedPrescribed(userId: string, opts: { autonomyLevel: AutonomyLevel }) {
  const lvl = opts.autonomyLevel;
  return [
    { userId, actionKey: ACTION_KEY_INVOICES, name: "Rappels factures", trigger: { kind: "scheduled" as const, cron: "0 9 * * 1,3,5" }, autonomyLevel: lvl, params: { horizonDays: 7, channels: ["app","telegram","email"] }, tags: ["finance"] },
    { userId, actionKey: ACTION_KEY_AGENDA,   name: "Prépa agenda quotidien", trigger: { kind: "scheduled" as const, cron: "15 8 * * *" }, autonomyLevel: lvl, params: { channels: ["app"] }, tags: ["agenda"] },
    { userId, actionKey: ACTION_KEY_PROJECTS_HEALTH, name: "Santé projets", trigger: { kind: "scheduled" as const, cron: "0 10,16 * * 1-5" }, autonomyLevel: lvl, params: { channels: ["app"] }, tags: ["projets"] },
    { userId, actionKey: ACTION_KEY_WEEK_PLAN, name: "Plan de semaine", trigger: { kind: "scheduled" as const, cron: "30 20 * * 0" }, autonomyLevel: lvl, params: { channels: ["app","email"] }, tags: ["semaine","organisation"] },
    { userId, actionKey: ACTION_KEY_WEEKLY_REVIEW, name: "Revue hebdomadaire", trigger: { kind: "scheduled" as const, cron: "0 18 * * 5" }, autonomyLevel: lvl, params: { channels: ["app","email"] }, tags: ["bilan","semaine"] },
    { userId, actionKey: ACTION_KEY_NEWSLETTER_DIGEST, name: "Digest newsletters", trigger: { kind: "scheduled" as const, cron: "0 12 * * 6" }, autonomyLevel: lvl, params: { channels: ["app","email"] }, tags: ["news"] },
    { userId, actionKey: ACTION_KEY_DIGITAL_HEALTHCHECK, name: "Hygiène digitale", trigger: { kind: "scheduled" as const, cron: "0 10 1 * *" }, autonomyLevel: lvl, params: { channels: ["app","email"] }, tags: ["sécurité"] },
    { userId, actionKey: ACTION_KEY_FINANCE_SNAPSHOT, name: "Point finances", trigger: { kind: "scheduled" as const, cron: "0 21 28 * *" }, autonomyLevel: lvl, params: { channels: ["app","email"] }, tags: ["finance","mensuel"] },
  ];
}