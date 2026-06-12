# 🚀 LAUNCH CHECKLIST — AI Clinic Growth System v2.0

## ──────────────────────────────────────────────
## STEP 1 — Supabase Setup (15 minutes)
## ──────────────────────────────────────────────

1. Go to https://supabase.com → New Project
   - Name: ai-clinic-growth
   - Region: ap-south-1 (Mumbai — fastest for India)
   - Database Password: generate a strong one, save it

2. Go to SQL Editor → New Query
   → Paste ENTIRE contents of: backend/supabase/schema.sql
   → Click RUN

3. Go to SQL Editor → New Query again
   → Paste ENTIRE contents of: backend/supabase/functions.sql
   → Click RUN

4. Go to Project Settings → API
   → Copy: Project URL       → SUPABASE_URL in .env
   → Copy: anon public key   → SUPABASE_ANON_KEY in .env
   → Copy: service_role key  → SUPABASE_SERVICE_ROLE_KEY in .env  ⚠️ NEVER expose this to frontend

5. Go to Project Settings → Database
   → Copy the connection string (URI mode) → AGENDA_DB_URI in .env

## ──────────────────────────────────────────────
## STEP 2 — Razorpay Setup (20 minutes)
## ──────────────────────────────────────────────

1. Go to https://razorpay.com → Create Account → Complete KYC

2. Dashboard → Settings → API Keys
   → Generate Live API Keys
   → RAZORPAY_KEY_ID    = rzp_live_xxxxx
   → RAZORPAY_KEY_SECRET = your_secret

3. Create Subscription Plans (for recurring billing):
   Dashboard → Products → Subscriptions → Plans → Create Plan

   Create 6 plans:
   a) Starter Monthly  — ₹1,999  interval: monthly  period: 1
   b) Starter Yearly   — ₹19,999 interval: yearly   period: 1
   c) Growth Monthly   — ₹2,999  interval: monthly  period: 1
   d) Growth Yearly    — ₹29,999 interval: yearly   period: 1
   e) Enterprise Monthly — ₹4,999 interval: monthly period: 1
   f) Enterprise Yearly  — ₹49,999 interval: yearly period: 1

   Copy each plan ID to .env:
   RZP_PLAN_STARTER_MONTHLY = plan_xxxx
   (etc.)

4. Webhooks → Add Webhook
   URL: https://api.yourclinic.com/api/v1/billing/webhook
   Events to subscribe:
   ✓ payment.captured
   ✓ payment.failed
   ✓ subscription.charged
   ✓ subscription.cancelled
   → Copy webhook secret → RAZORPAY_WEBHOOK_SECRET in .env

5. Account → Business Settings → Enable auto-capture payments

## ──────────────────────────────────────────────
## STEP 3 — Twilio Setup (15 minutes)
## ──────────────────────────────────────────────

1. https://twilio.com → Create account → Verify phone
2. Buy an Indian phone number (₹750/month approx)
3. Console → Account SID + Auth Token → copy to .env
4. Messaging → Senders → WhatsApp → Activate Sandbox (for testing)
   → Or apply for WhatsApp Business API (takes 2-3 days for approval)

Set webhook URLs in Twilio (after backend is deployed):
   Voice webhook:    POST https://api.yourclinic.com/api/v1/webhooks/twilio/voice?clinicId=YOUR_ID
   WhatsApp webhook: POST https://api.yourclinic.com/api/v1/webhooks/twilio/whatsapp?clinicId=YOUR_ID

## ──────────────────────────────────────────────
## STEP 4 — Google Calendar (10 minutes)
## ──────────────────────────────────────────────

1. https://console.cloud.google.com → New Project → Enable Google Calendar API
2. Credentials → Create OAuth 2.0 Client ID → Web application
3. Authorised redirect URIs: https://api.yourclinic.com/api/v1/clinic/calendar/callback
4. Copy Client ID + Secret to .env
5. Each clinic connects their own calendar from Settings page in dashboard

## ──────────────────────────────────────────────
## STEP 5 — Anthropic API (2 minutes)
## ──────────────────────────────────────────────

1. https://console.anthropic.com → API Keys → Create Key
2. Copy → ANTHROPIC_API_KEY in .env
3. Add $50 credits to start (enough for ~50,000 conversations)

## ──────────────────────────────────────────────
## STEP 6 — Deploy Backend to Render (10 minutes)
## ──────────────────────────────────────────────

1. Push code to GitHub: git init → git add . → git commit → push

2. https://render.com → New → Web Service
   → Connect GitHub repo
   → Root directory: backend
   → Build: npm install
   → Start: npm start
   → Region: Singapore

3. Go to Environment → Add all vars from .env
   (There are ~20 vars — copy them one by one or use Render's bulk paste)

4. Deploy → Wait 2-3 minutes → Test: curl https://your-app.onrender.com/health

## ──────────────────────────────────────────────
## STEP 7 — Deploy Frontend to Vercel (5 minutes)
## ──────────────────────────────────────────────

1. https://vercel.com → New Project → Import GitHub repo
2. Root directory: frontend
3. Add env var: REACT_APP_API_URL = https://your-backend.onrender.com/api/v1
4. Deploy → Done

## ──────────────────────────────────────────────
## STEP 8 — Register Your First Client Clinic (5 minutes)
## ──────────────────────────────────────────────

curl -X POST https://api.yourclinic.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name":     "SmileCare Dental",
    "email":    "admin@smilecare.com",
    "password": "secure123",
    "phone":    "+91 98765 43210",
    "timezone": "Asia/Kolkata"
  }'

→ Returns: { data: { clinic: {...}, token: "eyJ..." } }
→ Use that token to call all protected APIs

Then from the dashboard:
→ Settings → Integrations → Connect Google Calendar
→ Settings → AI Config → Add your clinic context
→ Settings → Services → Add treatments with prices
→ Copy webhook snippet → Paste on clinic website

## ──────────────────────────────────────────────
## STEP 9 — Onboard Client to Paid Plan
## ──────────────────────────────────────────────

From the clinic dashboard → Billing tab:
→ Choose plan → Click Upgrade
→ Razorpay checkout opens
→ Client pays via UPI/card/netbanking
→ Subscription activates instantly
→ You receive payment to your Razorpay account

## ──────────────────────────────────────────────
## PRICING SUMMARY (what you charge clients)
## ──────────────────────────────────────────────

Starter    ₹1,999/month   (200 leads, 2 channels)
Growth     ₹2,999/month   (1000 leads, all channels) ← sweet spot
Enterprise ₹4,999/month   (unlimited, white-label)

Your costs per clinic (approximate):
- Supabase:    ~₹0 (free tier handles 10+ clinics, Pro ₹1,750/mo for 100+ clinics)
- Render:       ₹750/month (one server handles 20-50 clinics)
- Anthropic:    ~₹150-300/clinic/month (depending on conversation volume)
- Twilio:       ~₹100-200/clinic/month
- Total COGS:   ~₹400-600/clinic/month

Gross margin at Growth plan: (₹2,999 - ₹600) / ₹2,999 = ~80% margin ✅

## ──────────────────────────────────────────────
## PRODUCTION HEALTH CHECKS
## ──────────────────────────────────────────────

GET  /health                    → { status: "healthy" }
GET  /api/v1/billing/plans      → List of pricing plans
POST /api/v1/auth/login         → Auth test
GET  /api/v1/analytics/overview → Requires JWT

## ──────────────────────────────────────────────
## SUPPORT RESOURCES
## ──────────────────────────────────────────────

Supabase docs:  https://supabase.com/docs
Razorpay docs:  https://razorpay.com/docs/api
Twilio docs:    https://www.twilio.com/docs
Anthropic docs: https://docs.anthropic.com
Render docs:    https://render.com/docs
