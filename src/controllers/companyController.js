const { Company } = require('../models');
const AppError = require('../utils/AppError');

// Fields a company itself may edit about its own profile. `isActive` is
// deliberately excluded - a tenant should never be able to toggle its own
// billing/access status; that lever stays Super-Admin-only.
const TENANT_EDITABLE_FIELDS = ['name', 'sponsorLicenseNumber', 'sponsorType', 'address'];

// sponsorType is a Postgres ENUM ('A-rated'/'B-rated', nullable) - an
// empty string (what an unselected <select> sends) is neither, and
// Postgres rejects it outright rather than treating it as null.
function normalizeEmptyToNull(value) {
  return value === '' ? null : value;
}

/**
 * Sales-assisted onboarding only: there is no public signup, and only
 * Super Admin ever creates a company (see FEATURES.COMPANIES comment in
 * config/permissions.js). Every other role's view of "companies" is
 * exactly one record - their own - never a list of others, not even
 * names/existence, which is why every branch below keys off
 * req.user.companyId directly rather than any generic scope helper.
 */
async function listCompanies(req, res) {
  if (req.user.role === 'SUPER_ADMIN') {
    const companies = await Company.findAll({ order: [['name', 'ASC']] });
    return res.json({ companies });
  }

  // Non-Super-Admin: "list" is just their own company, wrapped as a
  // single-item array so the frontend can use one code path either way.
  const own = await Company.findByPk(req.user.companyId);
  res.json({ companies: own ? [own] : [] });
}

async function getCompany(req, res) {
  if (req.user.role !== 'SUPER_ADMIN' && req.params.id !== req.user.companyId) {
    // 404, not 403: confirming another company's existence at all is
    // exactly what "never see or list other companies" rules out.
    throw new AppError('Company not found or not accessible', 404);
  }

  const company = await Company.findByPk(req.params.id);
  if (!company) throw new AppError('Company not found or not accessible', 404);
  res.json({ company });
}

async function createCompany(req, res) {
  // Belt-and-suspenders beyond authorize(): only SUPER_ADMIN's FULL level
  // includes 'create' on FEATURES.COMPANIES (EMPLOYER_ADMIN's OWN level
  // does not), so this is unreachable for anyone else, but the explicit
  // check keeps the sales-assisted-only invariant visible in one place.
  if (req.user.role !== 'SUPER_ADMIN') {
    throw new AppError('Only Super Admin can create a company', 403);
  }

  const { name, sponsorLicenseNumber, sponsorType, address } = req.body;
  if (!name) throw new AppError('name is required', 400);

  const company = await Company.create({ name, sponsorLicenseNumber, sponsorType: normalizeEmptyToNull(sponsorType), address });
  res.status(201).json({ company });
}

async function updateCompany(req, res) {
  const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
  if (!isSuperAdmin && req.params.id !== req.user.companyId) {
    throw new AppError('Company not found or not accessible', 404);
  }

  const company = await Company.findByPk(req.params.id);
  if (!company) throw new AppError('Company not found or not accessible', 404);

  const allowedFields = isSuperAdmin ? [...TENANT_EDITABLE_FIELDS, 'isActive'] : TENANT_EDITABLE_FIELDS;
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowedFields.includes(key)));
  if ('sponsorType' in updates) updates.sponsorType = normalizeEmptyToNull(updates.sponsorType);

  await company.update(updates);
  res.json({ company });
}

module.exports = { listCompanies, getCompany, createCompany, updateCompany };
