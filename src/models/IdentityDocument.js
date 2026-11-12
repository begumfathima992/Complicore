const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const { encryptField, decryptField } = require('../utils/fieldEncryption');

/**
 * Structured passport / national ID / BRP record - the source of truth
 * for these documents, separate from (but optionally linked to) an
 * uploaded scan in the Documents vault. An employee can hold several
 * (dual nationality); old ones are kept as history with `isCurrent: false`
 * rather than deleted.
 *
 * `supersedesCurrent` + the promotion flow mirror VisaRecord exactly -
 * see services/scheduledChangeService.js.
 */
class IdentityDocument extends Model {}

IdentityDocument.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    type: {
      type: DataTypes.ENUM('passport', 'national_id', 'brp'),
      allowNull: false,
      defaultValue: 'passport',
    },
    // Encrypted at rest + masked in API responses to everyone except
    // SUPER_ADMIN/EMPLOYER_ADMIN/HR_MANAGER (src/utils/maskSensitive.js).
    // Every unmasked view is audited - see controllers/identityDocumentController.js.
    documentNumber: {
      type: DataTypes.STRING,
      set(value) {
        this.setDataValue('documentNumber', encryptField(value));
      },
      get() {
        return decryptField(this.getDataValue('documentNumber'));
      },
    },
    issuingCountry: { type: DataTypes.STRING },
    nationality: { type: DataTypes.STRING },
    issueDate: { type: DataTypes.DATEONLY },
    expiryDate: { type: DataTypes.DATEONLY },
    isCurrent: { type: DataTypes.BOOLEAN, defaultValue: false },
    supersedesCurrent: { type: DataTypes.BOOLEAN, defaultValue: false },
    notes: { type: DataTypes.STRING },
    createdByUserId: { type: DataTypes.UUID },
  },
  { sequelize, modelName: 'IdentityDocument', tableName: 'identity_documents' }
);

module.exports = IdentityDocument;
