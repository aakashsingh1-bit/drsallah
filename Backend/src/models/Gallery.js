const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: '',
      maxlength: 200,
    },
    imageKey: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      default: '',
    },
    altText: {
      type: String,
      default: '',
      maxlength: 300,
    },
    category: {
      type: String,
      default: 'general',
      enum: ['general', 'events', 'courses', 'promotional', 'other'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

gallerySchema.index({ isActive: 1, createdAt: -1 });
gallerySchema.index({ category: 1 });

module.exports = mongoose.model('Gallery', gallerySchema);
