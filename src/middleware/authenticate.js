const AppError = require('../utils/AppError');
const { verifyAccessToken } = require('../utils/jwt');

/**
 * Verifies the JWT access token and attaches a minimal identity to req.user:
 *   { id, role, companyId, employeeId }
 * `role` is the Role.key (e.g. 'HR_MANAGER'), used by authorize.js.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AppError('Missing or malformed Authorization header', 401);
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      companyId: payload.companyId,
      employeeId: payload.employeeId,
    };
    next();
  } catch (err) {
    throw new AppError('Invalid or expired token', 401);
  }
}

module.exports = authenticate;
