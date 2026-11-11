const { Op } = require('sequelize');
const { HolidayBalance, HolidayRequest } = require('../models');

const DEFAULT_ANNUAL_ALLOWANCE = 28;

/**
 * Dashboard figures, derived from HolidayRequest rows rather than stored -
 * see HolidayBalance model comment for why. "Pending" is anything still
 * moving through the manager/HR approval pipeline.
 */
async function getBalance(employeeId, year) {
  const balanceRow = await HolidayBalance.findOne({ where: { employeeId, year } });
  const allowance = balanceRow
    ? Number(balanceRow.annualAllowanceDays) + Number(balanceRow.carriedOverDays)
    : DEFAULT_ANNUAL_ALLOWANCE;

  const requests = await HolidayRequest.findAll({
    where: {
      employeeId,
      status: { [Op.in]: ['pending_manager', 'pending_hr', 'approved'] },
      startDate: { [Op.gte]: `${year}-01-01`, [Op.lte]: `${year}-12-31` },
    },
  });

  let used = 0;
  let pending = 0;
  for (const request of requests) {
    if (request.status === 'approved') used += Number(request.totalDays);
    else pending += Number(request.totalDays);
  }

  return {
    year,
    annualAllowance: allowance,
    used,
    pending,
    remaining: Math.max(allowance - used - pending, 0),
  };
}

/** Simple weekday count (Mon-Fri) between two dates inclusive - does not account for public/bank holidays. */
function countWeekdays(startDate, endDate) {
  let count = 0;
  const cursor = new Date(startDate);
  const end = new Date(endDate);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

module.exports = { getBalance, countWeekdays, DEFAULT_ANNUAL_ALLOWANCE };
