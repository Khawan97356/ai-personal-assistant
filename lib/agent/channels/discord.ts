/**
 * Connecteur Discord Webhook pour OmniMind.
 */

export class DiscordChannel {
  private webhookUrl: string;

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl || process.env.DISCORD_WEBHOOK_URL || "";
  }

  public isConfigured(): boolean {
    return Boolean(this.webhookUrl);
  }

  /**
   * Envoie une notification ou un embed dans un salon Discord
   */
  public async sendAlert(title: string, description: string, color: number = 0x6366f1): Promise<boolean> {
    if (!this.isConfigured()) {
      console.log(`[SIMULATION DISCORD] Alerte envoyée : ${title} - ${description}`);
      return true;
    }

    try {
      const res = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "OmniMind AI Agent",
          embeds: [
            {
              title,
              description,
              color,
              timestamp: new Date().toISOString(),
              footer: { text: "OmniMind Autonomous Engine" },
            },
          ],
        }),
      });

      return res.ok;
    } catch (err) {
      console.error("Discord sendAlert error:", err);
      return false;
    }
  }
}

export const discordChannel = new DiscordChannel();
