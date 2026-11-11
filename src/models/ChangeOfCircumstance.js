const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Append-only audit trail of material changes to an employee's record.
 * Rows are never updated or deleted (enforced in the controller/routes -
 * only create + read are exposed) so this stays a trustworthy history for
 * sponsor-compliance audits.
 */
class ChangeOfCircumstance extends Model {}

ChangeOfCircumstance.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    changeType: {
      type: DataTypes.ENUM(
        'address',
        'role',
        'salary',
        'working_hours',
        'work_location',
        'absence',
        'termination',
        'promotion',
        'transfer',
        'other'
      ),
      allowNull: false,
    },
    oldValue: { type: DataTypes.TEXT },
    newValue: { type: DataTypes.TEXT },
    effectiveDate: { type: DataTypes.DATEONLY, allowNull: false },
    reason: { type: DataTypes.TEXT },
  },
  { sequelize, modelName: 'ChangeOfCircumstance', tableName: 'change_of_circumstances', updatedAt: false }
);

module.exports = ChangeOfCircumstance;
