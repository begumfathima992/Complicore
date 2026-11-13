const { VisaRecord, Employee, User, Document } = require('../models');
const AppError = require('../utils/AppError');
const { scopeToEmployeeWhereById } = require('../utils/scopeToWhere');
const { recordAudit, actorContextFrom } = require('../services/auditService');
const { promoteVisaRecordIfDue } = require('../services/scheduledChangeService');
const { syncVisaRecordAlerts } = require('../services/alertService');
const { maskValue, canSeeUnmasked } = require('../utils/maskSensitive');
const { normalizeShareCode, isValidShareCode } = require('../utils/ukValidators');

const INCLUDE = [
  { model: User, as: 'createdBy', attributes: ['id', 'email'] },
  { model: Document, attributes: ['id', 'fileName'] },
];

function serialize(record, roleKey) {
  const json = record.toJSON();
  if (!canSeeUnmasked(roleKey)) json.shareCode = maskValue(json.shareCode);
  return json;
}

/**
 * Full past/current/future visa history for one employee - replaces the
 * single visaType/visaExpiry/shareCode fields that used to live on
 * ImmigrationDetail (see the migration that moved them here). `shareCode`
 * is masked below for anyone outside SUPER_ADMIN/EMPLOYER_ADMIN/HR_MANAGER,
 * same treatment as a passport number.
 */
async function listRecords(req, res) {
  const employee = await Employee.findOne({ where: scopeToEmployeeWhereById(req.accessScope, req.params.employeeId) });
  if (!employee) throw new AppError('Employee not found or not accessible', 404);

  const records = await VisaRecord.findAll({
    where: { employeeId: employee.id },
    include: INCLUDE,
    order: [['startDate', 'DESC']],
  });
  res.json({ records: records.map((r) => serialize(r, req.user.role)) });
}

/**
 * `supersedesCurrent: true` means "this is the employee's new current
 * visa" - promoted immediately if `startDate` is today/past, or left
 * scheduled for the daily cron if it's a future-dated renewal already
 * granted. Without it, the record is just added as additional history
 * (e.g. backfilling an old expired visa) without touching isCurrent.
 */
async function createRecord(req, res) {
  const employee = await Employee.findOne({ where: scopeToEmployeeWhereById(req.accessScope, req.params.employeeId) });
  if (!employee) throw new AppError('Employee not found or not accessible', 404);

  const { visaType, startDate, expiryDate, sponsorshipReference, documentId, notes, supersedesCurrent } = req.body;

  let shareCode = req.body.shareCode;
  if (shareCode) {
    shareCode = normalizeShareCode(shareCode);
    if (!isValidShareCode(shareCode)) {
      throw new AppError('Share code must be exactly 9 letters/numbers', 400);
    }
  }

  let record = await VisaRecord.create({
    employeeId: employee.id,
    companyId: employee.companyId,
    visaType,
    shareCode,
    startDate,
    expiryDate,
    sponsorshipReference,
    documentId: documentId || null,
    notes,
    supersedesCurrent: !!supersedesCurrent,
    createdByUserId: req.user.id,
  });

  record = await promoteVisaRecordIfDue(record);

  await recordAudit({
    entityType: 'VisaRecord',
    entityId: record.id,
    action: 'create',
    fieldName: 'visaType',
    newValue: visaType,
    employeeId: employee.id,
    ...actorContextFrom(req),
    companyId: employee.companyId, // overrides actorContextFrom's req.user.companyId, which is null for Super Admin
  });
  await syncVisaRecordAlerts();

  const created = await VisaRecord.findByPk(record.id, { include: INCLUDE });
  res.status(201).json({ record: serialize(created, req.user.role) });
}

module.exports = { listRecords, createRecord };
