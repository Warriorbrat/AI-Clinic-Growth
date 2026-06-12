const express = require('express');
const router  = express.Router();
const { authenticate }   = require('../middlewares/auth.middleware');
const { verifyTwilio }   = require('../middlewares/twilio.middleware');
const webhookCtrl        = require('../controllers/webhook.controller');
const PaymentCtrl        = require('../controllers/payment.controller');
const PatientCtrl        = require('../controllers/patient.controller');
const { handleWebhook: rzpWebhook } = require('../services/payments/razorpay.service');
const { LeadController, AppointmentController, AnalyticsController, ClinicController, ConversationController } = require('../controllers/all.controllers');

const { Clinics } = require('../config/db');
const injectClinic = async (req, res, next) => {
  try {
    const id = req.query.clinicId || req.body.clinicId;
    if (!id) return res.status(400).send('clinicId required');
    const clinic = await Clinics.findById(id);
    if (!clinic) return res.status(404).send('Clinic not found');
    req.clinic = clinic; req.clinicId = clinic.id; next();
  } catch (err) { next(err); }
};

// AUTH
router.post('/auth/register', ClinicController.register);
router.post('/auth/login',    ClinicController.login);

// RAZORPAY WEBHOOK — body is a raw Buffer (set by express.raw in app.js)
// Signature verification uses the raw buffer, JSON parsing done inside handler
router.post('/billing/webhook', rzpWebhook);

// CHANNEL WEBHOOKS
router.post('/webhooks/twilio/voice',    injectClinic, verifyTwilio, webhookCtrl.voiceWebhook);
router.post('/webhooks/twilio/whatsapp', injectClinic, verifyTwilio, webhookCtrl.whatsappWebhook);
router.post('/webhooks/webchat',         injectClinic, webhookCtrl.webchatWebhook);
router.post('/webhooks/form',            injectClinic, webhookCtrl.formWebhook);
router.get( '/webhooks/instagram',       webhookCtrl.instagramVerify);
router.post('/webhooks/instagram',       injectClinic, webhookCtrl.instagramWebhook);

// CLINIC
router.get(   '/clinic',                   authenticate, ClinicController.getProfile);
router.patch( '/clinic',                   authenticate, ClinicController.updateProfile);
router.get(   '/clinic/calendar/auth',     authenticate, ClinicController.getCalendarAuthUrl);
router.get(   '/clinic/calendar/callback', authenticate, ClinicController.calendarCallback);

// BILLING
router.get( '/billing/plans',   (req,res,next) => next(), PaymentCtrl.plans);
router.get( '/billing/status',  authenticate, PaymentCtrl.status);
router.get( '/billing/history', authenticate, PaymentCtrl.history);
router.post('/billing/order',   authenticate, PaymentCtrl.createOrder);
router.post('/billing/verify',  authenticate, PaymentCtrl.verifyPayment);

// LEADS
router.get(   '/leads',           authenticate, LeadController.list);
router.get(   '/leads/stats',     authenticate, LeadController.stats);
router.get(   '/leads/:id',       authenticate, LeadController.getOne);
router.patch( '/leads/:id',       authenticate, LeadController.update);
router.post(  '/leads/:id/notes', authenticate, LeadController.addNote);
router.delete('/leads/:id',       authenticate, LeadController.remove);

// CONVERSATIONS
router.get('/conversations',     authenticate, ConversationController.list);
router.get('/conversations/:id', authenticate, ConversationController.getOne);

// APPOINTMENTS
router.get(  '/appointments',            authenticate, AppointmentController.list);
router.get(  '/appointments/slots',      authenticate, AppointmentController.getSlots);
router.post( '/appointments',            authenticate, AppointmentController.create);
router.get(  '/appointments/:id',        authenticate, AppointmentController.getOne);
router.patch('/appointments/:id',        authenticate, AppointmentController.update);
router.post( '/appointments/:id/remind', authenticate, AppointmentController.remind);

// CRM
router.get( '/crm/patients',           authenticate, PatientCtrl.list);
router.get( '/crm/patients/stats',     authenticate, PatientCtrl.stats);
router.get( '/crm/patients/:id',       authenticate, PatientCtrl.getOne);
router.post('/crm/patients/convert',   authenticate, PatientCtrl.convert);
router.post('/crm/patients/:id/visit', authenticate, PatientCtrl.recordVisit);

// ANALYTICS
router.get('/analytics/overview', authenticate, AnalyticsController.overview);
router.get('/analytics/funnel',   authenticate, AnalyticsController.funnel);
router.get('/analytics/channels', authenticate, AnalyticsController.channels);
router.get('/analytics/revenue',  authenticate, AnalyticsController.revenue);

module.exports = router;
