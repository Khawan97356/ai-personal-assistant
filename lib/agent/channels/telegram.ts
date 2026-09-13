/**
 * Connecteur Telegram Bot API pour OmniMind.
 * Permet d'envoyer des briefings, recevoir des ordres et proposer des boutons de validation 1-Tap.
 */

export interface TelegramInlineButton {
  text: string;
  callback_data: string;
}

export class TelegramChannel {
  private botToken: string;
  private baseUrl: string;

  constructor(token?: string) {
    this.botToken = token || process.env.TELEGRAM_BOT_TOKEN || "";
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  public isConfigured(): boolean {
    return Boolean(this.botToken);
  }

  /**
   * Envoie un message texte simple ou formaté à un chat ID
   */
  public async sendMessage(
    chatId: string | number,
    text: string,
    parseMode: "Markdown" | "HTML" = "Markdown"
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn("TelegramChannel: TELEGRAM_BOT_TOKEN non configuré. Message simulé :", text);
      return true;
    }

    try {
      const res = await fetch(`${this.baseUrl}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: parseMode,
        }),
      });

      const data = await res.json();
      return data.ok;
    } catch (err) {
      console.error("Telegram sendMessage error:", err);
      return false;
    }
  }

  /**
   * Envoie une proposition d'action avec boutons d'approbation directe
   */
  public async sendActionProposal(
    chatId: string | number,
    title: string,
    description: string,
    actionId: string
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      console.log(`[SIMULATION TELEGRAM] Proposition d'action envoyée (${actionId}) : ${title}`);
      return true;
    }

    const text = `🤖 *Action suggérée par OmniMind*\n\n*${title}*\n${description}\n\n_Souhaitez-vous exécuter cette action ?_`;

    const inlineKeyboard: TelegramInlineButton[][] = [
      [
        { text: "✅ Approuver & Exécuter", callback_data: `approve:${actionId}` },
        { text: "❌ Rejeter", callback_data: `reject:${actionId}` },
      ],
    ];

    try {
      const res = await fetch(`${this.baseUrl}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: inlineKeyboard,
          },
        }),
      });

      const data = await res.json();
      return data.ok;
    } catch (err) {
      console.error("Telegram sendActionProposal error:", err);
      return false;
    }
  }

  /**
   * Acquitte un clic sur un bouton inline
   */
  public async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<boolean> {
    if (!this.isConfigured()) return true;

    try {
      const res = await fetch(`${this.baseUrl}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text,
        }),
      });
      const data = await res.json();
      return data.ok;
    } catch (err) {
      console.error("Telegram answerCallbackQuery error:", err);
      return false;
    }
  }

  /**
   * Récupère le chemin d'un fichier via l'API Telegram
   */
  public async getFile(fileId: string): Promise<{ filePath: string; fileUrl: string } | null> {
    if (!this.isConfigured()) return null;
    try {
      const res = await fetch(`${this.baseUrl}/getFile?file_id=${fileId}`);
      const data = await res.json();
      if (data.ok && data.result?.file_path) {
        const filePath = data.result.file_path;
        const fileUrl = `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;
        return { filePath, fileUrl };
      }
      return null;
    } catch (err) {
      console.error("Telegram getFile error:", err);
      return null;
    }
  }

  /**
   * Télécharge le contenu binaire d'un fichier Telegram (ex: note vocale OGG)
   */
  public async downloadFileBuffer(fileId: string): Promise<Buffer | null> {
    const fileInfo = await this.getFile(fileId);
    if (!fileInfo) return null;
    try {
      const res = await fetch(fileInfo.fileUrl);
      if (!res.ok) return null;
      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    } catch (err) {
      console.error("Telegram downloadFileBuffer error:", err);
      return null;
    }
  }
}

export const telegramChannel = new TelegramChannel();
