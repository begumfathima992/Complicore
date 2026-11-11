const cron = require('node-cron');
const { runExpiryAlertEmailJob } = require('../services/expiryAlertJob');

/**
 * Registers the daily 07:00 Europe/London expiry-alert email sweep inside
 * the API process. Kept as a separate module (rather than inline in
 * server.js) so it can be skipped in tests - call this only from the real
 * server entrypoint.
 */
function scheduleExpiryAlertEmails() {
  cron.schedule(
    '0 7 * * *',
    async () => {
      try {
        const summary = await runExpiryAlertEmailJob();
        console.log('[expiry-alert-cron] run complete:', summary);
      } catch (err) {
        console.error('[expiry-alert-cron] run failed:', err);
      }
    },
    { timezone: 'Europe/London' }
  );
}

module.exports = { scheduleExpiryAlertEmails };
