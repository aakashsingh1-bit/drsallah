const User = require('../models/User');
const SecurityLog = require('../models/SecurityLog');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../services/tokenService');
const { generateOTP, getOTPExpiry } = require('../services/otpService');
const { sendOTPEmail, sendSecurityAlertEmail } = require('../services/emailService');
const { deleteUserAccount } = require('../services/accountDeletionService');

// ─── Register ──────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  const { name, email, phone, password } = req.body;

  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ success: false, message: 'Email already registered' });

  const otp = generateOTP();
  const user = await User.create({
    name,
    email,
    phone,
    password,
    otp,
    otpExpires: getOTPExpiry(5),
    otpType: 'email_verify',
  });

  // Send OTP
  try {
    await sendOTPEmail(email, otp, 'verify');
  } catch (e) {
    console.error('Email send failed:', e.message);
  }

  res.status(201).json({
    success: true,
    message: 'Registration successful. Please verify your email with the OTP sent.',
    userId: user._id,
  });
};

// ─── Verify OTP ────────────────────────────────────────────────────────────────
exports.verifyOTP = async (req, res) => {
  const { userId, otp } = req.body;
  const user = await User.findById(userId).select('+otp +otpExpires');
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  if (user.otp !== otp || user.otpExpires < new Date()) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();

  res.json({ success: true, message: 'Email verified successfully' });
};

// ─── Login ─────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  const { email, password, deviceId, deviceName } = req.body;
  const ip = req.ip;

  const user = await User.findOne({ email }).select('+password +refreshTokens');
  if (!user || !(await user.comparePassword(password))) {
    await SecurityLog.create({ event: 'login_failed', ip, details: { email }, severity: 'warning' });
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  if (user.deletedAt) {
    return res.status(403).json({ success: false, message: 'This account has been deleted' });
  }

  if (!user.isVerified) {
    return res.status(403).json({ success: false, message: 'Please verify your email first' });
  }

  if (user.isSuspended) {
    return res.status(403).json({ success: false, message: `Account suspended: ${user.suspensionReason}` });
  }

  // Device binding logic
  if (user.deviceId && deviceId && user.deviceId !== deviceId) {
    await SecurityLog.create({
      user: user._id, event: 'multi_device_login', ip, deviceId,
      severity: 'critical',
      details: { boundDevice: user.deviceId, attemptedDevice: deviceId },
    });
    await sendSecurityAlertEmail(user.email, {
      message: 'A login attempt was made from a new device. Your account is bound to another device.',
      ip,
    });
    return res.status(403).json({
      success: false,
      message: 'Account is bound to another device. Contact support to reset device.',
    });
  }

  // Bind device if not yet bound
  if (!user.deviceId && deviceId) {
    user.deviceId = deviceId;
    user.deviceName = deviceName || 'Unknown Device';
    user.deviceBoundAt = new Date();
  }

  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  // Store refresh token (max 5 per user)
  user.refreshTokens = [...(user.refreshTokens || []).slice(-4), refreshToken];
  user.lastLogin = new Date();
  user.lastLoginIp = ip;
  await user.save();

  await SecurityLog.create({
    user: user._id, event: 'login_success', ip,
    deviceId, deviceName, userAgent: req.headers['user-agent'],
  });

  res.json({
    success: true,
    message: 'Login successful',
    accessToken,
    refreshToken,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      deviceId: user.deviceId,
      isVerified: user.isVerified,
    },
  });
};

// ─── Refresh Token ─────────────────────────────────────────────────────────────
exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token required' });

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }

  const user = await User.findById(decoded.id).select('+refreshTokens');
  if (!user || !user.refreshTokens.includes(refreshToken)) {
    return res.status(401).json({ success: false, message: 'Refresh token revoked' });
  }

  if (user.deletedAt || !user.isActive) {
    return res.status(403).json({ success: false, message: 'Account has been deleted or is inactive' });
  }

  // Rotate refresh token
  const newAccessToken = generateAccessToken(user._id, user.role);
  const newRefreshToken = generateRefreshToken(user._id);

  user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);
  user.refreshTokens.push(newRefreshToken);
  await user.save();

  res.json({ success: true, accessToken: newAccessToken, refreshToken: newRefreshToken });
};

// ─── Logout ────────────────────────────────────────────────────────────────────
exports.logout = async (req, res) => {
  const { refreshToken } = req.body;
  const user = await User.findById(req.user._id).select('+refreshTokens');
  if (user && refreshToken) {
    user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);
    await user.save();
  }
  await SecurityLog.create({ user: req.user._id, event: 'logout', ip: req.ip });
  res.json({ success: true, message: 'Logged out successfully' });
};

// ─── Forgot Password ───────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.json({ success: true, message: 'If that email exists, an OTP has been sent.' });

  const otp = generateOTP();
  user.otp = otp;
  user.otpExpires = getOTPExpiry(5);
  user.otpType = 'password_reset';
  await user.save();

  try {
    await sendOTPEmail(email, otp, 'password_reset');
  } catch (e) {
    console.error('Email send failed:', e.message);
  }

  res.json({ success: true, message: 'OTP sent to email', userId: user._id });
};

// ─── Reset Password ────────────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  const { userId, otp, newPassword } = req.body;
  const user = await User.findById(userId).select('+otp +otpExpires');
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  if (user.otp !== otp || user.otpExpires < new Date() || user.otpType !== 'password_reset') {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }

  user.password = newPassword;
  user.otp = undefined;
  user.otpExpires = undefined;
  user.refreshTokens = [];
  await user.save();

  await SecurityLog.create({ user: user._id, event: 'password_reset', ip: req.ip });
  res.json({ success: true, message: 'Password reset successful' });
};

// ─── Get Me ────────────────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  const user = await User.findById(req.user._id).populate('activeSubscription');
  res.json({ success: true, user });
};

// ─── Delete Account (Self-service) ─────────────────────────────────────────────
exports.deleteAccount = async (req, res) => {
  try {
    await deleteUserAccount(req.user._id, { source: 'self', ip: req.ip });
  } catch (err) {
    if (err.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (err.code === 'ALREADY_DELETED') {
      return res.status(400).json({ success: false, message: 'Account already deleted' });
    }
    if (err.code === 'CANNOT_DELETE_ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin accounts cannot be deleted' });
    }
    throw err;
  }

  res.json({
    success: true,
    message: 'Your account has been deleted. All personal information has been removed. You may register again with the same email.',
  });
};

// ─── Reset Device (Admin triggers on support request) ─────────────────────────
exports.resetDevice = async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  user.deviceId = null;
  user.deviceName = null;
  user.deviceBoundAt = null;
  user.refreshTokens = [];
  await user.save();

  await SecurityLog.create({
    user: user._id, event: 'device_changed',
    details: { action: 'device_reset_by_admin', adminId: req.user._id },
    severity: 'warning',
  });

  res.json({ success: true, message: 'Device binding reset. User can login from new device.' });
};