const Anthropic = require('@anthropic-ai/sdk');
const { anthropic: cfg } = require('../../config/env');
const { AI_MODEL, AI_MAX_TOKENS, AI_MAX_CONTEXT_TURNS } = require('../../config/constants');
const { buildSystemPrompt } = require('./prompts/system.prompt');
const { withRetry, isRetriable } = require('../../utils/retry.utils');
const logger = require('../../utils/logger');

const client = new Anthropic({ apiKey: cfg.apiKey });

const processMessage = async ({ clinic, conversation, userMessage, availableSlots = [] }) => {
  const stage = conversation.stage || conversation.context?.stage || 'greeting';

  // Build message history — pull from JSONB messages array (Supabase) or messages array (Mongoose)
  const rawMessages = conversation.messages || [];
  const history = rawMessages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-AI_MAX_CONTEXT_TURNS)
    .map(m => ({ role: m.role, content: m.content }));

  // Adapt clinic object — support both snake_case (Supabase) and camelCase (Mongoose)
  const clinicAdapted = {
    name:     clinic.name,
    services: clinic.services || [],
    aiConfig: clinic.ai_config || clinic.aiConfig || {},
    address:  clinic.address,
    phone:    clinic.phone,
    timezone: clinic.timezone || 'Asia/Kolkata',
  };

  const systemPrompt = buildSystemPrompt(clinicAdapted, stage, availableSlots);

  const response = await withRetry(
    () => client.messages.create({
      model: AI_MODEL, max_tokens: AI_MAX_TOKENS, system: systemPrompt,
      messages: [...history, { role: 'user', content: userMessage }],
    }),
    3, 600, isRetriable
  );

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error('Claude returned no text content');

  return parseAiOutput(textBlock.text);
};

const parseAiOutput = (raw) => {
  try {
    const clean = raw.replace(/```json\n?|```\n?/g, '').trim();
    return validateAndNormalise(JSON.parse(clean));
  } catch {
    logger.warn('Claude JSON parse failed — using fallback', { raw: raw.slice(0, 150) });
    return validateAndNormalise({});
  }
};

const validateAndNormalise = (obj) => {
  const validStages  = ['greeting','qualification','objection_handling','booking','confirmation','follow_up'];
  const validClasses = ['hot','warm','cold','emergency'];
  const validActions = ['continue_conversation','offer_slots','confirm_booking','escalate_to_human','send_followup'];
  const validUrgency = ['immediate','within_week','within_month','flexible','unknown'];
  const validBudget  = ['premium','standard','price_sensitive','unknown'];

  return {
    reply:          typeof obj.reply === 'string' ? obj.reply.trim() : "Thanks for reaching out! Could you tell me your name and what brings you in today?",
    stage:          validStages.includes(obj.stage)          ? obj.stage          : 'greeting',
    classification: validClasses.includes(obj.classification)? obj.classification : 'cold',
    nextAction:     validActions.includes(obj.nextAction)    ? obj.nextAction     : 'continue_conversation',
    leadScore:      typeof obj.leadScore === 'number'        ? Math.max(0, Math.min(100, Math.round(obj.leadScore))) : 0,
    bookingReady:   obj.bookingReady === true,
    flags:          Array.isArray(obj.flags) ? obj.flags : [],
    extractedData: {
      name:              obj.extractedData?.name              || null,
      phone:             obj.extractedData?.phone             || null,
      email:             obj.extractedData?.email             || null,
      treatmentInterest: obj.extractedData?.treatmentInterest || null,
      urgency:           validUrgency.includes(obj.extractedData?.urgency)    ? obj.extractedData.urgency    : 'unknown',
      budgetIntent:      validBudget.includes(obj.extractedData?.budgetIntent) ? obj.extractedData.budgetIntent : 'unknown',
      preferredTimes:    Array.isArray(obj.extractedData?.preferredTimes) ? obj.extractedData.preferredTimes : [],
    },
  };
};

module.exports = { processMessage };
