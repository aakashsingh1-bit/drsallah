const { Course, Module, Lesson } = require('../models/Content');
const User = require('../models/User');
const { CoursePurchase, CourseReview } = require('../models/CourseAccess');
const SecurityLog = require('../models/SecurityLog');
const s3Service = require('../services/s3Service');
const { analyzeUserBehavior, detectAbnormalPlayback } = require('../services/antiPiracyService');

// ─── Helper: safe S3 signed URL ───────────────────────────────────────────────
const safeSignedUrl = async (key, expiry = 3600) => {
  if (!key) return null;
  try {
    const { streamUrl } = await s3Service.getPresignedStreamUrl(key, expiry);
    return streamUrl;
  } catch {
    return null; // fallback gracefully — don't break the response
  }
};

const EXPIRY = () => parseInt(process.env.SIGNED_URL_EXPIRY) || 3600;

const normalizePriceTiers = (value) => {
  if (value === undefined) return undefined;
  let tiers = value;
  if (typeof tiers === 'string') {
    try {
      tiers = JSON.parse(tiers);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(tiers)) return [];

  const seen = new Set();
  return tiers
    .map((tier) => ({
      months: Number(tier.months),
      price: Number(tier.price),
      currency: (tier.currency || 'AED').toUpperCase(),
      isActive: tier.isActive !== false && tier.isActive !== 'false',
    }))
    .filter((tier) => {
      if (!Number.isInteger(tier.months) || tier.months < 1 || tier.months > 12) return false;
      if (!Number.isFinite(tier.price) || tier.price < 0) return false;
      if (seen.has(tier.months)) return false;
      seen.add(tier.months);
      return true;
    })
    .sort((a, b) => a.months - b.months);
};

const attachCourseAccess = async (courseObj, user) => {
  if (!user || user.role === 'admin') {
    courseObj.access = { hasAccess: true, reason: 'admin' };
    return courseObj;
  }

  if (courseObj.requiredSubscription === 'free') {
    courseObj.access = { hasAccess: true, reason: 'free' };
    return courseObj;
  }

  const purchase = await CoursePurchase.findOne({
    user: user._id,
    course: courseObj._id,
    status: 'active',
    endDate: { $gte: new Date() },
  }).sort({ endDate: -1 });

  courseObj.access = {
    hasAccess: Boolean(purchase),
    reason: purchase ? 'purchased' : 'purchase_required',
    endDate: purchase?.endDate,
    purchaseId: purchase?._id,
  };
  return courseObj;
};

/**
 * Attach rating stats (overall average + breakdown by star count) to a course object.
 */
const attachCourseRating = async (courseObj) => {
  try {
    const stats = await CourseReview.aggregate([
      { $match: { course: courseObj._id, isApproved: true } },
      {
        $group: {
          _id: null,
          average: { $avg: '$rating' },
          count: { $sum: 1 },
          breakdown: {
            $push: '$rating',
          },
        },
      },
    ]);

    if (stats.length === 0) {
      courseObj.rating = {
        average: 0,
        count: 0,
        breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
      return courseObj;
    }

    const { average, count, breakdown: ratings } = stats[0];
    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratings.forEach((r) => { if (breakdown[r] !== undefined) breakdown[r]++; });

    courseObj.rating = {
      average: Math.round(average * 10) / 10,
      count,
      breakdown,
    };
  } catch {
    courseObj.rating = { average: 0, count: 0, breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  }
  return courseObj;
};

const getLastPublishedLessonId = async (courseId) => {
  const modules = await Module.find({ course: courseId, isPublished: true }).sort({ order: 1, createdAt: 1 }).select('_id');
  let lastLessonId = null;
  for (const mod of modules) {
    const lesson = await Lesson.findOne({ module: mod._id, isPublished: true }).sort({ order: -1, createdAt: -1 }).select('_id');
    if (lesson) lastLessonId = lesson._id.toString();
  }
  return lastLessonId;
};

const hasActiveCoursePurchase = async (userId, courseId) => {
  await CoursePurchase.updateMany(
    { user: userId, course: courseId, status: 'active', endDate: { $lt: new Date() } },
    { status: 'expired' }
  );

  return CoursePurchase.findOne({
    user: userId,
    course: courseId,
    status: 'active',
    endDate: { $gte: new Date() },
  });
};

// ════════════════════════════════════════════════════════════════
// COURSES
// ════════════════════════════════════════════════════════════════

// GET /courses
exports.getAllCourses = async (req, res) => {
  const { page = 1, limit = 10, search, category } = req.query;
  const isAdmin = req.user?.role === 'admin';

  const filter = isAdmin ? {} : { isPublished: true };
  if (search) filter.title = { $regex: search, $options: 'i' };
  if (category) filter.category = category;

  const [courses, total] = await Promise.all([
    Course.find(filter)
      .sort({ order: 1, createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit)),
    Course.countDocuments(filter),
  ]);

  // Attach signed thumbnail URLs + rating stats
  const data = await Promise.all(
    courses.map(async (c) => {
      const obj = c.toObject();
      if (obj.thumbnailKey) {
        obj.thumbnail = await safeSignedUrl(obj.thumbnailKey, EXPIRY()) || obj.thumbnail;
      }
      await attachCourseAccess(obj, req.user);
      await attachCourseRating(obj);
      return obj;
    })
  );

  res.json({ success: true, data, pagination: { total, page: +page, limit: +limit } });
};

// GET /courses/:id  — course + shallow module list (no lessons)
exports.getCourseById = async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

  const moduleFilter = { course: course._id };
  if (!isAdmin) moduleFilter.isPublished = true;

  // Get modules with actual lesson counts
  const modules = await Module.find(moduleFilter).sort({ order: 1 });
  const modulesWithCounts = await Promise.all(
    modules.map(async (mod) => {
      const modObj = mod.toObject();
      const lessonCount = await Lesson.countDocuments({ module: mod._id });
      modObj.totalLessons = lessonCount;
      return modObj;
    })
  );

  const courseObj = course.toObject();
  if (courseObj.thumbnailKey) {
    courseObj.thumbnail = await safeSignedUrl(courseObj.thumbnailKey, EXPIRY()) || courseObj.thumbnail;
  }
  await attachCourseAccess(courseObj, req.user);
  await attachCourseRating(courseObj);

  res.json({ success: true, data: { ...courseObj, modules: modulesWithCounts } });
};

// GET /courses/:id/content  — FULL: course + modules + lessons per module
exports.getCourseFullContent = async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

  // Students can only see published courses
  if (!isAdmin && !course.isPublished) {
    return res.status(404).json({ success: false, message: 'Course not found' });
  }

  const courseObj = course.toObject();
  if (courseObj.thumbnailKey) {
    courseObj.thumbnail = await safeSignedUrl(courseObj.thumbnailKey, EXPIRY()) || courseObj.thumbnail;
  }
  await attachCourseAccess(courseObj, req.user);
  await attachCourseRating(courseObj);
  const [lastLessonId, review] = isAdmin
    ? [null, null]
    : await Promise.all([
      getLastPublishedLessonId(course._id),
      CourseReview.findOne({ user: req.user._id, course: course._id }),
    ]);

  // Get all published modules
  const moduleFilter = { course: course._id };
  if (!isAdmin) moduleFilter.isPublished = true;
  const modules = await Module.find(moduleFilter).sort({ order: 1 });

  // Get lessons for every module in parallel
  const modulesWithLessons = await Promise.all(
    modules.map(async (mod) => {
      const modObj = mod.toObject();
      const lessonFilter = { module: mod._id };
      if (!isAdmin) lessonFilter.isPublished = true;

      const lessons = await Lesson.find(lessonFilter)
        .sort({ order: 1 })
        .select('-videoKey -videoBucket'); // never expose S3 keys to client

      modObj.lessons = lessons.map((l) => {
        const lessonObj = l.toObject();
        const isFinalLesson = lastLessonId && lessonObj._id.toString() === lastLessonId;
        lessonObj.isFinalLesson = Boolean(isFinalLesson);
        lessonObj.requiresReview = Boolean(isFinalLesson && !review);
        lessonObj.isLocked = Boolean(isFinalLesson && !review);
        return lessonObj;
      });
      modObj.totalLessons = lessons.length;
      return modObj;
    })
  );

  res.json({
    success: true,
    data: {
      ...courseObj,
      modules: modulesWithLessons,
    },
  });
};

// POST /courses
exports.createCourse = async (req, res) => {
  const courseData = { ...req.body };
  const priceTiers = normalizePriceTiers(courseData.priceTiers);
  if (priceTiers !== undefined) courseData.priceTiers = priceTiers;
  if (req.file) {
    const result = await s3Service.uploadThumbnail(req.file.buffer, req.file.originalname);
    courseData.thumbnail = result.url;
    courseData.thumbnailKey = result.key;
  }
  const course = await Course.create(courseData);
  res.status(201).json({ success: true, data: course });
};

// PUT /courses/:id
exports.updateCourse = async (req, res) => {
  const updateData = { ...req.body };
  const priceTiers = normalizePriceTiers(updateData.priceTiers);
  if (priceTiers !== undefined) updateData.priceTiers = priceTiers;
  if (updateData.isPublished === 'true' || updateData.isPublished === true) {
    updateData.isPublished = true;
    if (!updateData.publishedAt) updateData.publishedAt = new Date();
  }
  if (updateData.isPublished === 'false' || updateData.isPublished === false) {
    updateData.isPublished = false;
  }

  if (req.file) {
    const existing = await Course.findById(req.params.id);
    if (existing?.thumbnailKey) {
      try { await s3Service.deleteFromS3(existing.thumbnailKey); } catch {}
    }
    const result = await s3Service.uploadThumbnail(req.file.buffer, req.file.originalname);
    updateData.thumbnail = result.url;
    updateData.thumbnailKey = result.key;
  }

  const course = await Course.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
  res.json({ success: true, data: course });
};

// DELETE /courses/:id
exports.deleteCourse = async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

  if (course.thumbnailKey) {
    try { await s3Service.deleteFromS3(course.thumbnailKey); } catch {}
  }

  const lessons = await Lesson.find({ course: req.params.id });
  await Promise.all(
    lessons
      .filter((l) => l.videoKey)
      .map((l) => s3Service.deleteFromS3(l.videoKey).catch(() => {}))
  );

  await Promise.all([
    Course.findByIdAndDelete(req.params.id),
    Module.deleteMany({ course: req.params.id }),
    Lesson.deleteMany({ course: req.params.id }),
  ]);

  res.json({ success: true, message: 'Course and all its content deleted' });
};

// POST /courses/:courseId/thumbnail
exports.uploadThumbnail = async (req, res) => {
  const { courseId } = req.params;
  if (!req.file) return res.status(400).json({ success: false, message: 'No image file provided' });

  const course = await Course.findById(courseId);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

  if (course.thumbnailKey) {
    try { await s3Service.deleteFromS3(course.thumbnailKey); } catch {}
  }

  const result = await s3Service.uploadThumbnail(req.file.buffer, req.file.originalname);
  const updated = await Course.findByIdAndUpdate(
    courseId,
    { thumbnail: result.url, thumbnailKey: result.key },
    { new: true }
  );

  res.json({ success: true, data: { url: result.url, course: updated } });
};

// ════════════════════════════════════════════════════════════════
// MODULES
// ════════════════════════════════════════════════════════════════

// GET /courses/:courseId/modules
exports.getModulesByCourse = async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const filter = { course: req.params.courseId };
  if (!isAdmin) filter.isPublished = true;

  const modules = await Module.find(filter).sort({ order: 1 });

  // Get actual lesson counts for each module
  const modulesWithCounts = await Promise.all(
    modules.map(async (mod) => {
      const modObj = mod.toObject();
      const lessonCount = await Lesson.countDocuments({ module: mod._id });
      modObj.totalLessons = lessonCount;
      return modObj;
    })
  );

  res.json({ success: true, data: modulesWithCounts });
};

// GET /modules/:moduleId/with-lessons
exports.getModuleWithLessons = async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const module = await Module.findById(req.params.moduleId);
  if (!module) return res.status(404).json({ success: false, message: 'Module not found' });

  const lessonFilter = { module: module._id };
  if (!isAdmin) lessonFilter.isPublished = true;

  const lessons = await Lesson.find(lessonFilter)
    .sort({ order: 1 })
    .select('-videoKey -videoBucket');

  const moduleObj = module.toObject();
  moduleObj.lessons = lessons.map((l) => l.toObject());
  moduleObj.totalLessons = lessons.length;

  res.json({ success: true, data: moduleObj });
};

// POST /courses/:courseId/modules
exports.createModule = async (req, res) => {
  const module = await Module.create({ ...req.body, course: req.params.courseId });
  res.status(201).json({ success: true, data: module });
};

// PUT /modules/:id
exports.updateModule = async (req, res) => {
  const module = await Module.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!module) return res.status(404).json({ success: false, message: 'Module not found' });
  res.json({ success: true, data: module });
};

// DELETE /modules/:id
exports.deleteModule = async (req, res) => {
  const lessons = await Lesson.find({ module: req.params.id });
  await Promise.all(
    lessons
      .filter((l) => l.videoKey)
      .map((l) => s3Service.deleteFromS3(l.videoKey).catch(() => {}))
  );
  await Module.findByIdAndDelete(req.params.id);
  await Lesson.deleteMany({ module: req.params.id });
  res.json({ success: true, message: 'Module and all lessons deleted' });
};

// POST /modules/reorder
exports.reorderModules = async (req, res) => {
  const { orders } = req.body;
  if (!Array.isArray(orders)) return res.status(400).json({ success: false, message: 'orders array required' });
  const bulkOps = orders.map(({ id, order }) => ({
    updateOne: { filter: { _id: id }, update: { $set: { order } } },
  }));
  await Module.bulkWrite(bulkOps);
  res.json({ success: true, message: 'Modules reordered' });
};

// ════════════════════════════════════════════════════════════════
// LESSONS
// ════════════════════════════════════════════════════════════════

// GET /modules/:moduleId/lessons
exports.getLessonsByModule = async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const filter = { module: req.params.moduleId };
  if (!isAdmin) filter.isPublished = true;

  const projection = '-videoBucket';
  let lessons = await Lesson.find(filter).sort({ order: 1 }).select(projection);
  let lessonsData = lessons.map(l => l.toObject());

  const courseId = lessonsData[0]?.course;
  const [lastLessonId, review] = (!isAdmin && courseId)
    ? await Promise.all([
      getLastPublishedLessonId(courseId),
      CourseReview.findOne({ user: req.user._id, course: courseId }),
    ])
    : [null, null];
 
    for (let i = 0; i < lessonsData.length; i++) {
      if (lessonsData[i].videoKey) {
        lessonsData[i].videoUrl = await safeSignedUrl(lessonsData[i].videoKey, EXPIRY()) || null;
      }
      const isFinalLesson = lastLessonId && lessonsData[i]._id.toString() === lastLessonId;
      lessonsData[i].isFinalLesson = Boolean(isFinalLesson);
      lessonsData[i].requiresReview = Boolean(isFinalLesson && !review);
      lessonsData[i].isLocked = Boolean(isFinalLesson && !review);
      // Remove raw videoKey from response for security
      delete lessonsData[i].videoKey;
    }

  res.json({ success: true, data: lessonsData });
};

// GET /lessons/:id
exports.getLessonById = async (req, res) => {
  const lesson = await Lesson.findById(req.params.id).select('-videoKey -videoBucket');
  if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });

  // Admin bypasses all access checks
  if (req.user?.role !== 'admin') {
    // Check course purchase access
    const purchase = await hasActiveCoursePurchase(req.user._id, lesson.course);
    if (!purchase) {
      return res.status(403).json({ success: false, message: 'Active course purchase required to access this lesson' });
    }

    // Check if this is the final lesson and requires a review
    const lastLessonId = await getLastPublishedLessonId(lesson.course);
    if (lastLessonId && lesson._id.toString() === lastLessonId) {
      const review = await CourseReview.findOne({ user: req.user._id, course: lesson.course });
      if (!review) {
        return res.status(403).json({
          success: false,
          message: 'You must submit a course review before accessing the final lesson',
          requiresReview: true,
        });
      }
    }
  }

  res.json({ success: true, data: lesson });
};

// POST /modules/:moduleId/lessons
exports.createLesson = async (req, res) => {
  const module = await Module.findById(req.params.moduleId);
  if (!module) return res.status(404).json({ success: false, message: 'Module not found' });

  const lesson = await Lesson.create({ ...req.body, module: module._id, course: module.course });

  // Update counters
  await Promise.all([
    Course.findByIdAndUpdate(module.course, {
      $inc: { totalLessons: 1, totalDuration: Number(req.body.duration) || 0 },
    }),
    Module.findByIdAndUpdate(module._id, { $inc: { totalLessons: 1 } }),
  ]);

  res.status(201).json({ success: true, data: lesson });
};

// PUT /lessons/:id
exports.updateLesson = async (req, res) => {
  const lesson = await Lesson.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });
  res.json({ success: true, data: lesson });
};

// DELETE /lessons/:id
exports.deleteLesson = async (req, res) => {
  const lesson = await Lesson.findByIdAndDelete(req.params.id);
  if (lesson) {
    if (lesson.videoKey) {
      try { await s3Service.deleteFromS3(lesson.videoKey); } catch {}
    }
    await Promise.all([
      Course.findByIdAndUpdate(lesson.course, {
        $inc: { totalLessons: -1, totalDuration: -(lesson.duration || 0) },
      }),
      Module.findByIdAndUpdate(lesson.module, { $inc: { totalLessons: -1 } }),
    ]);
  }
  res.json({ success: true, message: 'Lesson deleted' });
};

// POST /lessons/reorder
exports.reorderLessons = async (req, res) => {
  const { orders } = req.body;
  if (!Array.isArray(orders)) return res.status(400).json({ success: false, message: 'orders array required' });
  const bulkOps = orders.map(({ id, order }) => ({
    updateOne: { filter: { _id: id }, update: { $set: { order } } },
  }));
  await Lesson.bulkWrite(bulkOps);
  res.json({ success: true, message: 'Lessons reordered' });
};

// ════════════════════════════════════════════════════════════════
// VIDEO UPLOAD — AWS S3
// ════════════════════════════════════════════════════════════════

// POST /videos/presigned-upload
exports.getVideoUploadPresignedUrl = async (req, res) => {
  const { lessonId, filename, contentType } = req.body;
  if (!lessonId || !filename) {
    return res.status(400).json({ success: false, message: 'lessonId and filename are required' });
  }

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });

  const { uploadUrl, key } = await s3Service.getVideoUploadUrl(lesson.course, lessonId, filename);
  await Lesson.findByIdAndUpdate(lessonId, { videoKey: key, uploadStatus: 'pending' });

  res.json({
    success: true,
    data: {
      uploadUrl,
      key,
      lessonId,
      expiresIn: 7200,
      instructions: 'PUT the video binary to uploadUrl with the correct Content-Type header. Then call /videos/confirm.',
    },
  });
};

// POST /videos/confirm
exports.confirmVideoUpload = async (req, res) => {
  const { lessonId, key, duration } = req.body;
  if (!lessonId || !key) {
    return res.status(400).json({ success: false, message: 'lessonId and key are required' });
  }

  const existing = await Lesson.findById(lessonId);
  if (!existing) return res.status(404).json({ success: false, message: 'Lesson not found' });

  const oldDuration = existing.duration || 0;
  const newDuration = Number(duration) || 0;

  existing.videoKey = key;
  existing.uploadStatus = 'ready';
  existing.duration = newDuration;
  await existing.save();

  // Adjust course totalDuration: subtract old, add new
  const durationDiff = newDuration - oldDuration;
  if (durationDiff !== 0) {
    await Course.findByIdAndUpdate(existing.course, { $inc: { totalDuration: durationDiff } });
  }

  res.json({ success: true, message: 'Video confirmed. Lesson is ready for streaming.', data: existing });
};

// POST /videos/upload/:lessonId
exports.uploadVideoDirectly = async (req, res) => {
  const { lessonId } = req.params;
  if (!req.file) return res.status(400).json({ success: false, message: 'No video file provided' });

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });

  const oldDuration = lesson.duration || 0;

  // Delete old video if exists
  if (lesson.videoKey) {
    try { await s3Service.deleteFromS3(lesson.videoKey); } catch {}
  }

  const key = s3Service.generateS3Key(`videos/${lesson.course}/${lessonId}`, req.file.originalname);
  await s3Service.uploadToS3(req.file.buffer, key, req.file.mimetype);

  // Get duration from form data (sent from frontend)
  const newDuration = req.body.duration ? parseInt(req.body.duration) : 0;

  // Update lesson with video key, size and duration
  lesson.videoKey = key;
  lesson.uploadStatus = 'ready';
  lesson.videoSize = req.file.size;
  lesson.duration = newDuration;
  await lesson.save();

  // Adjust course totalDuration
  const durationDiff = newDuration - oldDuration;
  if (durationDiff !== 0) {
    await Course.findByIdAndUpdate(lesson.course, { $inc: { totalDuration: durationDiff } });
  }

  res.json({ success: true, message: 'Video uploaded to S3 successfully', data: { lessonId, key, lesson } });
};

// ════════════════════════════════════════════════════════════════
// VIDEO STREAMING
// ════════════════════════════════════════════════════════════════

// GET /lessons/:lessonId/stream  (requires course purchase)
exports.getStreamUrl = async (req, res) => {
  const lesson = await Lesson.findById(req.params.lessonId);
  if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });
  if (!lesson.isPublished) return res.status(404).json({ success: false, message: 'Lesson not available' });
  if (!lesson.videoKey) return res.status(400).json({ success: false, message: 'No video has been uploaded for this lesson yet' });

  const userId = req.user._id.toString();
  const ip = req.ip;

  // Check course purchase access (admin bypasses)
  if (req.user?.role !== 'admin') {
    const purchase = await hasActiveCoursePurchase(req.user._id, lesson.course);
    if (!purchase) {
      return res.status(403).json({ success: false, message: 'Active course purchase required to stream this lesson' });
    }

    // Check if this is the final lesson and requires a review
    const lastLessonId = await getLastPublishedLessonId(lesson.course);
    if (lastLessonId && lesson._id.toString() === lastLessonId) {
      const review = await CourseReview.findOne({ user: req.user._id, course: lesson.course });
      if (!review) {
        return res.status(403).json({
          success: false,
          message: 'You must submit a course review before accessing the final lesson',
          requiresReview: true,
        });
      }
    }
  }

  // Anti-piracy
  const { isSuspicious, uniqueIPs } = await detectAbnormalPlayback(userId, ip);
  if (isSuspicious) {
    await analyzeUserBehavior(userId, 'suspicious_activity', { uniqueIPs, ip });
    await SecurityLog.create({
      user: userId, event: 'suspicious_activity', ip, severity: 'critical',
      details: { lessonId: lesson._id, uniqueIPsLastHour: uniqueIPs },
    });
  }

  const { streamUrl, expires } = await s3Service.getPresignedStreamUrl(lesson.videoKey, EXPIRY());

  // Log playback
  SecurityLog.create({
    user: userId, event: 'playback_started', ip,
    deviceId: req.headers['x-device-id'],
    details: { lessonId: lesson._id, title: lesson.title },
  }).catch(() => {});

  Lesson.findByIdAndUpdate(lesson._id, { $inc: { totalViews: 1 } }).catch(() => {});

  res.json({
    success: true,
    data: {
      streamUrl,
      expires,
      drmType: lesson.drmType,
      lessonTitle: lesson.title,
      duration: lesson.duration,
      lessonId: lesson._id,
    },
  });
};

// GET /lessons/:lessonId/free-stream  (no subscription required)
exports.getFreeLessonStream = async (req, res) => {
  const lesson = await Lesson.findById(req.params.lessonId);
  if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });
  if (!lesson.isPublished) return res.status(404).json({ success: false, message: 'Lesson not available' });
  if (!lesson.isFree) return res.status(403).json({ success: false, message: 'This lesson is not free' });
  if (!lesson.videoKey) return res.status(400).json({ success: false, message: 'No video uploaded for this lesson' });

  const { streamUrl, expires } = await s3Service.getPresignedStreamUrl(lesson.videoKey, EXPIRY());

  Lesson.findByIdAndUpdate(lesson._id, { $inc: { totalViews: 1 } }).catch(() => {});

  res.json({
    success: true,
    data: { streamUrl, expires, lessonTitle: lesson.title, duration: lesson.duration, isFree: true },
  });
};

// POST /security/event
exports.reportSecurityEvent = async (req, res) => {
  const { event, lessonId } = req.body;
  const allowed = ['screen_record_attempt', 'screenshot_attempt', 'piracy_attempt'];
  if (!allowed.includes(event)) {
    return res.status(400).json({ success: false, message: `Invalid event. Must be one of: ${allowed.join(', ')}` });
  }

  const userId = req.user._id.toString();
  await SecurityLog.create({
    user: userId, event, ip: req.ip,
    deviceId: req.headers['x-device-id'],
    severity: 'critical',
    details: { lessonId, reportedByDevice: true },
  });

  const result = await analyzeUserBehavior(userId, event);
  res.json({
    success: true,
    message: 'Security event recorded',
    action: result?.suspended ? 'session_terminated' : 'flagged',
  });
};

// ════════════════════════════════════════════════════════════════
// WATCH HISTORY & BOOKMARKS
// ════════════════════════════════════════════════════════════════

// POST /watch-history
exports.updateWatchHistory = async (req, res) => {
  const { lessonId, progress } = req.body;
  if (!lessonId || progress === undefined) {
    return res.status(400).json({ success: false, message: 'lessonId and progress are required' });
  }

  const user = await User.findById(req.user._id);
  const idx = user.watchHistory.findIndex((h) => h.lesson.toString() === lessonId);

  if (idx >= 0) {
    user.watchHistory[idx].progress = progress;
    user.watchHistory[idx].watchedAt = new Date();
  } else {
    user.watchHistory.push({ lesson: lessonId, progress });
  }
  await user.save();
  res.json({ success: true, message: 'Watch history updated' });
};

// GET /watch-history
exports.getWatchHistory = async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate({
      path: 'watchHistory.lesson',
      select: 'title duration course module order isFree uploadStatus',
    })
    .select('watchHistory');
  res.json({ success: true, data: user.watchHistory });
};

// GET /bookmarks
exports.getBookmarks = async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate({
      path: 'bookmarks',
      select: 'title description duration course module order isFree',
    })
    .select('bookmarks');
  res.json({ success: true, data: user.bookmarks });
};

// POST /bookmarks/:lessonId
exports.toggleBookmark = async (req, res) => {
  const { lessonId } = req.params;
  const user = await User.findById(req.user._id);
  const idx = user.bookmarks.findIndex((b) => b.toString() === lessonId);
  if (idx >= 0) {
    user.bookmarks.splice(idx, 1);
  } else {
    user.bookmarks.push(lessonId);
  }
  await user.save();
  res.json({ success: true, bookmarked: idx < 0, bookmarks: user.bookmarks });
};
