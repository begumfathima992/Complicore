/**
 * Translates an accessScope (set by middleware/authorize.js) into a
 * Sequelize `where` fragment for the Employee model.
 */
function scopeToEmployeeWhere(scope) {
  switch (scope.type) {
    case 'all':
      return {};
    case 'company':
      return { companyId: scope.companyId };
    case 'team':
      return { companyId: scope.companyId, managerId: scope.managerId };
    case 'own':
      return { id: scope.employeeId };
    case 'none':
    default:
      // Impossible predicate: caller has no access, return zero rows.
      return { id: null };
  }
}

/**
 * Combines a scope with a specific target employee id - SAFELY. Naively
 * writing `{ ...scopeToEmployeeWhere(scope), id: targetId }` is a real
 * authorization bug: scopeToEmployeeWhere('own') already returns
 * `{ id: callerEmployeeId }`, and a later `id: targetId` key in the same
 * object literal silently OVERWRITES it (last key wins) instead of
 * constraining it further - so an 'own'-scoped caller could pass ANY
 * employeeId and it would look up that employee with no scope check at
 * all. Using Op.and keeps both conditions and requires both to hold
 * (impossible unless targetId === callerEmployeeId for 'own' scope).
 */
function scopeToEmployeeWhereById(scope, targetId) {
  const { Op } = require('sequelize');
  return { [Op.and]: [scopeToEmployeeWhere(scope), { id: targetId }] };
}

/**
 * Translates an accessScope into a `where` fragment for a table that
 * belongs to an employee (RightToWorkCheck, Document, ChangeOfCircumstance,
 * Alert) - these tables carry their own `companyId` (denormalized for cheap
 * company-scoped queries) and `employeeId`, but not `managerId`, so "team"
 * scope needs an extra lookup of the manager's direct reports first.
 */
async function scopeToChildWhere(scope) {
  const { Op } = require('sequelize');

  switch (scope.type) {
    case 'all':
      return {};
    case 'company':
      return { companyId: scope.companyId };
    case 'own':
      return { employeeId: scope.employeeId };
    case 'team': {
      const { Employee } = require('../models');
      const reports = await Employee.findAll({
        where: { managerId: scope.managerId, companyId: scope.companyId },
        attributes: ['id'],
      });
      const ids = reports.map((r) => r.id);
      return {
        companyId: scope.companyId,
        employeeId: ids.length ? { [Op.in]: ids } : null,
      };
    }
    case 'none':
    default:
      return { id: null };
  }
}

module.exports = { scopeToEmployeeWhere, scopeToEmployeeWhereById, scopeToChildWhere };
