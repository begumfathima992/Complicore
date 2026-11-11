const app = require('./app');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 4000;

async function start() {
  await sequelize.authenticate();
  console.log('Database connection established.');

  app.listen(PORT, () => {
    console.log(`HRMS API listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
