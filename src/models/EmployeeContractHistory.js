const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Full past/current/future timeline of an employee's contract terms.
 * Exactly one row per employee should have `isCurrent: true` at any time -
 * maintained by services/scheduledChangeService.js, never by application
 * code writing isCurrent directly elsewhere. `Employee`'s own
 * jobTitle/salary/contractedHoursPerWeek/contractEndDate/workLocation stay
 * as a live mirror of the current row, so every existing report/list/page
 * that reads those columns keeps working unchanged - this table is the
 * history, not a replacement for them.
 */
class EmployeeContractHistory extends Model {}

EmployeeContractHistory.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    effectiveFrom: { type: DataTypes.DATEONLY, allowNull: false },
    effectiveTo: { type: DataTypes.DATEONLY }, // null = still open-ended (this is the latest version)
    jobTitle: { type: DataTypes.STRING },
    salary: { type: DataTypes.DECIMAL(10, 2) },
    contractedHoursPerWeek: { type: DataTypes.DECIMAL(4, 1) },
    contractEndDate: { type: DataTypes.DATEONLY }, // fixed-term end date for THIS version, if any
    workLocation: { type: DataTypes.STRING },
    changeReason: { type: DataTypes.STRING }, // e.g. "Annual review", "Promotion"
    isCurrent: { type: DataTypes.BOOLEAN, defaultValue: false },
    createdByUserId: { type: DataTypes.UUID },
  },
  { sequelize, modelName: 'EmployeeContractHistory', tableName: 'employee_contract_history' }
);

module.exports = EmployeeContractHistory;
