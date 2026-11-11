'use strict';
const { SentExpiryAlert } = require('../src/models');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable(SentExpiryAlert.getTableName(), SentExpiryAlert.getAttributes());
    await queryInterface.addIndex('sent_expiry_alerts', ['source_type', 'source_id', 'threshold'], {
      unique: true,
      name: 'sent_expiry_alerts_source_threshold_unique',
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('sent_expiry_alerts');
  },
};
