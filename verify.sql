-- ═══════════════════════════════════════════════════════════════
-- SUPABASE SETUP GUIDE — Run these in order in SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- STEP 1: Run schema.sql   (creates all tables + indexes + RLS)
-- STEP 2: Run functions.sql (creates RPC functions for analytics)
-- STEP 3: Run this file    (seeds plans, verifies setup)

-- ── Verify all tables exist ──────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
-- Expected: analytics_events, appointments, clinics, conversations,
--           leads, patients, payments, subscription_plans

-- ── Verify all functions exist ───────────────────────────────────
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';
-- Expected: increment_analytic, get_lead_stats,
--           get_channel_breakdown, get_appointments_for_reminder, update_updated_at

-- ── Verify subscription plans seeded ────────────────────────────
SELECT plan, display_name, price_monthly/100 as price_inr FROM subscription_plans;

-- ── Test insert a clinic (will be deleted after test) ────────────
INSERT INTO clinics (name, email, password_hash, phone)
VALUES ('Test Clinic', 'test@test.com', 'hash', '+91 00000 00000')
RETURNING id, name, email;

-- Delete it
DELETE FROM clinics WHERE email = 'test@test.com';

-- ── Enable Realtime for conversations (optional — for live dashboard) ──
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;

-- ── Storage bucket for patient documents (optional) ───────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-docs', 'patient-docs', false)
ON CONFLICT DO NOTHING;

-- ── Confirm RLS is enabled ───────────────────────────────────────
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
-- rowsecurity should be 't' (true) for all tables

-- ═══════════════════════════════════════════════════════════════
-- DONE. Your Supabase database is ready.
-- Now fill in .env and run: cd backend && npm install && npm run dev
-- ═══════════════════════════════════════════════════════════════
