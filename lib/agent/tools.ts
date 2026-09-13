/**
 * Définition et exécution des Outils (Function Calling) natifs pour l'agent OmniMind.
 * Compatible avec OpenAI, Google Gemini et Groq.
 */

import { db } from "@/lib/db/store";
import { ActionProposal, UserMemory } from "@/lib/agent/types";
import { omniAgent, globalActionStore } from "@/lib/agent/core";

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "create_email_draft",
      description: "Prépare un brouillon d'email professionnel prêt à être approuvé par l'utilisateur.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Adresse email du destinataire" },
          subject: { type: "string", description: "Objet clair et concis de l'email" },
          body: { type: "string", description: "Corps du message rédigé avec professionnalisme" },
          channel: {
            type: "string",
            enum: ["gmail", "outlook"],
            description: "Canal de messagerie à utiliser (gmail ou outlook)",
          },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_calendar_event",
      description: "Planifie un événement ou une réunion dans l'agenda Google Calendar ou Outlook.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Titre ou objet du rendez-vous" },
          startTime: { type: "string", description: "Date et heure de début au format ISO 8601" },
          endTime: { type: "string", description: "Date et heure de fin au format ISO 8601" },
          description: { type: "string", description: "Description ou ordre du jour de la réunion" },
          channel: {
            type: "string",
            enum: ["gmail", "outlook"],
            description: "Service de calendrier (gmail pour Google Calendar ou outlook)",
          },
        },
        required: ["summary", "startTime", "endTime"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_user_memory",
      description: "Mémorise une information durable, une préférence ou une contrainte sur l'utilisateur (RAG & profilage continu).",
      parameters: {
        type: "object",
        properties: {
          fact: {
            type: "string",
            description: "Fait ou règle à mémoriser (ex: 'Ne pas planifier de réunion le vendredi après-midi')",
          },
          category: {
            type: "string",
            enum: ["preference", "constraint", "vip_relation", "work_habit"],
            description: "Catégorie de la mémoire",
          },
        },
        required: ["fact"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_pending_action",
      description: "Valide et exécute immédiatement une action en attente selon l'ordre formel de l'utilisateur.",
      parameters: {
        type: "object",
        properties: {
          actionId: { type: "string", description: "L'identifiant unique de l'action à exécuter (ex: act_...)" },
        },
        required: ["actionId"],
      },
    },
  },
];

export async function executeAgentTool(
  toolName: string,
  args: Record<string, unknown>,
  userId?: string
): Promise<{ success: boolean; result: unknown; message: string }> {
  try {
    if (toolName === "create_email_draft") {
      const { to, subject, body, channel = "gmail" } = args as {
        to: string;
        subject: string;
        body: string;
        channel?: "gmail" | "outlook";
      };

      const action: ActionProposal = {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId,
        type: "send_email",
        channel,
        title: `Envoyer email à ${to}`,
        description: `Objet : "${subject}"`,
        status: "pending_approval",
        createdAt: new Date().toISOString(),
        payload: { to, subject, body },
      };

      globalActionStore.set(action.id, action);
      db.actions.add(action, userId);

      return {
        success: true,
        result: action,
        message: `Brouillon d'email préparé pour ${to}. En attente de votre approbation.`,
      };
    }

    if (toolName === "schedule_calendar_event") {
      const { summary, startTime, endTime, description, channel = "gmail" } = args as {
        summary: string;
        startTime: string;
        endTime: string;
        description?: string;
        channel?: "gmail" | "outlook";
      };

      const action: ActionProposal = {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId,
        type: "schedule_event",
        channel,
        title: `Planifier : ${summary}`,
        description: `${new Date(startTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} - ${new Date(endTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
        status: "pending_approval",
        createdAt: new Date().toISOString(),
        payload: {
          summary,
          eventStart: startTime,
          eventEnd: endTime,
          description: description || "Planifié par OmniMind",
        },
      };

      globalActionStore.set(action.id, action);
      db.actions.add(action, userId);

      return {
        success: true,
        result: action,
        message: `Événement "${summary}" préparé dans votre calendrier. Prêt pour validation.`,
      };
    }

    if (toolName === "record_user_memory") {
      const { fact, category = "preference" } = args as {
        fact: string;
        category?: UserMemory["category"];
      };

      const memory = db.memories.add({
        userId: userId || "usr_dev_admin",
        fact,
        category,
      });

      return {
        success: true,
        result: memory,
        message: `Mémorisé : "${fact}". Pris en compte pour vos prochains briefings et analyses.`,
      };
    }

    if (toolName === "execute_pending_action") {
      const { actionId } = args as { actionId: string };
      const execRes = await omniAgent.executeAction(actionId);
      return {
        success: execRes.success,
        result: execRes,
        message: execRes.message,
      };
    }

    return {
      success: false,
      result: null,
      message: `Outil inconnu : ${toolName}`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`Erreur exécution outil ${toolName}:`, err);
    return {
      success: false,
      result: null,
      message: `Erreur lors de l'exécution de l'outil : ${errorMsg}`,
    };
  }
}
