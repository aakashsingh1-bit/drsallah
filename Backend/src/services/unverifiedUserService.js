const User = require('../models/User');

const getUnverifiedDeleteAfterMs = () => {
  const minutes = parseInt(process.env.UNVERIFIED_USER_DELETE_AFTER_MINUTES, 10);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 30) * 60 * 1000;
};

const isUnverifiedUserStale = (user) => {
  if (!user || user.isVerified || user.deletedAt) return false;

  const otpExpired = !user.otpExpires || user.otpExpires < new Date();
  const accountAge = Date.now() - new Date(user.createdAt).getTime();
  return otpExpired || accountAge >= getUnverifiedDeleteAfterMs();
};

const deleteUnverifiedUsers = async () => {
  const cutoff = new Date(Date.now() - getUnverifiedDeleteAfterMs());
  const result = await User.deleteMany({
    isVerified: false,
    deletedAt: null,
    role: { $ne: 'admin' },
    $or: [
      { createdAt: { $lt: cutoff } },
      { otpExpires: { $lt: new Date() } },
    ],
  });
  return result.deletedCount;
};

module.exports = {
  getUnverifiedDeleteAfterMs,
  isUnverifiedUserStale,
  deleteUnverifiedUsers,
};
