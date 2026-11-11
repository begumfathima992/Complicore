const { User, Role, Company, Employee } = require('../models');
const AppError = require('../utils/AppError');
const { scopeToChildWhere } = require('../utils/scopeToWhere');
const { canManageRole } = require('../services/permissionService');
const { generateTempPassword } = require('../utils/generatePassword');
const { recordAudit, actorContextFrom } = require('../services/auditService');
const { ROLES } = require('../config/permissions');

// Safety note: `{ ...(await scopeToChildWhere(scope)), id: X }` was the
// exact shape of the cross-employee IDOR bug found earlier (scope's own
// `id`/`employeeId` key getting silently overwritten by the literal one).
// It's safe here specifically because FEATURES.USERS only ever grants
// SUPER_ADMIN/EMPLOYER_ADMIN/HR_MANAGER access, all at FULL level, which
// resolveScope always turns into 'all' or 'company' scope for this
// feature (MANAGER/EMPLOYEE get NONE and are blocked at authorize()
// before reaching here) - and neither 'all' nor 'company' scope objects
// contain an `id` key to collide with. If FEATURES.USERS is ever loosened
// to grant MANAGER/EMPLOYEE access (which would resolve to 'own'/'team'/
// 'none' scope), switch these to scopeToEmployeeWhereById()'s Op.and
// pattern instead.
const INCLUDE = [
  Role,
  { model: Employee, attributes: ['id', 'firstName', 'lastName', 'employeeNumber'] },
  { model: Company, attributes: ['id', 'name'] },
];
const SAFE_ATTRS = { exclude: ['passwordHash'] };

/**
 * canManageRole()'s strict `actingLevel > targetLevel` check (reused
 * as-is for every other role, including for Role Management's own use of
 * it) means literally nobody - not even Super Admin - could ever satisfy
 * `100 > 100`, making Super Admin un-grantable by anyone. This is the one
 * explicit exception: only Super Admin may grant Super Admin, every other
 * grant still goes through the unmodified seniority check.
 */
function canGrantRole(actingRoleKey, targetRoleKey) {
  if (targetRoleKey === 'SUPER_ADMIN') return actingRoleKey === 'SUPER_ADMIN';
  return canManageRole(actingRoleKey, targetRoleKey);
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : email;
}

async function listUsers(req, res) {
  const where = await scopeToChildWhere(req.accessScope);
  const users = await User.findAll({ where, include: INCLUDE, attributes: SAFE_ATTRS, order: [['email', 'ASC']] });
  res.json({ users });
}

async function getUser(req, res) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const user = await User.findOne({ where, include: INCLUDE, attributes: SAFE_ATTRS });
  if (!user) throw new AppError('User not found or not accessible', 404);
  res.json({ user });
}

/**
 * Creates a login identity with a random temporary password, returned
 * ONCE in this response (bcrypt-hashed at rest via the User model's own
 * hook) - there is no email-sending flow yet, so whoever ran this must
 * relay it to the new user out of band.
 */
async function createUser(req, res) {
  const { roleKey, employeeId } = req.body;
  const email = normalizeEmail(req.body.email);
  if (!email || !roleKey) throw new AppError('email and roleKey are required', 400);
  if (!ROLES[roleKey]) throw new AppError(`Unknown role '${roleKey}'`, 400);

  if (!canGrantRole(req.user.role, roleKey)) {
    throw new AppError(`Role '${req.user.role}' cannot create a user with role '${roleKey}'`, 403);
  }
  if (roleKey === 'SUPER_ADMIN' && !req.body.confirmSuperAdmin) {
    throw new AppError('Creating a Super Admin requires confirmSuperAdmin: true', 400);
  }

  // Super Admin has no company of their own, so must name the target
  // tenant explicitly; every other role is pinned to their own company -
  // this is the actual tenant-isolation boundary for user creation.
  let companyId;
  if (req.user.role === 'SUPER_ADMIN') {
    companyId = req.body.companyId;
    if (!companyId) throw new AppError('companyId is required for Super Admin', 400);
    const company = await Company.findByPk(companyId);
    if (!company) throw new AppError('Company not found', 404);
  } else {
    companyId = req.user.companyId;
  }

  if (employeeId) {
    const employee = await Employee.findOne({ where: { id: employeeId, companyId } });
    if (!employee) throw new AppError('Employee not found in the target company', 400);
  }

  // Pre-check for a clean 409 in the common case; the unique index is the
  // real guarantee against a race between two concurrent creates.
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new AppError('This email already has an account – use Edit to change it', 409);
  }

  const role = await Role.findOne({ where: { key: roleKey } });
  const temporaryPassword = generateTempPassword();

  let user;
  try {
    user = await User.create({
      email,
      passwordHash: temporaryPassword, // hashed by the model's beforeCreate hook
      roleId: role.id,
      companyId,
      employeeId: employeeId || null,
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      throw new AppError('This email already has an account – use Edit to change it', 409);
    }
    throw err;
  }

  await recordAudit({
    entityType: 'User',
    entityId: user.id,
    action: 'create',
    fieldName: 'role',
    newValue: roleKey,
    ...actorContextFrom(req),
    companyId, // the target company, not necessarily the actor's own (Super Admin case)
  });

  const created = await User.findByPk(user.id, { include: INCLUDE, attributes: SAFE_ATTRS });
  res.status(201).json({ user: created, temporaryPassword });
}

async function updateUser(req, res) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const user = await User.findOne({ where, include: Role });
  if (!user) throw new AppError('User not found or not accessible', 404);

  // Seniority check on the account's CURRENT role, not just the new one -
  // an HR Manager must not be able to touch an Employer Admin's account
  // at all, even to make an unrelated change.
  if (!canManageRole(req.user.role, user.Role.key) && user.id !== req.user.id) {
    throw new AppError(`Role '${req.user.role}' cannot manage a user with role '${user.Role.key}'`, 403);
  }

  const updates = {};
  let roleChanged = false;

  if (req.body.roleKey && req.body.roleKey !== user.Role.key) {
    if (user.id === req.user.id) {
      throw new AppError('You cannot change your own role', 400);
    }
    if (!ROLES[req.body.roleKey]) throw new AppError(`Unknown role '${req.body.roleKey}'`, 400);
    if (!canGrantRole(req.user.role, req.body.roleKey)) {
      throw new AppError(`Role '${req.user.role}' cannot grant role '${req.body.roleKey}'`, 403);
    }
    if (req.body.roleKey === 'SUPER_ADMIN' && !req.body.confirmSuperAdmin) {
      throw new AppError('Assigning Super Admin requires confirmSuperAdmin: true', 400);
    }
    const newRole = await Role.findOne({ where: { key: req.body.roleKey } });
    updates.roleId = newRole.id;
    roleChanged = true;
  }

  let employeeChanged = false;
  if (req.body.employeeId !== undefined && req.body.employeeId !== user.employeeId) {
    if (req.body.employeeId) {
      const employee = await Employee.findOne({ where: { id: req.body.employeeId, companyId: user.companyId } });
      if (!employee) throw new AppError('Employee not found in this company', 400);
    }
    updates.employeeId = req.body.employeeId || null;
    employeeChanged = true;
  }

  // Either kind of change alters what req.user looks like on every
  // subsequent request (role -> different permissions, employeeId ->
  // different "own" scope), so every token already issued must stop
  // working - see middleware/authenticate.js.
  if (roleChanged || employeeChanged) {
    updates.tokenVersion = user.tokenVersion + 1;
  }

  const previousRoleKey = user.Role.key;
  await user.update(updates);

  if (roleChanged) {
    await recordAudit({
      entityType: 'User',
      entityId: user.id,
      action: 'update',
      fieldName: 'role',
      oldValue: previousRoleKey,
      newValue: req.body.roleKey,
      ...actorContextFrom(req),
      companyId: user.companyId, // the target user's company, not necessarily the actor's own
    });
  }
  if (employeeChanged) {
    await recordAudit({
      entityType: 'User',
      entityId: user.id,
      action: 'update',
      fieldName: 'employeeId',
      newValue: updates.employeeId,
      ...actorContextFrom(req),
      companyId: user.companyId,
    });
  }

  const updated = await User.findByPk(user.id, { include: INCLUDE, attributes: SAFE_ATTRS });
  res.json({ user: updated });
}

async function setActive(req, res, isActive) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const user = await User.findOne({ where, include: Role });
  if (!user) throw new AppError('User not found or not accessible', 404);

  if (user.id === req.user.id) {
    throw new AppError('Cannot deactivate your own account', 400);
  }
  if (!canManageRole(req.user.role, user.Role.key)) {
    throw new AppError(`Role '${req.user.role}' cannot manage a user with role '${user.Role.key}'`, 403);
  }

  await user.update({ isActive, tokenVersion: user.tokenVersion + 1 });
  await recordAudit({
    entityType: 'User',
    entityId: user.id,
    action: 'status_change',
    fieldName: 'isActive',
    oldValue: String(!isActive),
    newValue: String(isActive),
    ...actorContextFrom(req),
    companyId: user.companyId, // the target user's company, not necessarily the actor's own
  });

  const updated = await User.findByPk(user.id, { include: INCLUDE, attributes: SAFE_ATTRS });
  res.json({ user: updated });
}

const deactivateUser = (req, res) => setActive(req, res, false);
const reactivateUser = (req, res) => setActive(req, res, true);

module.exports = { listUsers, getUser, createUser, updateUser, deactivateUser, reactivateUser };
