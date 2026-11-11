const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Core employee profile: personal + employment details.
 * Immigration/compliance and emergency-contact details live in their own
 * 1:1 tables (ImmigrationDetail, EmergencyContact) so that access to them
 * can be permissioned separately (see RIGHT_TO_WORK in permissions.js).
 */
class Employee extends Model {}

Employee.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    employeeNumber: { type: DataTypes.STRING, allowNull: false, unique: true },

    // Personal details
    firstName: { type: DataTypes.STRING, allowNull: false },
    lastName: { type: DataTypes.STRING, allowNull: false },
    dateOfBirth: { type: DataTypes.DATEONLY },
    addressLine1: { type: DataTypes.STRING },
    addressLine2: { type: DataTypes.STRING },
    city: { type: DataTypes.STRING },
    postcode: { type: DataTypes.STRING },
    telephone: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },

    // Employment details
    jobTitle: { type: DataTypes.STRING },
    startDate: { type: DataTypes.DATEONLY },
    employmentStatus: {
      type: DataTypes.ENUM('active', 'on_leave', 'suspended', 'terminated'),
      defaultValue: 'active',
    },
    terminationDate: { type: DataTypes.DATEONLY },
    salary: { type: DataTypes.DECIMAL(10, 2) },
    workLocation: { type: DataTypes.STRING },
    probationEndDate: { type: DataTypes.DATEONLY }, // drives the 'probation_ending' alert
    contractEndDate: { type: DataTypes.DATEONLY }, // fixed-term contracts only; drives 'contract_ending'
  },
  { sequelize, modelName: 'Employee', tableName: 'employees' }
);

module.exports = Employee;
