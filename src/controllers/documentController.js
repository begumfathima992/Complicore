const { Document, Employee, User } = require('../models');
const AppError = require('../utils/AppError');
const { scopeToChildWhere, scopeToEmployeeWhereById } = require('../utils/scopeToWhere');
const { syncDocumentAlerts } = require('../services/alertService');
const { recordAudit, snapshotChanges, recordFieldChanges, actorContextFrom } = require('../services/auditService');
const storageService = require('../services/storageService');

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
 * Step 1 of the upload flow: validates permission + employee scope +
 * declared file type/size, pre-generates the document's id so the R2
 * object key can embed it (company/{companyId}/employee/{employeeId}/
 * {documentId}-v{version}.ext), and returns a short-lived pre-signed PUT.
 * No DB row is created here - that happens in createDocument() once the
 * client confirms the upload actually completed, so a client that never
 * finishes the PUT never leaves a dangling "document" with no file.
 */
async function getUploadUrl(req, res) {
  const { employeeId, documentType, fileName, contentType, fileSizeBytes } = req.body;
  if (!employeeId || !documentType || !contentType || !fileSizeBytes) {
    throw new AppError('employeeId, documentType, contentType and fileSizeBytes are required', 400);
  }

  const employee = await Employee.findOne({ where: scopeToEmployeeWhereById(req.accessScope, employeeId) });
  if (!employee) throw new AppError('Employee not found or not accessible', 404);

  const previous = await Document.findOne({ where: { employeeId, documentType, isCurrent: true } });
  const version = previous ? previous.version + 1 : 1;
  const documentId = storageService.generateDocumentId();

  const { uploadUrl, key, expiresInSeconds } = await storageService.createUploadUrl({
    companyId: employee.companyId,
    employeeId,
    documentId,
    version,
    contentType,
    fileSizeBytes,
  });

  res.json({ documentId, uploadUrl, key, version, expiresInSeconds, fileName });
}

/**
 * Step 2: the client has PUT the file to R2 using the pre-signed URL from
 * getUploadUrl() and now confirms it - creates the Document row with the
 * SAME id/key/version computed above. Supersedes any previous current
 * document of the same type, exactly as before.
 */
async function createDocument(req, res) {
  const { documentId, employeeId, documentType, fileKey, fileName, version, expiryDate } = req.body;
  if (!documentId || !employeeId || !documentType || !fileKey || !version) {
    throw new AppError('documentId, employeeId, documentType, fileKey and version are required', 400);
  }

  const employee = await Employee.findOne({ where: scopeToEmployeeWhereById(req.accessScope, employeeId) });
  if (!employee) throw new AppError('Employee not found or not accessible', 404);

  const previous = await Document.findOne({
    where: { employeeId, documentType, isCurrent: true },
    order: [['version', 'DESC']],
  });
  if (previous) await previous.update({ isCurrent: false });

  const document = await Document.create({
    id: documentId,
    employeeId,
    documentType,
    fileKey,
    fileName,
    expiryDate,
    version,
    companyId: employee.companyId,
    uploadedByUserId: req.user.id,
    isCurrent: true,
  });

  await recordAudit({
    entityType: 'Document',
    entityId: document.id,
    action: 'upload',
    fieldName: 'documentType',
    newValue: `${documentType} (v${document.version})`,
    employeeId,
    ...actorContextFrom(req),
  });
  await syncDocumentAlerts();

  const created = await Document.findByPk(document.id, { include: INCLUDE });
  res.status(201).json({ document: created });
}

async function getViewUrl(req, res) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const document = await Document.findOne({ where });
  if (!document) throw new AppError('Document not found or not accessible', 404);

  const { url, expiresInSeconds } = await storageService.createGetUrl({ key: document.fileKey, fileName: document.fileName, mode: 'inline' });

  await recordAudit({
    entityType: 'Document',
    entityId: document.id,
    action: 'view',
    employeeId: document.employeeId,
    ...actorContextFrom(req),
  });

  res.json({ url, expiresInSeconds });
}

async function getDownloadUrl(req, res) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const document = await Document.findOne({ where });
  if (!document) throw new AppError('Document not found or not accessible', 404);

  const { url, expiresInSeconds } = await storageService.createGetUrl({ key: document.fileKey, fileName: document.fileName, mode: 'attachment' });

  await recordAudit({
    entityType: 'Document',
    entityId: document.id,
    action: 'download',
    employeeId: document.employeeId,
    ...actorContextFrom(req),
  });

  res.json({ url, expiresInSeconds });
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
  // getUploadUrl()/createDocument() so the old version is retained.
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

module.exports = {
  listDocuments,
  getDocument,
  getUploadUrl,
  createDocument,
  getViewUrl,
  getDownloadUrl,
  updateDocument,
};
