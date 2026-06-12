/**
 * Job Scheduler using node-cron.
 * Replaces Agenda.js because Agenda requires MongoDB and our DB is Supabase (PostgreSQL).
 * node-cron is stateless — jobs run on schedule, no persistence needed for these use cases.
 */
const cron   = require('node-cron');
const logger = require('../utils/logger');

const initAgenda = async () => {
  // Every hour — send 24h reminders
  cron.schedule('0 * * * *', async () => {
    try {
      const { send24hReminders } = require('../services/automation/reminder.service');
      await send24hReminders();
    } catch (err) { logger.error('Job send-24h-reminders failed:', err.message); }
  });

  // Every 30 minutes — send 2h reminders
  cron.schedule('*/30 * * * *', async () => {
    try {
      const { send2hReminders } = require('../services/automation/reminder.service');
      await send2hReminders();
    } catch (err) { logger.error('Job send-2h-reminders failed:', err.message); }
  });

  // Every 30 minutes — mark no-shows
  cron.schedule('*/30 * * * *', async () => {
    try {
      const { markNoShows } = require('../services/automation/reminder.service');
      await markNoShows();
    } catch (err) { logger.error('Job mark-no-shows failed:', err.message); }
  });

  // Every hour — send no-show recovery messages
  cron.schedule('15 * * * *', async () => {
    try {
      const { sendNoShowRecovery } = require('../services/automation/reminder.service');
      await sendNoShowRecovery();
    } catch (err) { logger.error('Job send-noshow-recovery failed:', err.message); }
  });

  // Every 30 minutes — process follow-ups
  cron.schedule('*/30 * * * *', async () => {
    try {
      const { processFollowUps } = require('../services/automation/followup.service');
      await processFollowUps();
    } catch (err) { logger.error('Job process-followups failed:', err.message); }
  });

  // Every day at 9am IST (3:30 UTC) — cold lead nurture
  cron.schedule('30 3 * * *', async () => {
    try {
      const { runColdLeadNurture } = require('../services/automation/followup.service');
      await runColdLeadNurture();
    } catch (err) { logger.error('Job cold-lead-nurture failed:', err.message); }
  });

  logger.info('Job scheduler started — 6 cron jobs active (node-cron)');
};

module.exports = { initAgenda };
