const User = require('../models/User');
const SecurityLog = require('../models/SecurityLog');
const { Course, Lesson } = require('../models/Content');
const { Subscription } = require('../models/Subscription');
const { CoursePurchase } = require('../models/CourseAccess');
const Notification = require('../models/Notification');
const { deleteUserAccount } = require('../services/accountDeletionService');

// ──────────────────── USER MANAGEMENT ────────────────────────────────────────

exports.getAllUsers = async (req, res) => {
  const { page = 1, limit = 20, search, isSuspended, isFlagged, role, includeDeleted } = req.query;
  const filter = {};
  if (includeDeleted !== 'true') {
    filter.deletedAt = null;
  }
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

  const [recentLogs, purchases] = await Promise.all([
    SecurityLog.find({ user: user._id }).sort({ createdAt: -1 }).limit(20),
    CoursePurchase.find({ user: user._id })
      .populate('course', 'title category priceTiers')
      .sort({ createdAt: -1 })
      .limit(50),
  ]);

  let deletedUserInfo = null;
  if (user.deletedAt) {
    const deletionLog = await SecurityLog.findOne({
      user: user._id,
      event: 'account_deleted',
    }).sort({ createdAt: -1 });
    if (deletionLog?.details) {
      deletedUserInfo = {
        name: deletionLog.details.name,
        email: deletionLog.details.email,
        phone: deletionLog.details.phone,
        deletedAt: deletionLog.details.deletedAt || user.deletedAt,
        source: deletionLog.details.source,
      };
    }
  }

  res.json({ success: true, data: { user, recentLogs, purchases, deletedUserInfo } });
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
  try {
    await deleteUserAccount(req.params.id, {
      source: 'admin',
      adminId: req.user._id,
      ip: req.ip,
    });
  } catch (err) {
    if (err.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (err.code === 'ALREADY_DELETED') {
      return res.status(400).json({ success: false, message: 'User already deleted' });
    }
    if (err.code === 'CANNOT_DELETE_ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin accounts cannot be deleted' });
    }
    throw err;
  }
  res.json({ success: true, message: 'User deleted. Audit logs preserved.' });
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
    .populate('user', 'name email deletedAt')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const enrichedLogs = await Promise.all(
    logs.map(async (log) => {
      const doc = log.toObject();
      if (doc.user?.deletedAt || doc.event === 'account_deleted') {
        const deletionLog =
          doc.event === 'account_deleted'
            ? doc
            : await SecurityLog.findOne({ user: doc.user?._id, event: 'account_deleted' })
                .sort({ createdAt: -1 })
                .lean();
        if (deletionLog?.details?.email) {
          doc.auditUser = {
            name: deletionLog.details.name,
            email: deletionLog.details.email,
            phone: deletionLog.details.phone,
            deletedAt: deletionLog.details.deletedAt,
          };
        }
      }
      return doc;
    })
  );

  const total = await SecurityLog.countDocuments(filter);
  res.json({ success: true, data: enrichedLogs, pagination: { total, page: +page, limit: +limit } });
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
    User.countDocuments({ role: 'student', deletedAt: null }),
    Subscription.countDocuments({ status: 'active' }),
    Course.countDocuments({ isPublished: true }),
    Lesson.countDocuments({ isPublished: true }),
    User.countDocuments({ isFlagged: true }),
    User.countDocuments({ isSuspended: true }),
    SecurityLog.countDocuments({
      severity: 'critical',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }),
    User.find({ role: 'student', deletedAt: null }).sort({ createdAt: -1 }).limit(5).select('name email createdAt'),
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
    const users = await User.find({ role: 'student', isActive: true, deletedAt: null }).select('_id');
    targetUsers = users.map((u) => u._id);
  }

  const notifications = targetUsers.map((userId) => ({ user: userId, title, body, type }));
  await Notification.insertMany(notifications);

  res.json({ success: true, message: `Notification sent to ${targetUsers.length} users` });
};

// ──────────────────── VIDEO OPTIMIZATION ─────────────────────────────────────

/** One-time: optimize all already-uploaded videos for smooth playback (720p + faststart) */
exports.optimizeAllVideos = async (req, res) => {
  const { queueAllUnoptimizedVideos } = require('../services/videoProcessingService');
  const result = await queueAllUnoptimizedVideos();
  res.json({ success: true, data: result });
};

// ──────────────────── MANUAL COURSE ACCESS ───────────────────────────────────

const addMonths = (date, months) => {
  const end = new Date(date);
  end.setMonth(end.getMonth() + Number(months));
  return end;
};

const finalizeActivePurchase = async (purchase, { adminId, note, source }) => {
  const wasAlreadyActive = purchase.status === 'active' && purchase.endDate && new Date(purchase.endDate) >= new Date();
  const startDate = new Date();
  purchase.status = 'active';
  purchase.startDate = purchase.startDate || startDate;
  purchase.endDate = addMonths(startDate, purchase.months);
  purchase.paymentProvider = purchase.paymentProvider || 'manual';
  purchase.metadata = {
    ...(purchase.metadata || {}),
    activatedByAdmin: adminId?.toString(),
    activatedAt: new Date().toISOString(),
    activationNote: note || undefined,
    activationSource: source || 'admin_manual',
  };
  await purchase.save();

  if (!wasAlreadyActive) {
    await Course.findByIdAndUpdate(purchase.course, { $inc: { totalEnrolled: 1 } }).catch(() => {});
  }

  await Promise.all([
    Notification.create({
      user: purchase.user,
      title: 'Course Access Active',
      body: 'Your course access has been activated. Enjoy learning!',
      type: 'general',
    }).catch(() => {}),
    SecurityLog.create({
      user: purchase.user,
      event: 'course_purchase_activated',
      severity: 'info',
      details: {
        courseId: purchase.course,
        purchaseId: purchase._id,
        endDate: purchase.endDate,
        activatedByAdmin: adminId?.toString(),
        note: note || null,
        source: source || 'admin_manual',
      },
    }).catch(() => {}),
  ]);

  return purchase;
};

/**
 * POST /admin/users/:id/grant-course
 * Manually grant/activate course access (e.g. Stripe paid but webhook missed).
 * Body: { courseId, months, amountPaid?, currency?, note?, stripePaymentIntentId? }
 */
exports.grantUserCourseAccess = async (req, res) => {
  const userId = req.params.id;
  const {
    courseId,
    months,
    amountPaid,
    currency,
    note,
    stripePaymentIntentId,
  } = req.body;

  if (!courseId || !months) {
    return res.status(400).json({ success: false, message: 'courseId and months are required' });
  }

  const selectedMonths = Number(months);
  if (!Number.isInteger(selectedMonths) || selectedMonths < 1 || selectedMonths > 12) {
    return res.status(400).json({ success: false, message: 'months must be an integer from 1 to 12' });
  }

  const user = await User.findById(userId);
  if (!user || user.deletedAt) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const course = await Course.findById(courseId);
  if (!course) {
    return res.status(404).json({ success: false, message: 'Course not found' });
  }

  // Prefer activating an existing pending/failed purchase for this course
  let purchase = await CoursePurchase.findOne({
    user: userId,
    course: courseId,
    status: { $in: ['pending', 'failed', 'cancelled'] },
  }).sort({ createdAt: -1 });

  if (purchase) {
    purchase.months = selectedMonths || purchase.months;
    if (amountPaid != null && amountPaid !== '') purchase.amountPaid = Number(amountPaid);
    if (currency) purchase.currency = String(currency).toUpperCase();
    if (stripePaymentIntentId) purchase.stripePaymentIntentId = stripePaymentIntentId;
    purchase = await finalizeActivePurchase(purchase, {
      adminId: req.user._id,
      note,
      source: 'admin_activate_existing',
    });
  } else {
    // If already has active access, extend from current endDate
    const active = await CoursePurchase.findOne({
      user: userId,
      course: courseId,
      status: 'active',
      endDate: { $gte: new Date() },
    }).sort({ endDate: -1 });

    if (active) {
      const from = new Date(active.endDate);
      active.months = selectedMonths;
      active.endDate = addMonths(from, selectedMonths);
      active.metadata = {
        ...(active.metadata || {}),
        extendedByAdmin: req.user._id.toString(),
        extendedAt: new Date().toISOString(),
        extensionNote: note || undefined,
      };
      await active.save();
      purchase = active;

      await SecurityLog.create({
        user: userId,
        event: 'course_purchase_activated',
        severity: 'info',
        details: {
          courseId,
          purchaseId: active._id,
          endDate: active.endDate,
          activatedByAdmin: req.user._id.toString(),
          note: note || null,
          source: 'admin_extend',
        },
      }).catch(() => {});
    } else {
      const tier = course.priceTiers?.find(
        (t) => t.isActive !== false && Number(t.months) === selectedMonths
      );
      purchase = await CoursePurchase.create({
        user: userId,
        course: courseId,
        months: selectedMonths,
        status: 'pending',
        amountPaid: amountPaid != null && amountPaid !== ''
          ? Number(amountPaid)
          : Number(tier?.price || 0),
        currency: (currency || tier?.currency || 'AED').toUpperCase(),
        paymentProvider: 'manual',
        stripePaymentIntentId: stripePaymentIntentId || undefined,
      });
      purchase = await finalizeActivePurchase(purchase, {
        adminId: req.user._id,
        note,
        source: 'admin_grant_new',
      });
    }
  }

  const populated = await CoursePurchase.findById(purchase._id)
    .populate('course', 'title category')
    .populate('user', 'name email');

  res.json({
    success: true,
    message: 'Course access activated successfully',
    data: populated,
  });
};

/**
 * POST /admin/course-purchases/:id/activate
 * Activate a pending/failed purchase (webhook miss recovery).
 * Body: { note?, months? }
 */
exports.activateCoursePurchase = async (req, res) => {
  const purchase = await CoursePurchase.findById(req.params.id);
  if (!purchase) {
    return res.status(404).json({ success: false, message: 'Purchase not found' });
  }

  if (purchase.status === 'active' && purchase.endDate && new Date(purchase.endDate) >= new Date()) {
    return res.status(400).json({ success: false, message: 'Purchase is already active' });
  }

  if (req.body.months) {
    const m = Number(req.body.months);
    if (Number.isInteger(m) && m >= 1 && m <= 12) purchase.months = m;
  }

  const updated = await finalizeActivePurchase(purchase, {
    adminId: req.user._id,
    note: req.body.note,
    source: 'admin_activate_purchase',
  });

  const populated = await CoursePurchase.findById(updated._id)
    .populate('course', 'title category')
    .populate('user', 'name email');

  res.json({
    success: true,
    message: 'Purchase activated successfully',
    data: populated,
  });
};