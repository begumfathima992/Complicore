const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Non-holiday absence tracking (holiday has its own workflow/balance in
 * HolidayRequest - see the Holiday Management module - so 'holiday' is
 * deliberately not a value here; the controller redirects that case).
 *
 * `reasonCategory` is a closed set of operational categories, not a
 * diagnosis field: HR needs to know an absence was illness-related to run
 * Bradford-factor/return-to-work processes, but does not need - and should
 * not store - what the illness actually was. `notes` is free text for
 * logistics (e.g. "covering shift arranged with Sarah"), not clinical
 * detail; keep medical specifics out of it.
 */
class Absence extends Model {}

Absence.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    absenceType: {
      type: DataTypes.ENUM('sickness', 'unauthorised', 'family_leave', 'other', 'long_term_absence'),
      allowNull: false,
    },
    startDate: { type: DataTypes.DATEONLY, allowNull: false },
    endDate: { type: DataTypes.DATEONLY },
    durationDays: { type: DataTypes.DECIMAL(5, 1) },
    reasonCategory: {
      type: DataTypes.ENUM(
        'illness_non_specific',
        'injury',
        'mental_health',
        'medical_appointment',
        'bereavement',
        'other'
      ),
    },
    notes: { type: DataTypes.STRING },
    returnToWorkDate: { type: DataTypes.DATEONLY },
    status: { type: DataTypes.ENUM('open', 'closed'), defaultValue: 'open' },
  },
  { sequelize, modelName: 'Absence', tableName: 'absences' }
);

module.exports = Absence;
