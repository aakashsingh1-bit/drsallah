const mongoose = require('mongoose');

const coursePurchaseSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    months: { type: Number, min: 1, max: 12, required: true },
    status: {
      type: String,
      enum: ['pending', 'active', 'expired', 'cancelled', 'failed'],
      default: 'pending',
    },
    startDate: { type: Date },
    endDate: { type: Date },
    amountPaid: { type: Number, min: 0, required: true },
    currency: { type: String, default: 'AED', uppercase: true },
    paymentProvider: { type: String, enum: ['stripe', 'manual'], default: 'stripe' },
    stripeCheckoutSessionId: { type: String, index: true, sparse: true },
    stripePaymentIntentId: { type: String },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

coursePurchaseSchema.index({ user: 1, course: 1, status: 1, endDate: 1 });

const courseReviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, maxlength: 2000 },
    isApproved: { type: Boolean, default: true },
  },
  { timestamps: true }
);

courseReviewSchema.index({ user: 1, course: 1 }, { unique: true });

module.exports = {
  CoursePurchase: mongoose.model('CoursePurchase', coursePurchaseSchema),
  CourseReview: mongoose.model('CourseReview', courseReviewSchema),
};
