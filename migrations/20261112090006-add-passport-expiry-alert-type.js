'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query("ALTER TYPE enum_alerts_alert_type ADD VALUE IF NOT EXISTS 'passport_expiry'");
  },
  async down() {
    // Postgres can't drop a single enum value - left in place (harmless if unused).
  },
};
