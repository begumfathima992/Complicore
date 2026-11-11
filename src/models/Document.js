const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Uploaded/registered documents (metadata only - actual bytes live in
 * object storage, e.g. S3; `fileUrl` is the storage location/key).
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
        'other'
      ),
      allowNull: false,
    },
    fileUrl: { type: DataTypes.STRING, allowNull: false },
    fileName: { type: DataTypes.STRING },
    uploadDate: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
    expiryDate: { type: DataTypes.DATEONLY }, // null for documents that don't expire (e.g. some contracts)
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
