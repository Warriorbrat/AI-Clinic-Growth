/**
 * webhook.controller.js — Supabase version
 * Central message processing pipeline for all inbound channels.
 */
const { parseWhatsAppWebhook, buildVoiceTwiml, buildVoiceEndTwiml, parseVoiceWebhook, sendWhatsApp } = require('../services/channels/twilio.service');
const { parseInstagramWebhook, sendInstagramMessage, getInstagramUserName } = require('../services/channels/instagram.service');
const { processMessage }         = require('../services/ai/claude.service');
const { findOrCreateLead, findOrCreateConversation, appendMessage, processAiOutput } = require('../services/ai/lead-qualifier-sb.service');
const { getAvailableSlots }      = require('../services/booking/calendar.service');
const { Appointments }           = require('../config/db');
const { sendConfirmation }       = require('../services/booking/confirmation.service');
const { normalisePhone }         = require('../utils/phone.utils');
const logger = require('../utils/logger');

// ─── Core pipeline ─────────────────────────────────────────────────────────
const handleInboundMessage = async ({ clinicId, clinic, channel, channelUserId, phone, name, userMessage, metadata = {} }) => {
  const lead         = await findOrCreateLead({ clinicId, channel, channelUserId, phone, name });
  const conversation = await findOrCreateConversation({ clinicId, leadId: lead.id, channel, channelUserId });

  await appendMessage(conversation.id, 'user', userMessage, metadata);

  // Pre-fetch available slots if near booking stage
  let availableSlots = [];
  const stage = conversation.stage || conversation.context?.stage || 'greeting';
  if (['qualification','booking','objection_handling'].includes(stage)) {
    try {
      const tomorrow = new Date(Date.now() + 86400000);
      const slots    = await getAvailableSlots(clinicId, tomorrow);
      availableSlots = (slots || []).slice(0, 5).map(s => s.label);
    } catch { /* calendar not connected yet */ }
  }

  const aiOutput = await processMessage({ clinic, conversation, userMessage, availableSlots });
  await processAiOutput(lead.id, conversation.id, aiOutput);
  await appendMessage(conversation.id, 'assistant', aiOutput.reply);

  if (aiOutput.nextAction === 'confirm_booking' && aiOutput.extractedData?.preferredTimes?.length > 0) {
    handleBookingConfirmation({ clinicId, lead, aiOutput, clinic, channel }).catch(e => logger.error('Auto-booking failed', e));
  }

  return { aiOutput, leadId: lead.id, conversationId: conversation.id };
};

const handleBookingConfirmation = async ({ clinicId, lead, aiOutput, clinic, channel }) => {
  const ex = aiOutput.extractedData;
  const appointment = await Appointments.create({
    clinic_id:    clinicId,
    lead_id:      lead.id,
    patient_name: ex.name || lead.name || 'Patient',
    phone:        ex.phone || lead.phone,
    email:        ex.email || lead.email,
    treatment:    ex.treatmentInterest,
    scheduled_at: new Date(Date.now() + 86400000).toISOString(), // next day placeholder
    source:       'ai',
  });
  await sendConfirmation({ appointment, clinic, channel });
};

// ─── WhatsApp ─────────────────────────────────────────────────────────────
exports.whatsappWebhook = async (req, res) => {
  res.status(200).send('OK');
  try {
    const parsed = parseWhatsAppWebhook(req.body);
    if (!parsed.messageBody) return;
    const { aiOutput } = await handleInboundMessage({
      clinicId: req.clinicId, clinic: req.clinic,
      channel: 'whatsapp', channelUserId: parsed.from,
      phone: normalisePhone(parsed.from), name: parsed.profileName,
      userMessage: parsed.messageBody, metadata: { messageSid: parsed.messageSid },
    });
    await sendWhatsApp(parsed.from, aiOutput.reply);
  } catch (err) { logger.error('WhatsApp webhook error', err); }
};

// ─── Voice ────────────────────────────────────────────────────────────────
exports.voiceWebhook = async (req, res) => {
  try {
    const parsed = parseVoiceWebhook(req.body);
    const { aiOutput } = await handleInboundMessage({
      clinicId: req.clinicId, clinic: req.clinic,
      channel: 'voice', channelUserId: parsed.callSid,
      phone: normalisePhone(parsed.from), userMessage: parsed.speechText || 'Hello',
      metadata: { callSid: parsed.callSid },
    });
    const webhookUrl = `${req.protocol}://${req.get('host')}/api/v1/webhooks/twilio/voice?clinicId=${req.clinicId}`;
    res.set('Content-Type', 'text/xml');
    res.send(buildVoiceTwiml(aiOutput.reply, webhookUrl));
  } catch (err) {
    logger.error('Voice webhook error', err);
    res.set('Content-Type', 'text/xml');
    res.send(buildVoiceEndTwiml("I'm having trouble right now. Please send us a WhatsApp message or call back shortly."));
  }
};

// ─── Web Chat ─────────────────────────────────────────────────────────────
exports.webchatWebhook = async (req, res) => {
  try {
    const { message, sessionId, name, phone } = req.body;
    if (!message || !sessionId) return res.status(400).json({ success: false, message: 'message and sessionId required' });
    const { aiOutput } = await handleInboundMessage({
      clinicId: req.clinicId, clinic: req.clinic,
      channel: 'webchat', channelUserId: sessionId,
      phone: normalisePhone(phone), name, userMessage: message,
    });
    return res.json({ success: true, reply: aiOutput.reply, stage: aiOutput.stage, nextAction: aiOutput.nextAction });
  } catch (err) {
    logger.error('Webchat error', err);
    return res.status(500).json({ success: false, reply: "Sorry, I'm having trouble right now. Please try again in a moment." });
  }
};

// ─── Form ─────────────────────────────────────────────────────────────────
exports.formWebhook = async (req, res) => {
  try {
    const { name, phone, email, message, treatment, sourceUrl } = req.body;
    const normPhone = normalisePhone(phone);
    const lead = await findOrCreateLead({
      clinicId: req.clinicId, channel: 'form',
      channelUserId: normPhone || email, phone: normPhone, name,
    });
    const { supabase } = require('../config/supabase');
    await supabase.from('leads').update({ email, source_url: sourceUrl, treatment_interest: treatment }).eq('id', lead.id);
    if (normPhone) {
      const conversation = await findOrCreateConversation({ clinicId: req.clinicId, leadId: lead.id, channel: 'form', channelUserId: normPhone });
      const initMessage  = `Hi, I'm ${name}. ${message || `I'm interested in ${treatment || 'a consultation'}.`}`;
      await appendMessage(conversation.id, 'user', initMessage);
      const aiOutput = await processMessage({ clinic: req.clinic, conversation, userMessage: initMessage });
      await processAiOutput(lead.id, conversation.id, aiOutput);
      await appendMessage(conversation.id, 'assistant', aiOutput.reply);
      await sendWhatsApp(normPhone, aiOutput.reply).catch(() => {});
    }
    return res.json({ success: true, message: "Thanks! We'll be in touch shortly." });
  } catch (err) {
    logger.error('Form webhook error', err);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

// ─── Instagram ────────────────────────────────────────────────────────────
exports.instagramVerify = (req, res) => {
  const { webhookSecret } = require('../config/env');
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === webhookSecret) {
    return res.status(200).send(req.query['hub.challenge']);
  }
  return res.status(403).send('Forbidden');
};

exports.instagramWebhook = async (req, res) => {
  res.status(200).send('EVENT_RECEIVED');
  try {
    const parsed = parseInstagramWebhook(req.body);
    if (!parsed || !parsed.messageText) return;
    const token = process.env.IG_PAGE_ACCESS_TOKEN;
    const senderName = token ? await getInstagramUserName(parsed.senderId, token) : null;
    const { aiOutput } = await handleInboundMessage({
      clinicId: req.clinicId, clinic: req.clinic,
      channel: 'instagram', channelUserId: parsed.senderId,
      phone: null, name: senderName, userMessage: parsed.messageText,
      metadata: { messageId: parsed.messageId },
    });
    if (token) await sendInstagramMessage(parsed.senderId, aiOutput.reply, token);
  } catch (err) { logger.error('Instagram webhook error', err); }
};

exports.handleInboundMessage = handleInboundMessage;
