const { Op } = require('sequelize');
const { AttendanceRecord, HolidayRequest, Absence } = require('../models');
const AppError = require('../utils/AppError');

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Rejects an actual (worked) status for a future date, per the client's rule. */
function assertDateStatusAllowed(date, status) {
  if (AttendanceRecord.ACTUAL_STATUSES.includes(status) && date > todayStr()) {
    throw new AppError('Actual hours can only be recorded for today or past dates.', 400);
  }
}

/**
 * Builds 7 day-cells for one employee's week starting at `weekStart`. For
 * each day, checks in order: a real AttendanceRecord row -> an approved
 * HolidayRequest covering the date (synthesized, read-only, never
 * persisted here) -> an open Absence covering the date -> empty. Holiday/
 * absence data is never copied into attendance_records - this is the "one
 * source of truth, no double entry" the brief asked for.
 */
async function getWeeklyGrid(employeeId, weekStart) {
  const weekEnd = addDays(weekStart, 6);

  const [records, holidays, absences] = await Promise.all([
    AttendanceRecord.findAll({ where: { employeeId, date: { [Op.between]: [weekStart, weekEnd] } } }),
    HolidayRequest.findAll({
      where: { employeeId, status: 'approved', startDate: { [Op.lte]: weekEnd }, endDate: { [Op.gte]: weekStart } },
    }),
    Absence.findAll({
      where: {
        employeeId,
        status: 'open',
        startDate: { [Op.lte]: weekEnd },
        [Op.or]: [{ endDate: { [Op.gte]: weekStart } }, { endDate: null }],
      },
    }),
  ]);

  const recordsByDate = new Map(records.map((r) => [r.date, r]));
  const today = todayStr();

  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(weekStart, i);
    const record = recordsByDate.get(date);

    if (record) {
      days.push({ date, kind: 'actual', record });
      continue;
    }

    const holiday = holidays.find((h) => h.startDate <= date && h.endDate >= date);
    if (holiday) {
      days.push({ date, kind: 'planned', label: 'Holiday', sourceType: 'HolidayRequest', sourceId: holiday.id });
      continue;
    }

    const absence = absences.find((a) => a.startDate <= date && (!a.endDate || a.endDate >= date));
    if (absence) {
      days.push({
        date,
        kind: 'planned',
        label: absence.absenceType.replace(/_/g, ' '),
        sourceType: 'Absence',
        sourceId: absence.id,
      });
      continue;
    }

    days.push({ date, kind: date > today ? 'future_empty' : 'empty' });
  }

  const totalHours = days.reduce((sum, d) => sum + (d.record ? Number(d.record.totalHours || 0) : 0), 0);
  const daysWorked = days.filter(
    (d) => d.record && AttendanceRecord.ACTUAL_STATUSES.includes(d.record.status) && Number(d.record.totalHours) > 0
  ).length;

  return { employeeId, weekStart, weekEnd, days, totalHours, daysWorked };
}

module.exports = { getWeeklyGrid, assertDateStatusAllowed, todayStr, addDays };
