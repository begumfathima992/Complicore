const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Uploaded documents (metadata only - actual bytes live in object storage;
 * see services/storageService.js). `fileKey` is the storage object key
 * (company/{companyId}/employee/{employeeId}/{documentId}-v{version}.ext),
 * never a public URL - access always goes through a short-lived pre-signed
 * GET, scoped by the same employee-access check as the rest of this API.
 * Re-uploading a document of the same type for the same employee creates a
 * new version rather than overwriting - compliance evidence must never be
 * silently replaced.
 */
class Document extends Model {}

Document.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    documentType: {
      type: DataTypes.ENUM(
        'passport_id',
        'right_to_work_evidence',
        'visa',
        'employment_contract',
        'dbs_check',
        'qualification',
        'certificate',
        'training_record',
        'other',
        'payslip'
      ),
      allowNull: false,
    },
    fileKey: { type: DataTypes.STRING, allowNull: false },
    fileName: { type: DataTypes.STRING },
    uploadDate: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
    expiryDate: { type: DataTypes.DATEONLY }, // null for documents that don't expire (e.g. some contracts)
    // Which month a payslip covers (first-of-month by convention) - required
    // for documentType 'payslip', unused otherwise. Payslips deliberately
    // skip the version/supersede behaviour below: each month's payslip is
    // its own current document, never replacing a prior month's.
    periodMonth: { type: DataTypes.DATEONLY },
    status: {
      type: DataTypes.ENUM('valid', 'expiring_soon', 'expired', 'pending_review'),
      defaultValue: 'pending_review',
    },
    version: { type: DataTypes.INTEGER, defaultValue: 1 },
    isCurrent: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { sequelize, modelName: 'Document', tableName: 'documents' }
);

module.exports = Document;
