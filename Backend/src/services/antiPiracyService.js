const SecurityLog = require('../models/SecurityLog');
const User = require('../models/User');

/**
 * Analyze user behavior and compute a risk score (0-100).
 * In production, this would feed into a proper ML pipeline.
 */
const analyzeUserBehavior = async (userId, event, context = {}) => {
  const suspiciousEvents = [
    'screen_record_attempt',
    'screenshot_attempt',
    'piracy_attempt',
    'multi_device_login',
    'device_changed',
  ];

  const warningEvents = ['login_failed', 'suspicious_activity', 'session_terminated'];

  let riskDelta = 0;

  if (suspiciousEvents.includes(event)) riskDelta += 20;
  else if (warningEvents.includes(event)) riskDelta += 10;

  // Count recent suspicious events in last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCritical = await SecurityLog.countDocuments({
    user: userId,
    severity: 'critical',
    createdAt: { $gte: oneDayAgo },
  });

  if (recentCritical > 3) riskDelta += 20;

  // Multiple IPs in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentIPs = await SecurityLog.distinct('ip', {
    user: userId,
    event: 'playback_started',
    createdAt: { $gte: oneHourAgo },
  });
  if (recentIPs.length > 2) riskDelta += 15;

  // Update user risk score
  const user = await User.findById(userId);
  if (!user) return;

  const newScore = Math.min(100, (user.riskScore || 0) + riskDelta);
  const shouldFlag = newScore >= 60;
  const shouldSuspend = newScore >= 85;

  await User.findByIdAndUpdate(userId, {
    riskScore: newScore,
    isFlagged: shouldFlag,
    ...(shouldFlag && !user.isFlagged ? { flagReason: `High risk score: ${newScore}` } : {}),
    ...(shouldSuspend && !user.isSuspended
      ? { isSuspended: true, suspensionReason: 'Automated: risk score exceeded threshold' }
      : {}),
  });

  return { riskScore: newScore, flagged: shouldFlag, suspended: shouldSuspend };
};

/**
 * Detect repeated login attempts from multiple IPs (session duplication detection)
 */
const detectAbnormalPlayback = async (userId, ip) => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const ips = await SecurityLog.distinct('ip', {
    user: userId,
    event: 'playback_started',
    createdAt: { $gte: oneHourAgo },
  });

  if (!ips.includes(ip)) {
    ips.push(ip);
  }

  return {
    isSuspicious: ips.length > 2,
    uniqueIPs: ips.length,
    ips,
  };
};

module.exports = { analyzeUserBehavior, detectAbnormalPlayback };