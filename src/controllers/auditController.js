const { Op } = require('sequelize');
const { AuditLog, Employee, User } = require('../models');
const AppError = require('../utils/AppError');
const { scopeToChildWhere } = require('../utils/scopeToWhere');
const { verifyIntegrity } = require('../services/auditService');

const INCLUDE = [
  { model: Employee, attributes: ['id', 'firstName', 'lastName', 'employeeNumber'] },
  { model: User, as: 'performedBy', attributes: ['id', 'email'] },
];

async function listAuditLogs(req, res) {
  const where = await scopeToChildWhere(req.accessScope);
  if (req.query.employeeId) where.employeeId = req.query.employeeId;
  if (req.query.entityType) where.entityType = req.query.entityType;
  if (req.query.action) where.action = req.query.action;
  if (req.query.from || req.query.to) {
    where.createdAt = {};
    if (req.query.from) where.createdAt[Op.gte] = new Date(req.query.from);
    if (req.query.to) where.createdAt[Op.lte] = new Date(req.query.to);
  }

  const logs = await AuditLog.findAll({ where, include: INCLUDE, order: [['createdAt', 'DESC']], limit: 500 });
  res.json({ logs });
}

async function getAuditLog(req, res) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const log = await AuditLog.findOne({ where, include: INCLUDE });
  if (!log) throw new AppError('Audit log entry not found or not accessible', 404);
  res.json({ log });
}

/**
 * Confirms the hash chain hasn't been altered - see model/service
 * comments for how. Super-Admin-only, deliberately, even though
 * EMPLOYER_ADMIN/HR_MANAGER otherwise have full AUDIT_LOGS access: the
 * chain is a single global sequence across every tenant (see
 * auditService.js), so this necessarily reports on the WHOLE platform's
 * row count and - on a break - another tenant's row id. A per-company
 * sub-chain would be needed before this could safely be exposed to a
 * tenant admin; until then, restricting it here is the actual isolation
 * boundary (the listAuditLogs/getAuditLog routes above already scope
 * correctly by company and are unaffected).
 */
async function checkIntegrity(req, res) {
  if (req.user.role !== 'SUPER_ADMIN') {
    throw new AppError('Only Super Admin can run a platform-wide integrity check', 403);
  }
  const result = await verifyIntegrity();
  res.json(result);
}

module.exports = { listAuditLogs, getAuditLog, checkIntegrity };
