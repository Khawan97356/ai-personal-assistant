/**
 * Connecteur WhatsApp Cloud API pour OmniMind.
 * Reçoit les messages entrants (texte et vocaux) et expédie les synthèses et alertes VIP.
 */

export class WhatsAppChannel {
  private apiToken: string;
  private phoneNumberId: string;
  private baseUrl: string;

  constructor(token?: string, phoneId?: string) {
    this.apiToken = token || process.env.WHATSAPP_API_TOKEN || "";
    this.phoneNumberId = phoneId || process.env.WHATSAPP_PHONE_NUMBER_ID || "";
    this.baseUrl = `https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiToken && this.phoneNumberId);
  }

  /**
   * Envoie un message texte simple à un numéro de téléphone WhatsApp
   */
  public async sendMessage(toPhoneNumber: string, bodyText: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn("WhatsAppChannel: Configuration manquante. Envoi simulé à", toPhoneNumber, ":", bodyText);
      return true;
    }

    try {
      const res = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toPhoneNumber,
          type: "text",
          text: { body: bodyText },
        }),
      });

      const data = await res.json();
      return Boolean(data.messages && data.messages.length > 0);
    } catch (err) {
      console.error("WhatsApp sendMessage error:", err);
      return false;
    }
  }

  /**
   * Envoie un message avec boutons de réponse rapide (ex: Valider / Modifier)
   */
  public async sendInteractiveAction(
    toPhoneNumber: string,
    title: string,
    actionId: string
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      console.log(`[SIMULATION WHATSAPP] Boutons envoyés à ${toPhoneNumber} pour action ${actionId}`);
      return true;
    }

    try {
      const res = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toPhoneNumber,
          type: "interactive",
          interactive: {
            type: "button",
            body: { text: `🤖 Action OmniMind :\n${title}\nSouhaitez-vous exécuter ?` },
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: { id: `approve_${actionId}`, title: "Valider" },
                },
                {
                  type: "reply",
                  reply: { id: `reject_${actionId}`, title: "Rejeter" },
                },
              ],
            },
          },
        }),
      });

      const data = await res.json();
      return Boolean(data.messages && data.messages.length > 0);
    } catch (err) {
      console.error("WhatsApp sendInteractiveAction error:", err);
      return false;
    }
  }

  /**
   * Télécharge un média binaire (audio / vocal) via Meta Graph API
   */
  public async downloadMediaBuffer(mediaId: string): Promise<Buffer | null> {
    if (!this.isConfigured()) return null;

    try {
      // 1. Récupérer l'URL de téléchargement direct auprès de Meta
      const mediaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
        headers: { Authorization: `Bearer ${this.apiToken}` },
      });
      const mediaData = await mediaRes.json();
      if (!mediaData.url) return null;

      // 2. Télécharger le binaire depuis l'URL de stockage Meta
      const downloadRes = await fetch(mediaData.url, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "User-Agent": "OmniMind-Agent/1.0",
        },
      });

      if (!downloadRes.ok) return null;
      const arrayBuf = await downloadRes.arrayBuffer();
      return Buffer.from(arrayBuf);
    } catch (err) {
      console.error("WhatsApp downloadMediaBuffer error:", err);
      return null;
    }
  }
}

export const whatsAppChannel = new WhatsAppChannel();
