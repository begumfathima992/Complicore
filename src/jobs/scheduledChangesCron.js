const cron = require('node-cron');
const { activateDueChanges } = require('../services/scheduledChangeService');

/**
 * Registers the daily 06:30 Europe/London promotion sweep (contract
 * versions, visa records, identity documents whose effective/start/issue
 * date has arrived) - run before the 07:00 expiry-alert email sweep
 * (jobs/expiryAlertCron.js) so that job reads already-promoted state.
 * Same shape as that cron; kept in its own module for the same reason.
 */
function scheduleActivateDueChanges() {
  cron.schedule(
    '30 6 * * *',
    async () => {
      try {
        const summary = await activateDueChanges();
        console.log('[scheduled-changes-cron] run complete:', summary);
      } catch (err) {
        console.error('[scheduled-changes-cron] run failed:', err);
      }
    },
    { timezone: 'Europe/London' }
  );
}

module.exports = { scheduleActivateDueChanges };
