const AppError = require('../utils/AppError');
const { REPORTS } = require('../services/reportService');
const { sendExport } = require('../services/exportService');
const { hasPermissionKey } = require('../services/permissionService');

const VALID_FORMATS = ['json', 'csv', 'excel', 'pdf'];

async function listReports(req, res) {
  const reports = await Promise.all(
    Object.entries(REPORTS).map(async ([key, def]) => ({
      key,
      label: def.label,
      category: def.category,
      // Nationality (or any future sensitive report) is only listed if the
      // caller actually holds the extra permission it requires.
      available: def.sensitivePermission
        ? await hasPermissionKey(req.user.companyId, req.user.role, def.sensitivePermission)
        : true,
    }))
  );
  res.json({ reports });
}

function extractFilters(query) {
  const { from, to, departmentId, employeeId, status, location, managerId } = query;
  return { from, to, departmentId, employeeId, status, location, managerId };
}

async function runReport(req, res) {
  const { reportKey } = req.params;
  const def = REPORTS[reportKey];
  if (!def) throw new AppError(`Unknown report '${reportKey}'`, 404);

  if (def.sensitivePermission) {
    const allowed = await hasPermissionKey(req.user.companyId, req.user.role, def.sensitivePermission);
    if (!allowed) {
      throw new AppError(`Permission '${def.sensitivePermission}' is required for the '${def.label}' report`, 403);
    }
  }

  const format = req.query.format || 'json';
  if (!VALID_FORMATS.includes(format)) throw new AppError(`format must be one of: ${VALID_FORMATS.join(', ')}`, 400);

  const { columns, rows } = await def.generate(req.accessScope, extractFilters(req.query));

  if (format === 'json') return res.json({ report: reportKey, columns, rows });
  return sendExport(res, format, def.label, columns, rows);
}

module.exports = { listReports, runReport };
