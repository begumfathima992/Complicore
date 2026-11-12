const { Op } = require('sequelize');
const { AttendanceRecord, Employee } = require('../models');
const AppError = require('../utils/AppError');
const { scopeToChildWhere, scopeToEmployeeWhereById } = require('../utils/scopeToWhere');
const { getWeeklyGrid, assertDateStatusAllowed } = require('../services/attendanceService');
const { recordAudit, snapshotChanges, recordFieldChanges, actorContextFrom } = require('../services/auditService');
const { toCsv, toExcelBuffer } = require('../services/exportService');

function dateRangeWhere(where, query) {
  if (!query.from && !query.to) return where;
  where.date = {};
  if (query.from) where.date[Op.gte] = query.from;
  if (query.to) where.date[Op.lte] = query.to;
  return where;
}

async function listRecords(req, res) {
  const where = dateRangeWhere(await scopeToChildWhere(req.accessScope), req.query);
  if (req.query.employeeId) where.employeeId = req.query.employeeId;

  const records = await AttendanceRecord.findAll({ where, order: [['date', 'ASC']] });
  res.json({ records });
}

async function getWeekly(req, res) {
  const { employeeId, weekStart } = req.query;
  if (!employeeId || !weekStart) throw new AppError('employeeId and weekStart are required', 400);

  const employee = await Employee.findOne({ where: scopeToEmployeeWhereById(req.accessScope, employeeId) });
  if (!employee) throw new AppError('Employee not found or not accessible', 404);

  const grid = await getWeeklyGrid(employeeId, weekStart);
  res.json(grid);
}

/**
 * Single upsert endpoint: creates today's/a past day's entry, or edits an
 * existing one for the same (employeeId, date) - same "one row identifies
 * itself" shape as upsertImmigrationDetail() in rightToWorkController.js.
 */
async function upsertRecord(req, res) {
  const { employeeId, date, status, clockIn, clockOut, breakMinutes, notes } = req.body;
  if (!employeeId || !date || !status) throw new AppError('employeeId, date and status are required', 400);

  const employee = await Employee.findOne({ where: scopeToEmployeeWhereById(req.accessScope, employeeId) });
  if (!employee) throw new AppError('Employee not found or not accessible', 404);
  if (employee.startDate && date < employee.startDate) {
    throw new AppError('This employee has not started yet as of this date', 400);
  }

  assertDateStatusAllowed(date, status);

  const updates = { status, clockIn, clockOut, breakMinutes, notes };
  let record = await AttendanceRecord.findOne({ where: { employeeId, date } });

  if (record) {
    const changes = snapshotChanges(record, updates);
    await record.update(updates);
    await recordFieldChanges('AttendanceRecord', record.id, changes, {
      employeeId,
      ...actorContextFrom(req),
      companyId: employee.companyId, // overrides actorContextFrom's req.user.companyId, which is null for Super Admin
    });
  } else {
    record = await AttendanceRecord.create({
      employeeId,
      companyId: employee.companyId,
      date,
      ...updates,
      createdByUserId: req.user.id,
    });
    await recordAudit({
      entityType: 'AttendanceRecord',
      entityId: record.id,
      action: 'create',
      fieldName: 'status',
      newValue: status,
      employeeId,
      ...actorContextFrom(req),
      companyId: employee.companyId,
    });
  }

  res.status(201).json({ record });
}

async function approveRecord(req, res) {
  const where = { ...(await scopeToChildWhere(req.accessScope)), id: req.params.id };
  const record = await AttendanceRecord.findOne({ where });
  if (!record) throw new AppError('Attendance record not found or not accessible', 404);

  await record.update({ approvedByUserId: req.user.id });
  await recordAudit({
    entityType: 'AttendanceRecord',
    entityId: record.id,
    action: 'status_change',
    fieldName: 'approvedByUserId',
    newValue: req.user.id,
    employeeId: record.employeeId,
    ...actorContextFrom(req),
    companyId: record.companyId,
  });
  res.json({ record });
}

const EXPORT_COLUMNS = [
  { key: 'employee', label: 'Employee' },
  { key: 'date', label: 'Date' },
  { key: 'status', label: 'Status' },
  { key: 'clockIn', label: 'Clock in' },
  { key: 'clockOut', label: 'Clock out' },
  { key: 'breakMinutes', label: 'Break (mins)' },
  { key: 'totalHours', label: 'Total hours' },
];

async function exportRecords(req, res) {
  const where = dateRangeWhere(await scopeToChildWhere(req.accessScope), req.query);
  if (req.query.employeeId) where.employeeId = req.query.employeeId;

  const records = await AttendanceRecord.findAll({
    where,
    include: [{ model: Employee, attributes: ['firstName', 'lastName', 'employeeNumber'] }],
    order: [['date', 'ASC']],
  });

  const rows = records.map((r) => ({
    employee: `${r.Employee.firstName} ${r.Employee.lastName} (${r.Employee.employeeNumber})`,
    date: r.date,
    status: r.status,
    clockIn: r.clockIn,
    clockOut: r.clockOut,
    breakMinutes: r.breakMinutes,
    totalHours: r.totalHours,
  }));

  if (req.query.format === 'excel') {
    const buffer = await toExcelBuffer('Attendance', EXPORT_COLUMNS, rows);
    res.setHeader('Content-Disposition', 'attachment; filename="attendance.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  }
  res.setHeader('Content-Disposition', 'attachment; filename="attendance.csv"');
  res.setHeader('Content-Type', 'text/csv');
  res.send(toCsv(EXPORT_COLUMNS, rows));
}

module.exports = { listRecords, getWeekly, upsertRecord, approveRecord, exportRecords };
