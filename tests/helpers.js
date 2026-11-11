const { Company, Role, Employee, User } = require('../src/models');

let counter = 0;
function unique(prefix) {
  counter += 1;
  return `${prefix}${Date.now()}_${counter}`;
}

async function createCompany(name) {
  return Company.create({ name: name || unique('Company') });
}

async function createEmployee(companyId, overrides = {}) {
  return Employee.create({
    companyId,
    employeeNumber: unique('EMP'),
    firstName: 'Test',
    lastName: 'Employee',
    email: `${unique('employee')}@test.example`,
    startDate: '2026-01-01',
    employmentStatus: 'active',
    ...overrides,
  });
}

async function createUser({ companyId, roleKey, email, password = 'TestPass123!', employeeId = null }) {
  const role = await Role.findOne({ where: { key: roleKey } });
  return User.create({
    email: email || `${unique('user')}@test.example`,
    passwordHash: password, // hashed by the model's beforeCreate hook
    roleId: role.id,
    companyId,
    employeeId,
  });
}

module.exports = { createCompany, createEmployee, createUser, unique };
