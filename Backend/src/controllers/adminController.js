const User = require('../models/User');
const SecurityLog = require('../models/SecurityLog');
const { Course, Lesson } = require('../models/Content');
const { Subscription } = require('../models/Subscription');
const { CoursePurchase } = require('../models/CourseAccess');
const Notification = require('../models/Notification');

// ──────────────────── USER MANAGEMENT ────────────────────────────────────────

exports.getAllUsers = async (req, res) => {
  const { page = 1, limit = 20, search, isSuspended, isFlagged, role } = req.query;
  const filter = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }
  if (isSuspended !== undefined) filter.isSuspended = isSuspended === 'true';
  if (isFlagged !== undefined) filter.isFlagged = isFlagged === 'true';
  if (role) filter.role = role;

  const users = await User.find(filter)
    .populate('activeSubscription')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await User.countDocuments(filter);
  res.json({ success: true, data: users, pagination: { total, page: +page, limit: +limit } });
};

exports.getUserById = async (req, res) => {
  const user = await User.findById(req.params.id).populate('activeSubscription');
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const recentLogs = await SecurityLog.find({ user: user._id }).sort({ createdAt: -1 }).limit(20);
  res.json({ success: true, data: { user, recentLogs } });
};

exports.updateUser = async (req, res) => {
  const { name, email, phone, role } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { name, email, phone, role },
    { new: true, runValidators: true }
  );
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: user });
};

exports.suspendUser = async (req, res) => {
  const { reason } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isSuspended: true, suspensionReason: reason || 'Suspended by admin', refreshTokens: [] },
    { new: true }
  );
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  await SecurityLog.create({
    user: user._id, event: 'account_suspended',
    details: { reason, adminId: req.user._id },
    severity: 'critical',
  });

  res.json({ success: true, message: 'User suspended', data: user });
};

exports.unsuspendUser = async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isSuspended: false, suspensionReason: null, riskScore: 0, isFlagged: false },
    { new: true }
  );
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  await SecurityLog.create({
    user: user._id, event: 'account_unblocked',
    details: { adminId: req.user._id },
    severity: 'info',
  });

  res.json({ success: true, message: 'User unsuspended', data: user });
};

exports.deleteUser = async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  await SecurityLog.create({
    event: 'admin_action',
    details: { action: 'delete_user', targetUserId: req.params.id, adminId: req.user._id },
  });
  res.json({ success: true, message: 'User deleted' });
};

exports.forceLogoutUser = async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, { refreshTokens: [] });
  await SecurityLog.create({
    user: req.params.id, event: 'session_terminated',
    details: { forcedByAdmin: req.user._id },
    severity: 'warning',
  });
  res.json({ success: true, message: 'User force logged out (all sessions revoked)' });
};

// ──────────────────── SECURITY LOGS ──────────────────────────────────────────

exports.getSecurityLogs = async (req, res) => {
  const { page = 1, limit = 50, userId, event, severity, resolved } = req.query;
  const filter = {};
  if (userId) filter.user = userId;
  if (event) filter.event = event;
  if (severity) filter.severity = severity;
  if (resolved !== undefined) filter.resolved = resolved === 'true';

  const logs = await SecurityLog.find(filter)
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await SecurityLog.countDocuments(filter);
  res.json({ success: true, data: logs, pagination: { total, page: +page, limit: +limit } });
};

exports.resolveSecurityLog = async (req, res) => {
  const log = await SecurityLog.findByIdAndUpdate(req.params.id, { resolved: true }, { new: true });
  if (!log) return res.status(404).json({ success: false, message: 'Log not found' });
  res.json({ success: true, data: log });
};

exports.getFlaggedUsers = async (req, res) => {
  const users = await User.find({ isFlagged: true })
    .sort({ riskScore: -1 })
    .select('name email phone riskScore flagReason isSuspended deviceId lastLogin lastLoginIp');
  res.json({ success: true, data: users });
};

// ──────────────────── ANALYTICS ──────────────────────────────────────────────

exports.getDashboardStats = async (req, res) => {
  const [
    totalUsers,
    activeSubscriptions,
    totalCourses,
    totalLessons,
    flaggedUsers,
    suspendedUsers,
    criticalLogs24h,
    recentUsers,
    totalCoursePurchases,
    activeCoursePurchases,
  ] = await Promise.all([
    User.countDocuments({ role: 'student' }),
    Subscription.countDocuments({ status: 'active' }),
    Course.countDocuments({ isPublished: true }),
    Lesson.countDocuments({ isPublished: true }),
    User.countDocuments({ isFlagged: true }),
    User.countDocuments({ isSuspended: true }),
    SecurityLog.countDocuments({
      severity: 'critical',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }),
    User.find({ role: 'student' }).sort({ createdAt: -1 }).limit(5).select('name email createdAt'),
    CoursePurchase.countDocuments(),
    CoursePurchase.countDocuments({ status: 'active', endDate: { $gte: new Date() } }),
  ]);

  // Revenue this month
  const startOfMonth = new Date(new Date().setDate(1));
  const revenueResult = await Subscription.aggregate([
    { $match: { createdAt: { $gte: startOfMonth }, status: { $in: ['active', 'expired'] } } },
    { $group: { _id: null, total: { $sum: '$amountPaid' } } },
  ]);
  const monthlyRevenue = revenueResult[0]?.total || 0;

  // Course purchase revenue this month
  const purchaseRevenueResult = await CoursePurchase.aggregate([
    { $match: { createdAt: { $gte: startOfMonth }, status: { $in: ['active', 'expired'] } } },
    { $group: { _id: null, total: { $sum: '$amountPaid' } } },
  ]);
  const monthlyPurchaseRevenue = purchaseRevenueResult[0]?.total || 0;

  res.json({
    success: true,
    data: {
      totalUsers,
      activeSubscriptions,
      totalCourses,
      totalLessons,
      flaggedUsers,
      suspendedUsers,
      criticalLogs24h,
      monthlyRevenue: monthlyRevenue + monthlyPurchaseRevenue,
      totalCoursePurchases,
      activeCoursePurchases,
      recentUsers,
    },
  });
};

exports.getUserGrowth = async (req, res) => {
  const growth = await User.aggregate([
    { $match: { role: 'student' } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  res.json({ success: true, data: growth });
};

exports.getVideoAnalytics = async (req, res) => {
  const topLessons = await Lesson.find()
    .sort({ totalViews: -1 })
    .limit(10)
    .populate('course', 'title')
    .select('title totalViews completionRate duration course');

  const playbackLogs = await SecurityLog.aggregate([
    { $match: { event: 'playback_started' } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
    { $limit: 30 },
  ]);

  res.json({ success: true, data: { topLessons, dailyPlayback: playbackLogs } });
};

// ──────────────────── NOTIFICATIONS ──────────────────────────────────────────

exports.sendBulkNotification = async (req, res) => {
  const { title, body, type, userIds } = req.body;

  let targetUsers;
  if (userIds && userIds.length > 0) {
    targetUsers = userIds;
  } else {
    const users = await User.find({ role: 'student', isActive: true }).select('_id');
    targetUsers = users.map((u) => u._id);
  }

  const notifications = targetUsers.map((userId) => ({ user: userId, title, body, type }));
  await Notification.insertMany(notifications);

  res.json({ success: true, message: `Notification sent to ${targetUsers.length} users` });
};