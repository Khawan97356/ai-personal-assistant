import fs from "fs";
import path from "path";
import { ActionProposal, SummaryReport, UserPreferences, ChannelType } from "@/lib/agent/types";

export interface ConnectedAccountRecord {
  id: string;
  name: string;
  channel: ChannelType;
  type: string;
  status: "connected" | "disconnected";
  identifier: string;
  unreadCount: number;
  lastSyncAt: string;
  iconColor: string;
  bgColor: string;
}

export interface DatabaseSchema {
  actions: ActionProposal[];
  briefings: SummaryReport[];
  accounts: ConnectedAccountRecord[];
  settings: UserPreferences;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

// Données initiales par défaut
const DEFAULT_DB: DatabaseSchema = {
  actions: [
    {
      id: "act_init_1",
      type: "schedule_event",
      channel: "gmail",
      title: "Mise à jour Réunion Sync (16h30)",
      description: "Mettre à jour l'événement Google Calendar pour 16h30 et avertir les participants.",
      status: "pending_approval",
      createdAt: new Date().toISOString(),
      payload: {
        summary: "Point Sync Équipe",
        eventStart: new Date(Date.now() + 3600000).toISOString(),
        eventEnd: new Date(Date.now() + 7200000).toISOString(),
      },
    },
    {
      id: "act_init_2",
      type: "send_email",
      channel: "gmail",
      title: "Envoyer confirmation de signature au Cabinet Lamy",
      description: "Préparer l'email confirmant que l'avenant sera retourné signé aujourd'hui.",
      status: "pending_approval",
      createdAt: new Date().toISOString(),
      payload: {
        to: "cabinet@lamy-associes.com",
        subject: "RE: Avenant Contrat SaaS - Signature en cours",
        body: "Bonjour Maître,\n\nBien reçu. L'avenant est actuellement en cours de signature électronique et vous sera renvoyé avant 18h.\n\nBien cordialement,\nThomas",
      },
    },
  ],
  briefings: [],
  accounts: [
    {
      id: "gmail",
      name: "Gmail & Google Workspace",
      channel: "gmail",
      type: "Email & Agenda",
      status: "connected",
      identifier: "thomas.dev@gmail.com",
      unreadCount: 8,
      lastSyncAt: new Date().toISOString(),
      iconColor: "text-red-400",
      bgColor: "bg-red-500/10 border-red-500/20",
    },
    {
      id: "whatsapp",
      name: "WhatsApp Business Cloud",
      channel: "whatsapp",
      type: "Messagerie Instantanée",
      status: "connected",
      identifier: "+33 6 12 34 56 78",
      unreadCount: 14,
      lastSyncAt: new Date().toISOString(),
      iconColor: "text-emerald-400",
      bgColor: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      id: "telegram",
      name: "Telegram Bot Privé",
      channel: "telegram",
      type: "Commandes Rapides",
      status: "connected",
      identifier: "@OmniMindThomasBot",
      unreadCount: 3,
      lastSyncAt: new Date().toISOString(),
      iconColor: "text-sky-400",
      bgColor: "bg-sky-500/10 border-sky-500/20",
    },
    {
      id: "outlook",
      name: "Outlook / Microsoft 365",
      channel: "outlook",
      type: "Email Pro",
      status: "disconnected",
      identifier: "Non connecté",
      unreadCount: 0,
      lastSyncAt: new Date().toISOString(),
      iconColor: "text-blue-400",
      bgColor: "bg-blue-500/10 border-blue-500/20",
    },
    {
      id: "discord",
      name: "Discord Bot & Webhook",
      channel: "discord",
      type: "Communautés & Serveurs",
      status: "connected",
      identifier: "Serveur Tech Scale",
      unreadCount: 22,
      lastSyncAt: new Date().toISOString(),
      iconColor: "text-indigo-400",
      bgColor: "bg-indigo-500/10 border-indigo-500/20",
    },
  ],
  settings: {
    userName: "Thomas",
    userEmail: "thomas.dev@gmail.com",
    userPhone: "+33612345678",
    preferredBriefingChannel: "telegram",
    morningBriefingTime: "08:00",
    eveningBriefingTime: "19:00",
    requireApprovalBeforeSending: true,
    vipContacts: ["cabinet@lamy-associes.com", "+33600000001", "investisseurs@seed.vc"],
  },
};

class JsonDatabase {
  private inMemory: DatabaseSchema | null = null;

  private ensureFile(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), "utf-8");
      }
    } catch (err) {
      console.error("Database initialization error:", err);
    }
  }

  private read(): DatabaseSchema {
    if (this.inMemory) return this.inMemory;
    this.ensureFile();
    try {
      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, "utf-8");
        this.inMemory = JSON.parse(content);
        return this.inMemory!;
      }
    } catch (err) {
      console.error("Database read error:", err);
    }
    return DEFAULT_DB;
  }

  private write(data: DatabaseSchema): void {
    this.inMemory = data;
    this.ensureFile();
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error("Database write error:", err);
    }
  }

  // --- ACTIONS REPOSITORY ---
  public actions = {
    getAll: (): ActionProposal[] => {
      return this.read().actions;
    },
    getById: (id: string): ActionProposal | undefined => {
      return this.read().actions.find((a) => a.id === id);
    },
    add: (action: ActionProposal): ActionProposal => {
      const db = this.read();
      db.actions.unshift(action);
      this.write(db);
      return action;
    },
    updateStatus: (id: string, status: ActionProposal["status"]): ActionProposal | null => {
      const db = this.read();
      const action = db.actions.find((a) => a.id === id);
      if (action) {
        action.status = status;
        this.write(db);
        return action;
      }
      return null;
    },
  };

  // --- BRIEFINGS REPOSITORY ---
  public briefings = {
    getAll: (): SummaryReport[] => {
      return this.read().briefings;
    },
    getLatest: (): SummaryReport | null => {
      const briefings = this.read().briefings;
      return briefings.length > 0 ? briefings[0] : null;
    },
    add: (report: SummaryReport): SummaryReport => {
      const db = this.read();
      db.briefings.unshift(report);
      this.write(db);
      return report;
    },
  };

  // --- ACCOUNTS REPOSITORY ---
  public accounts = {
    getAll: (): ConnectedAccountRecord[] => {
      return this.read().accounts;
    },
    toggleStatus: (id: string): ConnectedAccountRecord | null => {
      const db = this.read();
      const account = db.accounts.find((a) => a.id === id);
      if (account) {
        account.status = account.status === "connected" ? "disconnected" : "connected";
        this.write(db);
        return account;
      }
      return null;
    },
  };

  // --- SETTINGS REPOSITORY ---
  public settings = {
    get: (): UserPreferences => {
      return this.read().settings;
    },
    update: (updates: Partial<UserPreferences>): UserPreferences => {
      const db = this.read();
      db.settings = { ...db.settings, ...updates };
      this.write(db);
      return db.settings;
    },
  };
}

export const db = new JsonDatabase();
