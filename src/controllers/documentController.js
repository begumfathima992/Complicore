const { Document, Employee, User } = require('../models');
const AppError = require('../utils/AppError');
const { scopeToChildWhere, scopeToEmployeeWhereById } = require('../utils/scopeToWhere');
const { syncDocumentAlerts } = require('../services/alertService');
const { recordAudit, snapshotChanges, recordFieldChanges, actorContextFrom } = require('../services/auditService');

const INCLUDE = [
  { model: Employee, attributes: ['id', 'firstName', 'lastName', 'employeeNumber'] },
  { model: User, as: 'uploadedBy', attributes: ['id', 'email'] },
];

async function listDocuments(req, res) {
  const where = await scopeToChildWhere(req.accessScope);
  if (req.query.employeeId) where.employeeId = req.query.employeeId;
  if (req.query.documentType) where.documentType = req.query.documentType;
  if (req.query.includeSuperseded !== 'true') where.isCurrent = true;

  const documents = await Document.findAll({ where, include: INCLUDE, order: [['uploadDate', 'DESC']] });
  res.json({ documents });
}

async function getDocument(req, res) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const document = await Document.findOne({ where, include: INCLUDE });
  if (!document) throw new AppError('Document not found or not accessible', 404);
  res.json({ document });
}

/**
 * Registers a document (metadata only - `fileUrl` points at the already
 * uploaded object, e.g. an S3 key from a pre-signed upload). If the
 * employee already has a current document of the same type, that one is
 * superseded rather than deleted: version is bumped and the old row is
 * kept for audit purposes with isCurrent=false.
 */
async function uploadDocument(req, res) {
  const { employeeId, documentType } = req.body;
  if (!employeeId || !documentType) throw new AppError('employeeId and documentType are required', 400);

  const employee = await Employee.findOne({ where: scopeToEmployeeWhereById(req.accessScope, employeeId) });
  if (!employee) throw new AppError('Employee not found or not accessible', 404);

  const previous = await Document.findOne({
    where: { employeeId, documentType, isCurrent: true },
    order: [['version', 'DESC']],
  });

  if (previous) await previous.update({ isCurrent: false });

  const document = await Document.create({
    ...req.body,
    companyId: employee.companyId,
    uploadedByUserId: req.user.id,
    version: previous ? previous.version + 1 : 1,
    isCurrent: true,
  });

  await recordAudit({
    entityType: 'Document',
    entityId: document.id,
    action: 'create',
    fieldName: 'documentType',
    newValue: `${documentType} (v${document.version})`,
    employeeId,
    ...actorContextFrom(req),
  });
  await syncDocumentAlerts();

  const created = await Document.findByPk(document.id, { include: INCLUDE });
  res.status(201).json({ document: created });
}

async function updateDocument(req, res) {
  // Verifying a document's compliance status is an HR/manager judgment call,
  // never something an employee can do to their own record.
  if (req.accessScope.type === 'own') {
    throw new AppError('Not permitted to change document status', 403);
  }

  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const document = await Document.findOne({ where });
  if (!document) throw new AppError('Document not found or not accessible', 404);

  // Status/expiry edits only - re-uploading a new file goes through
  // uploadDocument() so the old version is retained.
  const { status, expiryDate } = req.body;
  const updates = {
    ...(status !== undefined && { status }),
    ...(expiryDate !== undefined && { expiryDate }),
  };
  const changes = snapshotChanges(document, updates);
  await document.update(updates);
  await recordFieldChanges('Document', document.id, changes, {
    employeeId: document.employeeId,
    ...actorContextFrom(req),
  });

  await syncDocumentAlerts();
  res.json({ document });
}

module.exports = { listDocuments, getDocument, uploadDocument, updateDocument };
