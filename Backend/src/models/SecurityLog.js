const mongoose = require('mongoose');

const securityLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    event: {
      type: String,
      enum: [
        'login_success',
        'login_failed',
        'logout',
        'token_refresh',
        'device_changed',
        'device_blocked',
        'otp_sent',
        'otp_verified',
        'password_reset',
        'account_suspended',
        'account_unblocked',
        'screen_record_attempt',
        'screenshot_attempt',
        'suspicious_activity',
        'session_terminated',
        'piracy_attempt',
        'multi_device_login',
        'playback_started',
        'playback_ended',
        'signed_url_requested',
        'subscription_created',
        'subscription_expired',
        'admin_action',
      ],
      required: true,
    },
    ip: { type: String },
    deviceId: { type: String },
    deviceName: { type: String },
    userAgent: { type: String },
    details: { type: mongoose.Schema.Types.Mixed },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
    },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

securityLogSchema.index({ user: 1, createdAt: -1 });
securityLogSchema.index({ event: 1, createdAt: -1 });
securityLogSchema.index({ severity: 1, resolved: 1 });

module.exports = mongoose.model('SecurityLog', securityLogSchema);