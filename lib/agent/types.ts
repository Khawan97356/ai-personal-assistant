export type ChannelType = "gmail" | "whatsapp" | "telegram" | "outlook" | "discord";

export type MessagePriority = "low" | "medium" | "high" | "critical";

export type ActionType =
  | "send_email"
  | "reply_message"
  | "schedule_event"
  | "create_reminder"
  | "archive_message";

export type ActionStatus = "pending_approval" | "approved" | "executed" | "rejected";

export interface MessageSender {
  name: string;
  identifier: string; // email, phone number, telegram handle, discord tag
  isVip?: boolean;
}

export interface IncomingMessage {
  id: string;
  channel: ChannelType;
  sender: MessageSender;
  timestamp: string;
  subject?: string;
  content: string;
  audioUrl?: string;
  audioDurationSeconds?: number;
  metadata?: Record<string, unknown>;
}

export interface ExtractedCommitment {
  title: string;
  description?: string;
  dateTime?: string; // ISO date string
  locationOrLink?: string;
  participants?: string[];
  isImplicit: boolean; // e.g. "je te l'envoie ce soir"
}

export interface ActionProposal {
  id: string;
  userId?: string;
  type: ActionType;
  channel: ChannelType;
  title: string;
  description: string;
  status: ActionStatus;
  createdAt: string;
  payload: {
    to?: string;
    subject?: string;
    body?: string;
    eventStart?: string;
    eventEnd?: string;
    summary?: string;
    reminderTime?: string;
    [key: string]: unknown;
  };
}

export interface SummaryReport {
  id: string;
  userId?: string;
  generatedAt: string;
  period: "morning" | "evening" | "instant";
  totalMessagesAnalyzed: number;
  criticalPoints: string[];
  decisionsTaken: string[];
  pendingTasks: ExtractedCommitment[];
  suggestedActions: ActionProposal[];
  summaryHtml?: string;
  summaryMarkdown: string;
}

export interface UserPreferences {
  userId?: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  telegramChatId?: string;
  preferredBriefingChannel: ChannelType;
  morningBriefingTime: string; // e.g. "08:00"
  eveningBriefingTime: string; // e.g. "19:00"
  requireApprovalBeforeSending: boolean;
  vipContacts: string[]; // list of emails/phones considered VIP
}

export interface UserMemory {
  id: string;
  userId: string;
  category: "preference" | "constraint" | "vip_relation" | "work_habit";
  fact: string;
  createdAt: string;
}
