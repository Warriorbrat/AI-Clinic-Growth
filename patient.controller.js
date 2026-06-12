const { Patients } = require('../config/db');
const { success, created, notFound, badRequest, paginated } = require('../utils/response');

const PatientController = {
  async list(req, res, next) {
    try {
      const { page, limit, search } = req.query;
      const result = await Patients.list(req.clinicId, { page, limit, search });
      return paginated(res, result.patients, { total: result.total, page: result.page, limit: result.limit, totalPages: Math.ceil(result.total / result.limit) });
    } catch (err) { next(err); }
  },

  async stats(req, res, next) {
    try {
      const { supabase } = require('../config/supabase');
      const { data: patients } = await supabase.from('patients').select('total_revenue, total_appointments, completed_appointments').eq('clinic_id', req.clinicId);
      const total    = patients?.length || 0;
      const revenue  = (patients||[]).reduce((s,p) => s + Number(p.total_revenue||0), 0);
      const avgRev   = total > 0 ? revenue / total : 0;
      const returning= (patients||[]).filter(p => (p.total_appointments||0) > 1).length;
      return success(res, { total, totalRevenue: revenue, avgRevenuePerPatient: Math.round(avgRev), returningPatients: returning, retentionRate: total > 0 ? +((returning/total)*100).toFixed(1) : 0 });
    } catch (err) { next(err); }
  },

  async getOne(req, res, next) {
    try {
      const profile = await Patients.getProfile(req.params.id, req.clinicId);
      if (!profile?.patient) return notFound(res, 'Patient not found');
      return success(res, profile);
    } catch (err) { next(err); }
  },

  async convert(req, res, next) {
    try {
      const { leadId, appointmentId } = req.body;
      if (!leadId) return badRequest(res, 'leadId required');
      const { supabase } = require('../config/supabase');
      const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).eq('clinic_id', req.clinicId).single();
      if (!lead) return notFound(res, 'Lead not found');
      const patient = await Patients.findOrCreate({ clinic_id: req.clinicId, lead_id: leadId, name: lead.name||'Patient', phone: lead.phone, email: lead.email, preferred_channel: lead.channel });
      await supabase.from('leads').update({ patient_id: patient.id, status: 'converted' }).eq('id', leadId);
      if (appointmentId) await supabase.from('appointments').update({ patient_id: patient.id }).eq('id', appointmentId);
      return created(res, patient, 'Lead converted to patient');
    } catch (err) { next(err); }
  },

  async recordVisit(req, res, next) {
    try {
      const { revenue, treatment, is_no_show } = req.body;
      const patient = await Patients.recordVisit(req.params.id, req.clinicId, { revenue: Number(revenue||0), treatment, is_no_show });
      if (!patient) return notFound(res, 'Patient not found');
      return success(res, patient, 'Visit recorded');
    } catch (err) { next(err); }
  },
};

module.exports = PatientController;
