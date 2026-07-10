const { Course, Module, Lesson } = require('../models/Content');
const User = require('../models/User');
const { CoursePurchase, CourseReview } = require('../models/CourseAccess');
const SecurityLog = require('../models/SecurityLog');
const s3Service = require('../services/s3Service');
const { detectAbnormalPlayback } = require('../services/antiPiracyService');
const {
  recalculateCourseStats,
  recalculateAfterLessonChange,
  recalculateAllCourses,
  countModuleLessons,
} = require('../services/courseStatsService');
const {
  capProgressSeconds,
  buildLessonProgress,
  buildWatchHistoryMap,
  computeCourseProgress,
  attachLessonWatchProgress,
} = require('../services/watchProgressService');
const { pipeS3VideoToResponse } = require('../services/streamPlaybackService');
const { generatePlaybackToken, verifyPlaybackToken, resolveJwtExpiresIn } = require('../services/tokenService');
const {
  resolvePlaybackVideoKey,
  queueVideoOptimization,
  maybeQueueExistingVideo,
} = require('../services/videoProcessingService');

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

const PLAYBACK_EXPIRES_SEC = () => {
  const raw = resolveJwtExpiresIn(process.env.PLAYBACK_TOKEN_EXPIRES_IN, '4h');
  if (typeof raw === 'number') return raw;
  if (raw.endsWith('h')) return parseInt(raw, 10) * 3600;
  if (raw.endsWith('m')) return parseInt(raw, 10) * 60;
  if (raw.endsWith('d')) return parseInt(raw, 10) * 86400;
  if (raw.endsWith('s')) return parseInt(raw, 10);
  return parseInt(raw, 10) || 14400;
};

const buildPlaybackStreamUrl = (lessonId, token, req) => {
  let apiBase = (process.env.API_URL || '').replace(/\/$/, '');
  if (!apiBase && req) {
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const host = req.get('x-forwarded-host') || req.get('host');
    if (host) apiBase = `${proto}://${host}`;
  }
  if (!apiBase) {
    throw new Error('API_URL is not configured');
  }
  const path = `/api/v1/lessons/${lessonId}/play?token=${encodeURIComponent(token)}`;
  return `${apiBase}${path}`;
};

/** Returns direct S3 URL + API proxy URL. All clients should use preferredUrl. */
const buildLessonStreamUrls = async (lesson, req, userId, options = {}) => {
  const playbackKey = await resolvePlaybackVideoKey(lesson);
  if (!playbackKey) throw new Error('No video uploaded');

  maybeQueueExistingVideo(lesson);

  const { streamUrl, expires } = await s3Service.getPresignedStreamUrl(playbackKey, EXPIRY());
  let proxyUrl = null;
  let proxyExpires = null;
  try {
    const token = generatePlaybackToken(userId, lesson._id, lesson.course, {
      isFree: Boolean(options.isFree),
      isAdmin: Boolean(options.isAdmin),
    });
    proxyUrl = buildPlaybackStreamUrl(lesson._id, token, req);
    proxyExpires = Math.floor(Date.now() / 1000) + PLAYBACK_EXPIRES_SEC();
  } catch (err) {
    console.error('Proxy playback token error:', err.message);
  }
  const preferredUrl = proxyUrl || streamUrl;
  return { streamUrl, expires, proxyUrl, proxyExpires, preferredUrl };
};

const afterVideoUploaded = (lesson) => {
  if (lesson?._id) queueVideoOptimization(lesson._id);
};

/** Attach playback URLs to a lesson object (videoUrl = preferredUrl for Android/web compatibility). */
const attachLessonVideoUrls = async (lessonData, req, options = {}) => {
  const { isAdmin = false, hasCourseAccess = false } = options;
  const userId = req.user?._id;

  if (!lessonData.videoKey || !userId) {
    delete lessonData.videoKey;
    delete lessonData.streamVideoKey;
    return;
  }

  if (lessonData.isLocked && !lessonData.isFree) {
    delete lessonData.videoKey;
    delete lessonData.streamVideoKey;
    return;
  }

  normalizeLessonFlags(lessonData);

  const canPlay = isAdmin || lessonData.isFree || hasCourseAccess;
  if (!canPlay) {
    delete lessonData.videoKey;
    delete lessonData.streamVideoKey;
    return;
  }

  const useFreeToken = Boolean(lessonData.isFree) && !hasCourseAccess && !isAdmin;

  try {
    const urls = await buildLessonStreamUrls(lessonData, req, userId, {
      isAdmin,
      isFree: useFreeToken,
    });
    lessonData.videoUrl = urls.preferredUrl || urls.proxyUrl || urls.streamUrl || null;
    lessonData.preferredUrl = urls.preferredUrl;
    lessonData.proxyUrl = urls.proxyUrl;
    lessonData.streamUrl = urls.streamUrl;
    lessonData.streamExpires = urls.expires;
    lessonData.proxyExpires = urls.proxyExpires;
  } catch {
    lessonData.videoUrl = await safeSignedUrl(lessonData.videoKey, EXPIRY()) || null;
  }

  delete lessonData.videoKey;
  delete lessonData.streamVideoKey;
};

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

const normalizeLessonFlags = (lesson) => {
  lesson.isFree = lesson.isFree === true || lesson.isFree === 'true';
  lesson.isPublished = lesson.isPublished === true || lesson.isPublished === 'true';
  return lesson;
};

/** Final-lesson review applies only to the last paid lesson for enrolled students — never free previews. */
const applyFinalLessonFlags = (lesson, { lastLessonId, review, hasCourseAccess = false }) => {
  normalizeLessonFlags(lesson);
  const isFinalLesson = lastLessonId && lesson._id.toString() === lastLessonId;
  lesson.isFinalLesson = Boolean(isFinalLesson);
  const needsReviewGate = Boolean(isFinalLesson && !lesson.isFree && !review);
  lesson.requiresReview = needsReviewGate;
  lesson.isLocked = Boolean(needsReviewGate && hasCourseAccess);
  return lesson;
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
      if (!isAdmin) {
        obj.totalLessons = c.totalLessons;
        obj.totalDuration = c.totalDuration;
      } else {
        obj.publishedLessons = c.totalLessons;
        obj.publishedDuration = c.totalDuration;
        obj.totalLessonsAll = await Lesson.countDocuments({ course: c._id });
      }
      await attachCourseAccess(obj, req.user);
      await attachCourseRating(obj);
      return obj;
    })
  );

  res.json({ success: true, data, pagination: { total, page: +page, limit: +limit } });
};

// GET /courses/my-learning — active enrolled courses for current user
exports.getMyLearning = async (req, res) => {
  await CoursePurchase.updateMany(
    { user: req.user._id, status: 'active', endDate: { $lt: new Date() } },
    { status: 'expired' }
  );

  const purchases = await CoursePurchase.find({
    user: req.user._id,
    status: 'active',
    endDate: { $gte: new Date() },
  })
    .populate({
      path: 'course',
      match: { isPublished: true },
    })
    .sort({ endDate: -1 });

  const user = await User.findById(req.user._id).select('watchHistory');
  const watchHistory = user?.watchHistory || [];

  const now = Date.now();
  const data = [];

  for (const purchase of purchases) {
    if (!purchase.course) continue;

    const courseObj = purchase.course.toObject();
    if (courseObj.thumbnailKey) {
      courseObj.thumbnail = await safeSignedUrl(courseObj.thumbnailKey, EXPIRY()) || courseObj.thumbnail;
    }
    delete courseObj.thumbnailKey;
    delete courseObj.priceTiers;

    await attachCourseRating(courseObj);

    const publishedModuleIds = await Module.find({
      course: courseObj._id,
      isPublished: true,
    }).distinct('_id');

    const publishedLessons = publishedModuleIds.length
      ? await Lesson.find({
          course: courseObj._id,
          module: { $in: publishedModuleIds },
          isPublished: true,
        }).select('_id duration')
      : [];

    const courseProgress = computeCourseProgress(watchHistory, publishedLessons);

    const daysRemaining = Math.max(
      0,
      Math.ceil((new Date(purchase.endDate).getTime() - now) / (1000 * 60 * 60 * 24))
    );

    data.push({
      enrollment: {
        purchaseId: purchase._id,
        status: purchase.status,
        startDate: purchase.startDate,
        endDate: purchase.endDate,
        months: purchase.months,
        daysRemaining,
      },
      course: courseObj,
      progress: {
        watchedLessons: courseProgress.watchedLessons,
        totalLessons: courseProgress.totalLessons,
        percentComplete: courseProgress.percentComplete,
        watchedDuration: courseProgress.watchedDuration,
        totalDuration: courseProgress.totalDuration,
        lastWatchedAt: courseProgress.lastWatchedAt,
        lastLessonId: courseProgress.lastLessonId,
      },
    });
  }

  res.json({ success: true, data, total: data.length });
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
      modObj.totalLessons = await countModuleLessons(mod._id, { includeUnpublished: isAdmin });
      if (isAdmin) {
        modObj.publishedLessons = await countModuleLessons(mod._id, { includeUnpublished: false });
      }
      return modObj;
    })
  );

  const courseObj = course.toObject();
  if (!isAdmin) {
    courseObj.totalLessons = course.totalLessons;
    courseObj.totalDuration = course.totalDuration;
  } else {
    courseObj.publishedLessons = course.totalLessons;
    courseObj.publishedDuration = course.totalDuration;
    courseObj.totalLessonsAll = await Lesson.countDocuments({ course: course._id });
  }
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
  const hasCourseAccess = Boolean(isAdmin || courseObj.access?.hasAccess);
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

  let watchMap = new Map();
  if (req.user && !isAdmin) {
    const whUser = await User.findById(req.user._id).select('watchHistory');
    watchMap = buildWatchHistoryMap(whUser?.watchHistory || []);
  }

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
        applyFinalLessonFlags(lessonObj, { lastLessonId, review, hasCourseAccess });
        if (!isAdmin) {
          attachLessonWatchProgress(lessonObj, watchMap.get(lessonObj._id.toString()));
        }
        return lessonObj;
      });
      modObj.totalLessons = lessons.length;
      if (isAdmin) {
        modObj.publishedLessons = await countModuleLessons(mod._id, { includeUnpublished: false });
      }
      return modObj;
    })
  );

  if (!isAdmin) {
    courseObj.totalLessons = course.totalLessons;
    courseObj.totalDuration = course.totalDuration;
    const allLessonIds = modulesWithLessons.flatMap((m) => (m.lessons || []).map((l) => l._id));
    const publishedForProgress = allLessonIds.length
      ? await Lesson.find({ _id: { $in: allLessonIds } }).select('_id duration')
      : [];
    const courseProgress = computeCourseProgress(
      watchMap.size ? [...watchMap.values()] : [],
      publishedForProgress
    );
    courseObj.courseProgress = {
      percentComplete: courseProgress.percentComplete,
      watchedLessons: courseProgress.watchedLessons,
      totalLessons: courseProgress.totalLessons,
      lastLessonId: courseProgress.lastLessonId,
    };
  } else {
    courseObj.publishedLessons = course.totalLessons;
    courseObj.publishedDuration = course.totalDuration;
    courseObj.totalLessonsAll = await Lesson.countDocuments({ course: course._id });
  }

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
  const data = course.toObject();
  if (req.user?.role === 'admin') {
    data.publishedLessons = course.totalLessons;
    data.publishedDuration = course.totalDuration;
    data.totalLessonsAll = await Lesson.countDocuments({ course: course._id });
  }
  res.json({ success: true, data });
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
      modObj.totalLessons = await countModuleLessons(mod._id, { includeUnpublished: isAdmin });
      if (isAdmin) {
        modObj.publishedLessons = await countModuleLessons(mod._id, { includeUnpublished: false });
      }
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
  if (isAdmin) {
    moduleObj.publishedLessons = await countModuleLessons(module._id, { includeUnpublished: false });
  }

  res.json({ success: true, data: moduleObj });
};

// POST /courses/:courseId/modules
exports.createModule = async (req, res) => {
  // Auto-calculate order: next number after the highest existing order in this course
  const lastModule = await Module.findOne({ course: req.params.courseId })
    .sort({ order: -1 })
    .select('order');
  const nextOrder = (lastModule?.order ?? -1) + 1;

  // Auto-set scheduledAt to now if not provided
  const scheduledAt = req.body.scheduledAt || new Date();

  const module = await Module.create({
    ...req.body,
    order: nextOrder,
    scheduledAt,
    course: req.params.courseId,
  });
  await recalculateCourseStats(req.params.courseId);
  res.status(201).json({ success: true, data: module });
};

// PUT /modules/:id
exports.updateModule = async (req, res) => {
  const module = await Module.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!module) return res.status(404).json({ success: false, message: 'Module not found' });
  await recalculateCourseStats(module.course);
  res.json({ success: true, data: module });
};

// DELETE /modules/:id
exports.deleteModule = async (req, res) => {
  const module = await Module.findById(req.params.id);
  if (!module) return res.status(404).json({ success: false, message: 'Module not found' });

  const lessons = await Lesson.find({ module: req.params.id });
  await Promise.all(
    lessons
      .filter((l) => l.videoKey)
      .map((l) => s3Service.deleteFromS3(l.videoKey).catch(() => {}))
  );
  await Lesson.deleteMany({ module: req.params.id });
  await Module.findByIdAndDelete(req.params.id);
  await recalculateCourseStats(module.course);
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

  let hasCourseAccess = isAdmin;
  if (!isAdmin && courseId && req.user?._id) {
    hasCourseAccess = Boolean(await hasActiveCoursePurchase(req.user._id, courseId));
  }

  for (let i = 0; i < lessonsData.length; i++) {
    applyFinalLessonFlags(lessonsData[i], { lastLessonId, review, hasCourseAccess });
    await attachLessonVideoUrls(lessonsData[i], req, { isAdmin, hasCourseAccess });
  }

  res.json({ success: true, data: lessonsData });
};

// GET /lessons/:id
exports.getLessonById = async (req, res) => {
  const lesson = await Lesson.findById(req.params.id).select('-videoKey -videoBucket');
  if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });

  // Admin bypasses all access checks
  if (req.user?.role !== 'admin') {
    const lessonObj = lesson.toObject();
    normalizeLessonFlags(lessonObj);

    const purchase = await hasActiveCoursePurchase(req.user._id, lesson.course);
    if (!purchase && !lessonObj.isFree) {
      return res.status(403).json({ success: false, message: 'Active course purchase required to access this lesson' });
    }

    if (purchase && !lessonObj.isFree) {
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
  }

  res.json({ success: true, data: lesson });
};

// POST /modules/:moduleId/lessons
exports.createLesson = async (req, res) => {
  const module = await Module.findById(req.params.moduleId);
  if (!module) return res.status(404).json({ success: false, message: 'Module not found' });

  // Auto-calculate order: next number after the highest existing order in this module
  const lastLesson = await Lesson.findOne({ module: module._id })
    .sort({ order: -1 })
    .select('order');
  const nextOrder = (lastLesson?.order ?? -1) + 1;

  // Auto-set scheduledAt to now if not provided
  const scheduledAt = req.body.scheduledAt || new Date();

  const lesson = await Lesson.create({
    ...req.body,
    order: nextOrder,
    scheduledAt,
    module: module._id,
    course: module.course,
  });

  await recalculateAfterLessonChange(lesson);

  res.status(201).json({ success: true, data: lesson });
};

// PUT /lessons/:id
exports.updateLesson = async (req, res) => {
  const lesson = await Lesson.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });
  await recalculateAfterLessonChange(lesson);
  res.json({ success: true, data: lesson });
};

// DELETE /lessons/:id
exports.deleteLesson = async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });

  if (lesson.videoKey) {
    try { await s3Service.deleteFromS3(lesson.videoKey); } catch {}
  }
  if (lesson.streamVideoKey && lesson.streamVideoKey !== lesson.videoKey) {
    try { await s3Service.deleteFromS3(lesson.streamVideoKey); } catch {}
  }
  await Lesson.findByIdAndDelete(req.params.id);
  await recalculateAfterLessonChange(lesson);
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
  existing.streamVideoKey = undefined;
  await existing.save();

  await recalculateAfterLessonChange(existing);
  afterVideoUploaded(existing);

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
  if (lesson.streamVideoKey && lesson.streamVideoKey !== lesson.videoKey) {
    try { await s3Service.deleteFromS3(lesson.streamVideoKey); } catch {}
  }

  // req.file comes from s3StreamStorage — already uploaded to S3 via multipart streaming
  // No disk writes, no full memory buffer — streamed directly in 10MB chunks
  const { key, size } = req.file;

  // Get duration from form data (sent from frontend)
  const newDuration = req.body.duration ? parseInt(req.body.duration) : 0;

  // Update lesson with video key, size and duration
  lesson.videoKey = key;
  lesson.uploadStatus = 'ready';
  lesson.videoSize = size;
  lesson.duration = newDuration;
  lesson.streamVideoKey = undefined;
  await lesson.save();

  await recalculateAfterLessonChange(lesson);
  afterVideoUploaded(lesson);

  res.json({ success: true, message: 'Video uploaded to S3 successfully', data: { lessonId, key, lesson } });
};

// ════════════════════════════════════════════════════════════════
// DIRECT BROWSER-TO-S3 MULTIPART UPLOAD (like YouTube)
// ════════════════════════════════════════════════════════════════
// POST /videos/direct-multipart/init
// Body: { lessonId, filename, fileSize, contentType }
//
// The browser splits the file into chunks and uploads each chunk directly
// to S3 via presigned URLs. This bypasses the server entirely for upload
// data — as fast as the user's internet allows.
exports.initDirectMultipartUpload = async (req, res) => {
  const { lessonId, filename, fileSize, contentType } = req.body;
  if (!lessonId || !filename || !fileSize) {
    return res.status(400).json({ success: false, message: 'lessonId, filename, and fileSize are required' });
  }

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });

  const key = `videos/${lesson.course}/${lessonId}/${require('uuid').v4()}-${filename}`;
  const mimetype = contentType || 'video/mp4';

  const result = await s3Service.initMultipartUploadToS3(key, mimetype, fileSize, {
    originalName: filename,
    lessonId,
  });

  // Store uploadId in lesson for tracking
  lesson.videoKey = key;
  lesson.uploadStatus = 'uploading';
  await lesson.save();

  res.json({
    success: true,
    data: {
      uploadId: result.UploadId,
      key: result.key,
      partUrls: result.partUrls,
      numParts: result.numParts,
      partSize: result.partSize,
    },
  });
};

// POST /videos/direct-multipart/complete
// Body: { lessonId, key, uploadId, parts: [{ ETag, PartNumber }], duration }
exports.completeDirectMultipartUpload = async (req, res) => {
  const { lessonId, key, uploadId, parts, duration } = req.body;
  if (!lessonId || !key || !uploadId || !parts) {
    return res.status(400).json({ success: false, message: 'lessonId, key, uploadId, and parts are required' });
  }

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });

  const oldDuration = lesson.duration || 0;
  const newDuration = Number(duration) || 0;

  try {
    await s3Service.completeMultipartUploadToS3(key, uploadId, parts);

    // Update lesson
    lesson.videoKey = key;
    lesson.uploadStatus = 'ready';
    lesson.duration = newDuration;
    lesson.streamVideoKey = undefined;
    await lesson.save();

    await recalculateAfterLessonChange(lesson);
    afterVideoUploaded(lesson);

    res.json({ success: true, message: 'Video uploaded to S3 successfully', data: { lessonId, key, lesson } });
  } catch (err) {
    // Abort on failure
    await s3Service.abortMultipartUploadToS3(key, uploadId).catch(() => {});
    throw err;
  }
};

// POST /videos/direct-multipart/abort
// Body: { key, uploadId }
exports.abortDirectMultipartUpload = async (req, res) => {
  const { key, uploadId } = req.body;
  if (!key || !uploadId) {
    return res.status(400).json({ success: false, message: 'key and uploadId are required' });
  }
  await s3Service.abortMultipartUploadToS3(key, uploadId);
  res.json({ success: true, message: 'Upload aborted' });
};

// ════════════════════════════════════════════════════════════════
// VIDEO IMPORT FROM URL (Google Drive, direct links, etc.)
// ════════════════════════════════════════════════════════════════
// POST /videos/import-url/:lessonId
// Body: { url: "https://drive.google.com/..." }
//
// The server downloads the file from the URL and uploads it to S3 using
// streaming multipart upload. This avoids tying up the admin's browser
// connection and is ideal for files >5GB.

/**
 * Convert various URL formats to a direct downloadable URL.
 * Handles Google Drive share links by extracting the file ID and
 * using the direct download endpoint.
 */
const resolveDownloadUrl = (inputUrl) => {
  const { URL: UrlParser } = require('url');

  // --- Google Drive ---
  // Pattern: https://drive.google.com/file/d/FILE_ID/view
  // Pattern: https://drive.google.com/uc?id=FILE_ID
  // Pattern: https://drive.google.com/open?id=FILE_ID
  const gDriveMatch = inputUrl.match(
    /drive\.google\.com\/(?:file\/d\/|uc\?id=|open\?id=)([a-zA-Z0-9_-]+)/
  );
  if (gDriveMatch) {
    const fileId = gDriveMatch[1];
    // Use the export download endpoint — this works for files up to ~5GB
    // For larger files, Google shows a virus scan confirmation page.
    // We handle that by checking the response content-type below.
    return {
      url: `https://drive.google.com/uc?export=download&id=${fileId}`,
      isGoogleDrive: true,
      fileId,
    };
  }

  // --- Direct URL (any other link) ---
  return { url: inputUrl, isGoogleDrive: false, fileId: null };
};

/**
 * Download from a URL that may require handling Google Drive's
 * virus scan confirmation page for large files.
 * Returns a readable stream.
 */
const createDownloadStream = (url, isGoogleDrive, jobId) => {
  const https = require('https');
  const http = require('http');
  const { URL: UrlParser } = require('url');

  return new Promise((resolve, reject) => {
    const parsedUrl = new UrlParser(url);
    const httpModule = parsedUrl.protocol === 'https:' ? https : http;

    const doRequest = (targetUrl) => {
      const parsed = new UrlParser(targetUrl);
      const mod = parsed.protocol === 'https:' ? https : http;

      mod.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          const redirectUrl = new UrlParser(response.headers.location, targetUrl).href;
          doRequest(redirectUrl);
          return;
        }

        // Google Drive: handle virus scan confirmation page
        // When the file is large (>100MB), Google shows a "Virus scan warning" page
        // with a form containing hidden inputs: confirm=t, uuid=xxxx.
        // We extract these values and submit the form to get the actual file.
        if (isGoogleDrive && response.headers['content-type']?.includes('text/html')) {
          let html = '';
          response.on('data', (chunk) => { html += chunk.toString(); });
          response.on('end', () => {
            // Extract hidden input values from the form
            const idMatch = html.match(/name="id"\s+value="([^"]+)"/);
            const confirmMatch = html.match(/name="confirm"\s+value="([^"]+)"/);
            const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/);
            const actionMatch = html.match(/action="([^"]+)"/);

            if (confirmMatch && idMatch) {
              const actionUrl = actionMatch ? actionMatch[1] : 'https://drive.usercontent.google.com/download';
              const confirmUrl = `${actionUrl}?id=${idMatch[1]}&export=download&confirm=${confirmMatch[1]}${uuidMatch ? '&uuid=' + uuidMatch[1] : ''}`;
              doRequest(confirmUrl);
            } else {
              // Check if it's the Google Drive file viewer page (not a download link)
              if (html.includes('Google Drive - Virus scan warning')) {
                reject(new Error('Google Drive requires virus scan confirmation for this file. The server attempted to bypass it but failed. Try using a direct file hosting service instead.'));
              } else {
                reject(new Error('Google Drive returned HTML instead of file. Make sure the file is shared with "Anyone with the link".'));
              }
            }
          });
          return;
        }

        // Check if we got HTML instead of a file (non-Google Drive)
        if (response.headers['content-type']?.includes('text/html')) {
          reject(new Error('URL returned HTML instead of a video file. Use a direct download link.'));
          return;
        }

        resolve(response);
      }).on('error', reject);
    };

    doRequest(url);
  });
};

exports.importVideoFromUrl = async (req, res) => {
  const { lessonId } = req.params;
  const { url, duration } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, message: 'URL is required' });
  }

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });

  // Resolve the URL (handle Google Drive, etc.)
  const resolved = resolveDownloadUrl(url);

  // Start the import asynchronously — respond immediately with a job ID
  const jobId = `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Store job info in memory (for simplicity; in production use Redis/DB)
  if (!global.importJobs) global.importJobs = new Map();
  global.importJobs.set(jobId, {
    status: 'downloading',
    progress: 0,
    lessonId,
    url,
    resolvedUrl: resolved.url,
    isGoogleDrive: resolved.isGoogleDrive,
    startedAt: new Date(),
  });

  // Execute the download + upload in the background
  const path = require('path');

  (async () => {
    try {
      const {
        S3Client,
        CreateMultipartUploadCommand,
        UploadPartCommand,
        CompleteMultipartUploadCommand,
        AbortMultipartUploadCommand,
      } = require('@aws-sdk/client-s3');
      const { NodeHttpHandler } = require('@smithy/node-http-handler');

      const s3 = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
        requestHandler: new NodeHttpHandler({
          connectionTimeout: 300_000,
          requestTimeout: 300_000,
          socketTimeout: 300_000,
        }),
        maxAttempts: 3,
      });

      const bucket = process.env.AWS_S3_BUCKET;
      const partSize = 50 * 1024 * 1024; // 50MB
      const concurrency = 5;

      // Determine file extension from URL or default to .mp4
      const parsedUrl = new URL(resolved.url);
      let ext = path.extname(parsedUrl.pathname);
      if (!ext || ext.length > 6) ext = '.mp4';
      const key = `videos/${lessonId}/${require('uuid').v4()}${ext}`;

      // Initiate S3 multipart upload
      const { UploadId } = await s3.send(new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: 'video/mp4',
        Metadata: { originalName: url, importedFrom: url },
        ServerSideEncryption: 'AES256',
      }));

      const uploadedParts = [];
      let partNumber = 0;
      let totalBytes = 0;
      const activeUploads = new Set();

      const uploadPart = async (partBuf, partNum) => {
        const { ETag } = await s3.send(new UploadPartCommand({
          Bucket: bucket, Key: key, PartNumber: partNum, UploadId, Body: partBuf,
        }));
        uploadedParts.push({ ETag, PartNumber: partNum });
        totalBytes += partBuf.length;
      };

      const dispatchUpload = (partBuf, partNum) => {
        const promise = uploadPart(partBuf, partNum).finally(() => activeUploads.delete(promise));
        activeUploads.add(promise);
      };

      const waitForAllUploads = async () => {
        if (activeUploads.size > 0) await Promise.all(activeUploads);
      };

      // Download the file using the smart downloader (handles Google Drive confirm page)
      const stream = await createDownloadStream(resolved.url, resolved.isGoogleDrive, jobId);
      const contentLength = parseInt(stream.headers['content-length'] || '0', 10);

      // Update job with content info
      const initJob = global.importJobs.get(jobId);
      if (initJob) {
        initJob.contentLength = contentLength;
        initJob.message = `Downloading from ${resolved.isGoogleDrive ? 'Google Drive' : 'URL'}...`;
      }

      // Stream the download to S3 multipart upload
      await new Promise((resolve, reject) => {
        let currentChunk = Buffer.alloc(0);
        let downloadedBytes = 0;

        stream.on('data', (chunk) => {
          currentChunk = Buffer.concat([currentChunk, chunk]);
          downloadedBytes += chunk.length;

          // Update progress (0-50% = download phase)
          const job = global.importJobs.get(jobId);
          if (job) {
            job.downloadedBytes = downloadedBytes;
            if (contentLength > 0) {
              job.progress = Math.min(50, Math.round((downloadedBytes / contentLength) * 50));
            } else {
              // No content-length — show indeterminate progress
              job.progress = Math.min(49, Math.round((downloadedBytes / (50 * 1024 * 1024)) * 5));
            }
          }

          // Flush complete parts to S3
          while (currentChunk.length >= partSize) {
            partNumber++;
            const partBuffer = currentChunk.subarray(0, partSize);
            currentChunk = currentChunk.subarray(partSize);
            dispatchUpload(partBuffer, partNumber);
          }
        });

        stream.on('end', async () => {
          try {
            // Mark download complete
            const job = global.importJobs.get(jobId);
            if (job) {
              job.status = 'uploading';
              job.progress = 50;
              job.message = 'Uploading to S3...';
            }

            await waitForAllUploads();

            // Upload final chunk
            if (currentChunk.length > 0) {
              partNumber++;
              await uploadPart(currentChunk, partNumber);
            }

            if (uploadedParts.length === 0) {
              await uploadPart(Buffer.alloc(0), 1);
            }

            // Complete multipart upload
            await s3.send(new CompleteMultipartUploadCommand({
              Bucket: bucket, Key: key, UploadId,
              MultipartUpload: { Parts: uploadedParts },
            }));

            // Update lesson in DB
            const newDuration = duration ? parseInt(duration) : 0;
            lesson.videoKey = key;
            lesson.uploadStatus = 'ready';
            lesson.videoSize = totalBytes;
            lesson.duration = newDuration;
            lesson.streamVideoKey = undefined;
            await lesson.save();
            await recalculateAfterLessonChange(lesson);
            afterVideoUploaded(lesson);

            if (job) {
              job.status = 'completed';
              job.progress = 100;
              job.key = key;
              job.size = totalBytes;
              job.message = 'Import complete!';
            }

            resolve();
          } catch (err) {
            try { await s3.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId })); } catch {}
            const failedJob = global.importJobs.get(jobId);
            if (failedJob) { failedJob.status = 'failed'; failedJob.error = err.message; }
            reject(err);
          }
        });

        stream.on('error', async (err) => {
          try { await s3.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId })); } catch {}
          const failedJob = global.importJobs.get(jobId);
          if (failedJob) { failedJob.status = 'failed'; failedJob.error = err.message; }
          reject(err);
        });
      });
    } catch (err) {
      console.error('Import error:', err);
      const job = global.importJobs.get(jobId);
      if (job) { job.status = 'failed'; job.error = err.message; }
    }
  })();

  res.json({
    success: true,
    message: 'Video import started. Use the jobId to track progress.',
    data: { jobId, lessonId },
  });
};

// GET /videos/import-status/:jobId
exports.getImportStatus = async (req, res) => {
  const { jobId } = req.params;
  if (!global.importJobs || !global.importJobs.has(jobId)) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }
  res.json({ success: true, data: global.importJobs.get(jobId) });
};

// ════════════════════════════════════════════════════════════════
// VIDEO STREAMING
// ════════════════════════════════════════════════════════════════

// GET /lessons/:lessonId/play — byte-range video stream (token from /stream endpoint)
exports.playLessonVideo = async (req, res) => {
  const { lessonId } = req.params;
  const token = req.query.token;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Playback token required' });
  }

  let decoded;
  try {
    decoded = verifyPlaybackToken(token);
  } catch (err) {
    return res.status(401).json({
      success: false,
      message:
        err.name === 'TokenExpiredError'
          ? 'Playback session expired. Please reopen the lesson.'
          : 'Invalid playback token',
    });
  }

  if (decoded.lessonId !== lessonId) {
    return res.status(403).json({ success: false, message: 'Token does not match lesson' });
  }

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) {
    return res.status(404).json({ success: false, message: 'Lesson not found' });
  }
  if (!decoded.isAdmin && !lesson.isPublished) {
    return res.status(404).json({ success: false, message: 'Lesson not found' });
  }
  if (!lesson.videoKey) {
    return res.status(400).json({ success: false, message: 'No video uploaded for this lesson' });
  }

  if (decoded.isAdmin) {
    // Admin preview — no purchase check
  } else if (decoded.isFree) {
    if (!lesson.isFree) {
      return res.status(403).json({ success: false, message: 'This lesson is not free' });
    }
  } else {
    const purchase = await hasActiveCoursePurchase(decoded.id, lesson.course);
    if (!purchase) {
      return res.status(403).json({ success: false, message: 'Active course purchase required' });
    }

    const lastLessonId = await getLastPublishedLessonId(lesson.course);
    if (lastLessonId && lesson._id.toString() === lastLessonId) {
      const review = await CourseReview.findOne({ user: decoded.id, course: lesson.course });
      if (!review) {
        return res.status(403).json({ success: false, message: 'Review required for final lesson' });
      }
    }
  }

  try {
    const keysToTry = [];
    const preferred = await resolvePlaybackVideoKey(lesson);
    if (preferred) keysToTry.push(preferred);
    if (lesson.videoKey && !keysToTry.includes(lesson.videoKey)) {
      keysToTry.push(lesson.videoKey);
    }

    let lastErr = null;
    for (const key of keysToTry) {
      try {
        await pipeS3VideoToResponse(key, req, res);
        return;
      } catch (err) {
        lastErr = err;
        const missing =
          err.name === 'NoSuchKey' ||
          err.Code === 'NoSuchKey' ||
          err.$metadata?.httpStatusCode === 404;
        if (!missing || res.headersSent) break;
        console.warn(`Video key missing, trying fallback: ${key}`);
      }
    }

    console.error('Video stream error:', lastErr?.message || 'unknown');
    if (!res.headersSent) {
      res.status(404).json({ success: false, message: 'Video file not found in storage. Please re-upload.' });
    }
  } catch (err) {
    console.error('Video stream error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to stream video' });
    }
  }
};

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

  // Anti-piracy logging only — no auto-suspend on web playback
  const { isSuspicious, uniqueIPs } = await detectAbnormalPlayback(userId, ip);
  if (isSuspicious) {
    await SecurityLog.create({
      user: userId, event: 'suspicious_activity', ip, severity: 'warning',
      details: { lessonId: lesson._id, uniqueIPsLastHour: uniqueIPs },
    });
  }

  let streamUrl;
  let expires;
  let proxyUrl;
  let proxyExpires;
  let preferredUrl;
  try {
    ({ streamUrl, expires, proxyUrl, proxyExpires, preferredUrl } = await buildLessonStreamUrls(
      lesson,
      req,
      userId,
      { isFree: false, isAdmin: req.user?.role === 'admin' }
    ));
  } catch (err) {
    console.error('Stream URL error:', err.message);
    return res.status(500).json({ success: false, message: 'Unable to prepare video stream. Please try again.' });
  }

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
      proxyUrl,
      preferredUrl,
      expires,
      proxyExpires,
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

  let streamUrl;
  let expires;
  let proxyUrl;
  let proxyExpires;
  let preferredUrl;
  try {
    ({ streamUrl, expires, proxyUrl, proxyExpires, preferredUrl } = await buildLessonStreamUrls(
      lesson,
      req,
      req.user._id,
      { isFree: true }
    ));
  } catch (err) {
    console.error('Free stream URL error:', err.message);
    return res.status(500).json({ success: false, message: 'Unable to prepare video stream. Please try again.' });
  }

  Lesson.findByIdAndUpdate(lesson._id, { $inc: { totalViews: 1 } }).catch(() => {});

  res.json({
    success: true,
    data: {
      streamUrl,
      proxyUrl,
      preferredUrl,
      expires,
      proxyExpires,
      lessonTitle: lesson.title,
      duration: lesson.duration,
      isFree: true,
    },
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
    severity: 'warning',
    details: { lessonId, reportedByDevice: true },
  });

  res.json({
    success: true,
    message: 'Security event recorded',
    action: 'logged',
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

  const lesson = await Lesson.findById(lessonId).select('duration course');
  if (!lesson) {
    return res.status(404).json({ success: false, message: 'Lesson not found' });
  }

  const cappedProgress = capProgressSeconds(progress, lesson.duration);

  const user = await User.findById(req.user._id);
  const idx = user.watchHistory.findIndex((h) => h.lesson.toString() === lessonId);

  if (idx >= 0) {
    user.watchHistory[idx].progress = cappedProgress;
    user.watchHistory[idx].watchedAt = new Date();
  } else {
    user.watchHistory.push({ lesson: lessonId, progress: cappedProgress });
  }
  await user.save();

  const watchProgress = buildLessonProgress(cappedProgress, lesson.duration);
  res.json({
    success: true,
    message: 'Watch history updated',
    data: {
      lessonId,
      ...watchProgress,
      watchedAt: new Date(),
    },
  });
};

// GET /watch-history
exports.getWatchHistory = async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate({
      path: 'watchHistory.lesson',
      select: 'title duration course module order isFree uploadStatus',
    })
    .select('watchHistory');

  const sorted = [...(user?.watchHistory || [])].sort(
    (a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime()
  );

  const data = sorted.map((entry) => {
    const obj = entry.toObject ? entry.toObject() : { ...entry };
    const duration = obj.lesson?.duration || 0;
    obj.watchProgress = buildLessonProgress(obj.progress, duration);
    return obj;
  });

  res.json({ success: true, data });
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
