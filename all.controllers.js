/**
 * all.controllers.js — Supabase version
 * All controllers rewritten to use db.js (Supabase) instead of Mongoose models.
 */
const { Leads, Conversations, Appointments, Analytics, Clinics } = require('../config/db');
const { success, created, notFound, badRequest, paginated }       = require('../utils/response');
const { signToken }          = require('../middlewares/auth.middleware');
const { getAuthUrl, exchangeCodeForTokens, getAvailableSlots } = require('../services/booking/calendar.service');

// ─────────────────────────────────────────────────────────────────────────────
// LEAD CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────
const LeadController = {
  async list(req, res, next) {
    try {
      const { page, limit, status, channel, search, dateFrom, dateTo } = req.query;
      const result = await Leads.list(req.clinicId, { page, limit, status, channel, search, date_from: dateFrom, date_to: dateTo });
      return paginated(res, result.leads, { total: result.total, page: result.page, limit: result.limit, totalPages: Math.ceil(result.total / result.limit) });
    } catch (err) { next(err); }
  },

  async getOne(req, res, next) {
    try {
      const lead = await Leads.findById(req.params.id, req.clinicId);
      if (!lead) return notFound(res, 'Lead not found');
      return success(res, lead);
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const allowed = ['status','score','follow_up_at','tags','is_escalated','name','phone','email'];
      const fields  = {};
      for (const k of allowed) if (req.body[k] !== undefined) fields[k] = req.body[k];
      const lead = await Leads.update(req.params.id, req.clinicId, fields);
      if (!lead) return notFound(res, 'Lead not found');
      return success(res, lead, 'Lead updated');
    } catch (err) { next(err); }
  },

  async addNote(req, res, next) {
    try {
      const { text } = req.body;
      if (!text) return badRequest(res, 'Note text required');
      const lead = await Leads.addNote(req.params.id, req.clinicId, text, 'staff');
      if (!lead) return notFound(res, 'Lead not found');
      return success(res, lead, 'Note added');
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      await Leads.update(req.params.id, req.clinicId, { status: 'lost' });
      return success(res, null, 'Lead marked as lost');
    } catch (err) { next(err); }
  },

  async stats(req, res, next) {
    try {
      const now = new Date();
      const period = req.query.period || 'month';
      const dateFrom = period === 'today'
        ? new Date(now.setHours(0,0,0,0)).toISOString()
        : period === 'week'
          ? new Date(Date.now() - 7*86400000).toISOString()
          : new Date(Date.now() - 30*86400000).toISOString();
      const stats = await Leads.getStats(req.clinicId, dateFrom);
      return success(res, stats);
    } catch (err) { next(err); }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────
const ConversationController = {
  async list(req, res, next) {
    try {
      const { page, limit, leadId, status } = req.query;
      const result = await Conversations.list(req.clinicId, { page, limit, lead_id: leadId, status });
      return paginated(res, result.conversations, { total: result.total, page: result.page, limit: result.limit, totalPages: Math.ceil(result.total / result.limit) });
    } catch (err) { next(err); }
  },

  async getOne(req, res, next) {
    try {
      const conv = await Conversations.findById(req.params.id, req.clinicId);
      if (!conv) return notFound(res, 'Conversation not found');
      return success(res, conv);
    } catch (err) { next(err); }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// APPOINTMENT CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────
const AppointmentController = {
  async list(req, res, next) {
    try {
      const { page, limit, status, dateFrom, dateTo } = req.query;
      const result = await Appointments.list(req.clinicId, { page, limit, status, date_from: dateFrom, date_to: dateTo });
      return paginated(res, result.appointments, { total: result.total, page: result.page, limit: result.limit, totalPages: Math.ceil(result.total / result.limit) });
    } catch (err) { next(err); }
  },

  async getSlots(req, res, next) {
    try {
      const { date } = req.query;
      if (!date) return badRequest(res, 'date param required (YYYY-MM-DD)');
      const slots = await getAvailableSlots(req.clinicId, new Date(date));
      return success(res, slots);
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const appt = await Appointments.create({ clinic_id: req.clinicId, source: 'staff', ...req.body });
      return created(res, appt, 'Appointment booked');
    } catch (err) { next(err); }
  },

  async getOne(req, res, next) {
    try {
      const appt = await Appointments.findById(req.params.id, req.clinicId);
      if (!appt) return notFound(res, 'Appointment not found');
      return success(res, appt);
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const { status, revenue, cancellation_reason, notes } = req.body;
      const appt = await Appointments.updateStatus(req.params.id, req.clinicId, status, { revenue, cancellation_reason, notes });
      if (!appt) return notFound(res, 'Appointment not found');
      return success(res, appt, 'Appointment updated');
    } catch (err) { next(err); }
  },

  async remind(req, res, next) {
    try {
      const appt = await Appointments.findById(req.params.id, req.clinicId);
      if (!appt) return notFound(res, 'Appointment not found');
      const { sendReminderForAppointment } = require('../services/automation/reminder.service');
      await sendReminderForAppointment(appt, req.clinic, '24h');
      return success(res, null, 'Reminder sent');
    } catch (err) { next(err); }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────
const AnalyticsController = {
  async overview(req, res, next) {
    try {
      const period   = req.query.period || 'month';
      const now      = new Date();
      const dateFrom = period === 'today' ? new Date(now.setHours(0,0,0,0)).toISOString()
                     : period === 'week'  ? new Date(Date.now()-7*86400000).toISOString()
                     :                      new Date(Date.now()-30*86400000).toISOString();
      const data = await Analytics.getOverview(req.clinicId, dateFrom);
      return success(res, { ...data, period });
    } catch (err) { next(err); }
  },

  async funnel(req, res, next) {
    try {
      const dateFrom = new Date(Date.now()-30*86400000).toISOString();
      const data = await Analytics.getFunnel(req.clinicId, dateFrom);
      return success(res, { funnel: data });
    } catch (err) { next(err); }
  },

  async channels(req, res, next) {
    try {
      const dateFrom = new Date(Date.now()-30*86400000).toISOString();
      const data = await Analytics.getChannelBreakdown(req.clinicId, dateFrom);
      return success(res, data);
    } catch (err) { next(err); }
  },

  async revenue(req, res, next) {
    try {
      const data = await Analytics.getRevenueSeries(req.clinicId);
      return success(res, data);
    } catch (err) { next(err); }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CLINIC CONTROLLER (auth + settings)
// ─────────────────────────────────────────────────────────────────────────────
const ClinicController = {
  async register(req, res, next) {
    try {
      const { name, email, password, phone, timezone } = req.body;
      if (!name || !email || !password || !phone) return badRequest(res, 'name, email, password, phone required');
      const existing = await Clinics.findByEmail(email);
      if (existing) return res.status(409).json({ success: false, message: 'Email already registered' });
      const clinic = await Clinics.create({ name, email, password, phone, timezone });
      const token  = signToken(clinic.id);
      return created(res, { clinic, token }, 'Clinic registered — welcome!');
    } catch (err) { next(err); }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      if (!email || !password) return badRequest(res, 'email and password required');
      const clinic = await Clinics.findByEmail(email);
      if (!clinic) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      const ok = await Clinics.comparePassword(clinic, password);
      if (!ok)     return res.status(401).json({ success: false, message: 'Invalid credentials' });
      const token  = signToken(clinic.id);
      delete clinic.password_hash;
      return success(res, { clinic, token }, 'Login successful');
    } catch (err) { next(err); }
  },

  async getProfile(req, res, next) {
    try {
      return success(res, req.clinic);
    } catch (err) { next(err); }
  },

  async updateProfile(req, res, next) {
    try {
      const allowed = ['name','phone','address','timezone','working_hours','services','staff','ai_config'];
      const updates = {};
      for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
      const clinic = await Clinics.update(req.clinicId, updates);
      return success(res, clinic, 'Clinic updated');
    } catch (err) { next(err); }
  },

  async getCalendarAuthUrl(req, res, next) {
    try {
      const url = getAuthUrl();
      return success(res, { url });
    } catch (err) { next(err); }
  },

  async calendarCallback(req, res, next) {
    try {
      const { code } = req.query;
      if (!code) return badRequest(res, 'Authorization code missing');
      const tokens = await exchangeCodeForTokens(code);
      await Clinics.setGoogleTokens(req.clinicId, tokens);
      return success(res, null, 'Google Calendar connected');
    } catch (err) { next(err); }
  },
};

module.exports = { LeadController, AppointmentController, AnalyticsController, ClinicController, ConversationController };
