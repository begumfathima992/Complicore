const AppError = require('../utils/AppError');
const { getAccessLevel, canPerform, ACCESS_LEVELS } = require('../config/permissions');
const { KEY_MAP } = require('../config/permissionKeys');
const { hasPermissionKey } = require('../services/permissionService');

/**
 * Resolves *which records* a role may see/act on for a given access level.
 * This is deliberately separate from the access-level lookup: "full" means
 * "every company" for SUPER_ADMIN but "my company only" for everyone else;
 * "limited"/"approve" mean "my direct reports" for MANAGER; "own"/"request"
 * mean "my own record" for EMPLOYEE.
 */
function resolveScope(user, level) {
  if (user.role === 'SUPER_ADMIN' && level === ACCESS_LEVELS.FULL) {
    return { type: 'all' };
  }
  if (level === ACCESS_LEVELS.NONE) {
    return { type: 'none' };
  }
  if (
    level === ACCESS_LEVELS.OWN ||
    level === ACCESS_LEVELS.REQUEST ||
    level === ACCESS_LEVELS.SELF_MANAGE ||
    level === ACCESS_LEVELS.SELF_FULL
  ) {
    return { type: 'own', employeeId: user.employeeId };
  }
  if (
    user.role === 'MANAGER' &&
    (level === ACCESS_LEVELS.LIMITED || level === ACCESS_LEVELS.APPROVE || level === ACCESS_LEVELS.VIEW)
  ) {
    return { type: 'team', managerId: user.employeeId, companyId: user.companyId };
  }
  // FULL / LIMITED / VIEW for EMPLOYER_ADMIN / HR_MANAGER, or any other case
  return { type: 'company', companyId: user.companyId };
}

/**
 * Route guard factory: authorize(FEATURES.EMPLOYEES, 'update')
 * - 403s if the caller's role has no permission to perform the action
 *   under the platform's static matrix (config/permissions.js)
 * - 403s if a company admin has additionally restricted this specific
 *   granular permission for the caller's role (see Role Management /
 *   services/permissionService.js) - restrictions can only narrow the
 *   static matrix, never widen it
 * - otherwise attaches req.accessScope so controllers can filter queries
 */
function authorize(feature, action) {
  return async (req, res, next) => {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const level = getAccessLevel(req.user.role, feature);

    if (!canPerform(req.user.role, feature, action)) {
      throw new AppError(`Role '${req.user.role}' cannot '${action}' on '${feature}'`, 403);
    }

    const permissionKey = KEY_MAP[`${feature}:${action}`];
    if (permissionKey) {
      const allowed = await hasPermissionKey(req.user.companyId, req.user.role, permissionKey);
      if (!allowed) {
        throw new AppError(`Permission '${permissionKey}' has been restricted for this role`, 403);
      }
    }

    req.accessScope = { feature, action, level, ...resolveScope(req.user, level) };
    next();
  };
}

module.exports = authorize;
