const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Next-of-kin / emergency contact for an employee. Not compliance-audit
 * data (unlike Document/RightToWorkCheck) - no retention requirement, so
 * updates/deletes are real writes, not new versions, and this is not
 * instrumented in the audit log. `companyId` is denormalized here (like
 * Document/Shift/etc.) purely so scopeToChildWhere() can filter it
 * directly without an extra join to Employee.
 */
class EmergencyContact extends Model {}

EmergencyContact.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    relationship: { type: DataTypes.STRING },
    telephone: { type: DataTypes.STRING },
    address: { type: DataTypes.STRING },
  },
  { sequelize, modelName: 'EmergencyContact', tableName: 'emergency_contacts' }
);

module.exports = EmergencyContact;
