'use strict';
const { AttendanceRecord } = require('../src/models');
const { createTableFromModel } = require('./_helpers/fromModel');

const base = createTableFromModel(AttendanceRecord);

module.exports = {
  async up(queryInterface, Sequelize) {
    await base.up(queryInterface, Sequelize);
    // One row per employee per day.
    await queryInterface.addIndex('attendance_records', ['employee_id', 'date'], {
      unique: true,
      name: 'attendance_records_employee_date_unique',
    });
  },
  async down(queryInterface, Sequelize) {
    await base.down(queryInterface, Sequelize);
  },
};
