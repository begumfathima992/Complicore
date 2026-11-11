const { Absence, Employee, Document, User } = require('../models');
const AppError = require('../utils/AppError');
const { scopeToChildWhere } = require('../utils/scopeToWhere');
const { upsertSickLeaveAlert } = require('../services/alertService');
const { recordAudit, snapshotChanges, recordFieldChanges, actorContextFrom } = require('../services/auditService');

const INCLUDE = [
  { model: Employee, attributes: ['id', 'firstName', 'lastName', 'employeeNumber'] },
  { model: Document, as: 'evidence' },
  { model: User, as: 'approvedBy', attributes: ['id', 'email'] },
];

function durationDays(startDate, endDate) {
  if (!endDate) return null;
  const diff = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24);
  return diff + 1;
}

async function listAbsences(req, res) {
  const where = await scopeToChildWhere(req.accessScope);
  if (req.query.employeeId) where.employeeId = req.query.employeeId;
  if (req.query.absenceType) where.absenceType = req.query.absenceType;
  if (req.query.status) where.status = req.query.status;

  const absences = await Absence.findAll({ where, include: INCLUDE, order: [['startDate', 'DESC']] });
  res.json({ absences });
}

async function getAbsence(req, res) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const absence = await Absence.findOne({ where, include: INCLUDE });
  if (!absence) throw new AppError('Absence record not found or not accessible', 404);
  res.json({ absence });
}

async function createAbsence(req, res) {
  const { employeeId, absenceType, startDate } = req.body;
  if (!employeeId || !absenceType || !startDate) {
    throw new AppError('employeeId, absenceType and startDate are required', 400);
  }
  if (absenceType === 'holiday') {
    throw new AppError('Holiday is recorded through the Holiday Management module, not Absence', 400);
  }
  if (employeeId !== req.user.employeeId && req.accessScope.type === 'own') {
    throw new AppError('Can only report absence for yourself', 403);
  }

  const employee = await Employee.findByPk(employeeId);
  if (!employee) throw new AppError('Employee not found', 404);

  const absence = await Absence.create({
    ...req.body,
    companyId: employee.companyId,
    durationDays: durationDays(startDate, req.body.endDate),
  });

  await recordAudit({
    entityType: 'Absence',
    entityId: absence.id,
    action: 'create',
    employeeId,
    ...actorContextFrom(req),
  });
  await upsertSickLeaveAlert(absence);

  const created = await Absence.findByPk(absence.id, { include: INCLUDE });
  res.status(201).json({ absence: created });
}

/** HR/full-access roles only (see routes) - edits any field, e.g. setting a return-to-work date. */
async function updateAbsence(req, res) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const absence = await Absence.findOne({ where });
  if (!absence) throw new AppError('Absence record not found or not accessible', 404);

  const updates = { ...req.body };
  if (updates.endDate) updates.durationDays = durationDays(absence.startDate, updates.endDate);
  if (updates.returnToWorkDate) updates.status = 'closed';

  const changes = snapshotChanges(absence, updates);
  await absence.update(updates);
  await recordFieldChanges('Absence', absence.id, changes, {
    employeeId: absence.employeeId,
    ...actorContextFrom(req),
  });
  await upsertSickLeaveAlert(absence);

  res.json({ absence });
}

/** Manager sign-off: records that the absence has been reviewed, without editing its details. */
async function approveAbsence(req, res) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const absence = await Absence.findOne({ where });
  if (!absence) throw new AppError('Absence record not found or not accessible', 404);

  await absence.update({ approvedByUserId: req.user.id });
  await recordAudit({
    entityType: 'Absence',
    entityId: absence.id,
    action: 'update',
    fieldName: 'approvedByUserId',
    newValue: req.user.id,
    employeeId: absence.employeeId,
    ...actorContextFrom(req),
  });
  await upsertSickLeaveAlert(absence);

  res.json({ absence });
}

module.exports = { listAbsences, getAbsence, createAbsence, updateAbsence, approveAbsence };
