import { IncomingMessage } from "@/lib/agent/types";

/**
 * Connecteur Outlook & Microsoft 365 pour OmniMind (via Microsoft Graph API).
 * Supporte les tokens statiques ainsi que le renouvellement automatique OAuth2 (refresh_token).
 */

export class OutlookChannel {
  private accessToken?: string;
  private tokenExpiresAt: number = 0;

  constructor(token?: string) {
    this.accessToken = token || process.env.MICROSOFT_ACCESS_TOKEN;
  }

  public isConfigured(): boolean {
    return Boolean(
      this.accessToken ||
      process.env.MICROSOFT_ACCESS_TOKEN ||
      (process.env.MICROSOFT_REFRESH_TOKEN && process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET)
    );
  }

  /**
   * Obtient un jeton d'accès valide avec rafraîchissement automatique via Microsoft Graph OAuth2
   */
  public async getValidAccessToken(): Promise<string | null> {
    const now = Date.now();
    if (this.accessToken && (!this.tokenExpiresAt || this.tokenExpiresAt > now + 120_000)) {
      return this.accessToken;
    }

    const refreshToken = process.env.MICROSOFT_REFRESH_TOKEN;
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

    if (refreshToken && clientId && clientSecret) {
      try {
        const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
            scope: "offline_access Mail.ReadWrite Calendars.ReadWrite",
          }),
        });

        if (res.ok) {
          const data = await res.json();
          this.accessToken = data.access_token;
          this.tokenExpiresAt = now + (data.expires_in || 3600) * 1000;
          return this.accessToken || null;
        } else {
          console.warn("[OutlookChannel] Échec du rafraîchissement OAuth Microsoft:", await res.text());
        }
      } catch (err) {
        console.error("[OutlookChannel] Erreur lors du renouvellement du token Microsoft:", err);
      }
    }

    return this.accessToken || process.env.MICROSOFT_ACCESS_TOKEN || null;
  }

  /**
   * Crée un brouillon d'email dans Outlook
   */
  public async createDraft(to: string, subject: string, bodyText: string): Promise<boolean> {
    const token = await this.getValidAccessToken();
    if (!token) {
      console.log(`[SIMULATION OUTLOOK] Brouillon créé pour ${to} : "${subject}"`);
      return true;
    }

    try {
      const res = await fetch("https://graph.microsoft.com/v1.0/me/messages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
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
    const token = await this.getValidAccessToken();
    if (!token) {
      console.log(`[SIMULATION OUTLOOK CALENDAR] Événement créé : ${subject} (${startIso})`);
      return true;
    }

    try {
      const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
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
    const token = await this.getValidAccessToken();
    if (!token) {
      return [];
    }

    try {
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$filter=isRead eq false&$top=${maxResults}&$select=id,from,subject,bodyPreview,receivedDateTime`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
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
