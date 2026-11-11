const { sequelize, RightToWorkCheck, SentExpiryAlert } = require('../src/models');
const { createCompany, createEmployee, createUser } = require('./helpers');
const { runExpiryAlertEmailJob } = require('../src/services/expiryAlertJob');

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

describe('Expiry alert email job: no duplicate sends', () => {
  let companyId;

  beforeAll(async () => {
    const company = await createCompany();
    companyId = company.id;
    const employee = await createEmployee(companyId);

    await RightToWorkCheck.create({
      employeeId: employee.id,
      checkDate: '2026-01-01',
      checkType: 'continuous_check',
      status: 'verified',
      expiryDate: daysFromNow(7), // lands exactly on the '7' threshold
    });

    await createUser({ companyId, roleKey: 'HR_MANAGER', email: 'hr@expirytest.example' });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('sends exactly one email the first time an item crosses a threshold, then zero on a same-day rerun', async () => {
    const firstCalls = [];
    const firstSummary = await runExpiryAlertEmailJob({
      sendEmailFn: async (params) => {
        firstCalls.push(params);
        return { sent: true };
      },
    });

    expect(firstCalls).toHaveLength(1);
    expect(firstCalls[0].to).toEqual(['hr@expirytest.example']);
    expect(firstSummary.emailsSent).toBe(1);

    const sentRowCount = await SentExpiryAlert.count({ where: { companyId } });
    expect(sentRowCount).toBe(1);

    const secondCalls = [];
    const secondSummary = await runExpiryAlertEmailJob({
      sendEmailFn: async (params) => {
        secondCalls.push(params);
        return { sent: true };
      },
    });

    expect(secondCalls).toHaveLength(0);
    expect(secondSummary.emailsSent).toBe(0);
    expect(await SentExpiryAlert.count({ where: { companyId } })).toBe(1);
  });
});
