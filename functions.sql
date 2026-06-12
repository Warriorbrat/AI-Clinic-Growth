-- ═══════════════════════════════════════════════════════════════
-- SUPABASE RPC FUNCTIONS
-- Run in Supabase SQL Editor after running schema.sql
-- ═══════════════════════════════════════════════════════════════

-- Atomic analytics counter increment
-- Called by backend for every lead/appointment/revenue event
CREATE OR REPLACE FUNCTION increment_analytic(
  p_clinic_id UUID,
  p_date      DATE,
  p_field     TEXT,
  p_amount    NUMERIC DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO analytics_events(clinic_id, date)
  VALUES (p_clinic_id, p_date)
  ON CONFLICT (clinic_id, date) DO NOTHING;

  EXECUTE format(
    'UPDATE analytics_events SET %I = %I + $1 WHERE clinic_id = $2 AND date = $3',
    p_field, p_field
  ) USING p_amount, p_clinic_id, p_date;
END;
$$;

-- Fast lead stats aggregation (used by dashboard overview)
CREATE OR REPLACE FUNCTION get_lead_stats(
  p_clinic_id UUID,
  p_date_from TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total',     COUNT(*),
    'hot',       COUNT(*) FILTER (WHERE status = 'hot'),
    'warm',      COUNT(*) FILTER (WHERE status = 'warm'),
    'cold',      COUNT(*) FILTER (WHERE status = 'cold'),
    'emergency', COUNT(*) FILTER (WHERE status = 'emergency'),
    'booked',    COUNT(*) FILTER (WHERE status = 'appointment_set'),
    'converted', COUNT(*) FILTER (WHERE status = 'converted')
  ) INTO result
  FROM leads
  WHERE clinic_id = p_clinic_id
    AND created_at >= p_date_from;

  RETURN result;
END;
$$;

-- Channel conversion breakdown
CREATE OR REPLACE FUNCTION get_channel_breakdown(
  p_clinic_id UUID,
  p_date_from TIMESTAMPTZ
)
RETURNS TABLE(channel TEXT, total BIGINT, booked BIGINT, conversion_rate NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.channel::TEXT,
    COUNT(*)                                                           AS total,
    COUNT(*) FILTER (WHERE l.status IN ('appointment_set','converted')) AS booked,
    ROUND(
      COUNT(*) FILTER (WHERE l.status IN ('appointment_set','converted'))::NUMERIC
      / NULLIF(COUNT(*), 0) * 100, 1
    )                                                                  AS conversion_rate
  FROM leads l
  WHERE l.clinic_id = p_clinic_id
    AND l.created_at >= p_date_from
  GROUP BY l.channel;
END;
$$;

-- Find appointments needing 24h reminder
CREATE OR REPLACE FUNCTION get_appointments_for_reminder(
  p_hours_ahead INTEGER,
  p_window_minutes INTEGER DEFAULT 30
)
RETURNS SETOF appointments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT a.*
  FROM appointments a
  WHERE
    a.scheduled_at BETWEEN
      NOW() + (p_hours_ahead || ' hours')::INTERVAL - (p_window_minutes || ' minutes')::INTERVAL
      AND NOW() + (p_hours_ahead || ' hours')::INTERVAL + (p_window_minutes || ' minutes')::INTERVAL
    AND a.status IN ('pending', 'confirmed', 'reminded_24h')
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(a.reminders) r
      WHERE r->>'type' = (p_hours_ahead || 'h')
    );
END;
$$;
