const { Op } = require('sequelize');
const { Shift, ShiftChangeRequest, Employee, Department, User } = require('../models');
const AppError = require('../utils/AppError');
const { scopeToChildWhere, scopeToEmployeeWhere, scopeToEmployeeWhereById } = require('../utils/scopeToWhere');
const { detectConflicts } = require('../services/rosterService');

const INCLUDE = [
  { model: Employee, attributes: ['id', 'firstName', 'lastName', 'employeeNumber'] },
  { model: Department },
];

function applyDateRange(where, query) {
  if (query.from || query.to) {
    where.shiftDate = {};
    if (query.from) where.shiftDate[Op.gte] = query.from;
    if (query.to) where.shiftDate[Op.lte] = query.to;
  }
}

async function listShifts(req, res) {
  const where = await scopeToChildWhere(req.accessScope);
  applyDateRange(where, req.query);
  if (req.query.departmentId) where.departmentId = req.query.departmentId;

  // "Employees can see their own schedules" - regardless of the broader
  // company-wide read scope duty_roster grants, an Employee is pinned to
  // their own shifts, and never sees unpublished drafts.
  if (req.user.role === 'EMPLOYEE') {
    where.employeeId = req.user.employeeId;
    where.status = { [Op.in]: ['published', 'approved'] };
  }

  const shifts = await Shift.findAll({ where, include: INCLUDE, order: [['startsAt', 'ASC']] });
  res.json({ shifts });
}

async function getShift(req, res) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const shift = await Shift.findOne({ where, include: INCLUDE });
  if (!shift) throw new AppError('Shift not found or not accessible', 404);
  res.json({ shift });
}

async function createShift(req, res) {
  const { employeeId, shiftDate, startTime, endTime } = req.body;
  if (!employeeId || !shiftDate || !startTime || !endTime) {
    throw new AppError('employeeId, shiftDate, startTime and endTime are required', 400);
  }

  const employee = await Employee.findOne({ where: scopeToEmployeeWhereById(req.accessScope, employeeId) });
  if (!employee) throw new AppError('Employee not found or not accessible', 404);

  // Build without saving yet, so the beforeValidate hook derives startsAt/endsAt for conflict checking.
  const draft = Shift.build({ ...req.body, companyId: employee.companyId, createdByUserId: req.user.id });
  await draft.validate();

  const conflicts = await detectConflicts({
    employeeId,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    shiftDate,
  });

  if (conflicts.length > 0 && req.query.force !== 'true') {
    return res.status(409).json({ error: 'Scheduling conflict detected', conflicts });
  }

  await draft.save();
  const created = await Shift.findByPk(draft.id, { include: INCLUDE });
  res.status(201).json({ shift: created, conflicts });
}

async function updateShift(req, res) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const shift = await Shift.findOne({ where });
  if (!shift) throw new AppError('Shift not found or not accessible', 404);

  shift.set(req.body);
  await shift.validate();

  const conflicts = await detectConflicts({
    employeeId: shift.employeeId,
    startsAt: shift.startsAt,
    endsAt: shift.endsAt,
    shiftDate: shift.shiftDate,
    excludeShiftId: shift.id,
  });

  if (conflicts.length > 0 && req.query.force !== 'true') {
    return res.status(409).json({ error: 'Scheduling conflict detected', conflicts });
  }

  await shift.save();
  res.json({ shift, conflicts });
}

async function deleteShift(req, res) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const shift = await Shift.findOne({ where });
  if (!shift) throw new AppError('Shift not found or not accessible', 404);

  await shift.destroy();
  res.status(204).send();
}

/** Who's free on a given date within the caller's scope - shifts + any leave that day. */
async function getAvailability(req, res) {
  const { date } = req.query;
  if (!date) throw new AppError('date query param is required', 400);

  const employees = await Employee.findAll({
    where: scopeToEmployeeWhere(req.accessScope),
    attributes: ['id', 'firstName', 'lastName'],
    include: [
      { model: Shift, required: false, where: { shiftDate: date }, attributes: ['id', 'startTime', 'endTime', 'status'] },
    ],
  });

  res.json({ date, employees });
}

async function exportRoster(req, res) {
  const where = await scopeToChildWhere(req.accessScope);
  applyDateRange(where, req.query);

  const shifts = await Shift.findAll({ where, include: INCLUDE, order: [['startsAt', 'ASC']] });

  const header = 'Date,Start,End,Employee,Department,Status\n';
  const rows = shifts
    .map((s) =>
      [
        s.shiftDate,
        s.startTime,
        s.endTime,
        `"${s.Employee.firstName} ${s.Employee.lastName}"`,
        s.Department ? `"${s.Department.name}"` : '',
        s.status,
      ].join(',')
    )
    .join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="roster.csv"');
  res.send(header + rows);
}

// --- Shift change requests --------------------------------------------------

async function createChangeRequest(req, res) {
  const shiftWhere = { ...(await scopeToChildWhere(req.accessScope)), id: req.body.shiftId };
  const shift = await Shift.findOne({ where: shiftWhere });
  if (!shift) throw new AppError('Shift not found or not accessible', 404);

  if (req.accessScope.type === 'own' && shift.employeeId !== req.user.employeeId) {
    throw new AppError('Cannot request a change to someone else\'s shift', 403);
  }

  const changeRequest = await ShiftChangeRequest.create({
    ...req.body,
    requestedByUserId: req.user.id,
  });
  res.status(201).json({ changeRequest });
}

async function listChangeRequests(req, res) {
  const shiftWhere = await scopeToChildWhere(req.accessScope);
  const shifts = await Shift.findAll({ where: shiftWhere, attributes: ['id'] });
  const shiftIds = shifts.map((s) => s.id);

  const changeRequests = await ShiftChangeRequest.findAll({
    where: { shiftId: { [Op.in]: shiftIds.length ? shiftIds : [null] } },
    include: [{ model: Shift }, { model: User, as: 'requestedBy', attributes: ['id', 'email'] }],
    order: [['createdAt', 'DESC']],
  });
  res.json({ changeRequests });
}

/** Approving mutates the underlying Shift; rejecting just records the decision. */
async function reviewChangeRequest(req, res) {
  const { decision, reviewNotes } = req.body; // 'approved' | 'rejected'
  if (!['approved', 'rejected'].includes(decision)) throw new AppError("decision must be 'approved' or 'rejected'", 400);

  const changeRequest = await ShiftChangeRequest.findByPk(req.params.id, { include: [Shift] });
  if (!changeRequest) throw new AppError('Change request not found', 404);

  const shiftWhere = { ...(await scopeToChildWhere(req.accessScope)), id: changeRequest.shiftId };
  const shift = await Shift.findOne({ where: shiftWhere });
  if (!shift) throw new AppError('Not accessible', 404);

  await changeRequest.update({ status: decision, reviewNotes, reviewedByUserId: req.user.id, reviewedAt: new Date() });

  if (decision === 'approved') {
    if (changeRequest.requestType === 'time_change') {
      shift.set({ startTime: changeRequest.proposedStartTime, endTime: changeRequest.proposedEndTime });
      await shift.validate();
      await shift.save();
    } else if (changeRequest.requestType === 'cancellation') {
      await shift.destroy();
    } else if (changeRequest.requestType === 'swap' && changeRequest.swapWithEmployeeId) {
      await shift.update({ employeeId: changeRequest.swapWithEmployeeId });
    }
  }

  res.json({ changeRequest });
}

module.exports = {
  listShifts,
  getShift,
  createShift,
  updateShift,
  deleteShift,
  getAvailability,
  exportRoster,
  createChangeRequest,
  listChangeRequests,
  reviewChangeRequest,
};
