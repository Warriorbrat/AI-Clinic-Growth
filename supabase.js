const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const logger = require('../utils/logger');

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY         = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

/**
 * Service role client — used by the backend for all DB operations.
 * Bypasses RLS — only use server-side, never expose to frontend.
 */
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  db:   { schema: 'public' },
});

/**
 * Anon client — for operations that should respect RLS.
 */
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

/**
 * Test connection on startup.
 */
const testConnection = async () => {
  const { error } = await supabase.from('clinics').select('id').limit(1);
  if (error) {
    logger.error('Supabase connection test failed:', error.message);
    throw new Error(`Supabase connection failed: ${error.message}`);
  }
  logger.info('Supabase connected ✓');
};

/**
 * Thin query helper — throws on error, returns data directly.
 * Saves boilerplate null-checking throughout services.
 */
const query = async (fn) => {
  const { data, error } = await fn(supabase);
  if (error) throw Object.assign(new Error(error.message), { code: error.code, details: error.details });
  return data;
};

/**
 * Upsert a daily analytics counter field — used heavily by services.
 * Inserts row if missing, increments the field atomically.
 */
const incrementAnalytic = async (clinicId, field, amount = 1) => {
  const today = new Date().toISOString().split('T')[0];
  // Use Postgres RPC for atomic increment
  const { error } = await supabase.rpc('increment_analytic', {
    p_clinic_id: clinicId,
    p_date:      today,
    p_field:     field,
    p_amount:    amount,
  });
  if (error) logger.warn('Analytics increment failed:', error.message);
};

module.exports = { supabase, supabaseAnon, query, testConnection, incrementAnalytic };
