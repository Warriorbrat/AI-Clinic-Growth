/**
 * Supabase Data Layer
 * Replaces all Mongoose model calls with typed Supabase queries.
 * Every function maps 1:1 to what the controllers and services expect.
 */
const { supabase, query, incrementAnalytic } = require('../config/supabase');
const { normalisePhone } = require('../utils/phone.utils');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════
// CLINICS
// ═══════════════════════════════════════════════════════════════
const Clinics = {
  async findByEmail(email) {
    const { data } = await supabase.from('clinics').select('*').eq('email', email.toLowerCase()).single();
    return data;
  },

  async findById(id, includeSecrets = false) {
    let q = supabase.from('clinics').select('*').eq('id', id).single();
    const { data } = await q;
    if (!data) return null;
    if (!includeSecrets) {
      delete data.password_hash;
      delete data.google_access_token;
      delete data.google_refresh_token;
      delete data.supabase_service_role_key;
    }
    return data;
  },

  async create({ name, email, password, phone, timezone }) {
    const password_hash = await bcrypt.hash(password, 12);
    return query(sb => sb.from('clinics').insert({
      name, email: email.toLowerCase(), password_hash, phone,
      timezone: timezone || 'Asia/Kolkata',
    }).select('id,name,email,phone,timezone,subscription_plan,created_at').single());
  },

  async update(id, fields) {
    return query(sb => sb.from('clinics').update(fields).eq('id', id)
      .select('id,name,email,phone,address,timezone,working_hours,services,staff,ai_config,subscription_plan,google_calendar_id,whatsapp_number,twilio_phone_number')
      .single());
  },

  async comparePassword(clinic, candidate) {
    const { data } = await supabase.from('clinics').select('password_hash').eq('id', clinic.id).single();
    return bcrypt.compare(candidate, data.password_hash);
  },

  async setGoogleTokens(id, { access_token, refresh_token, expiry_date }) {
    return supabase.from('clinics').update({
      google_access_token:  access_token,
      google_refresh_token: refresh_token,
      google_token_expiry:  new Date(expiry_date).toISOString(),
    }).eq('id', id);
  },
};

// ═══════════════════════════════════════════════════════════════
// LEADS
// ═══════════════════════════════════════════════════════════════
const Leads = {
  async findOrCreate({ clinic_id, channel, channel_user_id, phone, name }) {
    // Try to find existing active lead for this channel user
    const { data: existing } = await supabase
      .from('leads').select('*')
      .eq('clinic_id', clinic_id).eq('channel', channel).eq('channel_user_id', channel_user_id)
      .single();

    if (existing) {
      await supabase.from('leads').update({
        last_contact_at: new Date().toISOString(),
        contact_count:   (existing.contact_count || 0) + 1,
      }).eq('id', existing.id);
      return { ...existing, contact_count: (existing.contact_count || 0) + 1 };
    }

    const { data: created } = await supabase.from('leads').insert({
      clinic_id, channel, channel_user_id,
      phone: normalisePhone(phone),
      name,
      status:          'new',
      last_contact_at: new Date().toISOString(),
    }).select().single();

    // Track in analytics
    await incrementAnalytic(clinic_id, 'leads_total');
    logger.info('New lead created', { leadId: created.id, channel, clinic_id });
    return created;
  },

  async findById(id, clinic_id) {
    return query(sb => sb.from('leads').select(`
      *,
      conversation:conversations(id, stage, status, updated_at),
      appointment:appointments(id, scheduled_at, status, confirmation_code)
    `).eq('id', id).eq('clinic_id', clinic_id).single());
  },

  async list(clinic_id, { page = 1, limit = 20, status, channel, search, date_from, date_to } = {}) {
    let q = supabase.from('leads').select('*', { count: 'exact' })
      .eq('clinic_id', clinic_id).order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status)   q = q.eq('status', status);
    if (channel)  q = q.eq('channel', channel);
    if (date_from) q = q.gte('created_at', date_from);
    if (date_to)   q = q.lte('created_at', date_to);
    if (search)    q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);

    const { data, count, error } = await q;
    if (error) throw new Error(error.message);
    return { leads: data, total: count, page: Number(page), limit: Number(limit) };
  },

  async update(id, clinic_id, fields) {
    let q = supabase.from('leads').update(fields).eq('id', id);
    if (clinic_id) q = q.eq('clinic_id', clinic_id);
    return query(sb => q.select().single());
  },

  async addNote(id, clinic_id, text, created_by = 'staff') {
    // Append to JSONB notes array
    const { data: lead } = await supabase.from('leads').select('notes').eq('id', id).single();
    const notes = [...(lead.notes || []), { text, created_by, created_at: new Date().toISOString() }];
    return query(sb => sb.from('leads').update({ notes }).eq('id', id).eq('clinic_id', clinic_id).select().single());
  },

  async updateQualification(id, { name, phone, email, treatment_interest, urgency, budget_intent, preferred_times, pain_points }) {
    const fields = {};
    if (name)               fields.name = name;
    if (phone)              fields.phone = normalisePhone(phone) || phone;
    if (email)              fields.email = email;
    if (treatment_interest) fields.treatment_interest = treatment_interest;
    if (urgency)            fields.urgency = urgency;
    if (budget_intent)      fields.budget_intent = budget_intent;
    if (preferred_times?.length) fields.preferred_times = preferred_times;
    if (pain_points?.length)     fields.pain_points = pain_points;
    if (Object.keys(fields).length === 0) return;
    await supabase.from('leads').update(fields).eq('id', id);
  },

  async getStats(clinic_id, date_from) {
    const { data } = await supabase.rpc('get_lead_stats', {
      p_clinic_id: clinic_id,
      p_date_from: date_from,
    });
    return data;
  },
};

// ═══════════════════════════════════════════════════════════════
// CONVERSATIONS
// ═══════════════════════════════════════════════════════════════
const Conversations = {
  async findOrCreate({ clinic_id, lead_id, channel, channel_user_id }) {
    const { data: existing } = await supabase
      .from('conversations').select('*')
      .eq('clinic_id', clinic_id).eq('lead_id', lead_id).eq('status', 'active')
      .single();

    if (existing) return existing;

    const { data: created } = await supabase.from('conversations').insert({
      clinic_id, lead_id, channel, channel_user_id,
      messages: [], stage: 'greeting', extracted_data: {}, flags: [],
    }).select().single();

    await supabase.from('leads').update({ conversation_id: created.id }).eq('id', lead_id);
    return created;
  },

  async findById(id, clinic_id) {
    return query(sb => sb.from('conversations').select(`
      *,
      lead:leads(id, name, phone, channel, status, score)
    `).eq('id', id).eq('clinic_id', clinic_id).single());
  },

  async list(clinic_id, { page = 1, limit = 20, lead_id, status } = {}) {
    let q = supabase.from('conversations').select(`
      id, clinic_id, lead_id, channel, stage, status, updated_at,
      lead:leads(id, name, phone, channel, status, score)
    `, { count: 'exact' })
      .eq('clinic_id', clinic_id)
      .order('updated_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (lead_id) q = q.eq('lead_id', lead_id);
    if (status)  q = q.eq('status', status);

    const { data, count, error } = await q;
    if (error) throw new Error(error.message);
    return { conversations: data, total: count, page: Number(page), limit: Number(limit) };
  },

  async appendMessage(id, role, content, metadata = {}) {
    const { data: conv } = await supabase.from('conversations').select('messages').eq('id', id).single();
    const messages = [...(conv.messages || []), { role, content, metadata, timestamp: new Date().toISOString() }];
    await supabase.from('conversations').update({ messages }).eq('id', id);
  },

  async updateContext(id, { stage, extracted_data, last_ai_output, flags, booking_attempts_inc }) {
    const updates = {};
    if (stage)           updates.stage = stage;
    if (extracted_data)  updates.extracted_data = extracted_data;
    if (last_ai_output)  updates.last_ai_output = last_ai_output;
    if (flags)           updates.flags = flags;
    if (booking_attempts_inc) {
      const { data } = await supabase.from('conversations').select('booking_attempts').eq('id', id).single();
      updates.booking_attempts = (data.booking_attempts || 0) + 1;
    }
    await supabase.from('conversations').update(updates).eq('id', id);
  },
};

// ═══════════════════════════════════════════════════════════════
// APPOINTMENTS
// ═══════════════════════════════════════════════════════════════
const Appointments = {
  async create({ clinic_id, lead_id, patient_name, phone, email, treatment, scheduled_at, duration_min = 30, source = 'ai', staff_id, staff_name }) {
    const appt = await query(sb => sb.from('appointments').insert({
      clinic_id, lead_id, patient_name,
      phone: normalisePhone(phone) || phone,
      email, treatment,
      scheduled_at: new Date(scheduled_at).toISOString(),
      duration_min, source, staff_id, staff_name,
    }).select().single());

    await incrementAnalytic(clinic_id, 'appts_booked');
    return appt;
  },

  async list(clinic_id, { page = 1, limit = 20, status, date_from, date_to } = {}) {
    let q = supabase.from('appointments').select(`
      *, lead:leads(id, name, channel, status, score)
    `, { count: 'exact' })
      .eq('clinic_id', clinic_id)
      .order('scheduled_at', { ascending: true })
      .range((page - 1) * limit, page * limit - 1);

    if (status)    q = q.eq('status', status);
    if (date_from) q = q.gte('scheduled_at', date_from);
    if (date_to)   q = q.lte('scheduled_at', date_to);

    const { data, count, error } = await q;
    if (error) throw new Error(error.message);
    return { appointments: data, total: count, page: Number(page), limit: Number(limit) };
  },

  async findById(id, clinic_id) {
    return query(sb => sb.from('appointments').select('*, lead:leads(*)').eq('id', id).eq('clinic_id', clinic_id).single());
  },

  async updateStatus(id, clinic_id, status, extras = {}) {
    const fields = { status, ...extras };
    const appt = await query(sb => sb.from('appointments').update(fields).eq('id', id).eq('clinic_id', clinic_id).select().single());

    if (status === 'completed' && extras.revenue) {
      await incrementAnalytic(clinic_id, 'appts_completed');
      await incrementAnalytic(clinic_id, 'revenue_generated', extras.revenue);
    }
    if (status === 'no_show')   await incrementAnalytic(clinic_id, 'appts_no_shows');
    if (status === 'cancelled') await incrementAnalytic(clinic_id, 'appts_cancelled');
    return appt;
  },

  async appendReminder(id, reminder) {
    const { data } = await supabase.from('appointments').select('reminders').eq('id', id).single();
    const reminders = [...(data.reminders || []), { ...reminder, sent_at: new Date().toISOString() }];
    await supabase.from('appointments').update({ reminders }).eq('id', id);
  },

  async getForNoShowRecovery() {
    const now = new Date().toISOString();
    const { data } = await supabase.from('appointments').select('*, clinic:clinics(name,phone,address,timezone)')
      .eq('status', 'no_show')
      .eq('no_show_recovery_sent', false)
      .lte('no_show_recovery_at', now)
      .limit(50);
    return data || [];
  },

  async getForReminder(hoursAhead) {
    const { data } = await supabase.rpc('get_appointments_for_reminder', {
      p_hours_ahead: hoursAhead,
      p_window_minutes: 30,
    });
    return data || [];
  },
};

// ═══════════════════════════════════════════════════════════════
// PATIENTS
// ═══════════════════════════════════════════════════════════════
const Patients = {
  async findOrCreate({ clinic_id, lead_id, name, phone, email, preferred_channel }) {
    const normPhone = normalisePhone(phone);
    const { data: existing } = await supabase.from('patients').select('*')
      .eq('clinic_id', clinic_id).eq('phone', normPhone).single();

    if (existing) return existing;

    return query(sb => sb.from('patients').insert({
      clinic_id, lead_id, name,
      phone: normPhone, email, preferred_channel,
      first_visit_at: new Date().toISOString(),
    }).select().single());
  },

  async getProfile(id, clinic_id) {
    const { data: patient } = await supabase
      .from('patients').select('*')
      .eq('id', id).eq('clinic_id', clinic_id).single();

    if (!patient) return { patient: null, appointments: [], conversations: [] };

    const [{ data: appointments }, { data: conversations }] = await Promise.all([
      supabase.from('appointments').select('*')
        .eq('patient_id', id).order('scheduled_at', { ascending: false }).limit(20),
      patient.lead_id
        ? supabase.from('conversations')
            .select('id, stage, status, channel, updated_at')
            .eq('lead_id', patient.lead_id).order('updated_at', { ascending: false }).limit(10)
        : Promise.resolve({ data: [] }),
    ]);

    return { patient, appointments: appointments || [], conversations: conversations || [] };
  },

  async list(clinic_id, { page = 1, limit = 20, search } = {}) {
    let q = supabase.from('patients').select('*', { count: 'exact' })
      .eq('clinic_id', clinic_id).order('last_visit_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (search) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    const { data, count, error } = await q;
    if (error) throw new Error(error.message);
    return { patients: data, total: count, page: Number(page), limit: Number(limit) };
  },

  async recordVisit(id, clinic_id, { revenue = 0, treatment, is_no_show = false }) {
    const { data } = await supabase.from('patients').select('*').eq('id', id).single();
    const updates = {
      total_appointments:     (data.total_appointments || 0) + 1,
      completed_appointments: (data.completed_appointments || 0) + (is_no_show ? 0 : 1),
      no_shows:               (data.no_shows || 0) + (is_no_show ? 1 : 0),
      total_revenue:          Number(data.total_revenue || 0) + (is_no_show ? 0 : revenue),
      last_visit_at:          new Date().toISOString(),
    };
    if (treatment && !is_no_show) {
      updates.treatment_history = [...new Set([...(data.treatment_history || []), treatment])];
    }
    return query(sb => sb.from('patients').update(updates).eq('id', id).eq('clinic_id', clinic_id).select().single());
  },
};

// ═══════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════
const Analytics = {
  async getOverview(clinic_id, date_from) {
    const [leadStats, apptStats, revenueData] = await Promise.all([
      supabase.rpc('get_lead_stats', { p_clinic_id: clinic_id, p_date_from: date_from }),
      supabase.from('appointments').select('status,revenue').eq('clinic_id', clinic_id).gte('created_at', date_from),
      supabase.from('appointments').select('revenue').eq('clinic_id', clinic_id).eq('status', 'completed').gte('created_at', date_from),
    ]);

    const appts   = apptStats.data || [];
    const revenue = (revenueData.data || []).reduce((s, a) => s + Number(a.revenue || 0), 0);
    const completed = appts.filter(a => a.status === 'completed').length;
    const noShows   = appts.filter(a => a.status === 'no_show').length;
    const leads = leadStats.data || {};

    return {
      leads: {
        ...leads,
        conversionRate: leads.total > 0 ? Number(((leads.booked / leads.total) * 100).toFixed(1)) : 0,
      },
      appointments: {
        total:     appts.length,
        completed,
        no_shows:  noShows,
        showRate:  appts.length > 0 ? Number(((completed / appts.length) * 100).toFixed(1)) : 0,
      },
      revenue: { generated: revenue },
    };
  },

  async getFunnel(clinic_id, date_from) {
    const [total, qualified, booked, completed] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('clinic_id', clinic_id).gte('created_at', date_from),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('clinic_id', clinic_id).in('status', ['hot','warm','appointment_set','converted']).gte('created_at', date_from),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('clinic_id', clinic_id).in('status', ['appointment_set','converted']).gte('created_at', date_from),
      supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('clinic_id', clinic_id).eq('status', 'completed').gte('created_at', date_from),
    ]);

    const t = total.count || 0;
    const pct = (n) => t > 0 ? Number(((n / t) * 100).toFixed(1)) : 0;
    return [
      { stage: 'Enquiries Received',  count: t,                  pct: 100 },
      { stage: 'Leads Qualified',     count: qualified.count||0, pct: pct(qualified.count||0) },
      { stage: 'Appointments Booked', count: booked.count||0,    pct: pct(booked.count||0) },
      { stage: 'Patients Showed Up',  count: completed.count||0, pct: pct(completed.count||0) },
    ];
  },

  async getRevenueSeries(clinic_id) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data } = await supabase.from('appointments').select('scheduled_at, revenue')
      .eq('clinic_id', clinic_id).eq('status', 'completed')
      .gte('scheduled_at', thirtyDaysAgo).gt('revenue', 0);

    const map = {};
    (data || []).forEach(a => {
      const d = a.scheduled_at.split('T')[0];
      map[d] = (map[d] || 0) + Number(a.revenue);
    });
    return Object.entries(map).sort().map(([date, revenue]) => ({ date, revenue }));
  },

  async getChannelBreakdown(clinic_id, date_from) {
    const { data } = await supabase.rpc('get_channel_breakdown', {
      p_clinic_id: clinic_id,
      p_date_from: date_from,
    });
    return data || [];
  },
};

// ═══════════════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════════════
const Payments = {
  async create(record) {
    return query(sb => sb.from('payments').insert(record).select().single());
  },

  async updateByOrderId(order_id, fields) {
    return supabase.from('payments').update(fields).eq('razorpay_order_id', order_id);
  },

  async listByClinic(clinic_id, limit = 12) {
    return query(sb => sb.from('payments').select('*').eq('clinic_id', clinic_id)
      .order('created_at', { ascending: false }).limit(limit));
  },

  async getPlans() {
    return query(sb => sb.from('subscription_plans').select('*').order('price_monthly'));
  },
};

module.exports = { Clinics, Leads, Conversations, Appointments, Patients, Analytics, Payments };
