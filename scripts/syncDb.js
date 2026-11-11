require('dotenv').config();
const { sequelize } = require('../src/models');

sequelize
  .sync({ alter: true })
  .then(() => {
    console.log('Database schema synced.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Sync failed:', err);
    process.exit(1);
  });
