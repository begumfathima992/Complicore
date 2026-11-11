/**
 * Production seed: roles (reference data every environment needs) + ONE
 * Super Admin from env vars. Nothing else - no example.com users, no test
 * companies, no sample employees. Run once against a freshly-migrated,
 * empty database.
 *
 * Deliberately separate from scripts/seedRoles.js, which remains the
 * dev-only seed (creates the hardcoded superadmin@example.com account
 * used throughout local development/testing) - never run that one against
 * production.
 */
require('dotenv').config();
const { sequelize, Role, User } = require('../src/models');
const { ROLES } = require('../src/config/permissions');

async function seed() {
  const { SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD } = process.env;
  if (!SUPERADMIN_EMAIL || !SUPERADMIN_PASSWORD) {
    console.error('SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must both be set.');
    process.exit(1);
  }
  if (SUPERADMIN_PASSWORD.length < 8) {
    console.error('SUPERADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  await sequelize.authenticate();

  for (const [key, { name, level }] of Object.entries(ROLES)) {
    await Role.findOrCreate({ where: { key }, defaults: { name, level } });
  }
  console.log('Roles seeded:', Object.keys(ROLES).join(', '));

  const superAdminRole = await Role.findOne({ where: { key: 'SUPER_ADMIN' } });
  const normalizedEmail = SUPERADMIN_EMAIL.trim().toLowerCase();

  const [admin, created] = await User.findOrCreate({
    where: { email: normalizedEmail },
    defaults: {
      passwordHash: SUPERADMIN_PASSWORD, // hashed automatically by the User model hook
      roleId: superAdminRole.id,
    },
  });

  // Never log the password, created or not.
  console.log(created ? `Super Admin created: ${admin.email}` : `Super Admin already exists: ${admin.email} (left unchanged)`);

  process.exit(0);
}

seed().catch((err) => {
  console.error('Production seed failed:', err.message);
  process.exit(1);
});
