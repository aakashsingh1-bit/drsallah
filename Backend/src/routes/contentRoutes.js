const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  // Courses
  getAllCourses,
  getCourseById,
  getCourseFullContent,
  createCourse,
  updateCourse,
  deleteCourse,
  // Thumbnail
  uploadThumbnail,
  // Modules
  getModulesByCourse,
  getModuleWithLessons,
  createModule,
  updateModule,
  deleteModule,
  reorderModules,
  // Lessons
  getLessonsByModule,
  getLessonById,
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
  // Video
  getVideoUploadPresignedUrl,
  confirmVideoUpload,
  uploadVideoDirectly,
  // Streaming
  getStreamUrl,
  getFreeLessonStream,
  // Security
  reportSecurityEvent,
  // Watch history & bookmarks
  updateWatchHistory,
  getWatchHistory,
  toggleBookmark,
  getBookmarks,
} = require('../controllers/contentController');
const { protect, adminOnly, requireSubscription } = require('../middleware/auth');

// ─── Multer memory storage for S3 uploads ─────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
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

// ════════════════════════════════════════════════════════════════
// COURSES
// ════════════════════════════════════════════════════════════════

/**
 * @openapi
 * tags:
 *   - name: Courses
 *     description: Course listing and management
 *   - name: Course Content
 *     description: Full course content for students (modules + lessons in one call)
 *   - name: Modules
 *     description: Module management
 *   - name: Lessons
 *     description: Lesson management
 *   - name: Video Upload
 *     description: AWS S3 video upload endpoints (admin)
 *   - name: Video Streaming
 *     description: Secure video streaming for students
 */

/**
 * @openapi
 * /courses:
 *   get:
 *     tags: [Courses]
 *     summary: Get all courses
 *     description: Students see only published courses. Admins see all courses.
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by title
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Paginated list of courses
 *   post:
 *     tags: [Courses]
 *     summary: Admin - Create a new course
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               category: { type: string }
 *               instructor: { type: string }
 *               level: { type: string, enum: [beginner, intermediate, advanced, all] }
 *               language: { type: string }
 *               requiredSubscription: { type: string, enum: [monthly, quarterly, yearly, free] }
 *               isPublished: { type: boolean }
 *               thumbnail: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Course created successfully
 */
router.route('/courses')
  .get(protect, getAllCourses)
  .post(protect, adminOnly, upload.single('thumbnail'), createCourse);

/**
 * @openapi
 * /courses/{id}:
 *   get:
 *     tags: [Courses]
 *     summary: Get a single course with its published modules
 *     description: Returns course details and list of modules (published only for students, all for admins). Lessons are NOT included here — use /courses/{id}/content for full content.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Course object with modules array
 *       404:
 *         description: Course not found
 *   put:
 *     tags: [Courses]
 *     summary: Admin - Update a course
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               isPublished: { type: boolean }
 *               thumbnail: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Updated course
 *   delete:
 *     tags: [Courses]
 *     summary: Admin - Delete a course and all its content + S3 files
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Course deleted
 */
router.route('/courses/:id')
  .get(protect, getCourseById)
  .put(protect, adminOnly, upload.single('thumbnail'), updateCourse)
  .delete(protect, adminOnly, deleteCourse);

/**
 * @openapi
 * /courses/{id}/content:
 *   get:
 *     tags: [Course Content]
 *     summary: Get FULL course content — modules + lessons in one call (student use)
 *     description: |
 *       **This is the primary endpoint for the student mobile app.**
 *       Returns the complete course hierarchy: course info, all published modules,
 *       and all published lessons per module. Lessons include metadata but NOT the
 *       video stream URL (call /lessons/{lessonId}/stream separately for that).
 *
 *       Free preview lessons (`isFree: true`) are always included even without a subscription.
 *       Non-free lesson details are included, but the video stream URL requires an active subscription.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Full course content
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id: { type: string }
 *                     title: { type: string }
 *                     description: { type: string }
 *                     thumbnail: { type: string }
 *                     instructor: { type: string }
 *                     totalLessons: { type: integer }
 *                     totalDuration: { type: integer }
 *                     modules:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id: { type: string }
 *                           title: { type: string }
 *                           description: { type: string }
 *                           order: { type: integer }
 *                           lessons:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 _id: { type: string }
 *                                 title: { type: string }
 *                                 description: { type: string }
 *                                 duration: { type: integer }
 *                                 isFree: { type: boolean }
 *                                 uploadStatus: { type: string }
 *                                 order: { type: integer }
 *       404:
 *         description: Course not found
 */
router.get('/courses/:id/content', protect, getCourseFullContent);

/**
 * @openapi
 * /courses/{courseId}/thumbnail:
 *   post:
 *     tags: [Courses]
 *     summary: Admin - Upload or replace course thumbnail (uploaded to AWS S3)
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               thumbnail: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Thumbnail uploaded, returns S3 URL
 */
router.post('/courses/:courseId/thumbnail', protect, adminOnly, upload.single('thumbnail'), uploadThumbnail);

// ════════════════════════════════════════════════════════════════
// MODULES
// ════════════════════════════════════════════════════════════════

/**
 * @openapi
 * /courses/{courseId}/modules:
 *   get:
 *     tags: [Modules]
 *     summary: Get all modules for a course
 *     description: Students see only published modules. Admins see all. Does NOT include lessons — use /modules/{moduleId}/lessons for lessons.
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of modules
 *   post:
 *     tags: [Modules]
 *     summary: Admin - Create a module inside a course
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               order: { type: integer }
 *               isPublished: { type: boolean }
 *               scheduledAt: { type: string, format: date }
 *     responses:
 *       201:
 *         description: Module created
 */
router.route('/courses/:courseId/modules')
  .get(protect, getModulesByCourse)
  .post(protect, adminOnly, createModule);

/**
 * @openapi
 * /modules/{moduleId}/with-lessons:
 *   get:
 *     tags: [Modules]
 *     summary: Get a single module with all its lessons included
 *     description: Returns module details and lessons array in one call. Useful for lazy-loading module content.
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Module with lessons
 *       404:
 *         description: Module not found
 */
router.get('/modules/:moduleId/with-lessons', protect, getModuleWithLessons);

/**
 * @openapi
 * /modules/reorder:
 *   post:
 *     tags: [Modules]
 *     summary: Admin - Reorder modules (drag and drop support)
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
 *             example:
 *               orders: [{ id: "64abc...", order: 0 }, { id: "64def...", order: 1 }]
 *     responses:
 *       200:
 *         description: Modules reordered successfully
 */
// ⚠️ IMPORTANT: /modules/reorder MUST be registered BEFORE /modules/:id
// to prevent Express matching "reorder" as the :id parameter
router.post('/modules/reorder', protect, adminOnly, reorderModules);

/**
 * @openapi
 * /modules/{id}:
 *   put:
 *     tags: [Modules]
 *     summary: Admin - Update a module
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               isPublished: { type: boolean }
 *               scheduledAt: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Module updated
 *   delete:
 *     tags: [Modules]
 *     summary: Admin - Delete module and all its lessons + S3 videos
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Module deleted
 */
router.route('/modules/:id')
  .put(protect, adminOnly, updateModule)
  .delete(protect, adminOnly, deleteModule);

// ════════════════════════════════════════════════════════════════
// LESSONS
// ════════════════════════════════════════════════════════════════

/**
 * @openapi
 * /modules/{moduleId}/lessons:
 *   get:
 *     tags: [Lessons]
 *     summary: Get all lessons for a module
 *     description: Students see only published lessons. Video keys are never exposed. Use /lessons/{lessonId}/stream to get the actual video URL.
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of lessons (videoKey is excluded from response)
 *   post:
 *     tags: [Lessons]
 *     summary: Admin - Create a lesson inside a module
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               order: { type: integer }
 *               isPublished: { type: boolean }
 *               isFree: { type: boolean, description: Free preview lesson (no subscription needed) }
 *               scheduledAt: { type: string, format: date }
 *     responses:
 *       201:
 *         description: Lesson created. Upload video next using /videos/presigned-upload
 */
router.route('/modules/:moduleId/lessons')
  .get(protect, getLessonsByModule)
  .post(protect, adminOnly, createLesson);

/**
 * @openapi
 * /lessons/reorder:
 *   post:
 *     tags: [Lessons]
 *     summary: Admin - Reorder lessons within a module
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
 *       200:
 *         description: Lessons reordered
 */
// ⚠️ IMPORTANT: /lessons/reorder MUST be registered BEFORE /lessons/:id
router.post('/lessons/reorder', protect, adminOnly, reorderLessons);

/**
 * @openapi
 * /lessons/{id}:
 *   get:
 *     tags: [Lessons]
 *     summary: Get a single lesson by ID
 *     description: Returns lesson metadata. Does NOT include video URL — use /lessons/{id}/stream for that.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lesson details
 *       404:
 *         description: Lesson not found
 *   put:
 *     tags: [Lessons]
 *     summary: Admin - Update lesson metadata
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               isPublished: { type: boolean }
 *               isFree: { type: boolean }
 *               order: { type: integer }
 *     responses:
 *       200:
 *         description: Lesson updated
 *   delete:
 *     tags: [Lessons]
 *     summary: Admin - Delete a lesson and its S3 video
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lesson deleted
 */
router.route('/lessons/:id')
  .get(protect, getLessonById)
  .put(protect, adminOnly, updateLesson)
  .delete(protect, adminOnly, deleteLesson);

// ════════════════════════════════════════════════════════════════
// VIDEO UPLOAD — Admin Only (AWS S3)
// ════════════════════════════════════════════════════════════════

/**
 * @openapi
 * /videos/presigned-upload:
 *   post:
 *     tags: [Video Upload]
 *     summary: Admin - Step 1 — Get S3 presigned URL for direct browser-to-S3 upload
 *     description: |
 *       **Upload Flow:**
 *       1. Call this endpoint to get a `uploadUrl` (S3 presigned PUT URL) and `key`
 *       2. PUT the video file directly to `uploadUrl` from the browser/app
 *       3. Call `/videos/confirm` with the `key` and `lessonId` to finalize
 *
 *       The presigned URL expires in 2 hours.
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
 *         description: Presigned S3 upload URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     uploadUrl: { type: string, description: PUT this URL with the video binary }
 *                     key: { type: string, description: S3 object key — save this for /videos/confirm }
 *                     lessonId: { type: string }
 *                     expiresIn: { type: integer, example: 7200 }
 */
router.post('/videos/presigned-upload', protect, adminOnly, getVideoUploadPresignedUrl);

/**
 * @openapi
 * /videos/confirm:
 *   post:
 *     tags: [Video Upload]
 *     summary: Admin - Step 2 — Confirm upload complete and update lesson record
 *     description: Call after the browser has finished uploading to S3. Updates the lesson with the video key and marks it ready.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lessonId, key]
 *             properties:
 *               lessonId: { type: string }
 *               key: { type: string, description: The S3 key from /videos/presigned-upload }
 *               duration: { type: number, description: Video duration in seconds (e.g. 1800 for 30 minutes) }
 *     responses:
 *       200:
 *         description: Lesson updated — uploadStatus is now "ready"
 */
router.post('/videos/confirm', protect, adminOnly, confirmVideoUpload);

/**
 * @openapi
 * /videos/upload/{lessonId}:
 *   post:
 *     tags: [Video Upload]
 *     summary: Admin - Direct server upload for small videos (max 500MB)
 *     description: Uploads video through the server to S3. Use the presigned upload for large files.
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               video: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Video uploaded to S3 successfully
 */
router.post('/videos/upload/:lessonId', protect, adminOnly, upload.single('video'), uploadVideoDirectly);

// ════════════════════════════════════════════════════════════════
// VIDEO STREAMING — Student
// ════════════════════════════════════════════════════════════════

/**
 * @openapi
 * /lessons/{lessonId}/stream:
 *   get:
 *     tags: [Video Streaming]
 *     summary: Student - Get secure AWS S3 presigned stream URL (requires active subscription)
 *     description: |
 *       Returns a time-limited S3 presigned URL for video streaming.
 *
 *       **Requirements:**
 *       - Valid JWT token
 *       - Active subscription (not expired)
 *       - Lesson must be published and have a video uploaded
 *
 *       **Anti-piracy checks are performed:**
 *       - Multiple IP detection
 *       - Behavior analysis
 *       - Device binding validation
 *
 *       The URL expires based on `SIGNED_URL_EXPIRY` env variable (default: 1 hour).
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Presigned streaming URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     streamUrl: { type: string, description: Time-limited S3 URL to stream the video }
 *                     expires: { type: integer, description: Unix timestamp when URL expires }
 *                     lessonTitle: { type: string }
 *                     duration: { type: integer }
 *                     drmType: { type: string }
 *       400:
 *         description: No video uploaded for this lesson
 *       403:
 *         description: No active subscription
 *       404:
 *         description: Lesson not found or not published
 */
router.get('/lessons/:lessonId/stream', protect, getStreamUrl);

/**
 * @openapi
 * /lessons/{lessonId}/free-stream:
 *   get:
 *     tags: [Video Streaming]
 *     summary: Student - Get stream URL for a FREE preview lesson (no subscription required)
 *     description: Returns stream URL for lessons marked as `isFree: true`. No subscription needed, but JWT auth is required.
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Presigned stream URL
 *       403:
 *         description: Lesson is not marked as free
 *       404:
 *         description: Lesson not found
 */
router.get('/lessons/:lessonId/free-stream', protect, getFreeLessonStream);

/**
 * @openapi
 * /security/event:
 *   post:
 *     tags: [Video Streaming]
 *     summary: Student - Report a security event from the mobile app
 *     description: Called by the mobile app when screen recording, screenshots, or piracy attempts are detected. Triggers risk scoring and possible automatic suspension.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [event]
 *             properties:
 *               event:
 *                 type: string
 *                 enum: [screen_record_attempt, screenshot_attempt, piracy_attempt]
 *               lessonId: { type: string }
 *     responses:
 *       200:
 *         description: Event recorded. Returns recommended action (flagged or session_terminated)
 */
router.post('/security/event', protect, reportSecurityEvent);

// ════════════════════════════════════════════════════════════════
// WATCH HISTORY & BOOKMARKS
// ════════════════════════════════════════════════════════════════

/**
 * @openapi
 * /watch-history:
 *   get:
 *     tags: [Course Content]
 *     summary: Get student's watch history with resume positions
 *     responses:
 *       200:
 *         description: Array of watched lessons with progress in seconds
 *   post:
 *     tags: [Course Content]
 *     summary: Update watch progress for a lesson (called periodically during playback)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lessonId, progress]
 *             properties:
 *               lessonId: { type: string }
 *               progress: { type: number, description: Progress in seconds }
 *     responses:
 *       200:
 *         description: Watch history updated
 */
router.route('/watch-history')
  .get(protect, getWatchHistory)
  .post(protect, updateWatchHistory);

/**
 * @openapi
 * /bookmarks:
 *   get:
 *     tags: [Course Content]
 *     summary: Get all bookmarked lessons for the logged-in student
 *     responses:
 *       200:
 *         description: Array of bookmarked lesson objects
 */
router.get('/bookmarks', protect, getBookmarks);

/**
 * @openapi
 * /bookmarks/{lessonId}:
 *   post:
 *     tags: [Course Content]
 *     summary: Toggle bookmark on a lesson (add if not bookmarked, remove if bookmarked)
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Bookmark toggled — returns new bookmarked state
 */
router.post('/bookmarks/:lessonId', protect, toggleBookmark);

module.exports = router;
