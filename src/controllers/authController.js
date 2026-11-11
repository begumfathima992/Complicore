const { User, Role } = require('../models');
const AppError = require('../utils/AppError');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError('Email and password are required', 400);

  const user = await User.findOne({ where: { email }, include: Role });
  if (!user || !user.isActive) throw new AppError('Invalid credentials', 401);

  const valid = await user.validatePassword(password);
  if (!valid) throw new AppError('Invalid credentials', 401);

  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.Role.key,
      companyId: user.companyId,
      employeeId: user.employeeId,
    },
  });
}

async function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError('refreshToken is required', 400);

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const user = await User.findByPk(payload.sub, { include: Role });
  if (!user || !user.isActive) throw new AppError('Invalid refresh token', 401);

  res.json({ accessToken: signAccessToken(user) });
}

async function me(req, res) {
  const user = await User.findByPk(req.user.id, {
    include: Role,
    attributes: { exclude: ['passwordHash'] },
  });
  res.json({ user });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new AppError('currentPassword and newPassword are required', 400);
  }
  if (newPassword.length < 8) {
    throw new AppError('newPassword must be at least 8 characters', 400);
  }

  const user = await User.findByPk(req.user.id);
  const valid = await user.validatePassword(currentPassword);
  if (!valid) throw new AppError('Current password is incorrect', 401);

  user.passwordHash = newPassword; // re-hashed by the model's beforeUpdate hook
  await user.save();

  res.json({ message: 'Password updated.' });
}

module.exports = { login, refresh, me, changePassword };
