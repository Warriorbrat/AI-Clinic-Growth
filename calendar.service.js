const { google }  = require('googleapis');
const { google: googleConfig } = require('../../config/env');
const { Clinics } = require('../../config/db');
const { addMinutes, getDayName } = require('../../utils/date.utils');
const { APPOINTMENT_SLOT_DURATION } = require('../../config/constants');
const logger = require('../../utils/logger');

const createOAuth2Client = () => new google.auth.OAuth2(
  googleConfig.clientId, googleConfig.clientSecret, googleConfig.redirectUri
);

const getAuthUrl = () => createOAuth2Client().generateAuthUrl({
  access_type:'offline', scope:['https://www.googleapis.com/auth/calendar'], prompt:'consent',
});

const exchangeCodeForTokens = async (code) => {
  const { tokens } = await createOAuth2Client().getToken(code);
  return tokens;
};

const getCalendarClient = async (clinicId) => {
  const clinic = await Clinics.findById(clinicId, true); // include secrets
  if (!clinic?.google_refresh_token) throw new Error('Google Calendar not connected');

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token:  clinic.google_access_token,
    refresh_token: clinic.google_refresh_token,
    expiry_date:   clinic.google_token_expiry ? new Date(clinic.google_token_expiry).getTime() : undefined,
  });

  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await Clinics.setGoogleTokens(clinicId, {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || clinic.google_refresh_token,
        expiry_date:  tokens.expiry_date,
      });
    }
  });

  return google.calendar({ version:'v3', auth: oauth2Client });
};

const getAvailableSlots = async (clinicId, targetDate, slotDuration = APPOINTMENT_SLOT_DURATION) => {
  const clinic  = await Clinics.findById(clinicId);
  const dayName = getDayName(targetDate);
  const dayHours = clinic.working_hours?.[dayName];
  if (!dayHours?.enabled) return [];

  let cal;
  try { cal = await getCalendarClient(clinicId); } catch { return []; }

  const dateStr     = new Date(targetDate).toISOString().split('T')[0];
  const tzOffsetMin = 330; // Asia/Kolkata — TODO: use clinic.timezone with proper tz lib
  const openUTC  = localTimeToUTC(dateStr, dayHours.open,  tzOffsetMin);
  const closeUTC = localTimeToUTC(dateStr, dayHours.close, tzOffsetMin);

  const { data } = await cal.events.list({
    calendarId: clinic.google_calendar_id || 'primary',
    timeMin: openUTC.toISOString(), timeMax: closeUTC.toISOString(),
    singleEvents: true, orderBy: 'startTime',
  });

  const existing = (data.items || []).map(e => ({
    start: new Date(e.start.dateTime || e.start.date),
    end:   new Date(e.end.dateTime   || e.end.date),
  }));

  const slots = [];
  let cursor  = new Date(openUTC);
  while (cursor < closeUTC) {
    const slotEnd   = addMinutes(cursor, slotDuration);
    if (slotEnd > closeUTC) break;
    const isBlocked = existing.some(e => cursor < e.end && slotEnd > e.start);
    if (!isBlocked && cursor > new Date()) {
      slots.push({ startTime: new Date(cursor), endTime: slotEnd, label: formatSlotLabel(cursor) });
    }
    cursor = slotEnd;
  }
  return slots;
};

const localTimeToUTC = (dateStr, timeStr, offsetMin = 330) => {
  const [y,m,d]   = dateStr.split('-').map(Number);
  const [h,min]   = timeStr.split(':').map(Number);
  return new Date(Date.UTC(y, m-1, d, h, min) - offsetMin*60000);
};

const formatSlotLabel = (date) =>
  date.toLocaleString('en-IN', { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:true, timeZone:'Asia/Kolkata' });

const createAppointmentEvent = async (clinicId, appointment) => {
  const clinic = await Clinics.findById(clinicId);
  const cal    = await getCalendarClient(clinicId);
  const tz     = clinic.timezone || 'Asia/Kolkata';

  // Calculate end time
  const start    = new Date(appointment.scheduled_at);
  const end      = addMinutes(start, appointment.duration_min || 30);

  const { data } = await cal.events.insert({
    calendarId: clinic.google_calendar_id || 'primary',
    resource: {
      summary:     `${appointment.patient_name} — ${appointment.treatment || 'Appointment'}`,
      description: `Phone: ${appointment.phone}\nCode: ${appointment.confirmation_code}`,
      start: { dateTime: start.toISOString(), timeZone: tz },
      end:   { dateTime: end.toISOString(),   timeZone: tz },
      reminders: { useDefault: false, overrides: [] },
    },
  });
  return data.id;
};

const deleteAppointmentEvent = async (clinicId, googleEventId) => {
  const clinic = await Clinics.findById(clinicId);
  const cal    = await getCalendarClient(clinicId);
  await cal.events.delete({ calendarId: clinic.google_calendar_id || 'primary', eventId: googleEventId });
};

module.exports = { getAuthUrl, exchangeCodeForTokens, getAvailableSlots, createAppointmentEvent, deleteAppointmentEvent };
