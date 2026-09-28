import type { Notifier } from "./types";
import { telegramChannel } from "../channels/telegram";
import { whatsAppChannel } from "../channels/whatsapp";
import { discordChannel } from "../channels/discord";
import { sendEmail } from "@/lib/email/sender";
import { prisma, isPrismaAvailable } from "@/lib/db/prisma";
import { db } from "@/lib/db/store";
import { makeId } from "./scheduler";

const KEY_APP_NOTIFS = "app_notifications_v1";

export class AutonomousNotifier implements Notifier {
  async send(userId: string, p: {
    title: string; body: string;
    channels?: Array<"email"|"telegram"|"discord"|"whatsapp"|"app">;
    metadata?: Record<string, unknown>;
  }) {
    const channels = p.channels?.length ? p.channels : ["app"];
    const errors: Array<{ channel: string; err: string }> = [];

    for (const ch of channels) {
      try {
        switch (ch) {
          case "app":      await this.pushApp(userId, p.title, p.body, p.metadata); break;
          case "telegram": await this.sendTG(`${p.title}\n\n${p.body}`); break;
          case "discord":  await this.sendDC(p); break;
          case "whatsapp": await this.sendWA(`${p.title}\n\n${p.body}`); break;
          case "email":    await this.sendMail(userId, p); break;
        }
      } catch (err) { errors.push({ channel: ch, err: String(err) }); }
    }
    if (errors.length) console.warn("[notifier] some failed:", errors);
  }

  private async pushApp(userId: string, title: string, body: string, metadata?: Record<string, unknown>) {
    const id = makeId("notif");
    const createdAt = new Date().toISOString();
    if (isPrismaAvailable()) {
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "AppNotification" (id, "userId", category, title, body, metadata, channel, "createdAt")
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::timestamptz)`,
          id, userId, "info", title, body, JSON.stringify(metadata ?? null), "app", createdAt
        );
      } catch { /* table peut ne pas exister */ }
    }
    try {
      const key = `${KEY_APP_NOTIFS}:${userId}`;
      const raw = (db as unknown as { get?: (k: string) => unknown }).get?.(key);
      const list = Array.isArray(raw) ? (raw as Array<unknown>) : [];
      list.unshift({ id, userId, category: "info", title, body, metadata, createdAt });
      (db as unknown as { set?: (k: string, v: unknown) => void }).set?.(key, list.slice(0, 500));
    } catch { /* ignore */ }
  }

  private async sendTG(text: string) {
    if (telegramChannel && typeof (telegramChannel as { send?: (t: string) => Promise<unknown> }).send === "function") {
      await (telegramChannel as { send: (t: string) => Promise<unknown> }).send(text);
    }
  }
  private async sendWA(text: string) {
    if (whatsAppChannel && typeof (whatsAppChannel as { send?: (t: string) => Promise<unknown> }).send === "function") {
      await (whatsAppChannel as { send: (t: string) => Promise<unknown> }).send(text);
    }
  }
  private async sendDC(p: { title: string; body: string }) {
    const msg = `**${p.title}**\n${p.body}`;
    if (discordChannel && typeof (discordChannel as { send?: (t: string) => Promise<unknown> }).send === "function") {
      await (discordChannel as { send: (t: string) => Promise<unknown> }).send(msg);
    }
  }
  private async sendMail(userId: string, p: { title: string; body: string }) {
    const to = userId.includes("@") ? userId : `${userId}@local`;
    await sendEmail({
      to, subject: p.title, text: p.body,
      html: `<div style="font-family:system-ui"><h2>${p.title}</h2><p style="white-space:pre-wrap">${p.body}</p></div>`,
    });
  }
}