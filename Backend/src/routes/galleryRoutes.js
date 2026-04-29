const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  uploadGalleryImage,
  uploadGalleryImagesBulk,
  getGalleryImages,
  getGalleryImageById,
  updateGalleryImage,
  deleteGalleryImage,
} = require('../controllers/galleryController');
const { protect, adminOnly } = require('../middleware/auth');

// ─── Multer memory storage for gallery image uploads ──────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per image
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Invalid image format. Use JPEG, PNG, WebP, GIF'));
  },
});

/**
 * @openapi
 * tags:
 *   - name: Gallery
 *     description: Gallery image management
 */

/**
 * @openapi
 * /gallery:
 *   get:
 *     tags: [Gallery]
 *     summary: Get all gallery images (public - only active)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: category
 *         schema: { type: string, enum: [general, events, courses, promotional, other] }
 *     responses:
 *       200:
 *         description: List of gallery images
 *   post:
 *     tags: [Gallery]
 *     summary: Admin - Upload a single gallery image
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               title:
 *                 type: string
 *               altText:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [general, events, courses, promotional, other]
 *     responses:
 *       201:
 *         description: Image uploaded
 */
router.route('/gallery')
  .get(getGalleryImages)
  .post(protect, adminOnly, upload.single('image'), uploadGalleryImage);

/**
 * @openapi
 * /gallery/bulk:
 *   post:
 *     tags: [Gallery]
 *     summary: Admin - Upload multiple gallery images at once
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [images]
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               title:
 *                 type: string
 *               altText:
 *                 type: string
 *               category:
 *                 type: string
 *     responses:
 *       201:
 *         description: Images uploaded
 */
router.post('/gallery/bulk', protect, adminOnly, upload.array('images', 20), uploadGalleryImagesBulk);

/**
 * @openapi
 * /gallery/{id}:
 *   get:
 *     tags: [Gallery]
 *     summary: Get a single gallery image by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Image data
 *   put:
 *     tags: [Gallery]
 *     summary: Admin - Update gallery image metadata
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               altText: { type: string }
 *               category: { type: string }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Image updated
 *   delete:
 *     tags: [Gallery]
 *     summary: Admin - Delete a gallery image
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Image deleted
 */
router.route('/gallery/:id')
  .get(getGalleryImageById)
  .put(protect, adminOnly, updateGalleryImage)
  .delete(protect, adminOnly, deleteGalleryImage);

module.exports = router;
