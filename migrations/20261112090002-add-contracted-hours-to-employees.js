'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('employees');
    if (!table.contracted_hours_per_week) {
      await queryInterface.addColumn('employees', 'contracted_hours_per_week', {
        type: Sequelize.DECIMAL(4, 1),
      });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('employees', 'contracted_hours_per_week');
  },
};
