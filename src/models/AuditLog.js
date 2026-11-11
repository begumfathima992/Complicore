const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

/**
 * WHO / WHAT / WHEN / WHERE / OLD VALUE / NEW VALUE, one row per changed
 * field. Tamper-resistance has two layers:
 *
 * 1. App layer (always active): `hash` chains each row to the previous
 *    one (`previousHash`) via services/auditService.js, the same principle
 *    as a blockchain - editing or deleting any historical row breaks the
 *    chain, which verifyIntegrity() detects. No update/delete route is
 *    ever exposed for this model (see routes/auditRoutes.js).
 * 2. DB layer (recommended for production - see scripts/lockAuditLog.sql):
 *    REVOKE UPDATE/DELETE on this table from the application's database
 *    role, so even a compromised app process can't rewrite history. This
 *    only works if the app connects as a role that is NOT the table owner
 *    (a Postgres table owner bypasses REVOKE) - see the script's comments.
 */
class AuditLog extends Model {}

AuditLog.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

    entityType: { type: DataTypes.STRING, allowNull: false }, // e.g. 'Employee'
    entityId: { type: DataTypes.UUID, allowNull: false },
    action: {
      type: DataTypes.ENUM('create', 'update', 'delete', 'status_change', 'upload', 'view', 'download'),
      allowNull: false,
    },
    fieldName: { type: DataTypes.STRING }, // e.g. 'jobTitle' - null for whole-record create/delete
    oldValue: { type: DataTypes.TEXT },
    newValue: { type: DataTypes.TEXT },

    performedByRoleKey: { type: DataTypes.STRING, allowNull: false }, // WHO (role)
    ipAddress: { type: DataTypes.STRING }, // WHERE
    userAgent: { type: DataTypes.STRING },

    // WHO (person) + WHAT this change was about, when the entity is
    // employee-scoped - e.g. the "John Smith / Role changed" example.
    performedByUserId: { type: DataTypes.UUID },
    employeeId: { type: DataTypes.UUID },

    companyId: { type: DataTypes.UUID, allowNull: false },

    previousHash: { type: DataTypes.STRING },
    hash: { type: DataTypes.STRING, allowNull: false },
  },
  {
    sequelize,
    modelName: 'AuditLog',
    tableName: 'audit_logs',
    updatedAt: false, // immutable - see model comment
  }
);

module.exports = AuditLog;
