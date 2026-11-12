const request = require('supertest');
const app = require('../src/app');
const { sequelize, VisaRecord, EmployeeContractHistory, Alert } = require('../src/models');
const { activateDueChanges } = require('../src/services/scheduledChangeService');
const { createCompany, createEmployee, createUser } = require('./helpers');

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

describe('Past/present/future dating rules', () => {
  let company, employee, hrToken;

  beforeAll(async () => {
    company = await createCompany();
    employee = await createEmployee(company.id);
    const password = 'HrPass123!';
    const email = 'hr@ppftest.example';
    await createUser({ companyId: company.id, roleKey: 'HR_MANAGER', email, password });
    const login = await request(app).post('/api/auth/login').send({ email, password });
    hrToken = login.body.accessToken;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Attendance', () => {
    it('rejects an actual (present) status for a future date', async () => {
      const res = await request(app)
        .post('/api/attendance')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ employeeId: employee.id, date: addDays(new Date().toISOString().slice(0, 10), 5), status: 'present' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Actual hours can only be recorded for today or past dates.');
    });

    it('accepts a planned (holiday/unpaid leave) status for a future date', async () => {
      const res = await request(app)
        .post('/api/attendance')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ employeeId: employee.id, date: addDays(new Date().toISOString().slice(0, 10), 5), status: 'unpaid_leave' });

      expect(res.status).toBe(201);
      expect(res.body.record.status).toBe('unpaid_leave');
    });

    it('accepts an actual status for today or the past', async () => {
      const res = await request(app)
        .post('/api/attendance')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          employeeId: employee.id,
          date: new Date().toISOString().slice(0, 10),
          status: 'present',
          clockIn: '09:00',
          clockOut: '17:00',
          breakMinutes: 30,
        });

      expect(res.status).toBe(201);
      expect(Number(res.body.record.totalHours)).toBeCloseTo(7.5);
    });
  });

  describe('Contract history', () => {
    it('does not change the current record until the effective date arrives', async () => {
      const future = addDays(new Date().toISOString().slice(0, 10), 30);

      const res = await request(app)
        .post(`/api/employees/${employee.id}/contract-history`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ effectiveFrom: future, jobTitle: 'Future Job Title', salary: 99999 });

      expect(res.status).toBe(201);
      expect(res.body.version.isCurrent).toBe(false);

      const unchanged = await request(app).get(`/api/employees/${employee.id}`).set('Authorization', `Bearer ${hrToken}`);
      expect(unchanged.body.employee.jobTitle).not.toBe('Future Job Title');
    });

    it('promotes a due contract version and mirrors it onto the Employee record', async () => {
      const dueToday = new Date().toISOString().slice(0, 10);
      const version = await EmployeeContractHistory.create({
        employeeId: employee.id,
        companyId: company.id,
        effectiveFrom: dueToday,
        jobTitle: 'Promoted Job Title',
        salary: 55555,
      });
      expect(version.isCurrent).toBe(false);

      await activateDueChanges();

      await version.reload();
      expect(version.isCurrent).toBe(true);

      const updated = await request(app).get(`/api/employees/${employee.id}`).set('Authorization', `Bearer ${hrToken}`);
      expect(updated.body.employee.jobTitle).toBe('Promoted Job Title');
    });
  });

  describe('Visa records', () => {
    it('becomes current on its start date and closes the old visa alert', async () => {
      const yesterday = addDays(new Date().toISOString().slice(0, 10), -1);

      const oldVisa = await VisaRecord.create({
        employeeId: employee.id,
        companyId: company.id,
        visaType: 'Skilled Worker',
        isCurrent: true,
        expiryDate: addDays(new Date().toISOString().slice(0, 10), 10),
      });
      const openAlert = await Alert.create({
        alertType: 'visa_expiry',
        sourceType: 'VisaRecord',
        sourceId: oldVisa.id,
        employeeId: employee.id,
        companyId: company.id,
        severity: 'high',
        title: 'Old visa expiring',
        message: 'test',
        status: 'open',
      });

      const newVisa = await VisaRecord.create({
        employeeId: employee.id,
        companyId: company.id,
        visaType: 'Skilled Worker (renewed)',
        startDate: yesterday, // already arrived - the cron should pick this up
        supersedesCurrent: true,
        isCurrent: false,
      });

      await activateDueChanges();

      await newVisa.reload();
      await oldVisa.reload();
      await openAlert.reload();

      expect(newVisa.isCurrent).toBe(true);
      expect(oldVisa.isCurrent).toBe(false);
      expect(openAlert.status).toBe('resolved');
    });

    it('leaves a future-dated visa uncurrent until its start date', async () => {
      const future = addDays(new Date().toISOString().slice(0, 10), 30);
      const res = await request(app)
        .post(`/api/right-to-work-checks/visa-records/${employee.id}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ visaType: 'Future Visa', startDate: future, supersedesCurrent: true });

      expect(res.status).toBe(201);
      expect(res.body.record.isCurrent).toBe(false);
    });
  });
});
