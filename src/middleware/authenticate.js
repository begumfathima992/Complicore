const AppError = require('../utils/AppError');
const { verifyAccessToken } = require('../utils/jwt');
const { User } = require('../models');

/**
 * Verifies the JWT access token and attaches a minimal identity to req.user:
 *   { id, role, companyId, employeeId }
 * `role` is the Role.key (e.g. 'HR_MANAGER'), used by authorize.js.
 *
 * Also checks the token's embedded `tokenVersion` against the current DB
 * value, and that the account is still active - a pure JWT-verify alone
 * can't revoke anything already issued, so this is what actually makes
 * "end the user's sessions when their role changes" (or when they're
 * deactivated) true rather than aspirational. Costs one DB lookup per
 * authenticated request; a worthwhile trade for real revocation.
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AppError('Missing or malformed Authorization header', 401);
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    throw new AppError('Invalid or expired token', 401);
  }

  const user = await User.findByPk(payload.sub, { attributes: ['id', 'isActive', 'tokenVersion'] });
  if (!user || !user.isActive || user.tokenVersion !== payload.tokenVersion) {
    throw new AppError('Your session has ended. Please log in again.', 401);
  }

  req.user = {
    id: payload.sub,
    role: payload.role,
    companyId: payload.companyId,
    employeeId: payload.employeeId,
  };
  next();
}

module.exports = authenticate;
