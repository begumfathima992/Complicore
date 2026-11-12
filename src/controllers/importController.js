const { Company } = require('../models');
const AppError = require('../utils/AppError');
const { SHEETS, buildTemplate, previewImport, commitImport } = require('../services/importService');
const { actorContextFrom } = require('../services/auditService');

/**
 * Import is inherently company-scoped (it writes employees/attendance/etc.
 * into one tenant), but Super Admin has no company of their own - same
 * situation as creating a user (see userController.js's createUser), so
 * it needs the same explicit companyId-in-the-body requirement rather
 * than silently falling back to req.user.companyId (null).
 */
async function resolveCompanyId(req) {
  if (req.user.role !== 'SUPER_ADMIN') return req.user.companyId;

  const { companyId } = req.body;
  if (!companyId) throw new AppError('companyId is required for Super Admin', 400);
  const company = await Company.findByPk(companyId);
  if (!company) throw new AppError('Company not found', 404);
  return companyId;
}

async function getTemplate(req, res) {
  const buffer = await buildTemplate();
  res.setHeader('Content-Disposition', 'attachment; filename="hrms-import-template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
}

function requireSheet(sheetKey) {
  if (!SHEETS[sheetKey]) throw new AppError(`Unknown import sheet '${sheetKey}' - must be one of: ${Object.keys(SHEETS).join(', ')}`, 400);
}

/** Dry run - parses + validates every row of the uploaded sheet, writes nothing. */
async function preview(req, res) {
  const { sheet } = req.body;
  requireSheet(sheet);
  if (!req.file) throw new AppError('No file uploaded', 400);

  const companyId = await resolveCompanyId(req);
  const result = await previewImport(req.file.buffer, sheet, companyId);
  res.json(result);
}

/** Commits every valid row of the uploaded sheet and reports/skips invalid ones. */
async function commit(req, res) {
  const { sheet } = req.body;
  requireSheet(sheet);
  if (!req.file) throw new AppError('No file uploaded', 400);

  const companyId = await resolveCompanyId(req);
  const { performedByUserId, performedByRoleKey, ipAddress, userAgent } = actorContextFrom(req);
  const result = await commitImport(req.file.buffer, sheet, {
    companyId,
    userId: performedByUserId,
    roleKey: performedByRoleKey,
    ipAddress,
    userAgent,
  });
  res.status(201).json(result);
}

module.exports = { getTemplate, preview, commit };
