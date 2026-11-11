const { Op } = require('sequelize');
const { Shift, HolidayRequest, Absence } = require('../models');

/**
 * Checks a proposed/edited shift against: other shifts for the same
 * employee that overlap in time, an approved holiday covering the date,
 * and a recorded (open) absence covering the date. Returns an array of
 * conflicts - callers decide whether to block or just warn (see
 * controllers/shiftController.js, which blocks unless ?force=true).
 */
async function detectConflicts({ employeeId, startsAt, endsAt, shiftDate, excludeShiftId }) {
  const conflicts = [];

  const overlapWhere = {
    employeeId,
    startsAt: { [Op.lt]: endsAt },
    endsAt: { [Op.gt]: startsAt },
  };
  if (excludeShiftId) overlapWhere.id = { [Op.ne]: excludeShiftId };

  const overlappingShifts = await Shift.findAll({ where: overlapWhere });
  overlappingShifts.forEach((shift) =>
    conflicts.push({ type: 'overlapping_shift', shiftId: shift.id, shiftDate: shift.shiftDate })
  );

  const holiday = await HolidayRequest.findOne({
    where: {
      employeeId,
      status: 'approved',
      startDate: { [Op.lte]: shiftDate },
      endDate: { [Op.gte]: shiftDate },
    },
  });
  if (holiday) conflicts.push({ type: 'approved_holiday', holidayRequestId: holiday.id });

  const absence = await Absence.findOne({
    where: {
      employeeId,
      status: 'open',
      startDate: { [Op.lte]: shiftDate },
      [Op.or]: [{ endDate: { [Op.gte]: shiftDate } }, { endDate: null }],
    },
  });
  if (absence) conflicts.push({ type: 'recorded_absence', absenceId: absence.id });

  return conflicts;
}

module.exports = { detectConflicts };
