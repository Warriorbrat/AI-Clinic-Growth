module.exports = {
  LEAD_STATUS: {
    NEW:             'new',
    HOT:             'hot',
    WARM:            'warm',
    COLD:            'cold',
    EMERGENCY:       'emergency',
    CONTACTED:       'contacted',
    APPOINTMENT_SET: 'appointment_set',
    CONVERTED:       'converted',
    LOST:            'lost',
    NURTURING:       'nurturing',
  },

  LEAD_URGENCY: {
    IMMEDIATE:    'immediate',
    WITHIN_WEEK:  'within_week',
    WITHIN_MONTH: 'within_month',
    FLEXIBLE:     'flexible',
    UNKNOWN:      'unknown',
  },

  BUDGET_INTENT: {
    PREMIUM:         'premium',
    STANDARD:        'standard',
    PRICE_SENSITIVE: 'price_sensitive',
    UNKNOWN:         'unknown',
  },

  CHANNEL: {
    VOICE:     'voice',
    WHATSAPP:  'whatsapp',
    INSTAGRAM: 'instagram',
    WEBCHAT:   'webchat',
    FORM:      'form',
  },

  CONVERSATION_STAGE: {
    GREETING:            'greeting',
    QUALIFICATION:       'qualification',
    OBJECTION_HANDLING:  'objection_handling',
    BOOKING:             'booking',
    CONFIRMATION:        'confirmation',
    FOLLOW_UP:           'follow_up',
  },

  CONVERSATION_STATUS: {
    ACTIVE:     'active',
    COMPLETED:  'completed',
    ABANDONED:  'abandoned',
  },

  APPOINTMENT_STATUS: {
    PENDING:       'pending',
    CONFIRMED:     'confirmed',
    REMINDED_24H:  'reminded_24h',
    REMINDED_2H:   'reminded_2h',
    COMPLETED:     'completed',
    NO_SHOW:       'no_show',
    CANCELLED:     'cancelled',
    RESCHEDULED:   'rescheduled',
  },

  NEXT_ACTION: {
    CONTINUE:          'continue_conversation',
    OFFER_SLOTS:       'offer_slots',
    CONFIRM_BOOKING:   'confirm_booking',
    ESCALATE_HUMAN:    'escalate_to_human',
    SEND_FOLLOWUP:     'send_followup',
  },

  REMINDER_TYPE: {
    H24: '24h',
    H2:  '2h',
    M30: '30m',
  },

  // Default working hours (IST)
  DEFAULT_WORKING_HOURS: {
    monday:    { open: '09:00', close: '18:00', enabled: true  },
    tuesday:   { open: '09:00', close: '18:00', enabled: true  },
    wednesday: { open: '09:00', close: '18:00', enabled: true  },
    thursday:  { open: '09:00', close: '18:00', enabled: true  },
    friday:    { open: '09:00', close: '18:00', enabled: true  },
    saturday:  { open: '09:00', close: '14:00', enabled: true  },
    sunday:    { open: '09:00', close: '14:00', enabled: false },
  },

  APPOINTMENT_SLOT_DURATION: 30, // minutes

  // AI config
  AI_MAX_CONTEXT_TURNS: 12,
  AI_MODEL: 'claude-sonnet-4-20250514',
  AI_MAX_TOKENS: 500,
};
