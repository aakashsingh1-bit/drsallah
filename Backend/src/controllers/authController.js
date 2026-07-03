const User = require('../models/User');
const SecurityLog = require('../models/SecurityLog');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../services/tokenService');
const { generateOTP, getOTPExpiry } = require('../services/otpService');
const { sendOTPEmail } = require('../services/emailService');
const { deleteUserAccount } = require('../services/accountDeletionService');
const { isUnverifiedUserStale } = require('../services/unverifiedUserService');
const { formatUserResponse, assertAccountCanAuthenticate, completeLogin } = require('../services/authHelpers');

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRES_IN, 10) || 5;

const sendOtpToUser = async (user, type, emailType) => {
  const otp = generateOTP();
  user.otp = otp;
  user.otpExpires = getOTPExpiry(OTP_EXPIRY_MINUTES);
  user.otpType = type;
  await user.save();

  try {
    await sendOTPEmail(user.email, otp, emailType);
  } catch (e) {
    console.error('Email send failed:', e.message);
    throw e;
  }

  return user;
};

// ─── Register ──────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  const { name, email, phone, password } = req.body;

  const exists = await User.findOne({ email });
  if (exists) {
    if (exists.isVerified) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    if (!isUnverifiedUserStale(exists)) {
      const otp = generateOTP();
      exists.name = name;
      exists.phone = phone;
      exists.password = password;
      exists.otp = otp;
      exists.otpExpires = getOTPExpiry(5);
      exists.otpType = 'email_verify';
      await exists.save();

      try {
        await sendOTPEmail(email, otp, 'verify');
      } catch (e) {
        console.error('Email send failed:', e.message);
      }

      return res.status(201).json({
        success: true,
        message: 'A verification code was sent to your email. Please verify to complete registration.',
        userId: exists._id,
        registeredAt: exists.createdAt,
        otpExpiresAt: exists.otpExpires,
      });
    }

    await User.findByIdAndDelete(exists._id);
  }

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

  try {
    await sendOTPEmail(email, otp, 'verify');
  } catch (e) {
    console.error('Email send failed:', e.message);
  }

  res.status(201).json({
    success: true,
    message: 'Registration successful. Please verify your email with the OTP sent.',
    userId: user._id,
    registeredAt: user.createdAt,
    otpExpiresAt: user.otpExpires,
  });
};

// ─── Verify OTP ────────────────────────────────────────────────────────────────
exports.verifyOTP = async (req, res) => {
  const { userId, otp, deviceId, deviceName } = req.body;
  const user = await User.findById(userId).select('+otp +otpExpires +refreshTokens');
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  if (user.otp !== otp || user.otpExpires < new Date()) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }

  if (user.otpType && user.otpType !== 'email_verify') {
    return res.status(400).json({ success: false, message: 'Invalid OTP type for email verification' });
  }

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpires = undefined;
  user.otpType = undefined;
  await user.save();

  await SecurityLog.create({ user: user._id, event: 'otp_verified', ip: req.ip, details: { type: 'email_verify' } });

  const response = {
    success: true,
    message: 'Email verified successfully',
    user: formatUserResponse(user),
  };

  if (deviceId) {
    const login = await completeLogin(user, req, { deviceId, deviceName });
    if (login.ok) {
      response.accessToken = login.accessToken;
      response.refreshToken = login.refreshToken;
      response.user = login.user;
      response.message = 'Email verified and logged in successfully';
    }
  }

  res.json(response);
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

  const check = assertAccountCanAuthenticate(user);
  if (!check.ok) return res.status(check.status).json({ success: false, message: check.message });

  const login = await completeLogin(user, req, { deviceId, deviceName });
  if (!login.ok) return res.status(login.status).json({ success: false, message: login.message });

  res.json({
    success: true,
    message: 'Login successful',
    accessToken: login.accessToken,
    refreshToken: login.refreshToken,
    user: login.user,
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

// ─── Update Profile ────────────────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  const { name, phone, currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  if (name !== undefined) user.name = name.trim();
  if (phone !== undefined) user.phone = phone?.trim() || undefined;

  if (newPassword) {
    if (!currentPassword) {
      return res.status(400).json({ success: false, message: 'Current password is required to set a new password' });
    }
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }
    user.password = newPassword;
    user.refreshTokens = [];
  }

  await user.save();

  const updated = await User.findById(user._id).populate('activeSubscription');
  res.json({ success: true, message: 'Profile updated successfully', user: updated });
};

// ─── Resend OTP (registration / verification) ───────────────────────────────────
exports.resendOTP = async (req, res) => {
  const { email, userId } = req.body;

  if (!email && !userId) {
    return res.status(400).json({ success: false, message: 'email or userId is required' });
  }

  const user = userId
    ? await User.findById(userId)
    : await User.findOne({ email: email.toLowerCase().trim() });

  if (!user) {
    return res.status(404).json({ success: false, message: 'Registration not found for this email' });
  }

  if (user.isVerified) {
    return res.status(400).json({ success: false, message: 'Email is already verified' });
  }

  if (isUnverifiedUserStale(user)) {
    return res.status(400).json({
      success: false,
      message: 'Registration expired. Please register again.',
      expired: true,
    });
  }

  await sendOtpToUser(user, 'email_verify', 'verify');

  await SecurityLog.create({
    user: user._id,
    event: 'otp_sent',
    ip: req.ip,
    details: { type: 'email_verify', resend: true },
  });

  res.json({
    success: true,
    message: 'Verification code resent to your email',
    userId: user._id,
    registeredAt: user.createdAt,
    otpExpiresAt: user.otpExpires,
  });
};

// ─── Registration Status ───────────────────────────────────────────────────────
exports.getRegistrationStatus = async (req, res) => {
  const email = (req.body.email || req.query.email || '').toLowerCase().trim();
  if (!email) {
    return res.status(400).json({ success: false, message: 'email is required' });
  }

  const user = await User.findOne({ email });

  if (!user) {
    return res.json({
      success: true,
      data: {
        exists: false,
        isVerified: false,
        canRegister: true,
      },
    });
  }

  if (user.isVerified) {
    return res.json({
      success: true,
      data: {
        exists: true,
        isVerified: true,
        canRegister: false,
        registeredAt: user.createdAt,
        lastLogin: user.lastLogin,
        message: 'Account already verified. Please login.',
      },
    });
  }

  const expired = isUnverifiedUserStale(user);

  res.json({
    success: true,
    data: {
      exists: true,
      isVerified: false,
      userId: user._id,
      registeredAt: user.createdAt,
      otpExpiresAt: user.otpExpires,
      expired,
      canRegister: expired,
      canResendOtp: !expired,
      message: expired
        ? 'Registration expired. You can register again with this email.'
        : 'Verification pending. Check your email or resend OTP.',
    },
  });
};

// ─── Login with OTP — send ─────────────────────────────────────────────────────
exports.sendLoginOTP = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'email is required' });

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    return res.json({ success: true, message: 'If that email exists, a login code has been sent.' });
  }

  const check = assertAccountCanAuthenticate(user);
  if (!check.ok) {
    return res.status(check.status).json({ success: false, message: check.message });
  }

  await sendOtpToUser(user, 'login_otp', 'login');

  await SecurityLog.create({
    user: user._id,
    event: 'otp_sent',
    ip: req.ip,
    details: { type: 'login_otp' },
  });

  res.json({
    success: true,
    message: 'Login code sent to your email',
    userId: user._id,
    otpExpiresAt: user.otpExpires,
  });
};

// ─── Login with OTP — verify ───────────────────────────────────────────────────
exports.verifyLoginOTP = async (req, res) => {
  const { userId, email, otp, deviceId, deviceName } = req.body;

  if (!otp || (!userId && !email)) {
    return res.status(400).json({ success: false, message: 'otp and userId or email are required' });
  }

  const user = userId
    ? await User.findById(userId).select('+otp +otpExpires +refreshTokens')
    : await User.findOne({ email: email.toLowerCase().trim() }).select('+otp +otpExpires +refreshTokens');

  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const check = assertAccountCanAuthenticate(user);
  if (!check.ok) return res.status(check.status).json({ success: false, message: check.message });

  if (user.otp !== otp || user.otpExpires < new Date() || user.otpType !== 'login_otp') {
    return res.status(400).json({ success: false, message: 'Invalid or expired login code' });
  }

  user.otp = undefined;
  user.otpExpires = undefined;
  user.otpType = undefined;
  await user.save();

  await SecurityLog.create({
    user: user._id,
    event: 'otp_verified',
    ip: req.ip,
    details: { type: 'login_otp' },
  });

  const login = await completeLogin(user, req, { deviceId, deviceName });
  if (!login.ok) return res.status(login.status).json({ success: false, message: login.message });

  res.json({
    success: true,
    message: 'Login successful',
    accessToken: login.accessToken,
    refreshToken: login.refreshToken,
    user: login.user,
  });
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