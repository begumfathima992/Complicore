require('dotenv').config();
const { sequelize, Role, User } = require('../src/models');
const { ROLES } = require('../src/config/permissions');

async function seed() {
  await sequelize.sync();

  for (const [key, { name, level }] of Object.entries(ROLES)) {
    await Role.findOrCreate({ where: { key }, defaults: { name, level } });
  }
  console.log('Roles seeded:', Object.keys(ROLES).join(', '));

  const superAdminRole = await Role.findOne({ where: { key: 'SUPER_ADMIN' } });

  const [admin, created] = await User.findOrCreate({
    where: { email: 'superadmin@example.com' },
    defaults: {
      passwordHash: 'ChangeMe123!', // hashed automatically by the User model hook
      roleId: superAdminRole.id,
    },
  });

  console.log(
    created
      ? `Seeded Super Admin user: ${admin.email} / ChangeMe123! (change this immediately)`
      : `Super Admin user already exists: ${admin.email}`
  );

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
