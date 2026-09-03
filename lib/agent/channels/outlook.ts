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
}

export const outlookChannel = new OutlookChannel();
