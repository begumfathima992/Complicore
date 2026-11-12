const ExcelJS = require('exceljs');
const { sequelize } = require('../src/models');
const { previewImport, commitImport, SHEETS } = require('../src/services/importService');
const { createCompany, createEmployee } = require('./helpers');

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Builds a one-sheet workbook buffer matching the SHEETS[sheetKey] template's header labels. */
async function buildSheet(sheetKey, rows) {
  const def = SHEETS[sheetKey];
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(def.label);
  ws.columns = def.columns.map((c) => ({ header: c.label, key: c.key }));
  rows.forEach((row) => ws.addRow(row));
  return workbook.xlsx.writeBuffer();
}

describe('Bulk import row rules', () => {
  let company, employee;

  beforeAll(async () => {
    company = await createCompany();
    employee = await createEmployee(company.id);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('rejects a future-dated row that records actual (present) hours', async () => {
    const buffer = await buildSheet('attendance', [
      { employeeNumber: employee.employeeNumber, date: addDays(new Date().toISOString().slice(0, 10), 5), status: 'present' },
    ]);

    const result = await previewImport(buffer, 'attendance', company.id);

    expect(result.validCount).toBe(0);
    expect(result.errors[0].message).toBe('Actual hours can only be recorded for today or past dates.');
  });

  it('accepts a future-dated row for a planned status', async () => {
    const buffer = await buildSheet('attendance', [
      { employeeNumber: employee.employeeNumber, date: addDays(new Date().toISOString().slice(0, 10), 5), status: 'planned_absence' },
    ]);

    const result = await previewImport(buffer, 'attendance', company.id);
    expect(result.validCount).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('commits valid rows and reports invalid ones individually, rather than failing the whole file', async () => {
    const buffer = await buildSheet('attendance', [
      { employeeNumber: employee.employeeNumber, date: addDays(new Date().toISOString().slice(0, 10), -1), status: 'present' },
      { employeeNumber: employee.employeeNumber, date: addDays(new Date().toISOString().slice(0, 10), 5), status: 'present' },
      { employeeNumber: 'NOT_A_REAL_NUMBER', date: addDays(new Date().toISOString().slice(0, 10), -1), status: 'present' },
    ]);

    const result = await commitImport(buffer, 'attendance', { companyId: company.id, userId: null, roleKey: 'HR_MANAGER' });

    expect(result.committed).toBe(1);
    expect(result.errors).toHaveLength(2);
  });
});
