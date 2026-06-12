const Joi = require('joi');
require('dotenv').config();

const schema = Joi.object({
  NODE_ENV:             Joi.string().valid('development','production','test').default('development'),
  PORT:                 Joi.number().default(5000),
  FRONTEND_URL:         Joi.string().uri().required(),
  SUPABASE_URL:              Joi.string().uri().required(),
  SUPABASE_ANON_KEY:         Joi.string().required(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().required(),
  JWT_SECRET:     Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  
  ANTHROPIC_API_KEY: Joi.string().allow('').optional(),

TWILIO_ACCOUNT_SID: Joi.string().allow('').optional(),
TWILIO_AUTH_TOKEN: Joi.string().allow('').optional(),
TWILIO_PHONE_NUMBER: Joi.string().allow('').optional(),
TWILIO_WHATSAPP_NUMBER: Joi.string().allow('').optional(),

GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),
GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional(),
GOOGLE_REDIRECT_URI: Joi.string().allow('').optional(),

RAZORPAY_KEY_ID: Joi.string().allow('').optional(),
RAZORPAY_KEY_SECRET: Joi.string().allow('').optional(),
RAZORPAY_WEBHOOK_SECRET: Joi.string().allow('').optional(),

  WEBHOOK_SECRET: Joi.string().min(16).required(),
AGENDA_DB_URI: Joi.string().allow('').optional(),
  LOG_LEVEL:      Joi.string().valid('error','warn','info','debug').default('info'),
}).unknown();

const { error, value } = schema.validate(process.env);
if (error) throw new Error('Env validation failed: ' + error.message);

module.exports = {
  env: value.NODE_ENV, port: value.PORT, frontendUrl: value.FRONTEND_URL,
  supabase: { url: value.SUPABASE_URL, anonKey: value.SUPABASE_ANON_KEY, serviceRoleKey: value.SUPABASE_SERVICE_ROLE_KEY },
  jwt: { secret: value.JWT_SECRET, expiresIn: value.JWT_EXPIRES_IN },
  anthropic: { apiKey: value.ANTHROPIC_API_KEY },
  twilio: { accountSid: value.TWILIO_ACCOUNT_SID, authToken: value.TWILIO_AUTH_TOKEN, phoneNumber: value.TWILIO_PHONE_NUMBER, whatsappNumber: value.TWILIO_WHATSAPP_NUMBER },
  google: { clientId: value.GOOGLE_CLIENT_ID, clientSecret: value.GOOGLE_CLIENT_SECRET, redirectUri: value.GOOGLE_REDIRECT_URI },
  razorpay: { keyId: value.RAZORPAY_KEY_ID, keySecret: value.RAZORPAY_KEY_SECRET, webhookSecret: value.RAZORPAY_WEBHOOK_SECRET },
  webhookSecret: value.WEBHOOK_SECRET, agendaDbUri: value.AGENDA_DB_URI, logLevel: value.LOG_LEVEL,
};
