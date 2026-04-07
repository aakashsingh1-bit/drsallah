const cron = require('node-cron');
const { Subscription } = require('../models/Subscription');
const User = require('../models/User');
const Notification = require('../models/Notification');
const SecurityLog = require('../models/SecurityLog');

// Run every day at midnight
const startSubscriptionJobs = () => {
  // ─── Daily: Check for expired subscriptions ───────────────────────────────
  cron.schedule('0 0 * * *', async () => {
    console.log('⏰ Running subscription expiry check...');
    const now = new Date();

    // Move active → grace_period when endDate passed
    const expired = await Subscription.find({
      status: 'active',
      endDate: { $lt: now },
    });

    for (const sub of expired) {
      sub.status = 'grace_period';
      await sub.save();

      await Notification.create({
        user: sub.user,
        title: 'Subscription Expired',
        body: 'Your subscription has expired. You have a 3-day grace period to renew.',
        type: 'subscription_expiry',
      });

      await SecurityLog.create({
        user: sub.user,
        event: 'subscription_expired',
        details: { subscriptionId: sub._id },
      });
    }

    // Move grace_period → expired after grace period ends
    const graceDone = await Subscription.find({
      status: 'grace_period',
      gracePeriodEndDate: { $lt: now },
    });

    for (const sub of graceDone) {
      sub.status = 'expired';
      await sub.save();

      await User.findByIdAndUpdate(sub.user, { activeSubscription: null });

      await Notification.create({
        user: sub.user,
        title: 'Access Restricted',
        body: 'Your grace period has ended. Please renew to continue accessing content.',
        type: 'subscription_expiry',
      });
    }

    console.log(`✅ Subscription check done. ${expired.length} expired, ${graceDone.length} access revoked.`);
  });

  // ─── Daily: Send 3-day expiry warning ────────────────────────────────────
  cron.schedule('0 9 * * *', async () => {
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const expiringSoon = await Subscription.find({
      status: 'active',
      endDate: { $lte: threeDaysFromNow, $gte: new Date() },
    });

    for (const sub of expiringSoon) {
      const daysLeft = Math.ceil((sub.endDate - new Date()) / (1000 * 60 * 60 * 24));
      await Notification.create({
        user: sub.user,
        title: 'Subscription Expiring Soon',
        body: `Your subscription expires in ${daysLeft} day(s). Renew now to keep learning!`,
        type: 'subscription_expiry',
      });
    }

    if (expiringSoon.length > 0) {
      console.log(`📢 Sent ${expiringSoon.length} expiry warning notifications`);
    }
  });
};

module.exports = startSubscriptionJobs;