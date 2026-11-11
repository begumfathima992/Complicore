const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

/**
 * A sponsoring employer organisation (tenant). Super Admin operates across
 * all companies; every other role is scoped to exactly one.
 */
class Company extends Model {}

Company.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    sponsorLicenseNumber: { type: DataTypes.STRING },
    sponsorType: { type: DataTypes.ENUM('A-rated', 'B-rated'), allowNull: true },
    address: { type: DataTypes.STRING },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { sequelize, modelName: 'Company', tableName: 'companies' }
);

module.exports = Company;
