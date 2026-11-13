const { Op } = require('sequelize');
const { Employee, ImmigrationDetail, EmergencyContact, Department } = require('../models');
const AppError = require('../utils/AppError');
const { scopeToEmployeeWhere, scopeToEmployeeWhereById } = require('../utils/scopeToWhere');
const { FEATURES } = require('../config/permissions');
const { recordAudit, snapshotChanges, recordFieldChanges, actorContextFrom } = require('../services/auditService');
const { normalizeUkPhone, isValidUkPhone } = require('../utils/ukValidators');
const { assertDateAfter } = require('../utils/dateOrder');
const { maskValue, canSeeUnmasked } = require('../utils/maskSensitive');

/**
 * `employee.ImmigrationDetail` is a nested association, not something
 * rightToWorkController.js's own masking (applied only to its own,
 * separate /immigration-detail endpoint) ever touches - so niNumber must
 * be masked here too, for anyone viewing it through the Employee record
 * itself (e.g. a Manager, who holds RIGHT_TO_WORK:VIEW and so gets
 * ImmigrationDetail included per includeForScope() below).
 */
function serializeEmployee(employee, roleKey) {
  const json = employee.toJSON();
  if (json.ImmigrationDetail && !canSeeUnmasked(roleKey)) {
    json.ImmigrationDetail.niNumber = maskValue(json.ImmigrationDetail.niNumber);
  }
  return json;
}

/** Normalizes `telephone` in place if present; throws a 400 if it's not a valid UK number. */
function validatePhone(fields) {
  if (!fields.telephone) return;
  fields.telephone = normalizeUkPhone(fields.telephone);
  if (!isValidUkPhone(fields.telephone)) {
    throw new AppError('Phone must be a valid UK number, e.g. 07700 900000 or +44 7700 900000', 400);
  }
}

const BASE_INCLUDE = [
  { model: Department },
  { model: EmergencyContact },
  { model: Employee, as: 'manager', attributes: ['id', 'firstName', 'lastName', 'jobTitle'] },
];

// Right-to-work / immigration data is only ever attached when the caller
// also holds RIGHT_TO_WORK access - a Manager can list/view employees but
// must not see visa/compliance fields.
function includeForScope(req) {
  const include = [...BASE_INCLUDE];
  if (req.accessScope.feature === FEATURES.EMPLOYEES) {
    const { canPerform } = require('../config/permissions');
    if (canPerform(req.user.role, FEATURES.RIGHT_TO_WORK, 'read')) {
      include.push({ model: ImmigrationDetail });
    }
  }
  return include;
}

async function listEmployees(req, res) {
  const where = scopeToEmployeeWhere(req.accessScope);

  if (req.query.search) {
    where[Op.or] = [
      { firstName: { [Op.iLike]: `%${req.query.search}%` } },
      { lastName: { [Op.iLike]: `%${req.query.search}%` } },
      { employeeNumber: { [Op.iLike]: `%${req.query.search}%` } },
    ];
  }

  const employees = await Employee.findAll({ where, include: includeForScope(req) });
  res.json({ employees: employees.map((e) => serializeEmployee(e, req.user.role)) });
}

async function getEmployee(req, res) {
  const where = scopeToEmployeeWhereById(req.accessScope, req.params.id);
  const employee = await Employee.findOne({ where, include: includeForScope(req) });
  if (!employee) throw new AppError('Employee not found or not accessible', 404);
  res.json({ employee: serializeEmployee(employee, req.user.role) });
}

async function createEmployee(req, res) {
  if (req.accessScope.type === 'own' || req.accessScope.type === 'none') {
    throw new AppError('Not permitted to create employees', 403);
  }

  const {
    emergencyContact,
    immigration,
    ...employeeFields
  } = req.body;

  validatePhone(employeeFields);
  assertDateAfter(
    employeeFields.contractEndDate,
    employeeFields.startDate,
    'Contract end date must be after the start date (Employed on)'
  );

  const employee = await Employee.create({
    ...employeeFields,
    companyId: req.user.companyId,
  });

  await recordAudit({
    entityType: 'Employee',
    entityId: employee.id,
    action: 'create',
    employeeId: employee.id,
    ...actorContextFrom(req),
  });

  if (emergencyContact) {
    await EmergencyContact.create({ ...emergencyContact, employeeId: employee.id });
  }

  if (immigration && require('../config/permissions').canPerform(req.user.role, FEATURES.RIGHT_TO_WORK, 'create')) {
    await ImmigrationDetail.create({ ...immigration, employeeId: employee.id });
  }

  const created = await Employee.findByPk(employee.id, { include: includeForScope(req) });
  res.status(201).json({ employee: serializeEmployee(created, req.user.role) });
}

async function updateEmployee(req, res) {
  const where = scopeToEmployeeWhereById(req.accessScope, req.params.id);
  const employee = await Employee.findOne({ where });
  if (!employee) throw new AppError('Employee not found or not accessible', 404);

  // Employees editing their "own" record may only touch contact fields,
  // never employment/compliance fields.
  const allowedFields =
    req.accessScope.type === 'own'
      ? ['telephone', 'addressLine1', 'addressLine2', 'city', 'postcode']
      : Object.keys(req.body);

  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([key]) => allowedFields.includes(key))
  );

  validatePhone(updates);
  // Validated against whichever startDate/contractEndDate are in effect
  // after this update - the new value if it's being changed, else the
  // employee's existing one.
  assertDateAfter(
    updates.contractEndDate ?? employee.contractEndDate,
    updates.startDate ?? employee.startDate,
    'Contract end date must be after the start date (Employed on)'
  );

  const changes = snapshotChanges(employee, updates);
  await employee.update(updates);
  await recordFieldChanges('Employee', employee.id, changes, {
    employeeId: employee.id,
    ...actorContextFrom(req),
    companyId: employee.companyId, // overrides actorContextFrom's req.user.companyId, which is null for Super Admin
  });

  res.json({ employee });
}

async function deleteEmployee(req, res) {
  if (req.accessScope.level !== 'full') {
    throw new AppError('Not permitted to delete employees', 403);
  }
  const where = scopeToEmployeeWhereById(req.accessScope, req.params.id);
  const employee = await Employee.findOne({ where });
  if (!employee) throw new AppError('Employee not found or not accessible', 404);

  // Soft delete: sponsor-compliance records must be retained, not erased.
  const previousStatus = employee.employmentStatus;
  await employee.update({ employmentStatus: 'terminated' });
  await recordAudit({
    entityType: 'Employee',
    entityId: employee.id,
    action: 'status_change',
    fieldName: 'employmentStatus',
    oldValue: previousStatus,
    newValue: 'terminated',
    employeeId: employee.id,
    ...actorContextFrom(req),
    companyId: employee.companyId,
  });
  res.json({ employee });
}

module.exports = { listEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee };
