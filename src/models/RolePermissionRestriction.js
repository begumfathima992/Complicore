const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

/**
 * A company-level override that REVOKES one granular permission key (e.g.
 * 'compliance.manage') from one role, within one company.
 *
 * This is deny-only by design: the platform's static role matrix
 * (config/permissions.js + config/permissionKeys.js) is the ceiling - a
 * company can narrow what a role is allowed to do, but can never grant a
 * role capability the platform doesn't already allow, since that would let
 * a tenant escalate privilege on its own. See services/permissionService.js
 * for where this is enforced, and controllers/roleController.js for the
 * management API.
 */
class RolePermissionRestriction extends Model {}

RolePermissionRestriction.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    companyId: { type: DataTypes.UUID, allowNull: false },
    roleKey: { type: DataTypes.STRING, allowNull: false },
    permissionKey: { type: DataTypes.STRING, allowNull: false },
  },
  {
    sequelize,
    modelName: 'RolePermissionRestriction',
    tableName: 'role_permission_restrictions',
    indexes: [{ unique: true, fields: ['company_id', 'role_key', 'permission_key'] }],
  }
);

module.exports = RolePermissionRestriction;
