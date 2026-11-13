const request = require('supertest');

// Avoids any real R2/S3 network call from documentController.deleteDocument -
// everything else in this file only exercises DB-level document creation,
// which never touches storageService.
jest.mock('../src/services/storageService', () => ({
  ...jest.requireActual('../src/services/storageService'),
  deleteObject: jest.fn().mockResolvedValue(undefined),
}));

const app = require('../src/app');
const { sequelize, Document, AuditLog } = require('../src/models');
const storageService = require('../src/services/storageService');
const { createCompany, createEmployee, createUser, unique } = require('./helpers');

describe('Audit follow-up: NI number, document delete, payslips, validations, create-form fields', () => {
  let company, employee, hrToken;

  beforeAll(async () => {
    company = await createCompany();
    employee = await createEmployee(company.id, { startDate: '2026-01-01' });
    const password = 'HrPass123!';
    const email = 'hr@followuptest.example';
    await createUser({ companyId: company.id, roleKey: 'HR_MANAGER', email, password });
    const login = await request(app).post('/api/auth/login').send({ email, password });
    hrToken = login.body.accessToken;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('NI number', () => {
    it('rejects an invalid UK NI number format', async () => {
      const res = await request(app)
        .patch(`/api/right-to-work-checks/immigration-detail/${employee.id}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ niNumber: 'not-a-valid-ni' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/UK format/);
    });

    it('accepts a valid NI number and normalizes it (spaces stripped, uppercase)', async () => {
      // Not 'QQ123456C' - the real HMRC format excludes Q as a first
      // letter (along with D, F, I, U, V), so that example (despite being
      // the one commonly quoted, including in the original audit report)
      // is not actually a valid NI number.
      const res = await request(app)
        .patch(`/api/right-to-work-checks/immigration-detail/${employee.id}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ niNumber: 'ab 123456 c' });

      expect(res.status).toBe(200);
      expect(res.body.immigrationDetail.niNumber).toBe('AB123456C');
    });
  });

  describe('Share code validation', () => {
    it('rejects a share code that is not exactly 9 letters/numbers', async () => {
      const res = await request(app)
        .post(`/api/right-to-work-checks/visa-records/${employee.id}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ visaType: 'Skilled Worker', shareCode: 'TOOSHORT' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/9 letters\/numbers/);
    });

    it('accepts a valid share code, normalized to uppercase with no dashes', async () => {
      const res = await request(app)
        .post(`/api/right-to-work-checks/visa-records/${employee.id}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ visaType: 'Skilled Worker', shareCode: 'w12-345-678' });

      expect(res.status).toBe(201);
      expect(res.body.record.shareCode).toBe('W12345678');
    });
  });

  describe('Contract end date after start date', () => {
    it('rejects a contract end date on or before the employee start date (via Employee update)', async () => {
      const res = await request(app)
        .patch(`/api/employees/${employee.id}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ contractEndDate: '2025-12-31' }); // before the 2026-01-01 startDate

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Contract end date must be after/);
    });

    it('accepts a contract end date after the start date', async () => {
      const res = await request(app)
        .patch(`/api/employees/${employee.id}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ contractEndDate: '2027-01-01' });

      expect(res.status).toBe(200);
    });

    it('rejects it the same way via the Contract History sub-resource', async () => {
      const res = await request(app)
        .post(`/api/employees/${employee.id}/contract-history`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ effectiveFrom: '2026-02-01', contractEndDate: '2025-01-01' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Contract end date must be after/);
    });
  });

  describe('UK phone validation on employee create', () => {
    it('rejects a malformed phone number', async () => {
      const res = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          employeeNumber: unique('EMP'),
          firstName: 'Bad',
          lastName: 'Phone',
          email: `${unique('badphone')}@test.example`,
          telephone: '12345',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/UK number/);
    });

    it('accepts and normalizes a valid UK mobile number', async () => {
      const res = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          employeeNumber: unique('EMP'),
          firstName: 'Good',
          lastName: 'Phone',
          email: `${unique('goodphone')}@test.example`,
          telephone: '07700 900 000',
        });

      expect(res.status).toBe(201);
      expect(res.body.employee.telephone).toBe('07700900000');
    });

    it('accepts date of birth on create', async () => {
      const res = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          employeeNumber: unique('EMP'),
          firstName: 'Has',
          lastName: 'Dob',
          email: `${unique('hasdob')}@test.example`,
          dateOfBirth: '1990-05-01',
        });

      expect(res.status).toBe(201);
      expect(res.body.employee.dateOfBirth).toBe('1990-05-01');
    });
  });

  describe('Payslips: multiple per employee, never superseding', () => {
    it('keeps two different months both current', async () => {
      const common = {
        employeeId: employee.id,
        documentType: 'payslip',
        fileName: 'payslip.pdf',
        version: 1,
      };

      const jan = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ ...common, documentId: require('crypto').randomUUID(), fileKey: 'fake/jan.pdf', periodMonth: '2026-01-01' });
      expect(jan.status).toBe(201);

      const feb = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ ...common, documentId: require('crypto').randomUUID(), fileKey: 'fake/feb.pdf', periodMonth: '2026-02-01' });
      expect(feb.status).toBe(201);

      const list = await request(app)
        .get('/api/documents')
        .query({ employeeId: employee.id, documentType: 'payslip' })
        .set('Authorization', `Bearer ${hrToken}`);

      const current = list.body.documents.filter((d) => d.isCurrent);
      expect(current).toHaveLength(2);
    });

    it('rejects a payslip with no periodMonth', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          employeeId: employee.id,
          documentType: 'payslip',
          documentId: require('crypto').randomUUID(),
          fileKey: 'fake/no-period.pdf',
          fileName: 'payslip.pdf',
          version: 1,
        });
      expect(res.status).toBe(400);
    });
  });

  describe('Document delete', () => {
    it('deletes the R2 object, the DB row, and records an audit entry', async () => {
      const doc = await Document.create({
        employeeId: employee.id,
        companyId: company.id,
        documentType: 'other',
        fileKey: 'fake/to-delete.pdf',
        fileName: 'to-delete.pdf',
        version: 1,
      });

      const res = await request(app).delete(`/api/documents/${doc.id}`).set('Authorization', `Bearer ${hrToken}`);
      expect(res.status).toBe(204);

      expect(storageService.deleteObject).toHaveBeenCalledWith({ key: 'fake/to-delete.pdf' });
      expect(await Document.findByPk(doc.id)).toBeNull();

      const audit = await AuditLog.findOne({ where: { entityType: 'Document', entityId: doc.id, action: 'delete' } });
      expect(audit).not.toBeNull();
      expect(audit.performedByRoleKey).toBe('HR_MANAGER');
    });

    it('is not permitted for a Manager', async () => {
      const managerPassword = 'MgrPass123!';
      const managerEmail = 'manager@followuptest.example';
      await createUser({ companyId: company.id, roleKey: 'MANAGER', email: managerEmail, password: managerPassword });
      const login = await request(app).post('/api/auth/login').send({ email: managerEmail, password: managerPassword });

      const doc = await Document.create({
        employeeId: employee.id,
        companyId: company.id,
        documentType: 'other',
        fileKey: 'fake/manager-cannot-delete.pdf',
        fileName: 'x.pdf',
        version: 1,
      });

      const res = await request(app).delete(`/api/documents/${doc.id}`).set('Authorization', `Bearer ${login.body.accessToken}`);
      expect(res.status).toBe(403);
    });
  });
});
