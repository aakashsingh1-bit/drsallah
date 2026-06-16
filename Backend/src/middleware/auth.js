const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SecurityLog = require('../models/SecurityLog');

// ─── Protect Route ─────────────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password -otp -otpExpires -refreshTokens');
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    if (user.deletedAt) {
      return res.status(403).json({ success: false, message: 'Account has been deleted' });
    }

    if (!user.isActive || user.isSuspended) {
      return res.status(403).json({ success: false, message: 'Account suspended or inactive' });
    }

    // Device check — if device was bound, validate incoming deviceId
    const incomingDeviceId = req.headers['x-device-id'];
    if (user.deviceId && incomingDeviceId && user.deviceId !== incomingDeviceId) {
      await SecurityLog.create({
        user: user._id,
        event: 'multi_device_login',
        ip: req.ip,
        deviceId: incomingDeviceId,
        severity: 'critical',
        details: { expectedDevice: user.deviceId, receivedDevice: incomingDeviceId },
      });
      return res.status(403).json({
        success: false,
        message: 'Access denied: login detected on a different device. Please contact support.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ─── Admin Only ────────────────────────────────────────────────────────────────
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

// ─── Check Active Subscription ─────────────────────────────────────────────────
const requireSubscription = async (req, res, next) => {
  const { Subscription } = require('../models/Subscription');
  const sub = await Subscription.findOne({ user: req.user._id, status: 'active' });
  if (!sub || sub.endDate < new Date()) {
    return res.status(403).json({ success: false, message: 'Active subscription required' });
  }
  req.subscription = sub;
  next();
};

module.exports = { protect, adminOnly, requireSubscription };