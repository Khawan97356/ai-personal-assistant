/**
 * Connecteur Gmail & Google Calendar pour OmniMind.
 * Permet d'extraire les emails non lus, de préparer des brouillons et de planifier des réunions.
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

  constructor(token?: string) {
    this.accessToken = token || process.env.GOOGLE_ACCESS_TOKEN;
  }

  public isConfigured(): boolean {
    return Boolean(this.accessToken);
  }

  /**
   * Crée un brouillon d'email dans la boîte Gmail de l'utilisateur
   */
  public async createDraft(to: string, subject: string, bodyText: string): Promise<{ draftId: string; success: boolean }> {
    if (!this.isConfigured()) {
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
          Authorization: `Bearer ${this.accessToken}`,
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
    if (!this.isConfigured()) {
      console.log(`[SIMULATION GOOGLE CALENDAR] Événement créé : ${event.summary} (${event.startTime} -> ${event.endTime})`);
      return { eventId: `sim_event_${Date.now()}`, success: true };
    }

    try {
      const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
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
}

export const gmailChannel = new GmailAndCalendarChannel();
