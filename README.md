# 🏥 AI Clinic Growth System
### Production-ready SaaS platform for clinic automation and revenue growth

---

## What this system does

- Captures leads from **Voice, WhatsApp, Instagram, Web Chat, and Forms**
- Handles conversations end-to-end using **Claude AI**
- Qualifies and scores leads automatically (Hot / Warm / Cold / Emergency)
- Books appointments into **Google Calendar** with conflict detection
- Sends **automated reminders** (24h, 2h) and **no-show recovery messages**
- Stores everything in a **CRM** with full patient history
- Tracks conversion funnels and revenue on an **analytics dashboard**

---

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | React 18, Recharts, Lucide          |
| Backend     | Node.js 18+, Express.js             |
| Database    | MongoDB Atlas                       |
| AI Engine   | Anthropic Claude (claude-sonnet-4)  |
| Messaging   | Twilio (Voice, WhatsApp, SMS)       |
| Calendar    | Google Calendar API (OAuth2)        |
| Job Scheduler | Agenda.js                         |
| Deployment  | Vercel (frontend) + Render (backend)|

---

## Quick Start (Local)

### Prerequisites
- Node.js >= 18
- MongoDB Atlas account (free tier works)
- Anthropic API key
- Twilio account
- Google Cloud project with Calendar API enabled

### 1. Clone and install

```bash
git clone <your-repo>
cd ai-clinic-growth-system

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Configure environment

```bash
cd backend
cp .env.example .env
# Edit .env with your actual keys
```

Required keys to fill in:
- `MONGODB_URI` — MongoDB Atlas connection string
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_WHATSAPP_NUMBER`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `JWT_SECRET` — any 64-char random string
- `WEBHOOK_SECRET` — any random string for Instagram verification

### 3. Run locally

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm start
```

Backend runs on http://localhost:5000  
Frontend runs on http://localhost:3000

---

## Google Calendar Setup

1. Go to https://console.cloud.google.com
2. Create a project → Enable Google Calendar API
3. Create OAuth 2.0 credentials (Web application)
4. Add redirect URI: `http://localhost:5000/api/v1/clinic/calendar/callback`
5. Copy Client ID and Secret to `.env`
6. After login, visit: `GET /api/v1/clinic/calendar/auth` → opens Google OAuth
7. Complete OAuth → tokens stored automatically

---

## Twilio Setup

### WhatsApp
1. Go to Twilio Console → Messaging → Try it out → Send WhatsApp
2. Note your sandbox number (WhatsApp: +14155238886 for sandbox)
3. Set webhook URL: `https://your-backend.com/api/v1/webhooks/twilio/whatsapp?clinicId=YOUR_CLINIC_ID`

### Voice
1. Buy a phone number in Twilio Console
2. Under the number → Voice → Webhook: `https://your-backend.com/api/v1/webhooks/twilio/voice?clinicId=YOUR_CLINIC_ID`

---

## Instagram Setup

1. Create a Facebook Developer App at developers.facebook.com
2. Add Instagram Graph API product
3. Set webhook URL: `https://your-backend.com/api/v1/webhooks/instagram?clinicId=YOUR_CLINIC_ID`
4. Set verify token = value of `WEBHOOK_SECRET` in `.env`
5. Subscribe to `messages` and `messaging_postbacks` events

---

## API Authentication

All dashboard endpoints require a Bearer JWT token.

```bash
# Register clinic
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"SmileCare Dental","email":"admin@smilecare.com","password":"secure123","phone":"+91 98765 43210"}'

# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -d '{"email":"admin@smilecare.com","password":"secure123"}'
# Returns: { token: "eyJ..." }

# Use token in all subsequent requests
curl http://localhost:5000/api/v1/leads \
  -H "Authorization: Bearer eyJ..."
```

---

## Deployment

### Backend → Render

1. Push code to GitHub
2. Create a new Web Service on Render
3. Connect your repo, set root to `backend/`
4. Build command: `npm install`
5. Start command: `npm start`
6. Add all environment variables from `.env`

### Frontend → Vercel

1. Create project on Vercel
2. Connect your repo, set root to `frontend/`
3. Add env var: `REACT_APP_API_URL=https://your-backend.onrender.com/api/v1`
4. Deploy

### Domain and SSL
Both Render and Vercel provide free SSL. Point your domain's DNS:
- `api.yourclinic.com` → Render backend
- `app.yourclinic.com` → Vercel frontend

---

## Webhook URL Pattern

Every clinic gets a unique webhook URL using their MongoDB `_id`:

```
WhatsApp: https://api.yourclinic.com/api/v1/webhooks/twilio/whatsapp?clinicId=64abc123...
Voice:    https://api.yourclinic.com/api/v1/webhooks/twilio/voice?clinicId=64abc123...
Web chat: POST https://api.yourclinic.com/api/v1/webhooks/webchat (body: { clinicId, sessionId, message })
Form:     POST https://api.yourclinic.com/api/v1/webhooks/form (body: { clinicId, name, phone, ... })
```

---

## Project Structure

```
ai-clinic-growth-system/
├── backend/
│   ├── src/
│   │   ├── config/          # DB, env validation, job scheduler
│   │   ├── controllers/     # HTTP handlers
│   │   ├── services/
│   │   │   ├── ai/          # Claude engine + lead qualifier
│   │   │   ├── channels/    # Twilio voice/WA/SMS
│   │   │   ├── booking/     # Google Calendar + confirmations
│   │   │   ├── crm/         # Lead/appointment/analytics services
│   │   │   └── automation/  # Reminders + follow-ups
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # Express route definitions
│   │   ├── middlewares/     # Auth, error, Twilio sig verification
│   │   └── utils/           # Logger, response helpers, date/phone utils
│   └── server.js
└── frontend/
    └── src/
        ├── services/api.js  # Axios + interceptors
        └── App.jsx          # Complete dashboard (Dashboard, Leads, Conversations, Appointments, Analytics)
```

---

## Scaling Path

| Stage       | Clinics | Action                                          |
|-------------|---------|------------------------------------------------|
| MVP         | 1–50    | Current setup (Render + Atlas M10)              |
| Growth      | 50–200  | Add Redis for session cache + Bull queue        |
| Scale       | 200–500 | Horizontal Render instances + Atlas M30         |
| Enterprise  | 500+    | Extract microservices + Kubernetes + Kafka      |

---

## Support

For issues: check logs via `logger.js` (Winston) — structured JSON in production, colored console in dev.

Health check: `GET /health` — returns service status, environment, timestamp.
