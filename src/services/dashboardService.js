const { Op } = require('sequelize');
const { Employee, RightToWorkCheck, Alert } = require('../models');
const { scopeToEmployeeWhere, scopeToChildWhere } = require('../utils/scopeToWhere');
const { REQUIRED_DOCUMENT_TYPES } = require('./alertService');

/**
 * Figures for the Compliance Overview tiles + score. Everything here is an
 * INTERNAL MANAGEMENT INDICATOR - a way for HR/employer admins to see where
 * to focus attention. It is explicitly NOT an official Home Office
 * compliance rating, and the API response says so on every call (see
 * `disclaimer` below) so no UI built on top of this can present it as one.
 */
async function getComplianceOverview(accessScope) {
  const employeeWhere = scopeToEmployeeWhere(accessScope);
  const employees = await Employee.findAll({ where: { ...employeeWhere, employmentStatus: 'active' } });
  const employeeIds = employees.map((e) => e.id);
  const totalEmployees = employees.length;

  // "Verified" = each employee's most recent right-to-work check says so.
  const checks = await RightToWorkCheck.findAll({
    where: { employeeId: { [Op.in]: employeeIds.length ? employeeIds : [null] } },
    order: [['checkDate', 'DESC']],
  });
  const latestCheckByEmployee = new Map();
  for (const check of checks) {
    if (!latestCheckByEmployee.has(check.employeeId)) latestCheckByEmployee.set(check.employeeId, check);
  }
  const verifiedCount = [...latestCheckByEmployee.values()].filter((c) => c.status === 'verified').length;

  const alertWhere = await scopeToChildWhere(accessScope);
  const openAlerts = await Alert.findAll({ where: { ...alertWhere, status: { [Op.ne]: 'resolved' } } });

  const expiringCount = new Set(
    openAlerts
      .filter((a) => ['right_to_work_expiry', 'visa_expiry'].includes(a.alertType) && ['medium', 'high'].includes(a.severity))
      .map((a) => a.employeeId)
  ).size;

  const expiredCount = new Set(
    openAlerts
      .filter((a) => ['right_to_work_expiry', 'visa_expiry', 'document_expiry'].includes(a.alertType) && a.severity === 'critical')
      .map((a) => a.employeeId)
  ).size;

  const missingDocsCount = new Set(
    openAlerts.filter((a) => a.alertType === 'missing_document').map((a) => a.employeeId)
  ).size;

  const openAlertsCount = openAlerts.length;

  // A simple, documented deduction-based score - not a statistical or
  // regulatory model. Weighted more heavily toward expired/missing items
  // (an active compliance gap) than merely-expiring ones (a heads-up).
  const deductions = expiredCount * 8 + missingDocsCount * 8 + expiringCount * 2;
  const internalComplianceScore = totalEmployees === 0 ? 100 : Math.max(0, Math.min(100, 100 - deductions));

  return {
    employees: totalEmployees,
    verified: verifiedCount,
    expiring: expiringCount,
    missingDocs: missingDocsCount,
    expired: expiredCount,
    openAlerts: openAlertsCount,
    internalComplianceScore,
    disclaimer:
      'This score is an internal management indicator derived from data recorded in this system. ' +
      'It is not an official Home Office compliance rating and does not guarantee sponsor licence compliance.',
  };
}

module.exports = { getComplianceOverview, REQUIRED_DOCUMENT_TYPES };
