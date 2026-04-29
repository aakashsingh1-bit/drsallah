const mongoose = require('mongoose');

// ─── Course ────────────────────────────────────────────────────────────────────
const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    thumbnail: { type: String },
    thumbnailKey: { type: String }, // S3 key
    instructor: { type: String, default: 'Dr. Sallah' },
    category: { type: String, trim: true },
    tags: [String],
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },
    totalLessons: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 }, // seconds
    requiredSubscription: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly', 'free'],
      default: 'monthly',
    },
    priceTiers: [
      {
        months: { type: Number, min: 1, max: 12, required: true },
        price: { type: Number, min: 0, required: true },
        currency: { type: String, default: 'AED', uppercase: true },
        isActive: { type: Boolean, default: true },
      },
    ],
    order: { type: Number, default: 0 },
    language: { type: String, default: 'Arabic' },
    level: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'all'], default: 'all' },
    totalEnrolled: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ─── Module ────────────────────────────────────────────────────────────────────
const moduleSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    order: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: false },
    scheduledAt: { type: Date, default: null },
    totalLessons: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ─── Lesson ────────────────────────────────────────────────────────────────────
const lessonSchema = new mongoose.Schema(
  {
    module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    order: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: false },
    isFree: { type: Boolean, default: false }, // preview lesson
    scheduledAt: { type: Date, default: null },

    // Video (AWS S3)
    videoKey: { type: String },           // S3 object key
    videoBucket: { type: String },        // S3 bucket name
    duration: { type: Number, default: 0 }, // seconds
    videoSize: { type: Number, default: 0 }, // bytes
    uploadStatus: {
      type: String,
      enum: ['none', 'pending', 'ready', 'failed'],
      default: 'none',
    },
    isEncrypted: { type: Boolean, default: false },
    drmType: { type: String, enum: ['widevine', 'fairplay', 'aes128', 'none'], default: 'none' },

    // Attachments
    attachments: [
      {
        name: String,
        key: String,   // S3 key
        url: String,
        size: Number,
        type: String,
      },
    ],

    // Stats
    totalViews: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = {
  Course: mongoose.model('Course', courseSchema),
  Module: mongoose.model('Module', moduleSchema),
  Lesson: mongoose.model('Lesson', lessonSchema),
};
