const { RightToWorkCheck, Employee, Document, User, ImmigrationDetail } = require('../models');
const AppError = require('../utils/AppError');
const { scopeToChildWhere, scopeToEmployeeWhereById } = require('../utils/scopeToWhere');
const { syncRightToWorkAlerts } = require('../services/alertService');
const { recordAudit, snapshotChanges, recordFieldChanges, actorContextFrom } = require('../services/auditService');
const { normalizeNiNumber, isValidNiNumber } = require('../utils/ukValidators');
const { maskValue, canSeeUnmasked } = require('../utils/maskSensitive');

// visaType/visaExpiry/shareCode/sponsorshipReference moved to VisaRecord
// (see controllers/visaRecordController.js) - ImmigrationDetail now only
// holds the fields below.
const IMMIGRATION_DETAIL_FIELDS = ['nationality', 'niNumber', 'rightToWorkStatus', 'complianceStatus', 'settlementStatus'];

/** niNumber is masked in every response outside SUPER_ADMIN/EMPLOYER_ADMIN/HR_MANAGER, same tier as passport number/share code. */
function serializeImmigrationDetail(detail, roleKey) {
  if (!detail) return detail;
  const json = detail.toJSON();
  if (!canSeeUnmasked(roleKey)) json.niNumber = maskValue(json.niNumber);
  return json;
}

const INCLUDE = [
  { model: Employee, attributes: ['id', 'firstName', 'lastName', 'employeeNumber'] },
  { model: Document, as: 'evidenceDocument' },
  { model: User, as: 'checkedBy', attributes: ['id', 'email'] },
];

async function listChecks(req, res) {
  const where = await scopeToChildWhere(req.accessScope);
  if (req.query.employeeId) where.employeeId = req.query.employeeId;

  const checks = await RightToWorkCheck.findAll({
    where,
    include: INCLUDE,
    order: [['checkDate', 'DESC']],
  });
  res.json({ checks });
}

async function getCheck(req, res) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const check = await RightToWorkCheck.findOne({ where, include: INCLUDE });
  if (!check) throw new AppError('Right-to-work check not found or not accessible', 404);
  res.json({ check });
}

async function createCheck(req, res) {
  const { employeeId } = req.body;
  if (!employeeId) throw new AppError('employeeId is required', 400);

  // Confirm the employee is within the caller's scope before allowing the write.
  const employee = await Employee.findOne({ where: scopeToEmployeeWhereById(req.accessScope, employeeId) });
  if (!employee) throw new AppError('Employee not found or not accessible', 404);

  const check = await RightToWorkCheck.create({
    ...req.body,
    companyId: employee.companyId,
    checkedByUserId: req.user.id,
  });

  await recordAudit({
    entityType: 'RightToWorkCheck',
    entityId: check.id,
    action: 'create',
    fieldName: 'status',
    newValue: check.status,
    employeeId,
    ...actorContextFrom(req),
    companyId: employee.companyId, // overrides actorContextFrom's req.user.companyId, which is null for Super Admin
  });
  await syncRightToWorkAlerts();

  const created = await RightToWorkCheck.findByPk(check.id, { include: INCLUDE });
  res.status(201).json({ check: created });
}

async function updateCheck(req, res) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const check = await RightToWorkCheck.findOne({ where });
  if (!check) throw new AppError('Right-to-work check not found or not accessible', 404);

  const { employeeId, companyId, checkedByUserId, ...updates } = req.body;
  const changes = snapshotChanges(check, updates);
  await check.update(updates);
  await recordFieldChanges('RightToWorkCheck', check.id, changes, {
    employeeId: check.employeeId,
    ...actorContextFrom(req),
    companyId: check.companyId,
  });
  await syncRightToWorkAlerts();

  res.json({ check });
}

/**
 * ImmigrationDetail (nationality, visa, right-to-work status, EU
 * Settlement Scheme status, ...) is a 1:1 sub-record of Employee that
 * lives under the right-to-work resource rather than the general
 * employee-edit form, so it inherits RIGHT_TO_WORK's stricter permission
 * (view-only for Manager, edit for HR/Employer/Super) instead of the
 * broader EMPLOYEES permission.
 */
async function getImmigrationDetail(req, res) {
  const employee = await Employee.findOne({ where: scopeToEmployeeWhereById(req.accessScope, req.params.employeeId) });
  if (!employee) throw new AppError('Employee not found or not accessible', 404);

  const detail = await ImmigrationDetail.findOne({ where: { employeeId: employee.id } });
  res.json({ immigrationDetail: serializeImmigrationDetail(detail, req.user.role) });
}

async function upsertImmigrationDetail(req, res) {
  const employee = await Employee.findOne({ where: scopeToEmployeeWhereById(req.accessScope, req.params.employeeId) });
  if (!employee) throw new AppError('Employee not found or not accessible', 404);

  // Only the real content fields are diffed for the audit trail - the
  // bookkeeping fields below would otherwise "change" on every save and
  // drown the actual history in noise.
  const contentUpdates = Object.fromEntries(
    Object.entries(req.body).filter(([key]) => IMMIGRATION_DETAIL_FIELDS.includes(key))
  );

  if (contentUpdates.niNumber) {
    contentUpdates.niNumber = normalizeNiNumber(contentUpdates.niNumber);
    if (!isValidNiNumber(contentUpdates.niNumber)) {
      throw new AppError('NI number must be a valid UK format, e.g. AB123456C', 400);
    }
  }

  const dbUpdates = { ...contentUpdates, lastCheckedAt: new Date(), lastCheckedByUserId: req.user.id };

  let detail = await ImmigrationDetail.findOne({ where: { employeeId: employee.id } });

  if (!detail) {
    detail = await ImmigrationDetail.create({ ...dbUpdates, employeeId: employee.id });
    await recordAudit({
      entityType: 'ImmigrationDetail',
      entityId: detail.id,
      action: 'create',
      employeeId: employee.id,
      ...actorContextFrom(req),
      companyId: employee.companyId, // overrides actorContextFrom's req.user.companyId, which is null for Super Admin
    });
  } else {
    const changes = snapshotChanges(detail, contentUpdates);
    await detail.update(dbUpdates);
    await recordFieldChanges('ImmigrationDetail', detail.id, changes, {
      employeeId: employee.id,
      ...actorContextFrom(req),
      companyId: employee.companyId,
    });
  }

  res.json({ immigrationDetail: serializeImmigrationDetail(detail, req.user.role) });
}

module.exports = { listChecks, getCheck, createCheck, updateCheck, getImmigrationDetail, upsertImmigrationDetail };
