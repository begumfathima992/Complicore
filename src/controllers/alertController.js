const { Op } = require('sequelize');
const { Alert, Employee } = require('../models');
const AppError = require('../utils/AppError');
const { scopeToChildWhere, scopeToEmployeeWhereById } = require('../utils/scopeToWhere');
const { syncAllAlerts, createComplianceTaskAlert } = require('../services/alertService');

const INCLUDE = [{ model: Employee, attributes: ['id', 'firstName', 'lastName', 'employeeNumber'] }];

async function listAlerts(req, res) {
  const where = await scopeToChildWhere(req.accessScope);
  if (req.query.status) where.status = req.query.status;
  else where.status = { [Op.ne]: 'resolved' }; // default: open + acknowledged
  if (req.query.severity) where.severity = req.query.severity;
  if (req.query.alertType) where.alertType = req.query.alertType;
  if (req.query.assignedToRoleKey) where.assignedToRoleKey = req.query.assignedToRoleKey;

  const alerts = await Alert.findAll({ where, include: INCLUDE, order: [['dueDate', 'ASC']] });
  res.json({ alerts });
}

/**
 * Acknowledging an alert records that HR has seen it - it does NOT mark
 * the underlying compliance item as resolved. Resolution only happens
 * automatically once a new RightToWorkCheck/Document supersedes it with a
 * later expiry (see services/alertService.js), or manually via `resolve`
 * for cases handled outside the system (e.g. employment ended).
 */
async function acknowledgeAlert(req, res) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const alert = await Alert.findOne({ where });
  if (!alert) throw new AppError('Alert not found or not accessible', 404);

  await alert.update({ status: 'acknowledged', acknowledgedByUserId: req.user.id, acknowledgedAt: new Date() });
  res.json({ alert });
}

async function resolveAlert(req, res) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const alert = await Alert.findOne({ where });
  if (!alert) throw new AppError('Alert not found or not accessible', 404);

  await alert.update({ status: 'resolved' });
  res.json({ alert });
}

// Manual trigger for the alert sweep (normally run on a schedule - see
// scripts/generateAlerts.js). Useful for testing/on-demand refresh.
async function runSync(req, res) {
  const result = await syncAllAlerts();
  res.json({ synced: result });
}

/** HR-raised ad-hoc alert - the one alert type with no automatic trigger (e.g. "renew DBS check policy"). */
async function createAlert(req, res) {
  const { severity, title, message, employeeId, dueDate, actionRequired, assignedToRoleKey } = req.body;
  if (!severity || !title || !message) throw new AppError('severity, title and message are required', 400);

  if (employeeId) {
    // scopeToEmployeeWhere, not scopeToChildWhere: this queries the
    // Employee table itself (keyed by `id`), not a child table keyed by
    // `employeeId` - using the wrong helper here 500s for 'own'/'team'
    // scoped callers since it filters on a column Employee doesn't have.
    const employee = await Employee.findOne({ where: scopeToEmployeeWhereById(req.accessScope, employeeId) });
    if (!employee) throw new AppError('Employee not found or not accessible', 404);
  }

  const alert = await createComplianceTaskAlert({
    companyId: req.user.companyId,
    employeeId,
    severity,
    title,
    message,
    actionRequired,
    assignedToRoleKey,
    dueDate,
  });

  res.status(201).json({ alert });
}

module.exports = { listAlerts, acknowledgeAlert, resolveAlert, runSync, createAlert };
