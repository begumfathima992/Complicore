const { EmployeeContractHistory, Employee, User } = require('../models');
const AppError = require('../utils/AppError');
const { scopeToEmployeeWhereById } = require('../utils/scopeToWhere');
const { recordAudit, actorContextFrom } = require('../services/auditService');
const { promoteContractVersionIfDue } = require('../services/scheduledChangeService');
const { assertDateAfter } = require('../utils/dateOrder');

const INCLUDE = [{ model: User, as: 'createdBy', attributes: ['id', 'email'] }];

/**
 * Full past/current/future timeline for one employee's contract terms -
 * lives under /employees/:employeeId/contract-history rather than the
 * general employee-edit form, same reasoning as ImmigrationDetail living
 * under the Right-to-Work resource: this is a sub-resource, not a field
 * on the main record.
 */
async function listVersions(req, res) {
  const employee = await Employee.findOne({ where: scopeToEmployeeWhereById(req.accessScope, req.params.employeeId) });
  if (!employee) throw new AppError('Employee not found or not accessible', 404);

  const versions = await EmployeeContractHistory.findAll({
    where: { employeeId: employee.id },
    include: INCLUDE,
    order: [['effectiveFrom', 'DESC']],
  });
  res.json({ versions });
}

/**
 * A new version always supersedes whatever's open-ended for this employee
 * - unlike VisaRecord/IdentityDocument there's no "does this replace the
 * current one?" ambiguity to ask about. If `effectiveFrom` is today/past
 * it's promoted immediately (mirrored onto the live Employee row); if
 * it's in the future it's left scheduled for the daily cron.
 */
async function createVersion(req, res) {
  const employee = await Employee.findOne({ where: scopeToEmployeeWhereById(req.accessScope, req.params.employeeId) });
  if (!employee) throw new AppError('Employee not found or not accessible', 404);

  const { effectiveFrom, jobTitle, salary, contractedHoursPerWeek, contractEndDate, workLocation, changeReason } = req.body;
  if (!effectiveFrom) throw new AppError('effectiveFrom is required', 400);

  // "Employed on" is read literally as Employee.startDate, not effectiveFrom.
  assertDateAfter(contractEndDate, employee.startDate, 'Contract end date must be after the start date (Employed on)');

  let version = await EmployeeContractHistory.create({
    employeeId: employee.id,
    companyId: employee.companyId,
    effectiveFrom,
    jobTitle,
    salary,
    contractedHoursPerWeek,
    contractEndDate,
    workLocation,
    changeReason,
    createdByUserId: req.user.id,
  });

  version = await promoteContractVersionIfDue(version);

  await recordAudit({
    entityType: 'EmployeeContractHistory',
    entityId: version.id,
    action: 'create',
    fieldName: 'effectiveFrom',
    newValue: effectiveFrom,
    employeeId: employee.id,
    ...actorContextFrom(req),
    companyId: employee.companyId, // overrides actorContextFrom's req.user.companyId, which is null for Super Admin
  });

  const created = await EmployeeContractHistory.findByPk(version.id, { include: INCLUDE });
  res.status(201).json({ version: created });
}

module.exports = { listVersions, createVersion };
