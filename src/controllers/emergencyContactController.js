const { EmergencyContact, Employee } = require('../models');
const AppError = require('../utils/AppError');
const { scopeToChildWhere, scopeToEmployeeWhereById } = require('../utils/scopeToWhere');

const INCLUDE = [{ model: Employee, attributes: ['id', 'firstName', 'lastName', 'employeeNumber'] }];

async function listContacts(req, res) {
  const where = await scopeToChildWhere(req.accessScope);
  if (req.query.employeeId) where.employeeId = req.query.employeeId;

  const contacts = await EmergencyContact.findAll({ where, include: INCLUDE, order: [['createdAt', 'ASC']] });
  res.json({ contacts });
}

async function getContact(req, res) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const contact = await EmergencyContact.findOne({ where, include: INCLUDE });
  if (!contact) throw new AppError('Emergency contact not found or not accessible', 404);
  res.json({ contact });
}

async function createContact(req, res) {
  const { employeeId, name } = req.body;
  if (!employeeId || !name) throw new AppError('employeeId and name are required', 400);

  const employee = await Employee.findOne({ where: scopeToEmployeeWhereById(req.accessScope, employeeId) });
  if (!employee) throw new AppError('Employee not found or not accessible', 404);

  const contact = await EmergencyContact.create({ ...req.body, companyId: employee.companyId });
  const created = await EmergencyContact.findByPk(contact.id, { include: INCLUDE });
  res.status(201).json({ contact: created });
}

async function updateContact(req, res) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const contact = await EmergencyContact.findOne({ where });
  if (!contact) throw new AppError('Emergency contact not found or not accessible', 404);

  const { employeeId, companyId, ...updates } = req.body;
  await contact.update(updates);
  res.json({ contact });
}

async function deleteContact(req, res) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const contact = await EmergencyContact.findOne({ where });
  if (!contact) throw new AppError('Emergency contact not found or not accessible', 404);

  // Hard delete: unlike Document/Employee, there's no compliance retention
  // requirement for an outdated next-of-kin entry.
  await contact.destroy();
  res.status(204).send();
}

module.exports = { listContacts, getContact, createContact, updateContact, deleteContact };
