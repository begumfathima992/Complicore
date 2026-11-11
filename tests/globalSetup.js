/**
 * Runs once before the whole test run (separate process context from
 * setupFiles/test files, so env vars are set here independently): wipes
 * and recreates every table on the dedicated test database, then seeds
 * the 5 roles every test relies on. The test database itself
 * (TEST_DB_NAME, default hrms_test) must already exist - same
 * precondition as the main app's `createdb hrms_compliance` step.
 */
process.env.DATABASE_URL = '';
process.env.DIRECT_URL = '';
process.env.DB_HOST = process.env.TEST_DB_HOST || 'localhost';
process.env.DB_PORT = process.env.TEST_DB_PORT || '5432';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'hrms_test';
process.env.DB_USER = process.env.TEST_DB_USER || 'postgres';
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD || 'postgres';

module.exports = async function globalSetup() {
  const { sequelize, Role } = require('../src/models');
  const { ROLES } = require('../src/config/permissions');

  await sequelize.authenticate();
  await sequelize.sync({ force: true });

  for (const [key, { name, level }] of Object.entries(ROLES)) {
    await Role.findOrCreate({ where: { key }, defaults: { name, level } });
  }

  await sequelize.close();
};
