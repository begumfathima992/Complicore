/**
 * Manual/ad-hoc trigger for the same job the in-process cron runs daily at
 * 07:00 Europe/London (see src/jobs/expiryAlertCron.js) - useful for
 * testing against a real mailbox or re-running after fixing RESEND_API_KEY.
 */
require('dotenv').config();
const { sequelize } = require('../src/models');
const { runExpiryAlertEmailJob } = require('../src/services/expiryAlertJob');

async function run() {
  await sequelize.authenticate();
  const summary = await runExpiryAlertEmailJob();
  console.log('Expiry alert email job complete:', summary);
  process.exit(0);
}

run().catch((err) => {
  console.error('Expiry alert email job failed:', err);
  process.exit(1);
});
