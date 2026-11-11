const request = require('supertest');
const app = require('../src/app');
const { sequelize, Document } = require('../src/models');
const { createCompany, createEmployee, createUser } = require('./helpers');

describe('Documents: cross-tenant isolation', () => {
  let companyBAdminToken;
  let companyADocumentId;

  beforeAll(async () => {
    const companyA = await createCompany();
    const employeeA = await createEmployee(companyA.id);
    const document = await Document.create({
      employeeId: employeeA.id,
      companyId: companyA.id,
      documentType: 'passport_id',
      fileKey: `company/${companyA.id}/employee/${employeeA.id}/doc-v1.pdf`,
      version: 1,
      isCurrent: true,
    });
    companyADocumentId = document.id;

    const companyB = await createCompany();
    const email = 'admin@tenantb.example';
    const password = 'AdminPass123!';
    await createUser({ companyId: companyB.id, roleKey: 'EMPLOYER_ADMIN', email, password });

    const login = await request(app).post('/api/auth/login').send({ email, password });
    companyBAdminToken = login.body.accessToken;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("does not let a company B user fetch a view/download link for company A's document", async () => {
    const downloadRes = await request(app)
      .get(`/api/documents/${companyADocumentId}/download-url`)
      .set('Authorization', `Bearer ${companyBAdminToken}`);
    expect(downloadRes.status).toBe(404);
    expect(downloadRes.body.url).toBeUndefined();

    const viewRes = await request(app)
      .get(`/api/documents/${companyADocumentId}/view-url`)
      .set('Authorization', `Bearer ${companyBAdminToken}`);
    expect(viewRes.status).toBe(404);
    expect(viewRes.body.url).toBeUndefined();
  });
});
