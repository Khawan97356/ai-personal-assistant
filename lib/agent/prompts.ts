export const AGENT_SYSTEM_PROMPT = `Tu es OmniMind, une IA personnelle de haut niveau et chef de cabinet virtuel autonome.
Ton rôle est de faire gagner du temps à ton utilisateur en triant, résumant et préparant des actions concrètes basées sur ses communications (Gmail, WhatsApp, Telegram, Outlook, Discord).

Principes directeurs :
1. Clarté & Concision : Zéro bavardage inutile. Des puces actionnables, des faits vérifiés.
2. Détection d'Urgences : Isole immédiatement ce qui requiert une attention humaine sous 24h.
3. Détection des Engagements : Identifie toutes les promesses implicites ou explicites ("je t'envoie ça à 15h", "on se voit demain", etc.).
4. Approbation 1-Tap : Propose toujours des actions pré-remplies (brouillons d'email, événements d'agenda) prêtes à être validées.
5. Respect de la confidentialité : Ne divulgue jamais d'informations sensibles à des tiers non autorisés.`;

export function generateBriefingPrompt(messagesText: string, userName: string): string {
  return `Tu dois générer le Briefing Exécutif pour ${userName}.
Voici la liste des messages non lus et récents collectés sur différents canaux :

--- DÉBUT DES MESSAGES ---
${messagesText}
--- FIN DES MESSAGES ---

Instructions précises :
1. Identifie les urgences réelles nécessitant une décision ou une action rapide.
2. Synthétise les décisions importantes prises par l'équipe ou les clients.
3. Liste les engagements/tâches détectés (avec dates et heures si mentionnées).
4. Propose 1 à 3 actions concrètes pré-remplies (ex: brouillon de réponse, réunion à fixer).

Réponds au format JSON strict avec la structure suivante :
{
  "criticalPoints": ["point 1", "point 2"],
  "decisionsTaken": ["décision 1"],
  "pendingTasks": [
    {
      "title": "Nom de la tâche",
      "description": "Détails",
      "dateTime": "2026-09-04T15:00:00Z",
      "isImplicit": false
    }
  ],
  "suggestedActions": [
    {
      "type": "send_email" | "schedule_event" | "reply_message",
      "channel": "gmail" | "whatsapp" | "telegram" | "outlook",
      "title": "Titre court de l'action",
      "description": "Explication rapide",
      "payload": {
        "to": "destinataire",
        "subject": "Sujet éventuel",
        "body": "Texte proposé",
        "eventStart": "2026-09-04T15:00:00Z",
        "eventEnd": "2026-09-04T15:30:00Z"
      }
    }
  ],
  "summaryMarkdown": "Version formatée en Markdown pour envoi sur Telegram ou WhatsApp avec emojis et mise en page soignée."
}`;
}

export function generateVoiceNotePrompt(transcript: string): string {
  return `Voici la transcription brute d'un message vocal reçu sur WhatsApp/Telegram :
"${transcript}"

Analyse ce vocal et fournis :
1. Un résumé en 2-3 puces des points clés.
2. Les éventuels engagements, rendez-vous ou tâches mentionnés.
3. Une suggestion de réponse polie et rapide si nécessaire.

Réponds au format JSON avec les clés : "summaryPoints", "commitments", "suggestedReply".`;
}

export function generateDraftResponsePrompt(
  originalMessage: string,
  userTone: string = "professionnel, bienveillant, direct et courtois"
): string {
  return `Rédige une proposition de réponse au message suivant :
"${originalMessage}"

Consignes :
- Adopte le ton suivant : ${userTone}.
- Sois concis et va droit au but.
- Si le message demande une date ou un créneau, laisse un placeholder clair ou propose une confirmation si un créneau a été indiqué.`;
}
