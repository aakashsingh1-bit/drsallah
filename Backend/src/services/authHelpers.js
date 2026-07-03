const SecurityLog = require('../models/SecurityLog');
const { generateAccessToken, generateRefreshToken } = require('./tokenService');

const formatUserResponse = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  deviceId: user.deviceId,
  isVerified: user.isVerified,
  lastLogin: user.lastLogin,
  createdAt: user.createdAt,
});

const assertAccountCanAuthenticate = (user) => {
  if (!user) return { ok: false, status: 401, message: 'Invalid credentials' };
  if (user.deletedAt) return { ok: false, status: 403, message: 'This account has been deleted' };
  if (!user.isVerified) return { ok: false, status: 403, message: 'Please verify your email first' };
  if (user.isSuspended) {
    return { ok: false, status: 403, message: `Account suspended: ${user.suspensionReason}` };
  }
  if (!user.isActive) return { ok: false, status: 403, message: 'Account is inactive' };
  return { ok: true };
};

const completeLogin = async (user, req, { deviceId, deviceName } = {}) => {
  const ip = req.ip;

  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);
  user.refreshTokens = [...(user.refreshTokens || []).slice(-4), refreshToken];
  user.lastLogin = new Date();
  user.lastLoginIp = ip;
  await user.save();

  await SecurityLog.create({
    user: user._id,
    event: 'login_success',
    ip,
    deviceId,
    deviceName,
    userAgent: req.headers['user-agent'],
  });

  return {
    ok: true,
    accessToken,
    refreshToken,
    user: formatUserResponse(user),
  };
};

module.exports = {
  formatUserResponse,
  assertAccountCanAuthenticate,
  completeLogin,
};
