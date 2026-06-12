/**
 * Lead qualifier service — Supabase version
 * Replaces the Mongoose-based version. Exports identical interface.
 */
const { Leads, Conversations } = require('../config/db');
const logger = require('../utils/logger');

const processAiOutput = async (leadId, conversationId, aiOutput) => {
  const { extractedData: ex, leadScore, classification, stage, nextAction, flags, bookingReady } = aiOutput;

  // ── Update lead ────────────────────────────────────────────────────────────
  await Leads.updateQualification(leadId, {
    name:               ex.name,
    phone:              ex.phone,
    email:              ex.email,
    treatment_interest: ex.treatmentInterest,
    urgency:            ex.urgency,
    budget_intent:      ex.budgetIntent,
    preferred_times:    ex.preferredTimes,
  });

  const statusFields = { score: leadScore, last_contact_at: new Date().toISOString() };

  const newStatus = deriveLeadStatus(classification, stage, flags);
  if (newStatus) statusFields.status = newStatus;

  if (flags.includes('emergency')) {
    statusFields.status       = 'emergency';
    statusFields.is_escalated = true;
  }

  // Schedule follow-up for warm/cold leads
  if (['warm','cold'].includes(classification) && nextAction === 'continue_conversation') {
    const hours = classification === 'warm' ? 4 : 24;
    statusFields.follow_up_at = new Date(Date.now() + hours * 3600000).toISOString();
  }

  await Leads.update(leadId, null, statusFields);

  // ── Update conversation context ─────────────────────────────────────────────
  // Merge extracted data incrementally — never overwrite known data with null
  const { data: conv } = await require('../config/supabase').supabase
    .from('conversations').select('extracted_data').eq('id', conversationId).single();

  const merged = { ...(conv?.extracted_data || {}) };
  for (const [k, v] of Object.entries(ex)) {
    if (v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)) {
      merged[k] = v;
    }
  }

  await Conversations.updateContext(conversationId, {
    stage,
    extracted_data:      merged,
    last_ai_output:      aiOutput,
    flags,
    booking_attempts_inc: bookingReady,
  });

  return { newStatus, leadScore, classification };
};

const deriveLeadStatus = (classification, stage, flags) => {
  if (flags.includes('emergency'))    return 'emergency';
  if (stage === 'confirmation')        return 'appointment_set';
  if (classification === 'hot')        return 'hot';
  if (classification === 'warm')       return 'warm';
  if (classification === 'cold')       return 'cold';
  return null;
};

const findOrCreateLead = async ({ clinicId, channel, channelUserId, phone, name }) => {
  return Leads.findOrCreate({
    clinic_id:       clinicId,
    channel,
    channel_user_id: channelUserId,
    phone,
    name,
  });
};

const findOrCreateConversation = async ({ clinicId, leadId, channel, channelUserId }) => {
  return Conversations.findOrCreate({
    clinic_id:       clinicId,
    lead_id:         leadId,
    channel,
    channel_user_id: channelUserId,
  });
};

const appendMessage = async (conversationId, role, content, metadata = {}) => {
  await Conversations.appendMessage(conversationId, role, content, metadata);
};

module.exports = {
  processAiOutput,
  findOrCreateLead,
  findOrCreateConversation,
  appendMessage,
};
