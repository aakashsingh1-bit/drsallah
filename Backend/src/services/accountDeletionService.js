const crypto = require('crypto');
const User = require('../models/User');
const SecurityLog = require('../models/SecurityLog');
const Notification = require('../models/Notification');
const { Subscription } = require('../models/Subscription');
const { CourseReview } = require('../models/CourseAccess');

/**
 * Remove user PII and deactivate the account while preserving SecurityLog entries for audit.
 * Frees the original email so the user can register again.
 */
async function deleteUserAccount(userId, { source = 'self', adminId = null, ip = null } = {}) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.code = 'USER_NOT_FOUND';
    throw err;
  }
  if (user.deletedAt) {
    const err = new Error('Account already deleted');
    err.code = 'ALREADY_DELETED';
    throw err;
  }
  if (user.role === 'admin') {
    const err = new Error('Admin accounts cannot be deleted');
    err.code = 'CANNOT_DELETE_ADMIN';
    throw err;
  }

  const snapshot = {
    userId: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    source,
    deletedAt: new Date().toISOString(),
    ...(adminId && { adminId }),
  };

  await Subscription.updateMany(
    { user: userId, status: { $in: ['active', 'grace_period', 'pending'] } },
    { $set: { status: 'cancelled', autoRenew: false } }
  );

  await Notification.deleteMany({ user: userId });

  await CourseReview.updateMany({ user: userId }, { $set: { comment: null } });

  await SecurityLog.create({
    user: userId,
    event: 'account_deleted',
    ip,
    details: snapshot,
    severity: 'info',
  });

  if (source === 'admin' && adminId) {
    await SecurityLog.create({
      event: 'admin_action',
      details: { action: 'delete_user', targetUserId: userId, adminId, ...snapshot },
    });
  }

  await SecurityLog.updateMany(
    { 'details.email': user.email },
    { $unset: { 'details.email': '' } }
  );

  user.name = 'Deleted User';
  user.email = `deleted_${user._id}@deleted.local`;
  user.phone = undefined;
  user.password = crypto.randomBytes(32).toString('hex');
  user.deviceId = null;
  user.deviceName = null;
  user.deviceBoundAt = null;
  user.isVerified = false;
  user.isActive = false;
  user.isSuspended = false;
  user.suspensionReason = null;
  user.otp = undefined;
  user.otpExpires = undefined;
  user.otpType = undefined;
  user.refreshTokens = [];
  user.riskScore = 0;
  user.isFlagged = false;
  user.flagReason = null;
  user.lastLogin = undefined;
  user.lastLoginIp = undefined;
  user.activeSubscription = null;
  user.watchHistory = [];
  user.bookmarks = [];
  user.deletedAt = new Date();

  await user.save();

  return { snapshot };
}

module.exports = { deleteUserAccount };
