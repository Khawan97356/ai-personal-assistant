# 🤖 OmniMind AI — Assistant Personnel & Agent Autonome Omnicanal

OmniMind AI est une plateforme d'intelligence artificielle personnelle connectée à **Gmail, WhatsApp, Telegram, Outlook et Discord**. Elle génère des synthèses quotidiennes, extrait les engagements et rendez-vous, et agit comme un agent autonome avec validation humaine (*Human-in-the-Loop*).

---

## 🚀 Fonctionnalités Clés

1. **Landing Page Complète & Premium** :
   - Header avec indicateur d'uptime et navigation responsive
   - Hero section avec simulation de flux omnicanal en temps réel
   - Écosystème connecté (Gmail, WhatsApp, Telegram, Outlook, Discord, Notion)
   - Grille de fonctionnalités détaillée (résumés, rappels prédictifs, transcription vocale, sécurité)
   - Section **Bento-Grid** asymétrique moderne
   - Simulateur d'agent interactif avec 4 scénarios concrets
   - Tarifs transparents (mensuel / annuel) et FAQ interactive
   - Bannière CTA et Footer multi-colonnes

2. **Moteur d'Agent IA Backend (`lib/agent/`)** :
   - **Cœur d'orchestration (`core.ts`)** : Fusion multi-sources, analyse de priorités, génération de briefings exécutifs et extraction des tâches.
   - **Transcription Vocale (`audio.ts`)** : Support de Whisper (OpenAI / Groq) pour la transcription instantanée des messages vocaux WhatsApp et Telegram.
   - **Connecteurs Canaux (`channels/`)** :
     - Telegram (`telegram.ts`) : Envoi de briefings et boutons d'approbation directe 1-Tap (`Approuver` / `Rejeter`).
     - WhatsApp Cloud (`whatsapp.ts`) : Webhooks Meta, réception de vocaux et messages interactifs.
     - Gmail & Google Calendar (`gmail.ts`) : Rédaction de brouillons et planification d'événements.
     - Outlook (`outlook.ts`) : Intégration Microsoft Graph API.
     - Discord (`discord.ts`) : Alertes et notifications par webhooks.

3. **Routes API Webhooks & Contrôle (`app/api/`)** :
   - `POST /api/webhooks/telegram` : Webhook Telegram Bot pour commandes (`/briefing`), vocaux et callbacks de validation.
   - `GET|POST /api/webhooks/whatsapp` : Handshake Meta et réception des messages WhatsApp.
   - `GET|POST /api/agent/briefing` : Déclencheur manuel ou cron pour le briefing exécutif.
   - `GET|POST /api/agent/actions` : Consultation et exécution des actions en attente d'approbation.

---

## 🛠️ Démarrage Rapide

### 1. Installation des dépendances
```bash
npm install
```

### 2. Configuration des variables d'environnement
Copiez le fichier d'exemple et renseignez vos clés API :
```bash
cp .env.example .env.local
```

### 3. Lancer le serveur local
```bash
npm run dev
```
Accédez à l'application sur [http://localhost:3000](http://localhost:3000).

---

## 🛡️ Sécurité & Confidentialité
- Architecture **Zero-Knowledge** : aucun message privé n'est persisté en clair.
- Approbation **Human-in-the-Loop** obligatoire par défaut avant tout envoi d'email ou modification d'agenda.

