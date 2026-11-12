const { Op } = require('sequelize');
const {
  Employee,
  Department,
  ImmigrationDetail,
  RightToWorkCheck,
  Document,
  ChangeOfCircumstance,
  HolidayRequest,
  Absence,
  Shift,
  User,
  VisaRecord,
  AttendanceRecord,
} = require('../models');
const { scopeToEmployeeWhere, scopeToChildWhere } = require('../utils/scopeToWhere');
const { REQUIRED_DOCUMENT_TYPES } = require('./alertService');

/** Applies the filters common to most reports: department, employee, status, location, manager. */
function applyCommonEmployeeFilters(where, filters) {
  if (filters.departmentId) where.departmentId = filters.departmentId;
  if (filters.employeeId) where.id = filters.employeeId;
  if (filters.status) where.employmentStatus = filters.status;
  if (filters.location) where.workLocation = { [Op.iLike]: `%${filters.location}%` };
  if (filters.managerId) where.managerId = filters.managerId;
  return where;
}

function applyDateRange(where, field, filters) {
  if (!filters.from && !filters.to) return where;
  where[field] = {};
  if (filters.from) where[field][Op.gte] = filters.from;
  if (filters.to) where[field][Op.lte] = filters.to;
  return where;
}

const fullName = (e) => `${e.firstName} ${e.lastName}`;

// --- Employee reports --------------------------------------------------------

async function employeeList(scope, filters) {
  const where = applyCommonEmployeeFilters(scopeToEmployeeWhere(scope), filters);
  const employees = await Employee.findAll({ where, include: [Department], order: [['lastName', 'ASC']] });

  return {
    columns: [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'name', label: 'Name' },
      { key: 'jobTitle', label: 'Job Title' },
      { key: 'department', label: 'Department' },
      { key: 'employmentStatus', label: 'Status' },
      { key: 'startDate', label: 'Start Date' },
      { key: 'workLocation', label: 'Location' },
    ],
    rows: employees.map((e) => ({
      employeeNumber: e.employeeNumber,
      name: fullName(e),
      jobTitle: e.jobTitle,
      department: e.Department?.name,
      employmentStatus: e.employmentStatus,
      startDate: e.startDate,
      workLocation: e.workLocation,
    })),
  };
}

async function employeeStatus(scope, filters) {
  const where = applyCommonEmployeeFilters(scopeToEmployeeWhere(scope), filters);
  const employees = await Employee.findAll({ where, order: [['employmentStatus', 'ASC']] });

  return {
    columns: [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'name', label: 'Name' },
      { key: 'employmentStatus', label: 'Status' },
    ],
    rows: employees.map((e) => ({ employeeNumber: e.employeeNumber, name: fullName(e), employmentStatus: e.employmentStatus })),
  };
}

async function departmentReport(scope, filters) {
  const where = applyCommonEmployeeFilters(scopeToEmployeeWhere(scope), filters);
  const employees = await Employee.findAll({ where, include: [Department] });

  const counts = new Map();
  for (const e of employees) {
    const name = e.Department?.name || 'Unassigned';
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  return {
    columns: [{ key: 'department', label: 'Department' }, { key: 'employeeCount', label: 'Employee Count' }],
    rows: [...counts.entries()].map(([department, employeeCount]) => ({ department, employeeCount })),
  };
}

async function roleReport(scope, filters) {
  const where = applyCommonEmployeeFilters(scopeToEmployeeWhere(scope), filters);
  const employees = await Employee.findAll({ where });

  const counts = new Map();
  for (const e of employees) {
    const title = e.jobTitle || 'Unspecified';
    counts.set(title, (counts.get(title) || 0) + 1);
  }

  return {
    columns: [{ key: 'jobTitle', label: 'Job Title' }, { key: 'employeeCount', label: 'Employee Count' }],
    rows: [...counts.entries()].map(([jobTitle, employeeCount]) => ({ jobTitle, employeeCount })),
  };
}

/**
 * Nationality is only reported here, gated by RIGHT_TO_WORK read access
 * (checked by the controller before calling this) - never surfaced on the
 * general employee_list report. See ImmigrationDetail model comment.
 */
async function nationalityReport(scope, filters) {
  const where = applyCommonEmployeeFilters(scopeToEmployeeWhere(scope), filters);
  const employees = await Employee.findAll({ where, include: [ImmigrationDetail] });

  return {
    columns: [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'name', label: 'Name' },
      { key: 'nationality', label: 'Nationality' },
    ],
    rows: employees.map((e) => ({ employeeNumber: e.employeeNumber, name: fullName(e), nationality: e.ImmigrationDetail?.nationality })),
  };
}

async function startTerminationDates(scope, filters) {
  const where = applyCommonEmployeeFilters(scopeToEmployeeWhere(scope), filters);
  const employees = await Employee.findAll({ where, order: [['startDate', 'DESC']] });

  return {
    columns: [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'name', label: 'Name' },
      { key: 'startDate', label: 'Start Date' },
      { key: 'terminationDate', label: 'Termination Date' },
      { key: 'employmentStatus', label: 'Status' },
    ],
    rows: employees.map((e) => ({
      employeeNumber: e.employeeNumber,
      name: fullName(e),
      startDate: e.startDate,
      terminationDate: e.terminationDate,
      employmentStatus: e.employmentStatus,
    })),
  };
}

// --- Compliance reports -------------------------------------------------------

async function rightToWorkReport(scope, filters) {
  const employeeWhere = applyCommonEmployeeFilters(scopeToEmployeeWhere(scope), filters);
  const employees = await Employee.findAll({ where: employeeWhere, attributes: ['id', 'employeeNumber', 'firstName', 'lastName'] });
  const employeeIds = employees.map((e) => e.id);

  const checks = await RightToWorkCheck.findAll({
    where: { employeeId: { [Op.in]: employeeIds.length ? employeeIds : [null] } },
    order: [['checkDate', 'DESC']],
  });
  const latest = new Map();
  for (const c of checks) if (!latest.has(c.employeeId)) latest.set(c.employeeId, c);

  return {
    columns: [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'name', label: 'Name' },
      { key: 'checkType', label: 'Last Check Type' },
      { key: 'checkDate', label: 'Last Check Date' },
      { key: 'status', label: 'Status' },
      { key: 'expiryDate', label: 'Expiry Date' },
      { key: 'nextReviewDate', label: 'Next Review' },
    ],
    rows: employees.map((e) => {
      const c = latest.get(e.id);
      return {
        employeeNumber: e.employeeNumber,
        name: fullName(e),
        checkType: c?.checkType,
        checkDate: c?.checkDate,
        status: c?.status || 'not_verified',
        expiryDate: c?.expiryDate,
        nextReviewDate: c?.nextReviewDate,
      };
    }),
  };
}

async function documentExpiryReport(scope, filters, { expired }) {
  const employeeWhere = applyCommonEmployeeFilters(scopeToEmployeeWhere(scope), filters);
  const employees = await Employee.findAll({ where: employeeWhere, attributes: ['id', 'employeeNumber', 'firstName', 'lastName'] });
  const employeeIds = employees.map((e) => e.id);
  const byId = new Map(employees.map((e) => [e.id, e]));

  const dateWhere = expired ? { [Op.lt]: new Date() } : { [Op.gte]: new Date() };
  const documents = await Document.findAll({
    where: applyDateRange(
      { employeeId: { [Op.in]: employeeIds.length ? employeeIds : [null] }, isCurrent: true, expiryDate: dateWhere },
      'expiryDate',
      filters
    ),
    order: [['expiryDate', 'ASC']],
  });

  return {
    columns: [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'name', label: 'Name' },
      { key: 'documentType', label: 'Document Type' },
      { key: 'expiryDate', label: 'Expiry Date' },
      { key: 'status', label: 'Status' },
    ],
    rows: documents.map((d) => ({
      employeeNumber: byId.get(d.employeeId)?.employeeNumber,
      name: byId.get(d.employeeId) ? fullName(byId.get(d.employeeId)) : undefined,
      documentType: d.documentType,
      expiryDate: d.expiryDate,
      status: d.status,
    })),
  };
}

async function missingDocumentsReport(scope, filters) {
  const employeeWhere = applyCommonEmployeeFilters(scopeToEmployeeWhere(scope), filters);
  const today = new Date().toISOString().slice(0, 10);
  const employees = await Employee.findAll({
    where: { ...employeeWhere, employmentStatus: 'active', startDate: { [Op.or]: [null, { [Op.lte]: today }] } },
    include: [{ model: Document, where: { isCurrent: true }, required: false, attributes: ['documentType'] }],
  });

  const rows = [];
  for (const e of employees) {
    const held = new Set(e.Documents.map((d) => d.documentType));
    for (const type of REQUIRED_DOCUMENT_TYPES) {
      if (!held.has(type)) rows.push({ employeeNumber: e.employeeNumber, name: fullName(e), missingDocumentType: type });
    }
  }

  return {
    columns: [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'name', label: 'Name' },
      { key: 'missingDocumentType', label: 'Missing Document' },
    ],
    rows,
  };
}

/**
 * Visa type/expiry/share code now come from the current (isCurrent:true)
 * VisaRecord rather than ImmigrationDetail directly - see the migration
 * that moved them there. `shareCode` is masked server-side for non-HR+
 * roles by runReport() in controllers/reportController.js, same as it is
 * everywhere else this field appears.
 */
async function visaMonitoringReport(scope, filters) {
  const employeeWhere = applyCommonEmployeeFilters(scopeToEmployeeWhere(scope), filters);
  const employees = await Employee.findAll({
    where: employeeWhere,
    include: [ImmigrationDetail, { model: VisaRecord, where: { isCurrent: true }, required: true }],
  });

  return {
    columns: [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'name', label: 'Name' },
      { key: 'visaType', label: 'Visa Type' },
      { key: 'visaExpiry', label: 'Visa Expiry' },
      { key: 'shareCode', label: 'Share Code' },
      { key: 'settlementStatus', label: 'EUSS Status' },
      { key: 'complianceStatus', label: 'Compliance Status' },
    ],
    rows: employees
      .filter((e) => e.VisaRecords?.[0]?.expiryDate)
      .map((e) => ({
        employeeNumber: e.employeeNumber,
        name: fullName(e),
        visaType: e.VisaRecords[0].visaType,
        visaExpiry: e.VisaRecords[0].expiryDate,
        shareCode: e.VisaRecords[0].shareCode,
        settlementStatus: e.ImmigrationDetail?.settlementStatus,
        complianceStatus: e.ImmigrationDetail?.complianceStatus,
      })),
  };
}

/**
 * EU Settlement Scheme status is its own report, separate from general
 * visa monitoring, because it's a distinct UK immigration category with
 * its own evidence trail - and unlike a work visa, it has no expiry date
 * to filter on, so it doesn't fit the expiring/expired document reports
 * either. `filters.status` (the report system's generic status filter)
 * maps onto settlementStatus here.
 */
async function settlementStatusReport(scope, filters) {
  // Deliberately not applyCommonEmployeeFilters(): its generic `status`
  // filter maps onto Employee.employmentStatus, but here `status` means
  // settlementStatus (an ImmigrationDetail field) - applying both would
  // send e.g. 'pre_settled' into the employmentStatus column and 500.
  const employeeWhere = scopeToEmployeeWhere(scope);
  if (filters.departmentId) employeeWhere.departmentId = filters.departmentId;
  if (filters.employeeId) employeeWhere.id = filters.employeeId;
  if (filters.managerId) employeeWhere.managerId = filters.managerId;

  const employees = await Employee.findAll({ where: employeeWhere, include: [ImmigrationDetail] });

  const rows = employees
    .filter((e) => !filters.status || e.ImmigrationDetail?.settlementStatus === filters.status)
    .map((e) => ({
      employeeNumber: e.employeeNumber,
      name: fullName(e),
      nationality: e.ImmigrationDetail?.nationality,
      settlementStatus: e.ImmigrationDetail?.settlementStatus || 'not_applicable',
    }));

  return {
    columns: [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'name', label: 'Name' },
      { key: 'nationality', label: 'Nationality' },
      { key: 'settlementStatus', label: 'EU Settlement Scheme Status' },
    ],
    rows,
  };
}

async function changeOfCircumstancesReport(scope, filters) {
  const where = applyDateRange(await scopeToChildWhere(scope), 'effectiveDate', filters);
  if (filters.employeeId) where.employeeId = filters.employeeId;

  const changes = await ChangeOfCircumstance.findAll({
    where,
    include: [
      { model: Employee, attributes: ['employeeNumber', 'firstName', 'lastName'] },
      { model: User, as: 'changedBy', attributes: ['email'] },
    ],
    order: [['effectiveDate', 'DESC']],
  });

  return {
    columns: [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'name', label: 'Name' },
      { key: 'changeType', label: 'Change Type' },
      { key: 'oldValue', label: 'Old Value' },
      { key: 'newValue', label: 'New Value' },
      { key: 'effectiveDate', label: 'Effective Date' },
      { key: 'changedBy', label: 'Changed By' },
    ],
    rows: changes.map((c) => ({
      employeeNumber: c.Employee?.employeeNumber,
      name: c.Employee ? fullName(c.Employee) : undefined,
      changeType: c.changeType,
      oldValue: c.oldValue,
      newValue: c.newValue,
      effectiveDate: c.effectiveDate,
      changedBy: c.changedBy?.email,
    })),
  };
}

// --- HR reports -----------------------------------------------------------

async function holidayReport(scope, filters) {
  const where = applyDateRange(await scopeToChildWhere(scope), 'startDate', filters);
  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.status) where.status = filters.status;

  const requests = await HolidayRequest.findAll({
    where,
    include: [{ model: Employee, attributes: ['employeeNumber', 'firstName', 'lastName'] }],
    order: [['startDate', 'DESC']],
  });

  return {
    columns: [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'name', label: 'Name' },
      { key: 'startDate', label: 'Start Date' },
      { key: 'endDate', label: 'End Date' },
      { key: 'totalDays', label: 'Total Days' },
      { key: 'status', label: 'Status' },
    ],
    rows: requests.map((r) => ({
      employeeNumber: r.Employee?.employeeNumber,
      name: r.Employee ? fullName(r.Employee) : undefined,
      startDate: r.startDate,
      endDate: r.endDate,
      totalDays: r.totalDays,
      status: r.status,
    })),
  };
}

async function absenceReportBase(scope, filters, { onlyType } = {}) {
  const where = applyDateRange(await scopeToChildWhere(scope), 'startDate', filters);
  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.status) where.status = filters.status;
  if (onlyType) where.absenceType = onlyType;

  const absences = await Absence.findAll({
    where,
    include: [{ model: Employee, attributes: ['employeeNumber', 'firstName', 'lastName'] }],
    order: [['startDate', 'DESC']],
  });

  return {
    columns: [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'name', label: 'Name' },
      { key: 'absenceType', label: 'Type' },
      { key: 'startDate', label: 'Start Date' },
      { key: 'endDate', label: 'End Date' },
      { key: 'durationDays', label: 'Duration (days)' },
      { key: 'status', label: 'Status' },
    ],
    rows: absences.map((a) => ({
      employeeNumber: a.Employee?.employeeNumber,
      name: a.Employee ? fullName(a.Employee) : undefined,
      absenceType: a.absenceType,
      startDate: a.startDate,
      endDate: a.endDate,
      durationDays: a.durationDays,
      status: a.status,
    })),
  };
}

const sicknessReport = (scope, filters) => absenceReportBase(scope, filters, { onlyType: 'sickness' });
const absenceReport = (scope, filters) => absenceReportBase(scope, filters);

async function rosterReport(scope, filters) {
  const where = applyDateRange(await scopeToChildWhere(scope), 'shiftDate', filters);
  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.departmentId) where.departmentId = filters.departmentId;

  const shifts = await Shift.findAll({
    where,
    include: [{ model: Employee, attributes: ['employeeNumber', 'firstName', 'lastName'] }, Department],
    order: [['startsAt', 'ASC']],
  });

  return {
    columns: [
      { key: 'shiftDate', label: 'Date' },
      { key: 'startTime', label: 'Start' },
      { key: 'endTime', label: 'End' },
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'name', label: 'Name' },
      { key: 'department', label: 'Department' },
      { key: 'status', label: 'Status' },
    ],
    rows: shifts.map((s) => ({
      shiftDate: s.shiftDate,
      startTime: s.startTime,
      endTime: s.endTime,
      employeeNumber: s.Employee?.employeeNumber,
      name: s.Employee ? fullName(s.Employee) : undefined,
      department: s.Department?.name,
      status: s.status,
    })),
  };
}

/** Weekly scheduled hours per employee vs a 40h/week baseline - not a payroll-grade overtime calculation. */
async function overtimeReport(scope, filters) {
  const where = applyDateRange(await scopeToChildWhere(scope), 'shiftDate', filters);
  if (filters.employeeId) where.employeeId = filters.employeeId;

  const shifts = await Shift.findAll({ where, include: [{ model: Employee, attributes: ['employeeNumber', 'firstName', 'lastName'] }] });

  const WEEK_BASELINE_HOURS = 40;
  const weekKey = (date) => {
    const d = new Date(date);
    const day = (d.getUTCDay() + 6) % 7; // Monday = 0
    d.setUTCDate(d.getUTCDate() - day);
    return d.toISOString().slice(0, 10);
  };

  const totals = new Map(); // `${employeeId}:${weekStart}` -> { employee, hours }
  for (const s of shifts) {
    const key = `${s.employeeId}:${weekKey(s.shiftDate)}`;
    const hours = (new Date(s.endsAt) - new Date(s.startsAt)) / (1000 * 60 * 60);
    const entry = totals.get(key) || { employee: s.Employee, weekStarting: weekKey(s.shiftDate), hours: 0 };
    entry.hours += hours;
    totals.set(key, entry);
  }

  return {
    columns: [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'name', label: 'Name' },
      { key: 'weekStarting', label: 'Week Starting' },
      { key: 'scheduledHours', label: 'Scheduled Hours' },
      { key: 'overtimeHours', label: 'Overtime Hours' },
    ],
    rows: [...totals.values()].map((t) => ({
      employeeNumber: t.employee?.employeeNumber,
      name: t.employee ? fullName(t.employee) : undefined,
      weekStarting: t.weekStarting,
      scheduledHours: Math.round(t.hours * 10) / 10,
      overtimeHours: Math.max(0, Math.round((t.hours - WEEK_BASELINE_HOURS) * 10) / 10),
    })),
  };
}

/** Planned (Shift) vs actual (AttendanceRecord) hours per employee per week - only meaningful for fully-past weeks; current/future weeks simply show 0 actual hours so far. */
async function attendanceVsRosterReport(scope, filters) {
  const weekKey = (date) => {
    const d = new Date(date);
    const day = (d.getUTCDay() + 6) % 7; // Monday = 0
    d.setUTCDate(d.getUTCDate() - day);
    return d.toISOString().slice(0, 10);
  };

  const totals = new Map(); // `${employeeId}:${weekStart}` -> { employee, weekStarting, plannedHours, actualHours }
  const getEntry = (employeeId, employee, weekStarting) => {
    const key = `${employeeId}:${weekStarting}`;
    if (!totals.has(key)) totals.set(key, { employee, weekStarting, plannedHours: 0, actualHours: 0 });
    return totals.get(key);
  };

  const shiftWhere = applyDateRange(await scopeToChildWhere(scope), 'shiftDate', filters);
  if (filters.employeeId) shiftWhere.employeeId = filters.employeeId;
  const shifts = await Shift.findAll({ where: shiftWhere, include: [{ model: Employee, attributes: ['employeeNumber', 'firstName', 'lastName'] }] });
  for (const s of shifts) {
    const hours = (new Date(s.endsAt) - new Date(s.startsAt)) / (1000 * 60 * 60);
    getEntry(s.employeeId, s.Employee, weekKey(s.shiftDate)).plannedHours += hours;
  }

  const attendanceWhere = applyDateRange(await scopeToChildWhere(scope), 'date', filters);
  if (filters.employeeId) attendanceWhere.employeeId = filters.employeeId;
  const records = await AttendanceRecord.findAll({ where: attendanceWhere, include: [{ model: Employee, attributes: ['employeeNumber', 'firstName', 'lastName'] }] });
  for (const r of records) {
    getEntry(r.employeeId, r.Employee, weekKey(r.date)).actualHours += Number(r.totalHours || 0);
  }

  return {
    columns: [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'name', label: 'Name' },
      { key: 'weekStarting', label: 'Week Starting' },
      { key: 'plannedHours', label: 'Planned Hours' },
      { key: 'actualHours', label: 'Actual Hours' },
      { key: 'varianceHours', label: 'Variance (actual - planned)' },
    ],
    rows: [...totals.values()].map((t) => ({
      employeeNumber: t.employee?.employeeNumber,
      name: t.employee ? fullName(t.employee) : undefined,
      weekStarting: t.weekStarting,
      plannedHours: Math.round(t.plannedHours * 10) / 10,
      actualHours: Math.round(t.actualHours * 10) / 10,
      varianceHours: Math.round((t.actualHours - t.plannedHours) * 10) / 10,
    })),
  };
}

async function turnoverReport(scope, filters) {
  const baseWhere = scopeToEmployeeWhere(scope);
  if (filters.departmentId) baseWhere.departmentId = filters.departmentId;

  const from = filters.from || '1970-01-01';
  const to = filters.to || new Date().toISOString().slice(0, 10);

  const hires = await Employee.count({ where: { ...baseWhere, startDate: { [Op.between]: [from, to] } } });
  const terminations = await Employee.count({
    where: { ...baseWhere, employmentStatus: 'terminated', terminationDate: { [Op.between]: [from, to] } },
  });
  // Excludes future-dated new starters ("starting soon") from active headcount.
  const headcountEnd = await Employee.count({
    where: { ...baseWhere, employmentStatus: 'active', startDate: { [Op.or]: [null, { [Op.lte]: to }] } },
  });
  const headcountStart = Math.max(headcountEnd - hires + terminations, 0);
  const avgHeadcount = (headcountStart + headcountEnd) / 2 || 1;
  const turnoverRatePercent = Math.round((terminations / avgHeadcount) * 1000) / 10;

  return {
    columns: [
      { key: 'metric', label: 'Metric' },
      { key: 'value', label: 'Value' },
    ],
    rows: [
      { metric: 'Period', value: `${from} to ${to}` },
      { metric: 'Headcount (start of period, est.)', value: headcountStart },
      { metric: 'Headcount (end of period)', value: headcountEnd },
      { metric: 'Hires in period', value: hires },
      { metric: 'Terminations in period', value: terminations },
      { metric: 'Turnover rate', value: `${turnoverRatePercent}%` },
    ],
  };
}

async function trainingReport(scope, filters) {
  const employeeWhere = applyCommonEmployeeFilters(scopeToEmployeeWhere(scope), filters);
  const employees = await Employee.findAll({ where: employeeWhere, attributes: ['id', 'employeeNumber', 'firstName', 'lastName'] });
  const employeeIds = employees.map((e) => e.id);
  const byId = new Map(employees.map((e) => [e.id, e]));

  const documents = await Document.findAll({
    where: {
      employeeId: { [Op.in]: employeeIds.length ? employeeIds : [null] },
      documentType: { [Op.in]: ['training_record', 'certificate', 'qualification'] },
      isCurrent: true,
    },
    order: [['expiryDate', 'ASC']],
  });

  return {
    columns: [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'name', label: 'Name' },
      { key: 'documentType', label: 'Training/Certificate' },
      { key: 'expiryDate', label: 'Expiry Date' },
      { key: 'status', label: 'Status' },
    ],
    rows: documents.map((d) => ({
      employeeNumber: byId.get(d.employeeId)?.employeeNumber,
      name: byId.get(d.employeeId) ? fullName(byId.get(d.employeeId)) : undefined,
      documentType: d.documentType,
      expiryDate: d.expiryDate,
      status: d.status,
    })),
  };
}

/**
 * Registry: key -> { label, category, generate, sensitivePermission }.
 * `sensitivePermission` (when set) is an extra granular permission key the
 * caller must hold, beyond ordinary Reports access - only nationality
 * needs this today, per "only where legitimately needed".
 */
const REPORTS = {
  employee_list: { label: 'Employee List', category: 'employee', generate: employeeList },
  employee_status: { label: 'Employee Status', category: 'employee', generate: employeeStatus },
  department: { label: 'Department', category: 'employee', generate: departmentReport },
  role: { label: 'Role', category: 'employee', generate: roleReport },
  nationality: { label: 'Nationality/Citizenship', category: 'employee', generate: nationalityReport, sensitivePermission: 'right_to_work.view' },
  start_termination_dates: { label: 'Start/Termination Dates', category: 'employee', generate: startTerminationDates },

  right_to_work: { label: 'Right-to-Work Report', category: 'compliance', generate: rightToWorkReport },
  expiring_documents: { label: 'Expiring Documents', category: 'compliance', generate: (s, f) => documentExpiryReport(s, f, { expired: false }) },
  expired_documents: { label: 'Expired Documents', category: 'compliance', generate: (s, f) => documentExpiryReport(s, f, { expired: true }) },
  missing_documents: { label: 'Missing Documents', category: 'compliance', generate: missingDocumentsReport },
  visa_monitoring: { label: 'Visa Monitoring', category: 'compliance', generate: visaMonitoringReport },
  settlement_status: {
    label: 'EU Settlement Scheme Status',
    category: 'compliance',
    generate: settlementStatusReport,
    sensitivePermission: 'right_to_work.view',
  },
  change_of_circumstances: { label: 'Change of Circumstances', category: 'compliance', generate: changeOfCircumstancesReport },

  holiday: { label: 'Holiday Report', category: 'hr', generate: holidayReport },
  sickness: { label: 'Sickness Report', category: 'hr', generate: sicknessReport },
  absence: { label: 'Absence Report', category: 'hr', generate: absenceReport },
  overtime: { label: 'Overtime Report', category: 'hr', generate: overtimeReport },
  attendance_vs_roster: { label: 'Attendance vs Roster', category: 'hr', generate: attendanceVsRosterReport },
  roster: { label: 'Roster Report', category: 'hr', generate: rosterReport },
  turnover: { label: 'Employee Turnover', category: 'hr', generate: turnoverReport },
  training: { label: 'Training Report', category: 'hr', generate: trainingReport },
};

module.exports = { REPORTS };
