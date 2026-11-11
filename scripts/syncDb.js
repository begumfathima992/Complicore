/**
 * Local-dev convenience only - NOT for Neon/production. Schema changes
 * there go through versioned migrations (`npm run migrate`, see
 * migrations/). sync({ alter: true }) can't cleanly change an existing
 * ENUM column and has no up/down history, which is exactly why migrations
 * replaced it for anything that matters.
 */
require('dotenv').config();

if (/neon\.tech/.test(process.env.DATABASE_URL || '') || /neon\.tech/.test(process.env.DIRECT_URL || '')) {
  console.error('Refusing to run sync({ alter: true }) against a neon.tech database. Use `npm run migrate` instead.');
  process.exit(1);
}

const { sequelize } = require('../src/models');

sequelize
  .sync({ alter: true })
  .then(() => {
    console.log('Database schema synced (local dev only).');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Sync failed:', err);
    process.exit(1);
  });
