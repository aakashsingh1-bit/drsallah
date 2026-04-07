const mongoose = require('mongoose');

// ─── Subscription Plan ─────────────────────────────────────────────────────────
const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['monthly', 'quarterly', 'yearly'], required: true },
    price: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    durationDays: { type: Number, required: true },
    features: [String],
    isActive: { type: Boolean, default: true },
    discount: { type: Number, default: 0 }, // percentage
    couponCode: { type: String, default: null },
  },
  { timestamps: true }
);

// ─── User Subscription ─────────────────────────────────────────────────────────
const subscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'grace_period', 'pending'],
      default: 'pending',
    },
    startDate: { type: Date },
    endDate: { type: Date },
    gracePeriodEndDate: { type: Date },
    autoRenew: { type: Boolean, default: true },

    // Payment
    paymentMethod: { type: String, enum: ['apple_iap', 'google_play', 'manual', 'card'] },
    transactionId: { type: String },
    amountPaid: { type: Number },
    currency: { type: String, default: 'USD' },

    // Retry logic
    retryCount: { type: Number, default: 0 },
    lastRetryAt: { type: Date },
    nextRetryAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = {
  Plan: mongoose.model('Plan', planSchema),
  Subscription: mongoose.model('Subscription', subscriptionSchema),
};