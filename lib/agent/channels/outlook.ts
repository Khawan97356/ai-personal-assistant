import { IncomingMessage } from "@/lib/agent/types";

/**
 * Connecteur Outlook & Microsoft 365 pour OmniMind (via Microsoft Graph API).
 */

export class OutlookChannel {
  private accessToken?: string;

  constructor(token?: string) {
    this.accessToken = token || process.env.MICROSOFT_ACCESS_TOKEN;
  }

  public isConfigured(): boolean {
    return Boolean(this.accessToken);
  }

  /**
   * Crée un brouillon d'email dans Outlook
   */
  public async createDraft(to: string, subject: string, bodyText: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.log(`[SIMULATION OUTLOOK] Brouillon créé pour ${to} : "${subject}"`);
      return true;
    }

    try {
      const res = await fetch("https://graph.microsoft.com/v1.0/me/messages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject,
          importance: "Normal",
          body: {
            contentType: "Text",
            content: bodyText,
          },
          toRecipients: [
            {
              emailAddress: { address: to },
            },
          ],
        }),
      });

      return res.ok;
    } catch (err) {
      console.error("Outlook createDraft error:", err);
      return false;
    }
  }

  /**
   * Crée un événement dans le calendrier Outlook
   */
  public async createEvent(
    subject: string,
    startIso: string,
    endIso: string
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      console.log(`[SIMULATION OUTLOOK CALENDAR] Événement créé : ${subject} (${startIso})`);
      return true;
    }

    try {
      const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject,
          start: { dateTime: startIso, timeZone: "UTC" },
          end: { dateTime: endIso, timeZone: "UTC" },
        }),
      });

      return res.ok;
    } catch (err) {
      console.error("Outlook createEvent error:", err);
      return false;
    }
  }

  /**
   * Récupère les emails non lus de la boîte Outlook
   */
  public async fetchUnreadMessages(maxResults: number = 10): Promise<IncomingMessage[]> {
    if (!this.isConfigured()) {
      return [];
    }

    try {
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$filter=isRead eq false&$top=${maxResults}&$select=id,from,subject,bodyPreview,receivedDateTime`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await res.json();
      if (!data.value || !Array.isArray(data.value)) {
        return [];
      }

      return data.value.map(
        (m: {
          id: string;
          from?: { emailAddress?: { name?: string; address?: string } };
          subject?: string;
          bodyPreview?: string;
          receivedDateTime?: string;
        }) => ({
          id: `outlook_${m.id}`,
          channel: "outlook" as const,
          sender: {
            name: m.from?.emailAddress?.name || "Expéditeur Outlook",
            identifier: m.from?.emailAddress?.address || "outlook@user",
          },
          timestamp: m.receivedDateTime || new Date().toISOString(),
          subject: m.subject || "Sans objet",
          content: m.bodyPreview || "",
        })
      );
    } catch (err) {
      console.error("Outlook fetchUnreadMessages error:", err);
      return [];
    }
  }
}

export const outlookChannel = new OutlookChannel();
