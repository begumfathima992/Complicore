const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const { encryptField, decryptField } = require('../utils/fieldEncryption');

/**
 * Full past/current/future history of an employee's visa/permission to
 * work - replaces the single visaType/visaExpiry/shareCode/
 * sponsorshipReference fields that used to live directly on
 * ImmigrationDetail (see the migration that moved them here).
 *
 * `supersedesCurrent` is set at creation time when the new record should
 * become the current one - immediately if `startDate` is today/past
 * (services/scheduledChangeService.js promotes it synchronously), or left
 * pending until `startDate` arrives if it's in the future (the daily
 * cron promotes it then). Only one row per employee should ever have
 * `isCurrent: true`.
 */
class VisaRecord extends Model {}

VisaRecord.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    visaType: { type: DataTypes.STRING },
    // Encrypted at rest + masked in API responses to everyone except
    // SUPER_ADMIN/EMPLOYER_ADMIN/HR_MANAGER (src/utils/maskSensitive.js),
    // same treatment as IdentityDocument.documentNumber below.
    shareCode: {
      type: DataTypes.STRING,
      set(value) {
        this.setDataValue('shareCode', encryptField(value));
      },
      get() {
        return decryptField(this.getDataValue('shareCode'));
      },
    },
    startDate: { type: DataTypes.DATEONLY }, // when this visa/permission begins
    expiryDate: { type: DataTypes.DATEONLY },
    sponsorshipReference: { type: DataTypes.STRING }, // e.g. Certificate of Sponsorship number
    isCurrent: { type: DataTypes.BOOLEAN, defaultValue: false },
    supersedesCurrent: { type: DataTypes.BOOLEAN, defaultValue: false },
    notes: { type: DataTypes.STRING },
    createdByUserId: { type: DataTypes.UUID },
  },
  { sequelize, modelName: 'VisaRecord', tableName: 'visa_records' }
);

module.exports = VisaRecord;
