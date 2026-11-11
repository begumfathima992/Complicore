const crypto = require('crypto');
const { RolePermissionRestriction } = require('../models');
const AppError = require('../utils/AppError');
const { ROLES } = require('../config/permissions');
const { platformPermissionKeysForRole, ALL_PERMISSION_KEYS } = require('../config/permissionKeys');
const { getEffectivePermissionKeys, canManageRole } = require('../services/permissionService');
const { recordAudit, actorContextFrom } = require('../services/auditService');

// Super Admin has no companyId of their own, so management calls must name
// one explicitly; every other role is pinned to their own company and may
// not act on another tenant's roles.
function resolveTargetCompanyId(req) {
  if (req.user.role === 'SUPER_ADMIN') {
    const companyId = req.query.companyId || req.body.companyId;
    if (!companyId) throw new AppError('companyId is required for Super Admin role-management calls', 400);
    return companyId;
  }
  return req.user.companyId;
}

async function listRoles(req, res) {
  const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;

  const roles = await Promise.all(
    Object.keys(ROLES).map(async (roleKey) => ({
      key: roleKey,
      name: ROLES[roleKey].name,
      level: ROLES[roleKey].level,
      permissions: Array.from(await getEffectivePermissionKeys(companyId, roleKey)).sort(),
    }))
  );

  res.json({ roles });
}

async function getRolePermissions(req, res) {
  const { roleKey } = req.params;
  if (!ROLES[roleKey]) throw new AppError(`Unknown role '${roleKey}'`, 404);

  const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;

  const ceiling = Array.from(platformPermissionKeysForRole(roleKey)).sort();
  const effective = Array.from(await getEffectivePermissionKeys(companyId, roleKey)).sort();
  const restricted = ceiling.filter((key) => !effective.includes(key));

  res.json({ role: roleKey, ceiling, effective, restricted });
}

/**
 * Body: { permissionKey, allowed }.
 * allowed=false narrows the role by writing a restriction row.
 * allowed=true removes any existing restriction, reverting to the platform
 * default - it can never grant a key outside the platform ceiling.
 */
async function updateRolePermission(req, res) {
  const { roleKey } = req.params;
  const { permissionKey, allowed } = req.body;

  if (!ROLES[roleKey]) throw new AppError(`Unknown role '${roleKey}'`, 404);
  if (!ALL_PERMISSION_KEYS.includes(permissionKey)) throw new AppError(`Unknown permission key '${permissionKey}'`, 400);
  if (typeof allowed !== 'boolean') throw new AppError('allowed (boolean) is required', 400);

  if (!canManageRole(req.user.role, roleKey)) {
    throw new AppError(`Role '${req.user.role}' cannot manage permissions for '${roleKey}'`, 403);
  }

  const companyId = resolveTargetCompanyId(req);
  const ceiling = platformPermissionKeysForRole(roleKey);

  if (!ceiling.has(permissionKey)) {
    throw new AppError(
      `'${permissionKey}' is outside the platform's default permission set for '${roleKey}' and cannot be granted`,
      403
    );
  }

  let entityId;
  if (allowed) {
    const existing = await RolePermissionRestriction.findOne({ where: { companyId, roleKey, permissionKey } });
    entityId = existing?.id || crypto.randomUUID();
    await RolePermissionRestriction.destroy({ where: { companyId, roleKey, permissionKey } });
  } else {
    const [row] = await RolePermissionRestriction.findOrCreate({ where: { companyId, roleKey, permissionKey } });
    entityId = row.id;
  }

  // Permission changes are among the most sensitive actions in the system -
  // always audited, regardless of which entity type they touch.
  await recordAudit({
    entityType: 'RolePermissionRestriction',
    entityId,
    action: 'update',
    fieldName: permissionKey,
    oldValue: allowed ? 'restricted' : 'allowed',
    newValue: allowed ? 'allowed' : 'restricted',
    ...actorContextFrom(req),
    companyId, // the target company, not necessarily the actor's own (Super Admin case)
  });

  const effective = Array.from(await getEffectivePermissionKeys(companyId, roleKey)).sort();
  res.json({ role: roleKey, effective });
}

module.exports = { listRoles, getRolePermissions, updateRolePermission };
