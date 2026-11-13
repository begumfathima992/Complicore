'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query("ALTER TYPE enum_documents_document_type ADD VALUE IF NOT EXISTS 'payslip'");

    const table = await queryInterface.describeTable('documents');
    if (!table.period_month) {
      await queryInterface.addColumn('documents', 'period_month', { type: Sequelize.DATEONLY });
    }
  },
  async down(queryInterface) {
    // Postgres can't drop a single enum value - down() only reverts the column.
    await queryInterface.removeColumn('documents', 'period_month');
  },
};
