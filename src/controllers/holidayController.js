const { HolidayRequest, Employee, User } = require('../models');
const AppError = require('../utils/AppError');
const { scopeToChildWhere, scopeToEmployeeWhereById } = require('../utils/scopeToWhere');
const { getBalance, countWeekdays } = require('../services/holidayService');
const { hasPermissionKey } = require('../services/permissionService');
const { upsertHolidayRequestAlert } = require('../services/alertService');
const { recordAudit, actorContextFrom } = require('../services/auditService');

const INCLUDE = [
  { model: Employee, attributes: ['id', 'firstName', 'lastName', 'employeeNumber'] },
  { model: User, as: 'managerReviewedBy', attributes: ['id', 'email'] },
  { model: User, as: 'hrConfirmedBy', attributes: ['id', 'email'] },
];

async function getMyOrEmployeeBalance(req, res) {
  const employeeId = req.query.employeeId || req.user.employeeId;
  if (!employeeId) throw new AppError('employeeId is required', 400);

  if (employeeId !== req.user.employeeId) {
    // Looking up someone else's balance - must be within the caller's scope.
    const employee = await Employee.findOne({ where: scopeToEmployeeWhereById(req.accessScope, employeeId) });
    if (!employee) throw new AppError('Employee not found or not accessible', 404);
  }

  const year = Number(req.query.year) || new Date().getFullYear();
  const balance = await getBalance(employeeId, year);
  res.json({ employeeId, ...balance });
}

async function listRequests(req, res) {
  const where = await scopeToChildWhere(req.accessScope);
  if (req.query.employeeId) where.employeeId = req.query.employeeId;
  if (req.query.status) where.status = req.query.status;

  const requests = await HolidayRequest.findAll({ where, include: INCLUDE, order: [['startDate', 'DESC']] });
  res.json({ requests });
}

async function getRequest(req, res) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const request = await HolidayRequest.findOne({ where, include: INCLUDE });
  if (!request) throw new AppError('Holiday request not found or not accessible', 404);
  res.json({ request });
}

async function createRequest(req, res) {
  const { employeeId, startDate, endDate, reason } = req.body;
  if (!employeeId || !startDate || !endDate) throw new AppError('employeeId, startDate and endDate are required', 400);

  let employee;
  if (employeeId === req.user.employeeId) {
    employee = await Employee.findByPk(employeeId);
    if (!employee) throw new AppError('Employee not found', 404);
  } else {
    // Logging a request on someone else's behalf (verbal/retroactive/historic
    // entry) requires holiday.manage - i.e. full/limited HOLIDAY access
    // (HR Manager, Employer Admin, Super Admin). Employee and Manager stay
    // self-only, since Manager only holds 'approve' on this feature, not
    // 'create' on behalf of others.
    const canManageOnBehalf = await hasPermissionKey(req.user.companyId, req.user.role, 'holiday.manage');
    if (!canManageOnBehalf) {
      throw new AppError('Can only request holiday for yourself', 403);
    }

    employee = await Employee.findOne({ where: scopeToEmployeeWhereById(req.accessScope, employeeId) });
    if (!employee) throw new AppError('Employee not found or not accessible', 404);
  }

  const totalDays = countWeekdays(startDate, endDate);
  const year = new Date(startDate).getFullYear();
  const balance = await getBalance(employeeId, year);

  if (totalDays > balance.remaining) {
    throw new AppError(
      `Requested ${totalDays} day(s) exceeds remaining balance of ${balance.remaining} day(s)`,
      400
    );
  }

  const request = await HolidayRequest.create({
    employeeId,
    companyId: employee.companyId,
    startDate,
    endDate,
    totalDays,
    reason,
    status: 'pending_manager',
  });

  await recordAudit({
    entityType: 'HolidayRequest',
    entityId: request.id,
    action: 'create',
    employeeId,
    ...actorContextFrom(req),
  });
  await upsertHolidayRequestAlert(request);

  const created = await HolidayRequest.findByPk(request.id, { include: INCLUDE });
  res.status(201).json({ request: created });
}

async function managerApprove(req, res) {
  const { decision, rejectionReason } = req.body; // 'approved' | 'rejected'
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id, status: 'pending_manager' };
  const request = await HolidayRequest.findOne({ where });
  if (!request) throw new AppError('Holiday request not found, not accessible, or not awaiting manager review', 404);

  const previousStatus = request.status;
  const newStatus = decision === 'approved' ? 'pending_hr' : 'rejected';
  await request.update({
    status: newStatus,
    managerReviewedByUserId: req.user.id,
    managerReviewedAt: new Date(),
    ...(decision !== 'approved' && { rejectionReason }),
  });

  await recordAudit({
    entityType: 'HolidayRequest',
    entityId: request.id,
    action: 'status_change',
    fieldName: 'status',
    oldValue: previousStatus,
    newValue: newStatus,
    employeeId: request.employeeId,
    ...actorContextFrom(req),
  });
  await upsertHolidayRequestAlert(request);

  res.json({ request });
}

async function hrConfirm(req, res) {
  const { decision, rejectionReason } = req.body; // 'approved' | 'rejected'
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id, status: 'pending_hr' };
  const request = await HolidayRequest.findOne({ where });
  if (!request) throw new AppError('Holiday request not found, not accessible, or not awaiting HR confirmation', 404);

  const previousStatus = request.status;
  const newStatus = decision === 'approved' ? 'approved' : 'rejected';
  await request.update({
    status: newStatus,
    hrConfirmedByUserId: req.user.id,
    hrConfirmedAt: new Date(),
    ...(decision !== 'approved' && { rejectionReason }),
  });

  await recordAudit({
    entityType: 'HolidayRequest',
    entityId: request.id,
    action: 'status_change',
    fieldName: 'status',
    oldValue: previousStatus,
    newValue: newStatus,
    employeeId: request.employeeId,
    ...actorContextFrom(req),
  });
  await upsertHolidayRequestAlert(request);

  // "Calendar Updated": once approved, the roster's conflict detection
  // (services/rosterService.js) picks this request up automatically when
  // shifts are created/edited - no separate calendar write needed.
  res.json({ request });
}

async function cancelRequest(req, res) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const request = await HolidayRequest.findOne({ where });
  if (!request) throw new AppError('Holiday request not found or not accessible', 404);

  if (req.accessScope.type === 'own' && request.employeeId !== req.user.employeeId) {
    throw new AppError('Cannot cancel someone else\'s request', 403);
  }
  if (!['pending_manager', 'pending_hr'].includes(request.status)) {
    throw new AppError(`Cannot cancel a request with status '${request.status}'`, 400);
  }

  const previousStatus = request.status;
  await request.update({ status: 'cancelled' });
  await recordAudit({
    entityType: 'HolidayRequest',
    entityId: request.id,
    action: 'status_change',
    fieldName: 'status',
    oldValue: previousStatus,
    newValue: 'cancelled',
    employeeId: request.employeeId,
    ...actorContextFrom(req),
  });
  await upsertHolidayRequestAlert(request);

  res.json({ request });
}

module.exports = {
  getMyOrEmployeeBalance,
  listRequests,
  getRequest,
  createRequest,
  managerApprove,
  hrConfirm,
  cancelRequest,
};
