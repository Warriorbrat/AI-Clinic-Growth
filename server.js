const app      = require('./src/app');
const { testConnection } = require('./src/config/supabase');
const { initAgenda }     = require('./src/config/agenda');
const { port, env }      = require('./src/config/env');
const logger             = require('./src/utils/logger');

const start = async () => {
  try {
    await testConnection();
    const server = app.listen(port, () => {
      logger.info('AI Clinic Growth System v2.0 on port ' + port + ' [' + env + '] | Supabase + Razorpay');
    });
    initAgenda().catch(err => logger.error('Agenda failed:', err.message));
    const shutdown = sig => { logger.info(sig + ' received'); server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 10000); };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));
    process.on('unhandledRejection', r => logger.error('Unhandled:', r));
    process.on('uncaughtException',  e => { logger.error('Uncaught:', e); process.exit(1); });
  } catch (err) {
    logger.error('Startup failed:', err);
    process.exit(1);
  }
};
start();
