const { sendWhatsApp, sendSms } = require('../channels/twilio.service');
const logger = require('../../utils/logger');

const sendConfirmation = async ({ appointment, clinic, channel }) => {
  const message = buildConfirmationMessage(appointment, clinic);
  try {
    if (channel === 'whatsapp') await sendWhatsApp(appointment.phone, message);
    else                        await sendSms(appointment.phone, message);
    logger.info('Confirmation sent', { appointmentId: appointment.id, channel });
    return { sent: true };
  } catch (err) {
    logger.error('Confirmation failed', { appointmentId: appointment.id, err: err.message });
    return { sent: false, error: err.message };
  }
};

const buildConfirmationMessage = (appointment, clinic) => {
  const tz = clinic.timezone || 'Asia/Kolkata';
  const dateStr = new Date(appointment.scheduled_at).toLocaleString('en-IN', {
    weekday:'long', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:true, timeZone: tz,
  });
  return `✅ *Appointment Confirmed!*\n\n👤 *Patient:* ${appointment.patient_name}\n🏥 *Clinic:* ${clinic.name}\n📅 *Date & Time:* ${dateStr}\n💉 *Treatment:* ${appointment.treatment || 'Consultation'}\n🔖 *Code:* ${appointment.confirmation_code}\n\n📍 ${clinic.address || 'Please contact the clinic for directions.'}\n📞 ${clinic.phone}\n\n⚠️ Please arrive 10 minutes early.\nTo reschedule, reply RESCHEDULE or call us. 🙏`;
};

const buildReminderMessage = (appointment, clinic, type) => {
  const timeLabel = { '24h':'tomorrow','2h':'in 2 hours','30m':'in 30 minutes' }[type] || 'soon';
  const tz = clinic.timezone || 'Asia/Kolkata';
  const timeStr = new Date(appointment.scheduled_at).toLocaleString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true, timeZone: tz });
  return `⏰ *Reminder:* Your appointment at *${clinic.name}* is *${timeLabel}* at ${timeStr}.\n\nTreatment: ${appointment.treatment || 'Consultation'}\nCode: ${appointment.confirmation_code}\n\nCan't make it? Reply RESCHEDULE. 🙏`;
};

const buildNoShowRecoveryMessage = (appointment, clinic) =>
  `Hi ${appointment.patient_name}! We missed you at ${clinic.name} today 😊\n\nWe understand things come up! We'd love to reschedule your ${appointment.treatment || 'appointment'}.\n\nJust reply with a convenient day and time and we'll sort it out! 📅`;

module.exports = { sendConfirmation, buildConfirmationMessage, buildReminderMessage, buildNoShowRecoveryMessage };
