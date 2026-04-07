const { Plan, Subscription } = require('../models/Subscription');
const User = require('../models/User');
const SecurityLog = require('../models/SecurityLog');
const Notification = require('../models/Notification');

// ──────────────────── PLANS ──────────────────────────────────────────────────

exports.getAllPlans = async (req, res) => {
  const plans = await Plan.find({ isActive: true }).sort({ price: 1 });
  res.json({ success: true, data: plans });
};

exports.createPlan = async (req, res) => {
  const plan = await Plan.create(req.body);
  res.status(201).json({ success: true, data: plan });
};

exports.updatePlan = async (req, res) => {
  const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
  res.json({ success: true, data: plan });
};

exports.deletePlan = async (req, res) => {
  await Plan.findByIdAndUpdate(req.params.id, { isActive: false });
  res.json({ success: true, message: 'Plan deactivated' });
};

// ──────────────────── SUBSCRIPTIONS ─────────────────────────────────────────

exports.subscribe = async (req, res) => {
  const { planId, paymentMethod, transactionId, amountPaid } = req.body;
  const userId = req.user._id;

  const plan = await Plan.findById(planId);
  if (!plan || !plan.isActive) {
    return res.status(404).json({ success: false, message: 'Plan not found or inactive' });
  }

  // Expire any existing active subscription
  await Subscription.updateMany(
    { user: userId, status: 'active' },
    { status: 'expired' }
  );

  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
  const gracePeriodEndDate = new Date(endDate.getTime() + 3 * 24 * 60 * 60 * 1000); // 3-day grace

  const subscription = await Subscription.create({
    user: userId,
    plan: planId,
    status: 'active',
    startDate,
    endDate,
    gracePeriodEndDate,
    paymentMethod,
    transactionId,
    amountPaid: amountPaid || plan.price,
    currency: plan.currency,
  });

  await User.findByIdAndUpdate(userId, { activeSubscription: subscription._id });

  await SecurityLog.create({
    user: userId,
    event: 'subscription_created',
    details: { planId, planType: plan.type, endDate },
  });

  await Notification.create({
    user: userId,
    title: 'Subscription Active!',
    body: `Your ${plan.type} subscription is now active. Enjoy learning!`,
    type: 'general',
  });

  res.status(201).json({ success: true, data: subscription });
};

exports.getMySubscription = async (req, res) => {
  const sub = await Subscription.findOne({ user: req.user._id, status: 'active' }).populate('plan');
  res.json({ success: true, data: sub || null });
};

exports.cancelSubscription = async (req, res) => {
  const sub = await Subscription.findOne({ user: req.user._id, status: 'active' });
  if (!sub) return res.status(404).json({ success: false, message: 'No active subscription found' });

  sub.status = 'cancelled';
  sub.autoRenew = false;
  await sub.save();

  await User.findByIdAndUpdate(req.user._id, { activeSubscription: null });
  res.json({ success: true, message: 'Subscription cancelled' });
};

// ──────────────────── ADMIN: All Subscriptions ───────────────────────────────

exports.getAllSubscriptions = async (req, res) => {
  const { page = 1, limit = 20, status, userId } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (userId) filter.user = userId;

  const subscriptions = await Subscription.find(filter)
    .populate('user', 'name email phone')
    .populate('plan', 'name type price')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Subscription.countDocuments(filter);
  res.json({ success: true, data: subscriptions, pagination: { total, page: +page, limit: +limit } });
};

exports.getRevenueAnalytics = async (req, res) => {
  const revenue = await Subscription.aggregate([
    { $match: { status: { $in: ['active', 'expired'] } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        total: { $sum: '$amountPaid' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const byPlan = await Subscription.aggregate([
    { $match: { status: { $in: ['active', 'expired'] } } },
    { $group: { _id: '$plan', total: { $sum: '$amountPaid' }, count: { $sum: 1 } } },
    { $lookup: { from: 'plans', localField: '_id', foreignField: '_id', as: 'plan' } },
    { $unwind: '$plan' },
    { $project: { planName: '$plan.name', planType: '$plan.type', total: 1, count: 1 } },
  ]);

  res.json({ success: true, data: { monthly: revenue, byPlan } });
};