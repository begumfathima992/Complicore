const { IdentityDocument, Employee, User, Document } = require('../models');
const AppError = require('../utils/AppError');
const { scopeToEmployeeWhereById } = require('../utils/scopeToWhere');
const { recordAudit, actorContextFrom } = require('../services/auditService');
const { promoteIdentityDocumentIfDue } = require('../services/scheduledChangeService');
const { syncIdentityDocumentAlerts } = require('../services/alertService');
const { maskValue, canSeeUnmasked } = require('../utils/maskSensitive');

const INCLUDE = [
  { model: User, as: 'createdBy', attributes: ['id', 'email'] },
  { model: Document, attributes: ['id', 'fileName'] },
];

/**
 * Serializes one record for the response - unmasked + audited as a 'view'
 * for SUPER_ADMIN/EMPLOYER_ADMIN/HR_MANAGER, masked (and not audited,
 * since the real number was never sent) for everyone else. This is the
 * one place a *view* (not just a change) of sensitive data gets an audit
 * row, per the brief.
 */
async function serializeAndAudit(record, req) {
  const json = record.toJSON();
  if (canSeeUnmasked(req.user.role)) {
    await recordAudit({
      entityType: 'IdentityDocument',
      entityId: record.id,
      action: 'view',
      fieldName: 'documentNumber',
      employeeId: record.employeeId,
      ...actorContextFrom(req),
      companyId: record.companyId, // overrides actorContextFrom's req.user.companyId, which is null for Super Admin
    });
  } else {
    json.documentNumber = maskValue(json.documentNumber);
  }
  return json;
}

/**
 * Full passport/national-ID/BRP history for one employee - the source of
 * truth, optionally linked to an uploaded scan in the Documents vault via
 * `documentId`. An employee can hold several current records at once
 * (dual nationality) since `isCurrent` is scoped per (employeeId, type).
 */
async function listDocuments(req, res) {
  const employee = await Employee.findOne({ where: scopeToEmployeeWhereById(req.accessScope, req.params.employeeId) });
  if (!employee) throw new AppError('Employee not found or not accessible', 404);

  const documents = await IdentityDocument.findAll({
    where: { employeeId: employee.id },
    include: INCLUDE,
    order: [['issueDate', 'DESC']],
  });

  const serialized = [];
  for (const doc of documents) serialized.push(await serializeAndAudit(doc, req));
  res.json({ documents: serialized });
}

/**
 * `supersedesCurrent: true` means "this replaces the current record for
 * this employee+type" - promoted immediately if `issueDate` is today/past,
 * or left scheduled for the daily cron if it's a future-dated renewal
 * already issued.
 */
async function createDocument(req, res) {
  const employee = await Employee.findOne({ where: scopeToEmployeeWhereById(req.accessScope, req.params.employeeId) });
  if (!employee) throw new AppError('Employee not found or not accessible', 404);

  const { type, documentNumber, issuingCountry, nationality, issueDate, expiryDate, documentId, notes, supersedesCurrent } = req.body;

  let doc = await IdentityDocument.create({
    employeeId: employee.id,
    companyId: employee.companyId,
    type: type || 'passport',
    documentNumber,
    issuingCountry,
    nationality,
    issueDate,
    expiryDate,
    documentId: documentId || null,
    notes,
    supersedesCurrent: !!supersedesCurrent,
    createdByUserId: req.user.id,
  });

  doc = await promoteIdentityDocumentIfDue(doc);

  await recordAudit({
    entityType: 'IdentityDocument',
    entityId: doc.id,
    action: 'create',
    fieldName: 'type',
    newValue: doc.type,
    employeeId: employee.id,
    ...actorContextFrom(req),
    companyId: employee.companyId, // overrides actorContextFrom's req.user.companyId, which is null for Super Admin
  });
  await syncIdentityDocumentAlerts();

  const created = await IdentityDocument.findByPk(doc.id, { include: INCLUDE });
  res.status(201).json({ document: await serializeAndAudit(created, req) });
}

module.exports = { listDocuments, createDocument };
