'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('immigration_details');
    if (!table.ni_number) {
      await queryInterface.addColumn('immigration_details', 'ni_number', { type: Sequelize.STRING });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('immigration_details', 'ni_number');
  },
};
