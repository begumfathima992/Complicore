const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Right-to-work / sponsorship compliance data for an employee.
 * Kept separate from Employee so it can carry its own, stricter
 * permission (RIGHT_TO_WORK feature) independent of general profile access.
 */
class ImmigrationDetail extends Model {}

ImmigrationDetail.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    // Lives here rather than on Employee: nationality is only legitimately
    // needed for right-to-work/sponsorship reporting, so it inherits the
    // RIGHT_TO_WORK permission gate instead of being visible on every
    // general employee record view (see reportService.js's nationality report).
    nationality: { type: DataTypes.STRING },
    rightToWorkStatus: {
      type: DataTypes.ENUM('verified', 'pending', 'expired', 'not_required'),
      defaultValue: 'pending',
    },
    visaType: { type: DataTypes.STRING },
    visaExpiry: { type: DataTypes.DATEONLY },
    shareCode: { type: DataTypes.STRING },
    // EU Settlement Scheme status - a distinct UK immigration category from
    // general right-to-work/visa status (an EU/EEA/Swiss national with
    // settled/pre-settled status has a different evidence trail than a
    // work-visa holder). 'not_applicable' is the default because most
    // employees were never in scope for the EUSS at all - it is not a
    // synonym for "not verified".
    settlementStatus: {
      type: DataTypes.ENUM('settled', 'pre_settled', 'not_applicable'),
      defaultValue: 'not_applicable',
    },
    sponsorshipReference: { type: DataTypes.STRING }, // e.g. Certificate of Sponsorship number
    complianceStatus: {
      type: DataTypes.ENUM('compliant', 'action_required', 'non_compliant'),
      defaultValue: 'compliant',
    },
    lastCheckedAt: { type: DataTypes.DATE },
    lastCheckedByUserId: { type: DataTypes.UUID },
  },
  { sequelize, modelName: 'ImmigrationDetail', tableName: 'immigration_details' }
);

module.exports = ImmigrationDetail;
