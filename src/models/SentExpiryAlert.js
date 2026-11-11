const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Dedup ledger for the daily expiry-alert email job (services/expiryAlertJob.js).
 * One row per (sourceType, sourceId, threshold) that has actually been
 * emailed - the unique index is what guarantees the same item never
 * triggers the same 90/60/30/7-day-or-overdue threshold email twice, even
 * if the cron runs more than once on the same day or a run is retried.
 */
class SentExpiryAlert extends Model {}

SentExpiryAlert.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    sourceType: { type: DataTypes.STRING, allowNull: false }, // 'RightToWorkCheck' | 'Document'
    sourceId: { type: DataTypes.STRING, allowNull: false },
    threshold: { type: DataTypes.STRING, allowNull: false }, // '90' | '60' | '30' | '7' | 'overdue'
    companyId: { type: DataTypes.UUID, allowNull: false },
    sentAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    modelName: 'SentExpiryAlert',
    tableName: 'sent_expiry_alerts',
    indexes: [{ unique: true, fields: ['source_type', 'source_id', 'threshold'] }],
  }
);

module.exports = SentExpiryAlert;
