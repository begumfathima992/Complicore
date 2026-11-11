const { RolePermissionRestriction } = require('../models');
const { platformPermissionKeysForRole, ALL_PERMISSION_KEYS, ROLES } = require('../config/permissionKeys');

/**
 * Effective permission keys for a role within a company = platform ceiling
 * minus anything a RolePermissionRestriction has revoked for that company.
 * There is no way to end up with MORE than the platform ceiling here -
 * see the RolePermissionRestriction model comment for why that's deny-only
 * by design.
 */
async function getEffectivePermissionKeys(companyId, roleKey) {
  const ceiling = platformPermissionKeysForRole(roleKey);
  if (!companyId) return ceiling; // Super Admin acting platform-wide: no company to scope restrictions to

  const restrictions = await RolePermissionRestriction.findAll({
    where: { companyId, roleKey },
    attributes: ['permissionKey'],
  });
  const revoked = new Set(restrictions.map((r) => r.permissionKey));

  return new Set([...ceiling].filter((key) => !revoked.has(key)));
}

async function hasPermissionKey(companyId, roleKey, permissionKey) {
  const effective = await getEffectivePermissionKeys(companyId, roleKey);
  return effective.has(permissionKey);
}

/**
 * Guards a Role Management write: `actingRoleKey` may only restrict roles
 * strictly below its own seniority - HR Manager can narrow Manager/Employee
 * permissions, but never Employer Admin's or another HR Manager's.
 */
function canManageRole(actingRoleKey, targetRoleKey) {
  const actingLevel = ROLES[actingRoleKey]?.level ?? -1;
  const targetLevel = ROLES[targetRoleKey]?.level ?? Infinity;
  return actingLevel > targetLevel;
}

module.exports = { getEffectivePermissionKeys, hasPermissionKey, canManageRole, ALL_PERMISSION_KEYS };
