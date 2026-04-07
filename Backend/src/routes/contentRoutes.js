const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getAllCourses, getCourseById, createCourse, updateCourse, deleteCourse,
  getModulesByCourse, createModule, updateModule, deleteModule, reorderModules,
  getLessonsByModule, getLessonById, createLesson, updateLesson, deleteLesson, reorderLessons,
  getVideoUploadPresignedUrl, confirmVideoUpload, uploadVideoDirectly,
  uploadThumbnail,
  getStreamUrl, reportSecurityEvent,
  updateWatchHistory, getWatchHistory, toggleBookmark,
} = require('../controllers/contentController');
const { protect, adminOnly, requireSubscription } = require('../middleware/auth');

// Multer: memory storage for S3 uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB for direct video upload
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'video') {
      const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
      if (allowed.includes(file.mimetype)) return cb(null, true);
      return cb(new Error('Invalid video format. Use MP4, WebM, MOV, AVI'));
    }
    if (file.fieldname === 'thumbnail') {
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (allowed.includes(file.mimetype)) return cb(null, true);
      return cb(new Error('Invalid image format. Use JPEG, PNG, WebP'));
    }
    cb(null, true);
  },
});

/**
 * @openapi
 * tags:
 *   - name: Courses
 *     description: Course management
 *   - name: Modules
 *     description: Module management
 *   - name: Lessons
 *     description: Lesson & video management
 *   - name: Video Streaming
 *     description: Secure S3 presigned video streaming
 */

// ─── COURSES ──────────────────────────────────────────────────────────────────
/**
 * @openapi
 * /courses:
 *   get:
 *     tags: [Courses]
 *     summary: Get all courses (admin sees all, students see published)
 *     parameters:
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: category, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 10 } }
 *     responses:
 *       200: { description: List of courses }
 *   post:
 *     tags: [Courses]
 *     summary: Admin - Create a course (with optional thumbnail)
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               category: { type: string }
 *               instructor: { type: string }
 *               requiredSubscription: { type: string, enum: [monthly, quarterly, yearly, free] }
 *               thumbnail: { type: string, format: binary }
 *     responses:
 *       201: { description: Course created }
 */
router.route('/courses')
  .get(protect, getAllCourses)
  .post(protect, adminOnly, upload.single('thumbnail'), createCourse);

router.route('/courses/:id')
  .get(protect, getCourseById)
  .put(protect, adminOnly, upload.single('thumbnail'), updateCourse)
  .delete(protect, adminOnly, deleteCourse);

// ─── THUMBNAIL UPLOAD ─────────────────────────────────────────────────────────
/**
 * @openapi
 * /courses/{courseId}/thumbnail:
 *   post:
 *     tags: [Courses]
 *     summary: Admin - Upload/replace course thumbnail to S3
 *     parameters:
 *       - { in: path, name: courseId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               thumbnail: { type: string, format: binary }
 *     responses:
 *       200: { description: Thumbnail uploaded }
 */
router.post('/courses/:courseId/thumbnail', protect, adminOnly, upload.single('thumbnail'), uploadThumbnail);

// ─── MODULES ──────────────────────────────────────────────────────────────────
router.route('/courses/:courseId/modules')
  .get(protect, getModulesByCourse)
  .post(protect, adminOnly, createModule);

router.route('/modules/:id')
  .put(protect, adminOnly, updateModule)
  .delete(protect, adminOnly, deleteModule);

/**
 * @openapi
 * /modules/reorder:
 *   post:
 *     tags: [Modules]
 *     summary: Admin - Reorder modules (drag & drop)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orders:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     order: { type: integer }
 *     responses:
 *       200: { description: Reordered }
 */
router.post('/modules/reorder', protect, adminOnly, reorderModules);

// ─── LESSONS ──────────────────────────────────────────────────────────────────
router.route('/modules/:moduleId/lessons')
  .get(protect, getLessonsByModule)
  .post(protect, adminOnly, createLesson);

router.route('/lessons/:id')
  .get(protect, getLessonById)
  .put(protect, adminOnly, updateLesson)
  .delete(protect, adminOnly, deleteLesson);

router.post('/lessons/reorder', protect, adminOnly, reorderLessons);

// ─── VIDEO UPLOAD (AWS S3) ────────────────────────────────────────────────────
/**
 * @openapi
 * /videos/presigned-upload:
 *   post:
 *     tags: [Lessons]
 *     summary: Admin - Get S3 presigned URL for direct browser video upload
 *     description: |
 *       Returns a presigned S3 PUT URL. Frontend uploads video directly to S3.
 *       After upload, call /videos/confirm to finalize.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lessonId, filename]
 *             properties:
 *               lessonId: { type: string }
 *               filename: { type: string, example: lecture-01.mp4 }
 *               contentType: { type: string, example: video/mp4 }
 *     responses:
 *       200:
 *         description: Presigned upload URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uploadUrl: { type: string }
 *                 key: { type: string }
 *                 expiresIn: { type: integer }
 */
router.post('/videos/presigned-upload', protect, adminOnly, getVideoUploadPresignedUrl);

/**
 * @openapi
 * /videos/confirm:
 *   post:
 *     tags: [Lessons]
 *     summary: Admin - Confirm video upload complete and update lesson
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lessonId, key]
 *             properties:
 *               lessonId: { type: string }
 *               key: { type: string }
 *               duration: { type: number, description: Duration in seconds }
 *     responses:
 *       200: { description: Lesson updated with video info }
 */
router.post('/videos/confirm', protect, adminOnly, confirmVideoUpload);

/**
 * @openapi
 * /videos/upload/{lessonId}:
 *   post:
 *     tags: [Lessons]
 *     summary: Admin - Direct multipart video upload (for small files < 500MB)
 *     parameters:
 *       - { in: path, name: lessonId, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               video: { type: string, format: binary }
 *     responses:
 *       200: { description: Video uploaded }
 */
router.post('/videos/upload/:lessonId', protect, adminOnly, upload.single('video'), uploadVideoDirectly);

// ─── STREAMING (Student - requires subscription) ──────────────────────────────
/**
 * @openapi
 * /lessons/{lessonId}/stream:
 *   get:
 *     tags: [Video Streaming]
 *     summary: Get AWS S3 presigned stream URL for a lesson
 *     description: Returns a time-limited S3 presigned URL. Validates subscription, device, and anti-piracy.
 *     parameters:
 *       - { in: path, name: lessonId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: S3 presigned stream URL }
 *       403: { description: No active subscription }
 */
router.get('/lessons/:lessonId/stream', protect, requireSubscription, getStreamUrl);

router.post('/security/event', protect, reportSecurityEvent);

// ─── WATCH HISTORY & BOOKMARKS ────────────────────────────────────────────────
router.route('/watch-history')
  .get(protect, getWatchHistory)
  .post(protect, updateWatchHistory);

router.post('/bookmarks/:lessonId', protect, toggleBookmark);

module.exports = router;
