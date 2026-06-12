-- ═══════════════════════════════════════════════════════════════
-- AI CLINIC GROWTH SYSTEM — Supabase PostgreSQL Schema
-- Run this in your Supabase project: SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- for fast text search

-- ─────────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────────
CREATE TYPE lead_status AS ENUM (
  'new','hot','warm','cold','emergency',
  'contacted','appointment_set','converted','lost','nurturing'
);
CREATE TYPE lead_urgency AS ENUM ('immediate','within_week','within_month','flexible','unknown');
CREATE TYPE budget_intent AS ENUM ('premium','standard','price_sensitive','unknown');
CREATE TYPE channel_type AS ENUM ('voice','whatsapp','instagram','webchat','form');
CREATE TYPE conversation_stage AS ENUM (
  'greeting','qualification','objection_handling','booking','confirmation','follow_up'
);
CREATE TYPE conversation_status AS ENUM ('active','completed','abandoned');
CREATE TYPE appointment_status AS ENUM (
  'pending','confirmed','reminded_24h','reminded_2h',
  'completed','no_show','cancelled','rescheduled'
);
CREATE TYPE reminder_type AS ENUM ('24h','2h','30m');
CREATE TYPE subscription_plan AS ENUM ('starter','growth','enterprise');
CREATE TYPE payment_status AS ENUM ('pending','captured','failed','refunded');

-- ─────────────────────────────────────────────────────────────────
-- TABLE: clinics  (multi-tenant root)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE clinics (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  TEXT NOT NULL,
  email                 TEXT NOT NULL UNIQUE,
  password_hash         TEXT NOT NULL,
  phone                 TEXT NOT NULL,
  address               TEXT,
  timezone              TEXT DEFAULT 'Asia/Kolkata',

  -- Twilio
  twilio_phone_number   TEXT,
  twilio_account_sid    TEXT,
  whatsapp_number       TEXT,

  -- Google Calendar
  google_calendar_id    TEXT,
  google_access_token   TEXT,
  google_refresh_token  TEXT,
  google_token_expiry   TIMESTAMPTZ,

  -- Working hours (stored as JSONB per day)
  working_hours JSONB DEFAULT '{
    "monday":    {"open":"09:00","close":"18:00","enabled":true},
    "tuesday":   {"open":"09:00","close":"18:00","enabled":true},
    "wednesday": {"open":"09:00","close":"18:00","enabled":true},
    "thursday":  {"open":"09:00","close":"18:00","enabled":true},
    "friday":    {"open":"09:00","close":"18:00","enabled":true},
    "saturday":  {"open":"09:00","close":"14:00","enabled":true},
    "sunday":    {"open":"09:00","close":"14:00","enabled":false}
  }'::jsonb,

  services  JSONB DEFAULT '[]'::jsonb,
  staff     JSONB DEFAULT '[]'::jsonb,

  ai_config JSONB DEFAULT '{
    "personality":   "professional and warm",
    "clinicContext": "",
    "language":      "English"
  }'::jsonb,

  -- Subscription
  subscription_plan     subscription_plan DEFAULT 'starter',
  subscription_expires_at TIMESTAMPTZ,
  subscription_active   BOOLEAN DEFAULT true,
  razorpay_customer_id  TEXT,
  razorpay_subscription_id TEXT,

  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clinics_email ON clinics(email);

-- ─────────────────────────────────────────────────────────────────
-- TABLE: leads
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE leads (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,

  name            TEXT,
  phone           TEXT,
  email           TEXT,

  channel         channel_type NOT NULL,
  channel_user_id TEXT,
  source_url      TEXT,

  status          lead_status DEFAULT 'new',
  score           INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),

  -- Qualification
  treatment_interest  TEXT,
  urgency         lead_urgency DEFAULT 'unknown',
  budget_intent   budget_intent DEFAULT 'unknown',
  preferred_times TEXT[],
  pain_points     TEXT[],

  -- Relationships
  conversation_id UUID,
  appointment_id  UUID,
  patient_id      UUID,

  -- Lifecycle
  follow_up_at    TIMESTAMPTZ,
  last_contact_at TIMESTAMPTZ,
  contact_count   INTEGER DEFAULT 0,
  is_escalated    BOOLEAN DEFAULT false,

  notes     JSONB DEFAULT '[]'::jsonb,
  tags      TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_clinic_status  ON leads(clinic_id, status);
CREATE INDEX idx_leads_clinic_channel ON leads(clinic_id, channel);
CREATE INDEX idx_leads_followup       ON leads(clinic_id, follow_up_at) WHERE follow_up_at IS NOT NULL;
CREATE INDEX idx_leads_created        ON leads(clinic_id, created_at DESC);
CREATE INDEX idx_leads_channel_user   ON leads(clinic_id, channel, channel_user_id);
-- Full-text search on name + phone
CREATE INDEX idx_leads_name_trgm  ON leads USING gin(name gin_trgm_ops);
CREATE INDEX idx_leads_phone_trgm ON leads USING gin(phone gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────────
-- TABLE: conversations
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE conversations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  channel         channel_type,
  channel_user_id TEXT,

  -- Messages stored as JSONB array — [{role, content, timestamp, metadata}]
  messages        JSONB DEFAULT '[]'::jsonb,

  -- Conversation context
  stage           conversation_stage DEFAULT 'greeting',
  extracted_data  JSONB DEFAULT '{}'::jsonb,
  booking_attempts INTEGER DEFAULT 0,
  last_ai_output  JSONB,
  flags           TEXT[] DEFAULT '{}',
  slots_offered_at TIMESTAMPTZ,

  status          conversation_status DEFAULT 'active',
  resolved_at     TIMESTAMPTZ,
  summary         TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_convs_clinic_lead   ON conversations(clinic_id, lead_id);
CREATE INDEX idx_convs_channel_user  ON conversations(clinic_id, channel_user_id, status);
CREATE INDEX idx_convs_status        ON conversations(clinic_id, status);

-- ─────────────────────────────────────────────────────────────────
-- TABLE: appointments
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE appointments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id           UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  lead_id             UUID REFERENCES leads(id),
  patient_id          UUID,

  patient_name        TEXT NOT NULL,
  phone               TEXT NOT NULL,
  email               TEXT,

  treatment           TEXT,
  staff_id            UUID,
  staff_name          TEXT,

  scheduled_at        TIMESTAMPTZ NOT NULL,
  duration_min        INTEGER DEFAULT 30,
  ends_at             TIMESTAMPTZ GENERATED ALWAYS AS (scheduled_at + (duration_min || ' minutes')::INTERVAL) STORED,

  status              appointment_status DEFAULT 'pending',
  google_event_id     TEXT,
  confirmation_code   TEXT NOT NULL DEFAULT upper(substring(md5(random()::text), 1, 8)),

  reminders           JSONB DEFAULT '[]'::jsonb,

  revenue             NUMERIC(10,2),
  cancellation_reason TEXT,
  reschedule_count    INTEGER DEFAULT 0,

  no_show_recovery_at   TIMESTAMPTZ,
  no_show_recovery_sent BOOLEAN DEFAULT false,

  source  TEXT DEFAULT 'ai',
  notes   TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appts_clinic_scheduled ON appointments(clinic_id, scheduled_at);
CREATE INDEX idx_appts_clinic_status    ON appointments(clinic_id, status);
CREATE INDEX idx_appts_noshow_recovery  ON appointments(clinic_id, no_show_recovery_at)
  WHERE no_show_recovery_sent = false AND status = 'no_show';

-- ─────────────────────────────────────────────────────────────────
-- TABLE: patients
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE patients (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES leads(id),

  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  dob             DATE,
  gender          TEXT,
  address         TEXT,

  total_appointments    INTEGER DEFAULT 0,
  completed_appointments INTEGER DEFAULT 0,
  no_shows              INTEGER DEFAULT 0,
  total_revenue         NUMERIC(10,2) DEFAULT 0,
  last_visit_at         TIMESTAMPTZ,
  first_visit_at        TIMESTAMPTZ,

  treatment_history TEXT[] DEFAULT '{}',
  tags              TEXT[] DEFAULT '{}',
  notes             JSONB DEFAULT '[]'::jsonb,

  preferred_channel TEXT,
  opted_out_sms     BOOLEAN DEFAULT false,
  opted_out_whatsapp BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(clinic_id, phone)
);

CREATE INDEX idx_patients_clinic   ON patients(clinic_id);
CREATE INDEX idx_patients_phone    ON patients(clinic_id, phone);

-- ─────────────────────────────────────────────────────────────────
-- TABLE: analytics_events  (daily aggregates per clinic)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE analytics_events (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  date      DATE NOT NULL,

  leads_total     INTEGER DEFAULT 0,
  leads_hot       INTEGER DEFAULT 0,
  leads_warm      INTEGER DEFAULT 0,
  leads_cold      INTEGER DEFAULT 0,
  leads_emergency INTEGER DEFAULT 0,
  leads_by_channel JSONB DEFAULT '{"voice":0,"whatsapp":0,"instagram":0,"webchat":0,"form":0}'::jsonb,

  appts_booked    INTEGER DEFAULT 0,
  appts_confirmed INTEGER DEFAULT 0,
  appts_completed INTEGER DEFAULT 0,
  appts_no_shows  INTEGER DEFAULT 0,
  appts_cancelled INTEGER DEFAULT 0,

  recovery_leads_recaptured INTEGER DEFAULT 0,
  recovery_noshows_rebooked INTEGER DEFAULT 0,

  revenue_generated NUMERIC(10,2) DEFAULT 0,
  revenue_recovered NUMERIC(10,2) DEFAULT 0,

  conversion_lead_to_appt NUMERIC(5,2) DEFAULT 0,
  conversion_appt_to_show NUMERIC(5,2) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(clinic_id, date)
);

CREATE INDEX idx_analytics_clinic_date ON analytics_events(clinic_id, date DESC);

-- ─────────────────────────────────────────────────────────────────
-- TABLE: payments  (Razorpay transaction log)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE payments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id             UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,

  razorpay_order_id     TEXT UNIQUE,
  razorpay_payment_id   TEXT UNIQUE,
  razorpay_signature    TEXT,
  razorpay_subscription_id TEXT,

  amount                NUMERIC(10,2) NOT NULL,  -- in INR
  currency              TEXT DEFAULT 'INR',
  plan                  subscription_plan NOT NULL,
  billing_cycle         TEXT DEFAULT 'monthly',  -- monthly | yearly

  status                payment_status DEFAULT 'pending',
  failure_reason        TEXT,

  paid_at               TIMESTAMPTZ,
  period_start          TIMESTAMPTZ,
  period_end            TIMESTAMPTZ,

  metadata              JSONB DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_clinic ON payments(clinic_id, created_at DESC);
CREATE INDEX idx_payments_status ON payments(status);

-- ─────────────────────────────────────────────────────────────────
-- AUTO-UPDATE updated_at via trigger
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clinics_updated_at      BEFORE UPDATE ON clinics      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_leads_updated_at        BEFORE UPDATE ON leads        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_appointments_updated_at  BEFORE UPDATE ON appointments  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_patients_updated_at     BEFORE UPDATE ON patients     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_analytics_updated_at    BEFORE UPDATE ON analytics_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS) — clinic data isolation
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE clinics       ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads         ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments      ENABLE ROW LEVEL SECURITY;

-- Clinics can only see their own rows (using app-set JWT claim)
-- Your backend sets: request.jwt.claims ->> 'clinic_id'
-- Service role key bypasses RLS (used by backend server)

CREATE POLICY "clinic_own_data" ON leads
  USING (clinic_id::text = current_setting('request.jwt.claims', true)::json->>'clinic_id');
CREATE POLICY "clinic_own_data" ON conversations
  USING (clinic_id::text = current_setting('request.jwt.claims', true)::json->>'clinic_id');
CREATE POLICY "clinic_own_data" ON appointments
  USING (clinic_id::text = current_setting('request.jwt.claims', true)::json->>'clinic_id');
CREATE POLICY "clinic_own_data" ON patients
  USING (clinic_id::text = current_setting('request.jwt.claims', true)::json->>'clinic_id');
CREATE POLICY "clinic_own_data" ON analytics_events
  USING (clinic_id::text = current_setting('request.jwt.claims', true)::json->>'clinic_id');
CREATE POLICY "clinic_own_data" ON payments
  USING (clinic_id::text = current_setting('request.jwt.claims', true)::json->>'clinic_id');

-- ─────────────────────────────────────────────────────────────────
-- HELPER VIEWS
-- ─────────────────────────────────────────────────────────────────

-- Live lead pipeline view
CREATE OR REPLACE VIEW lead_pipeline AS
SELECT
  l.clinic_id,
  l.id,
  l.name,
  l.phone,
  l.channel,
  l.status,
  l.score,
  l.treatment_interest,
  l.urgency,
  l.last_contact_at,
  l.follow_up_at,
  c.stage AS conversation_stage,
  c.status AS conversation_status,
  a.scheduled_at AS appointment_at,
  a.status AS appointment_status,
  l.created_at
FROM leads l
LEFT JOIN conversations c ON c.lead_id = l.id AND c.status = 'active'
LEFT JOIN appointments  a ON a.id = l.appointment_id;

-- Monthly revenue summary
CREATE OR REPLACE VIEW monthly_revenue AS
SELECT
  clinic_id,
  date_trunc('month', date) AS month,
  SUM(revenue_generated) AS total_revenue,
  SUM(appts_completed)   AS completed_appointments,
  SUM(leads_total)       AS total_leads,
  SUM(appts_booked)      AS total_booked,
  ROUND(AVG(conversion_lead_to_appt), 1) AS avg_conversion_rate
FROM analytics_events
GROUP BY clinic_id, date_trunc('month', date)
ORDER BY month DESC;

-- ─────────────────────────────────────────────────────────────────
-- SEED: Default subscription plans reference data
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE subscription_plans (
  plan          subscription_plan PRIMARY KEY,
  display_name  TEXT NOT NULL,
  price_monthly INTEGER NOT NULL,  -- in INR paise (e.g. 299900 = ₹2999)
  price_yearly  INTEGER NOT NULL,
  max_leads_per_month INTEGER,
  max_channels  INTEGER,
  features      TEXT[]
);

INSERT INTO subscription_plans VALUES
('starter',    'Starter',    199900,  1999900,  200,  2, ARRAY['WhatsApp + Web chat','AI conversations','Basic CRM','Email support']),
('growth',     'Growth',     299900,  2999900,  1000, 4, ARRAY['All channels','AI conversations','Full CRM','Reminders & follow-ups','Analytics dashboard','Priority support']),
('enterprise', 'Enterprise', 499900, 4999900,  NULL, 5, ARRAY['Unlimited leads','All channels','White-label','Custom AI training','Dedicated support','API access']);
