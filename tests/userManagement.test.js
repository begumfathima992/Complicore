const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');
const { createCompany, createUser } = require('./helpers');

describe('User management: duplicate email', () => {
  let adminToken;

  beforeAll(async () => {
    const company = await createCompany();
    const password = 'AdminPass123!';
    const email = 'admin@duptest.example';
    await createUser({ companyId: company.id, roleKey: 'EMPLOYER_ADMIN', email, password });

    const login = await request(app).post('/api/auth/login').send({ email, password });
    adminToken = login.body.accessToken;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('returns 409 with a clear message when creating a user with an email that already has an account', async () => {
    const email = 'duplicate@duptest.example';

    const first = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, roleKey: 'EMPLOYEE' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, roleKey: 'EMPLOYEE' });

    expect(second.status).toBe(409);
    expect(second.body.error).toBe('This email already has an account – use Edit to change it');
  });

  it('treats email as case-insensitive for the duplicate check', async () => {
    const email = 'CaseTest@DupTest.example';

    const first = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, roleKey: 'EMPLOYEE' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'casetest@duptest.example', roleKey: 'EMPLOYEE' });

    expect(second.status).toBe(409);
  });
});
