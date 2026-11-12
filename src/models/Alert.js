const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

/**
 * The central alert engine's single table - every alert type the spec
 * lists (right-to-work/visa/document/training expiry, missing document,
 * holiday/sick-leave requests needing review, absence threshold, probation
 * ending, contract ending, ad-hoc compliance tasks) is one row here, not a
 * separate table per type. `sourceType`/`sourceId` optionally point back
 * at the record that triggered it (a RightToWorkCheck, Document, etc.);
 * `compliance_task` alerts are raised manually by HR and have no source.
 *
 * An alert existing (or being high severity) is a reminder only - it is
 * never treated as proof that a required action was completed. Resolving
 * an expiry-driven alert happens automatically once a later-dated
 * check/document supersedes it (see services/alertService.js); other types
 * are acknowledged/resolved by a human via the alerts API.
 */
class Alert extends Model {}

Alert.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    alertType: {
      type: DataTypes.ENUM(
        'right_to_work_expiry',
        'visa_expiry',
        'document_expiry',
        'missing_document',
        'holiday_request',
        'sick_leave',
        'absence_threshold',
        'probation_ending',
        'contract_ending',
        'training_expiry',
        'compliance_task',
        'passport_expiry'
      ),
      allowNull: false,
    },
    severity: {
      type: DataTypes.ENUM('info', 'low', 'medium', 'high', 'critical'),
      allowNull: false,
    },
    title: { type: DataTypes.STRING, allowNull: false },
    message: { type: DataTypes.STRING, allowNull: false },
    actionRequired: { type: DataTypes.STRING }, // e.g. "Review required"
    assignedToRoleKey: { type: DataTypes.STRING }, // e.g. 'HR_MANAGER' - who should act on it
    sourceType: { type: DataTypes.STRING }, // e.g. 'RightToWorkCheck', 'Document', 'HolidayRequest'
    // STRING, not UUID: most sources key by a plain row id, but composite
    // per-employee alerts (missing_document, probation_ending,
    // contract_ending, absence_threshold) key by e.g. '<employeeId>:<type>'
    // so each sub-case gets its own upsertable/resolvable alert row.
    sourceId: { type: DataTypes.STRING },
    dueDate: { type: DataTypes.DATEONLY }, // the date driving the alert, if any (expiry, ending date, etc.)
    status: { type: DataTypes.ENUM('open', 'acknowledged', 'resolved'), defaultValue: 'open' },
    acknowledgedAt: { type: DataTypes.DATE },
  },
  { sequelize, modelName: 'Alert', tableName: 'alerts' }
);

module.exports = Alert;
