/**
 * Runs the compliance alert sweep (right-to-work + document expiry).
 * Intended to be triggered on a schedule (daily is typical) by an external
 * scheduler - OS cron, a container's scheduled task, or AWS EventBridge -
 * rather than kept running in-process. Also runs automatically after every
 * relevant create/update via the API (see alertService usage in the
 * right-to-work and document controllers), so this script is a safety net
 * that catches alerts becoming due purely because time has passed, with no
 * accompanying API write (e.g. a visa quietly crossing the 90-day mark).
 */
require('dotenv').config();
const { sequelize } = require('../src/models');
const { syncAllAlerts } = require('../src/services/alertService');

async function run() {
  await sequelize.authenticate();
  const result = await syncAllAlerts();
  console.log('Alert sweep complete:', result);
  process.exit(0);
}

run().catch((err) => {
  console.error('Alert sweep failed:', err);
  process.exit(1);
});
