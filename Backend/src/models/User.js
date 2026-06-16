const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    password: { type: String, minlength: 6 },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },

    // Device Binding
    deviceId: { type: String, default: null },
    deviceName: { type: String, default: null },
    deviceBoundAt: { type: Date, default: null },

    // Auth
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isSuspended: { type: Boolean, default: false },
    suspensionReason: { type: String, default: null },

    // OTP
    otp: { type: String },
    otpExpires: { type: Date },
    otpType: { type: String, enum: ['email_verify', 'phone_verify', 'password_reset'] },

    // Refresh Tokens (stored for rotation / revocation)
    refreshTokens: [{ type: String }],

    // Security
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    isFlagged: { type: Boolean, default: false },
    flagReason: { type: String, default: null },
    lastLogin: { type: Date },
    lastLoginIp: { type: String },

    // Subscription reference
    activeSubscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },

    // Watch history
    watchHistory: [
      {
        lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
        watchedAt: { type: Date, default: Date.now },
        progress: { type: Number, default: 0 }, // in seconds
      },
    ],

    // Bookmarks
    bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }],

    // Account deletion (PII removed; document kept for audit log references)
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ deletedAt: 1 });

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return ;
  this.password = await bcrypt.hash(this.password, 12);

});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.otp;
  delete obj.otpExpires;
  delete obj.refreshTokens;
  return obj;
};

module.exports = mongoose.model('User', userSchema);