import fs from "fs";
import path from "path";
import { ActionProposal, SummaryReport, UserPreferences, ChannelType, UserMemory } from "@/lib/agent/types";

export interface ConnectedAccountRecord {
  id: string;
  userId?: string;
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

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  verified: boolean;
  verificationToken?: string;
  verificationCode?: string;
  tokenExpiresAt?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface DatabaseSchema {
  users?: UserRecord[];
  actions: ActionProposal[];
  briefings: SummaryReport[];
  accounts: ConnectedAccountRecord[];
  settings: UserPreferences;
  userSettings?: Record<string, UserPreferences>;
  memories?: UserMemory[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

// Données initiales par défaut
const DEFAULT_DB: DatabaseSchema = {
  users: [],
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
  userSettings: {},
  memories: [
    {
      id: "mem_init_1",
      userId: "usr_dev_admin",
      category: "constraint",
      fact: "Pas de rendez-vous ni de réunions client le vendredi après 16h.",
      createdAt: new Date().toISOString(),
    },
    {
      id: "mem_init_2",
      userId: "usr_dev_admin",
      category: "vip_relation",
      fact: "Cabinet Lamy est le conseil juridique prioritaire. Traiter leurs demandes sous 4h.",
      createdAt: new Date().toISOString(),
    },
  ],
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
        if (!this.inMemory!.memories) {
          this.inMemory!.memories = DEFAULT_DB.memories;
        }
        if (!this.inMemory!.userSettings) {
          this.inMemory!.userSettings = {};
        }
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

  // --- ACTIONS REPOSITORY (Multi-tenant) ---
  public actions = {
    getAll: (userId?: string): ActionProposal[] => {
      const actions = this.read().actions;
      if (!userId) return actions;
      return actions.filter((a) => !a.userId || a.userId === userId);
    },
    getById: (id: string, userId?: string): ActionProposal | undefined => {
      return this.read().actions.find(
        (a) => a.id === id && (!userId || !a.userId || a.userId === userId)
      );
    },
    add: (action: ActionProposal, userId?: string): ActionProposal => {
      const db = this.read();
      if (userId) action.userId = userId;
      db.actions.unshift(action);
      this.write(db);
      return action;
    },
    updateStatus: (
      id: string,
      status: ActionProposal["status"],
      userId?: string
    ): ActionProposal | null => {
      const db = this.read();
      const action = db.actions.find(
        (a) => a.id === id && (!userId || !a.userId || a.userId === userId)
      );
      if (action) {
        action.status = status;
        this.write(db);
        return action;
      }
      return null;
    },
  };

  // --- BRIEFINGS REPOSITORY (Multi-tenant) ---
  public briefings = {
    getAll: (userId?: string): SummaryReport[] => {
      const briefings = this.read().briefings;
      if (!userId) return briefings;
      return briefings.filter((b) => !b.userId || b.userId === userId);
    },
    getLatest: (userId?: string): SummaryReport | null => {
      const briefings = this.briefings.getAll(userId);
      return briefings.length > 0 ? briefings[0] : null;
    },
    add: (report: SummaryReport, userId?: string): SummaryReport => {
      const db = this.read();
      if (userId) report.userId = userId;
      db.briefings.unshift(report);
      this.write(db);
      return report;
    },
  };

  // --- ACCOUNTS REPOSITORY (Multi-tenant) ---
  public accounts = {
    getAll: (userId?: string): ConnectedAccountRecord[] => {
      const accounts = this.read().accounts;
      if (!userId) return accounts;
      return accounts.filter((a) => !a.userId || a.userId === userId);
    },
    toggleStatus: (id: string, userId?: string): ConnectedAccountRecord | null => {
      const db = this.read();
      const account = db.accounts.find(
        (a) => a.id === id && (!userId || !a.userId || a.userId === userId)
      );
      if (account) {
        account.status = account.status === "connected" ? "disconnected" : "connected";
        this.write(db);
        return account;
      }
      return null;
    },
  };

  // --- SETTINGS REPOSITORY (Multi-tenant) ---
  public settings = {
    get: (userId?: string): UserPreferences => {
      const db = this.read();
      if (userId && db.userSettings && db.userSettings[userId]) {
        return db.userSettings[userId];
      }
      return db.settings;
    },
    update: (updates: Partial<UserPreferences>, userId?: string): UserPreferences => {
      const db = this.read();
      if (userId) {
        if (!db.userSettings) db.userSettings = {};
        const current = db.userSettings[userId] || { ...db.settings, userId };
        db.userSettings[userId] = { ...current, ...updates };
        this.write(db);
        return db.userSettings[userId];
      }
      db.settings = { ...db.settings, ...updates };
      this.write(db);
      return db.settings;
    },
  };

  // --- MEMORIES REPOSITORY (Long-Term Memory / RAG) ---
  public memories = {
    getAll: (userId?: string): UserMemory[] => {
      const db = this.read();
      const all = db.memories || [];
      if (!userId) return all;
      return all.filter((m) => !m.userId || m.userId === userId);
    },
    add: (memory: {
      userId: string;
      fact: string;
      category?: UserMemory["category"];
    }): UserMemory => {
      const db = this.read();
      if (!db.memories) db.memories = [];
      const newMemory: UserMemory = {
        id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId: memory.userId,
        fact: memory.fact.trim(),
        category: memory.category || "preference",
        createdAt: new Date().toISOString(),
      };
      db.memories.unshift(newMemory);
      this.write(db);
      return newMemory;
    },
    delete: (id: string, userId?: string): boolean => {
      const db = this.read();
      if (!db.memories) return false;
      const initialCount = db.memories.length;
      db.memories = db.memories.filter(
        (m) => !(m.id === id && (!userId || m.userId === userId))
      );
      this.write(db);
      return db.memories.length < initialCount;
    },
    search: (query: string, userId?: string): UserMemory[] => {
      const list = this.memories.getAll(userId);
      const terms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2);
      if (terms.length === 0) return list.slice(0, 5);
      return list
        .filter((m) => terms.some((t) => m.fact.toLowerCase().includes(t)))
        .slice(0, 5);
    },
  };

  // --- USERS REPOSITORY ---
  public users = {
    getAll: (): UserRecord[] => {
      const data = this.read();
      return data.users || [];
    },
    getById: (id: string): UserRecord | undefined => {
      const users = this.read().users || [];
      return users.find((u) => u.id === id);
    },
    getByEmail: (email: string): UserRecord | undefined => {
      const users = this.read().users || [];
      const normalized = email.toLowerCase().trim();
      return users.find((u) => u.email.toLowerCase() === normalized);
    },
    getByToken: (token: string): UserRecord | undefined => {
      const users = this.read().users || [];
      return users.find((u) => u.verificationToken === token.trim());
    },
    getByCode: (email: string, code: string): UserRecord | undefined => {
      const users = this.read().users || [];
      const normalized = email.toLowerCase().trim();
      return users.find(
        (u) =>
          u.email.toLowerCase() === normalized &&
          u.verificationCode === code.trim()
      );
    },
    createOrUpdateVerification: (
      email: string,
      name: string,
      token: string,
      code: string,
      expiresAt: string
    ): UserRecord => {
      const db = this.read();
      if (!db.users) db.users = [];
      const normalized = email.toLowerCase().trim();
      let user = db.users.find((u) => u.email.toLowerCase() === normalized);

      if (user) {
        user.name = name.trim() || user.name;
        user.verificationToken = token;
        user.verificationCode = code;
        user.tokenExpiresAt = expiresAt;
      } else {
        user = {
          id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          email: normalized,
          name: name.trim() || normalized.split("@")[0],
          verified: false,
          verificationToken: token,
          verificationCode: code,
          tokenExpiresAt: expiresAt,
          createdAt: new Date().toISOString(),
        };
        db.users.push(user);
      }
      this.write(db);
      return user;
    },
    verifyUser: (id: string): UserRecord | null => {
      const db = this.read();
      if (!db.users) db.users = [];
      const user = db.users.find((u) => u.id === id);
      if (user) {
        user.verified = true;
        user.verificationToken = undefined;
        user.verificationCode = undefined;
        user.lastLoginAt = new Date().toISOString();

        // Mettre à jour automatiquement le profil exécutif actif
        db.settings.userName = user.name;
        db.settings.userEmail = user.email;

        this.write(db);
        return user;
      }
      return null;
    },
  };
}

export const db = new JsonDatabase();
