const Gallery = require('../models/Gallery');
const s3Service = require('../services/s3Service');
const SecurityLog = require('../models/SecurityLog');

// ─── Helper: generate signed URL for gallery image ────────────────────────────
const safeSignedUrl = async (key, expiry = 86400) => {
  if (!key) return null;
  try {
    const { streamUrl } = await s3Service.getPresignedStreamUrl(key, expiry);
    return streamUrl;
  } catch {
    return null;
  }
};

// ─── Upload gallery image (admin only) ────────────────────────────────────────
exports.uploadGalleryImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image file provided' });
  }

  const { title, altText, category } = req.body;

  // Upload to S3
  const result = await s3Service.uploadGalleryImage(req.file.buffer, req.file.originalname, req.file.mimetype);

  const image = await Gallery.create({
    title: title?.trim() || '',
    imageKey: result.key,
    imageUrl: result.url,
    altText: altText?.trim() || '',
    category: category || 'general',
    fileSize: req.file.size,
    uploadedBy: req.user._id,
  });

  res.status(201).json({ success: true, data: image });
};

// ─── Upload multiple gallery images (admin only) ──────────────────────────────
exports.uploadGalleryImagesBulk = async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: 'No image files provided' });
  }

  const { title, altText, category } = req.body;
  const results = [];

  for (const file of req.files) {
    const result = await s3Service.uploadGalleryImage(file.buffer, file.originalname, file.mimetype);
    const image = await Gallery.create({
      title: title?.trim() || file.originalname,
      imageKey: result.key,
      imageUrl: result.url,
      altText: altText?.trim() || '',
      category: category || 'general',
      fileSize: file.size,
      uploadedBy: req.user._id,
    });
    results.push(image);
  }

  res.status(201).json({ success: true, data: results, count: results.length });
};

// ─── Get all gallery images (public, only active) ─────────────────────────────
exports.getGalleryImages = async (req, res) => {
  const { page = 1, limit = 50, category, isActive, search } = req.query;
  const filter = {};
  if (search) filter.title = { $regex: search, $options: 'i' };

  // Admin can see all, public only sees active
  if (req.user?.role !== 'admin') {
    filter.isActive = true;
  } else if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }

  if (category) filter.category = category;

  const [images, total] = await Promise.all([
    Gallery.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit)),
    Gallery.countDocuments(filter),
  ]);

  // Attach signed URLs for S3 images
  const data = await Promise.all(
    images.map(async (img) => {
      const obj = img.toObject();
      if (obj.imageKey) {
        obj.imageUrl = await safeSignedUrl(obj.imageKey) || obj.imageUrl;
      }
      return obj;
    })
  );

  res.json({
    success: true,
    data,
    pagination: { total, page: +page, limit: +limit },
  });
};

// ─── Get single gallery image by ID ───────────────────────────────────────────
exports.getGalleryImageById = async (req, res) => {
  const image = await Gallery.findById(req.params.id);
  if (!image) return res.status(404).json({ success: false, message: 'Image not found' });

  const obj = image.toObject();
  if (obj.imageKey) {
    obj.imageUrl = await safeSignedUrl(obj.imageKey) || obj.imageUrl;
  }

  res.json({ success: true, data: obj });
};

// ─── Update gallery image metadata (admin only) ───────────────────────────────
exports.updateGalleryImage = async (req, res) => {
  const { title, altText, category, isActive } = req.body;
  const updateData = {};
  if (title !== undefined) updateData.title = title.trim();
  if (altText !== undefined) updateData.altText = altText.trim();
  if (category !== undefined) updateData.category = category;
  if (isActive !== undefined) updateData.isActive = isActive === true || isActive === 'true';

  const image = await Gallery.findByIdAndUpdate(req.params.id, updateData, { new: true });
  if (!image) return res.status(404).json({ success: false, message: 'Image not found' });

  res.json({ success: true, data: image });
};

// ─── Delete gallery image (admin only) ────────────────────────────────────────
exports.deleteGalleryImage = async (req, res) => {
  const image = await Gallery.findById(req.params.id);
  if (!image) return res.status(404).json({ success: false, message: 'Image not found' });

  // Delete from S3
  if (image.imageKey) {
    try { await s3Service.deleteFromS3(image.imageKey); } catch {}
  }

  await Gallery.findByIdAndDelete(req.params.id);

  await SecurityLog.create({
    user: req.user._id,
    event: 'gallery_image_deleted',
    details: { imageId: image._id, imageKey: image.imageKey },
  }).catch(() => {});

  res.json({ success: true, message: 'Gallery image deleted' });
};
