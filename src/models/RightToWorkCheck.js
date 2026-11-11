const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

/**
 * One record per right-to-work check performed on an employee (Home Office
 * guidance requires an initial check before employment starts, and - for
 * anyone with time-limited permission to work - a follow-up check before
 * that permission expires). This is a log, not a single "current status"
 * field: employees with time-limited permission accumulate multiple checks
 * over their employment.
 *
 * `status` is always set explicitly by whoever performed the check - it is
 * never auto-derived from dates. A system-generated Alert (see Alert model
 * / services/alertService.js) flags an upcoming/passed expiry, but firing
 * that alert is not itself evidence of compliance: HR must still complete
 * the actual Home Office-required check/action and record the outcome here.
 */
class RightToWorkCheck extends Model {}

RightToWorkCheck.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    checkType: {
      type: DataTypes.ENUM(
        'initial_manual_check',
        'initial_online_check', // Home Office share-code check
        'follow_up_check',
        'continuous_check' // eVisa / share-code continuous checking service
      ),
      allowNull: false,
    },
    checkDate: { type: DataTypes.DATEONLY, allowNull: false },
    status: {
      type: DataTypes.ENUM('verified', 'pending', 'expiring_soon', 'expired', 'not_verified'),
      defaultValue: 'pending',
      allowNull: false,
    },
    expiryDate: { type: DataTypes.DATEONLY }, // expiry of the permission to work confirmed by this check
    evidenceReference: { type: DataTypes.STRING }, // free-text fallback if no Document record exists
    verificationNotes: { type: DataTypes.TEXT },
    nextReviewDate: { type: DataTypes.DATEONLY },
  },
  { sequelize, modelName: 'RightToWorkCheck', tableName: 'right_to_work_checks' }
);

module.exports = RightToWorkCheck;
