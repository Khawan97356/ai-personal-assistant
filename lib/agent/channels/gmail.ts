import { IncomingMessage } from "@/lib/agent/types";

/**
 * Connecteur Gmail & Google Calendar pour OmniMind.
 * Permet d'extraire les emails non lus, de préparer des brouillons et de planifier des réunions.
 * Supporte les tokens statiques ainsi que le renouvellement automatique OAuth2 (refresh_token).
 */

export interface GoogleEventPayload {
  summary: string;
  description?: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  attendees?: string[];
}

export class GmailAndCalendarChannel {
  private accessToken?: string;
  private tokenExpiresAt: number = 0;

  constructor(token?: string) {
    this.accessToken = token || process.env.GOOGLE_ACCESS_TOKEN;
  }

  public isConfigured(): boolean {
    return Boolean(
      this.accessToken ||
      process.env.GOOGLE_ACCESS_TOKEN ||
      (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    );
  }

  /**
   * Obtient un jeton d'accès valide avec rafraîchissement automatique via OAuth2
   */
  public async getValidAccessToken(): Promise<string | null> {
    const now = Date.now();
    if (this.accessToken && (!this.tokenExpiresAt || this.tokenExpiresAt > now + 120_000)) {
      return this.accessToken;
    }

    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (refreshToken && clientId && clientSecret) {
      try {
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
          }),
        });

        if (res.ok) {
          const data = await res.json();
          this.accessToken = data.access_token;
          this.tokenExpiresAt = now + (data.expires_in || 3600) * 1000;
          return this.accessToken || null;
        } else {
          console.warn("[GmailChannel] Échec du rafraîchissement OAuth Google:", await res.text());
        }
      } catch (err) {
        console.error("[GmailChannel] Erreur lors du renouvellement du token Google:", err);
      }
    }

    return this.accessToken || process.env.GOOGLE_ACCESS_TOKEN || null;
  }

  /**
   * Crée un brouillon d'email dans la boîte Gmail de l'utilisateur
   */
  public async createDraft(to: string, subject: string, bodyText: string): Promise<{ draftId: string; success: boolean }> {
    const token = await this.getValidAccessToken();
    if (!token) {
      console.log(`[SIMULATION GMAIL] Brouillon créé pour ${to} | Sujet: ${subject}`);
      return { draftId: `sim_draft_${Date.now()}`, success: true };
    }

    try {
      const emailContent = [
        `To: ${to}`,
        `Subject: =?utf-8?B?${Buffer.from(subject).toString("base64")}?=`,
        "Content-Type: text/plain; charset=utf-8",
        "",
        bodyText,
      ].join("\r\n");

      const encoded = Buffer.from(emailContent)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: { raw: encoded },
        }),
      });

      const data = await res.json();
      return { draftId: data.id || "draft_created", success: res.ok };
    } catch (err) {
      console.error("Gmail createDraft error:", err);
      return { draftId: "", success: false };
    }
  }

  /**
   * Crée un événement dans Google Calendar
   */
  public async scheduleCalendarEvent(event: GoogleEventPayload): Promise<{ eventId: string; success: boolean }> {
    const token = await this.getValidAccessToken();
    if (!token) {
      console.log(`[SIMULATION GOOGLE CALENDAR] Événement créé : ${event.summary} (${event.startTime} -> ${event.endTime})`);
      return { eventId: `sim_event_${Date.now()}`, success: true };
    }

    try {
      const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: event.summary,
          description: event.description || "Créé automatiquement par OmniMind AI",
          start: { dateTime: event.startTime },
          end: { dateTime: event.endTime },
          attendees: event.attendees?.map((email) => ({ email })),
        }),
      });

      const data = await res.json();
      return { eventId: data.id || "event_created", success: res.ok };
    } catch (err) {
      console.error("Google Calendar schedule error:", err);
      return { eventId: "", success: false };
    }
  }

  /**
   * Récupère les emails non lus de la boîte Gmail
   */
  public async fetchUnreadMessages(maxResults: number = 10): Promise<IncomingMessage[]> {
    const token = await this.getValidAccessToken();
    if (!token) {
      return [];
    }

    try {
      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=${maxResults}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const listData = await listRes.json();
      if (!listData.messages || !Array.isArray(listData.messages)) {
        return [];
      }

      const results: IncomingMessage[] = [];
      for (const item of listData.messages.slice(0, maxResults)) {
        try {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          const msgData = await msgRes.json();
          const headers: Array<{ name: string; value: string }> = msgData.payload?.headers || [];
          const fromHeader = headers.find((h) => h.name.toLowerCase() === "from")?.value || "Expéditeur inconnu";
          const subjectHeader = headers.find((h) => h.name.toLowerCase() === "subject")?.value || "Sans objet";
          const dateHeader = headers.find((h) => h.name.toLowerCase() === "date")?.value || new Date().toISOString();

          let body = msgData.snippet || "";
          if (msgData.payload?.body?.data) {
            body = Buffer.from(msgData.payload.body.data, "base64").toString("utf-8");
          } else if (msgData.payload?.parts) {
            const textPart = msgData.payload.parts.find(
              (p: { mimeType?: string; body?: { data?: string } }) => p.mimeType === "text/plain"
            );
            if (textPart?.body?.data) {
              body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
            }
          }

          results.push({
            id: `gmail_${item.id}`,
            channel: "gmail",
            sender: {
              name: fromHeader.split("<")[0].trim() || fromHeader,
              identifier: (fromHeader.match(/<([^>]+)>/)?.[1] || fromHeader).trim(),
            },
            timestamp: new Date(dateHeader).toISOString(),
            subject: subjectHeader,
            content: body.substring(0, 1000),
          });
        } catch (itemErr) {
          console.warn("Gmail individual message fetch error:", itemErr);
        }
      }

      return results;
    } catch (err) {
      console.error("Gmail fetchUnreadMessages error:", err);
      return [];
    }
  }
}

export const gmailChannel = new GmailAndCalendarChannel();
