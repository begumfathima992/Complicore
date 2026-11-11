const { ChangeOfCircumstance, Employee, User, Document } = require('../models');
const AppError = require('../utils/AppError');
const { scopeToChildWhere, scopeToEmployeeWhereById } = require('../utils/scopeToWhere');

const INCLUDE = [
  { model: Employee, attributes: ['id', 'firstName', 'lastName', 'employeeNumber'] },
  { model: User, as: 'changedBy', attributes: ['id', 'email'] },
  { model: Document, as: 'supportingDocument' },
];

async function listChanges(req, res) {
  const where = await scopeToChildWhere(req.accessScope);
  if (req.query.employeeId) where.employeeId = req.query.employeeId;
  if (req.query.changeType) where.changeType = req.query.changeType;

  const changes = await ChangeOfCircumstance.findAll({
    where,
    include: INCLUDE,
    order: [['effectiveDate', 'DESC']],
  });
  res.json({ changes });
}

async function getChange(req, res) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const change = await ChangeOfCircumstance.findOne({ where, include: INCLUDE });
  if (!change) throw new AppError('Change record not found or not accessible', 404);
  res.json({ change });
}

// Note: intentionally no update/delete controller or route - this is an
// append-only audit trail (see model comment in ChangeOfCircumstance.js).
async function createChange(req, res) {
  const { employeeId } = req.body;
  if (!employeeId) throw new AppError('employeeId is required', 400);

  if (req.accessScope.type === 'own') {
    throw new AppError('Employees cannot log their own changes of circumstance', 403);
  }

  const employee = await Employee.findOne({ where: scopeToEmployeeWhereById(req.accessScope, employeeId) });
  if (!employee) throw new AppError('Employee not found or not accessible', 404);

  const change = await ChangeOfCircumstance.create({
    ...req.body,
    companyId: employee.companyId,
    changedByUserId: req.user.id,
  });

  const created = await ChangeOfCircumstance.findByPk(change.id, { include: INCLUDE });
  res.status(201).json({ change: created });
}

module.exports = { listChanges, getChange, createChange };
