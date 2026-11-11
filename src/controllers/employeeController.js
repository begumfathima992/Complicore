const { Op } = require('sequelize');
const { Employee, ImmigrationDetail, EmergencyContact, Department } = require('../models');
const AppError = require('../utils/AppError');
const { scopeToEmployeeWhere, scopeToEmployeeWhereById } = require('../utils/scopeToWhere');
const { FEATURES } = require('../config/permissions');
const { recordAudit, snapshotChanges, recordFieldChanges, actorContextFrom } = require('../services/auditService');

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
  res.json({ employees });
}

async function getEmployee(req, res) {
  const where = scopeToEmployeeWhereById(req.accessScope, req.params.id);
  const employee = await Employee.findOne({ where, include: includeForScope(req) });
  if (!employee) throw new AppError('Employee not found or not accessible', 404);
  res.json({ employee });
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
  res.status(201).json({ employee: created });
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

  const changes = snapshotChanges(employee, updates);
  await employee.update(updates);
  await recordFieldChanges('Employee', employee.id, changes, {
    employeeId: employee.id,
    ...actorContextFrom(req),
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
  });
  res.json({ employee });
}

module.exports = { listEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee };
