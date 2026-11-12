const { randomUUID } = require('crypto');
const ExcelJS = require('exceljs');
const { Employee, AttendanceRecord, EmployeeContractHistory, VisaRecord } = require('../models');
const { assertDateStatusAllowed } = require('./attendanceService');
const { promoteContractVersionIfDue, promoteVisaRecordIfDue } = require('./scheduledChangeService');
const { recordAudit } = require('./auditService');

/**
 * One sheet per entity. Each column's `key` is both the template's header
 * label (humanised) and the field name rows are parsed into - row objects
 * from parseWorkbook() use these keys directly.
 */
const SHEETS = {
  employees: {
    label: 'Employees',
    columns: [
      { key: 'employeeNumber', label: 'Employee Number' },
      { key: 'firstName', label: 'First Name' },
      { key: 'lastName', label: 'Last Name' },
      { key: 'email', label: 'Email' },
      { key: 'dateOfBirth', label: 'Date Of Birth (YYYY-MM-DD)' },
      { key: 'jobTitle', label: 'Job Title' },
      { key: 'startDate', label: 'Start Date (YYYY-MM-DD)' },
      { key: 'workLocation', label: 'Work Location' },
      { key: 'salary', label: 'Salary' },
      { key: 'contractedHoursPerWeek', label: 'Contracted Hours/Week' },
      { key: 'contractEndDate', label: 'Contract End Date (YYYY-MM-DD)' },
    ],
  },
  attendance: {
    label: 'Attendance',
    columns: [
      { key: 'employeeNumber', label: 'Employee Number' },
      { key: 'date', label: 'Date (YYYY-MM-DD)' },
      { key: 'status', label: 'Status (present/absent/sick/planned_absence/unpaid_leave)' },
      { key: 'clockIn', label: 'Clock In (HH:MM)' },
      { key: 'clockOut', label: 'Clock Out (HH:MM)' },
      { key: 'breakMinutes', label: 'Break (mins)' },
      { key: 'notes', label: 'Notes' },
    ],
  },
  contracts: {
    label: 'Contracts',
    columns: [
      { key: 'employeeNumber', label: 'Employee Number' },
      { key: 'effectiveFrom', label: 'Effective From (YYYY-MM-DD)' },
      { key: 'jobTitle', label: 'Job Title' },
      { key: 'salary', label: 'Salary' },
      { key: 'contractedHoursPerWeek', label: 'Contracted Hours/Week' },
      { key: 'contractEndDate', label: 'Contract End Date (YYYY-MM-DD)' },
      { key: 'workLocation', label: 'Work Location' },
      { key: 'changeReason', label: 'Change Reason' },
    ],
  },
  visas: {
    label: 'Visas',
    columns: [
      { key: 'employeeNumber', label: 'Employee Number' },
      { key: 'visaType', label: 'Visa Type' },
      { key: 'shareCode', label: 'Share Code' },
      { key: 'startDate', label: 'Start Date (YYYY-MM-DD)' },
      { key: 'expiryDate', label: 'Expiry Date (YYYY-MM-DD)' },
      { key: 'sponsorshipReference', label: 'Sponsorship Reference' },
      { key: 'supersedesCurrent', label: 'Replaces Current? (true/false)' },
    ],
  },
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function buildTemplate() {
  const workbook = new ExcelJS.Workbook();
  for (const sheet of Object.values(SHEETS)) {
    const ws = workbook.addWorksheet(sheet.label);
    ws.columns = sheet.columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(c.label.length + 2, 16) }));
    ws.getRow(1).font = { bold: true };
  }
  return workbook.xlsx.writeBuffer();
}

/** Parses one sheet of an uploaded workbook into row objects keyed by the SHEETS[...] column keys above, matched by header label. */
async function parseSheet(buffer, sheetKey) {
  const def = SHEETS[sheetKey];
  if (!def) throw new Error(`Unknown import sheet '${sheetKey}'`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const ws = workbook.getWorksheet(def.label);
  if (!ws) return [];

  const headerRow = ws.getRow(1).values; // 1-indexed, index 0 is empty
  const keyByColumn = {};
  headerRow.forEach((label, colIndex) => {
    const match = def.columns.find((c) => c.label === label);
    if (match) keyByColumn[colIndex] = match.key;
  });

  const rows = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj = { _row: rowNumber };
    let hasValue = false;
    row.eachCell({ includeEmpty: true }, (cell, colIndex) => {
      const key = keyByColumn[colIndex];
      if (!key) return;
      let value = cell.value;
      if (value instanceof Date) value = value.toISOString().slice(0, 10);
      if (value != null && value !== '') hasValue = true;
      obj[key] = value == null ? '' : String(value).trim();
    });
    if (hasValue) rows.push(obj);
  });
  return rows;
}

/** Validates one row against the same past/present/future rules used by the live-entry endpoints. Returns an error string, or null if valid. */
function validateRow(sheetKey, row, employeeIndex) {
  if (!row.employeeNumber) return 'employeeNumber is required';
  const employee = sheetKey === 'employees' ? null : employeeIndex.get(row.employeeNumber);
  if (sheetKey !== 'employees' && !employee) return `No employee found with employeeNumber '${row.employeeNumber}'`;

  switch (sheetKey) {
    case 'employees':
      if (!row.firstName || !row.lastName || !row.email) return 'firstName, lastName and email are required';
      if (employeeIndex.has(row.employeeNumber)) return `employeeNumber '${row.employeeNumber}' already exists`;
      return null;
    case 'attendance': {
      if (!row.date || !row.status) return 'date and status are required';
      if (!AttendanceRecord.ACTUAL_STATUSES.includes(row.status) && !AttendanceRecord.PLANNED_STATUSES.includes(row.status)) {
        return `status must be one of: ${[...AttendanceRecord.ACTUAL_STATUSES, ...AttendanceRecord.PLANNED_STATUSES].join(', ')}`;
      }
      try {
        assertDateStatusAllowed(row.date, row.status);
      } catch (err) {
        return err.message;
      }
      return null;
    }
    case 'contracts':
      if (!row.effectiveFrom) return 'effectiveFrom is required';
      return null;
    case 'visas':
      if (!row.visaType && !row.shareCode && !row.expiryDate) return 'at least one of visaType, shareCode or expiryDate is required';
      return null;
    default:
      return 'Unknown sheet';
  }
}

/** Dry run: parses + validates every row, writes nothing. */
async function previewImport(buffer, sheetKey, companyId) {
  const rows = await parseSheet(buffer, sheetKey);
  const employees = await Employee.findAll({ where: { companyId }, attributes: ['id', 'employeeNumber'] });
  const employeeIndex = new Map(employees.map((e) => [e.employeeNumber, e]));

  const errors = [];
  let validCount = 0;
  for (const row of rows) {
    const error = validateRow(sheetKey, row, employeeIndex);
    if (error) errors.push({ row: row._row, message: error });
    else validCount += 1;
  }

  return { sheet: sheetKey, totalRows: rows.length, validCount, errors };
}

/**
 * Commits every valid row and skips/reports invalid ones, rather than
 * failing the whole file together - a single bad row in a large sheet
 * shouldn't block the rest. One audit row is recorded for the whole run
 * (counts), not one per imported record.
 */
async function commitImport(buffer, sheetKey, { companyId, userId, roleKey, ipAddress, userAgent }) {
  const rows = await parseSheet(buffer, sheetKey);
  const employees = await Employee.findAll({ where: { companyId }, attributes: ['id', 'employeeNumber'] });
  const employeeIndex = new Map(employees.map((e) => [e.employeeNumber, e]));

  const errors = [];
  let committed = 0;

  for (const row of rows) {
    const error = validateRow(sheetKey, row, employeeIndex);
    if (error) {
      errors.push({ row: row._row, message: error });
      continue;
    }

    try {
      if (sheetKey === 'employees') {
        const created = await Employee.create({
          companyId,
          employeeNumber: row.employeeNumber,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          dateOfBirth: row.dateOfBirth || null,
          jobTitle: row.jobTitle || null,
          startDate: row.startDate || null,
          workLocation: row.workLocation || null,
          salary: row.salary || null,
          contractedHoursPerWeek: row.contractedHoursPerWeek || null,
          contractEndDate: row.contractEndDate || null,
        });
        employeeIndex.set(created.employeeNumber, created);
      } else {
        const employee = employeeIndex.get(row.employeeNumber);
        if (sheetKey === 'attendance') {
          await AttendanceRecord.create({
            employeeId: employee.id,
            companyId,
            date: row.date,
            status: row.status,
            clockIn: row.clockIn || null,
            clockOut: row.clockOut || null,
            breakMinutes: row.breakMinutes || 0,
            notes: row.notes || null,
            source: 'import',
            createdByUserId: userId,
          });
        } else if (sheetKey === 'contracts') {
          let version = await EmployeeContractHistory.create({
            employeeId: employee.id,
            companyId,
            effectiveFrom: row.effectiveFrom,
            jobTitle: row.jobTitle || null,
            salary: row.salary || null,
            contractedHoursPerWeek: row.contractedHoursPerWeek || null,
            contractEndDate: row.contractEndDate || null,
            workLocation: row.workLocation || null,
            changeReason: row.changeReason || 'Imported',
            createdByUserId: userId,
          });
          await promoteContractVersionIfDue(version);
        } else if (sheetKey === 'visas') {
          let record = await VisaRecord.create({
            employeeId: employee.id,
            companyId,
            visaType: row.visaType || null,
            shareCode: row.shareCode || null,
            startDate: row.startDate || null,
            expiryDate: row.expiryDate || null,
            sponsorshipReference: row.sponsorshipReference || null,
            supersedesCurrent: String(row.supersedesCurrent).toLowerCase() === 'true',
            createdByUserId: userId,
          });
          await promoteVisaRecordIfDue(record);
        }
      }
      committed += 1;
    } catch (err) {
      errors.push({ row: row._row, message: err.message });
    }
  }

  await recordAudit({
    entityType: 'Import',
    entityId: randomUUID(), // one synthetic id per run - entityId is a UUID column, and a run has no natural row to point at
    action: 'create',
    fieldName: 'summary',
    newValue: JSON.stringify({ sheet: sheetKey, committed, failed: errors.length, totalRows: rows.length }),
    performedByUserId: userId,
    performedByRoleKey: roleKey,
    ipAddress,
    userAgent,
    companyId,
  });

  return { sheet: sheetKey, totalRows: rows.length, committed, errors };
}

module.exports = { SHEETS, buildTemplate, previewImport, commitImport, todayStr };
