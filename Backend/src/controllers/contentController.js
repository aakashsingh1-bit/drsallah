const { Course, Module, Lesson } = require('../models/Content');
const User = require('../models/User');
const SecurityLog = require('../models/SecurityLog');
const {
  getPresignedStreamUrl,
  getVideoUploadUrl,
  uploadThumbnail,
  deleteFromS3,
  generateS3Key,
  uploadToS3,
} = require('../services/s3Service');
const { analyzeUserBehavior, detectAbnormalPlayback } = require('../services/antiPiracyService');

// ──────────────────── COURSES ─────────────────────────────────────────────────

exports.getAllCourses = async (req, res) => {
  const { page = 1, limit = 10, search, category } = req.query;
  const isAdmin = req.user?.role === 'admin';
  const filter = isAdmin ? {} : { isPublished: true };
  if (search) filter.title = { $regex: search, $options: 'i' };
  if (category) filter.category = category;

  const courses = await Course.find(filter)
    .sort({ order: 1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Course.countDocuments(filter);

  // Generate signed URLs for thumbnails
  const expirySeconds = parseInt(process.env.SIGNED_URL_EXPIRY) || 3600;
  const coursesWithThumbnails = await Promise.all(courses.map(async (course) => {
    const courseObj = course.toObject();
    if (courseObj.thumbnailKey) {
      try {
        const { streamUrl } = await getPresignedStreamUrl(courseObj.thumbnailKey, expirySeconds);
        courseObj.thumbnail = streamUrl;
      } catch (err) {
        // Keep original thumbnail URL if signed URL fails
      }
    }
    return courseObj;
  }));

  res.json({ success: true, data: coursesWithThumbnails, pagination: { total, page: +page, limit: +limit } });
};

exports.getCourseById = async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

  const filter = { course: course._id };
  if (!isAdmin) filter.isPublished = true;
  const modules = await Module.find(filter).sort({ order: 1 });

  const courseObj = course.toObject();
  const expirySeconds = parseInt(process.env.SIGNED_URL_EXPIRY) || 3600;

  // Generate signed URL for course thumbnail
  if (courseObj.thumbnailKey) {
    try {
      const { streamUrl } = await getPresignedStreamUrl(courseObj.thumbnailKey, expirySeconds);
      courseObj.thumbnail = streamUrl;
    } catch (err) {}
  }

  res.json({ success: true, data: { ...courseObj, modules } });
};

exports.createCourse = async (req, res) => {
  const courseData = { ...req.body };

  // Handle thumbnail upload if file provided
  if (req.file) {
    const result = await uploadThumbnail(req.file.buffer, req.file.originalname);
    courseData.thumbnail = result.url;
    courseData.thumbnailKey = result.key;
  }

  const course = await Course.create(courseData);
  res.status(201).json({ success: true, data: course });
};

exports.updateCourse = async (req, res) => {
  const updateData = { ...req.body };
  if (updateData.isPublished && !updateData.publishedAt) updateData.publishedAt = new Date();

  // Handle thumbnail update
  if (req.file) {
    const existing = await Course.findById(req.params.id);
    if (existing?.thumbnailKey) {
      try { await deleteFromS3(existing.thumbnailKey); } catch (e) { /* ignore */ }
    }
    const result = await uploadThumbnail(req.file.buffer, req.file.originalname);
    updateData.thumbnail = result.url;
    updateData.thumbnailKey = result.key;
  }

  const course = await Course.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
  res.json({ success: true, data: course });
};

exports.deleteCourse = async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

  // Delete thumbnail from S3
  if (course.thumbnailKey) {
    try { await deleteFromS3(course.thumbnailKey); } catch (e) { /* ignore */ }
  }

  // Delete all lesson videos from S3
  const lessons = await Lesson.find({ course: req.params.id });
  for (const lesson of lessons) {
    if (lesson.videoKey) {
      try { await deleteFromS3(lesson.videoKey); } catch (e) { /* ignore */ }
    }
  }

  await Course.findByIdAndDelete(req.params.id);
  await Module.deleteMany({ course: req.params.id });
  await Lesson.deleteMany({ course: req.params.id });
  res.json({ success: true, message: 'Course and all its content deleted' });
};

// ──────────────────── MODULES ─────────────────────────────────────────────────

exports.getModulesByCourse = async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const filter = { course: req.params.courseId };
  if (!isAdmin) filter.isPublished = true;

  const modules = await Module.find(filter).sort({ order: 1 });
  res.json({ success: true, data: modules });
};

exports.createModule = async (req, res) => {
  const module = await Module.create({ ...req.body, course: req.params.courseId });
  res.status(201).json({ success: true, data: module });
};

exports.updateModule = async (req, res) => {
  const module = await Module.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!module) return res.status(404).json({ success: false, message: 'Module not found' });
  res.json({ success: true, data: module });
};

exports.deleteModule = async (req, res) => {
  // Delete lesson videos
  const lessons = await Lesson.find({ module: req.params.id });
  for (const lesson of lessons) {
    if (lesson.videoKey) {
      try { await deleteFromS3(lesson.videoKey); } catch (e) { /* ignore */ }
    }
  }
  await Module.findByIdAndDelete(req.params.id);
  await Lesson.deleteMany({ module: req.params.id });
  res.json({ success: true, message: 'Module and lessons deleted' });
};

exports.reorderModules = async (req, res) => {
  const { orders } = req.body; // [{ id, order }]
  const bulkOps = orders.map(({ id, order }) => ({
    updateOne: { filter: { _id: id }, update: { order } },
  }));
  await Module.bulkWrite(bulkOps);
  res.json({ success: true, message: 'Modules reordered' });
};

// ──────────────────── LESSONS ─────────────────────────────────────────────────

exports.getLessonsByModule = async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const filter = { module: req.params.moduleId };
  if (!isAdmin) filter.isPublished = true;

  let lessons = await Lesson.find(filter).sort({ order: 1 }).select('-videoKey');

  // If admin, include video info with signed URLs
  if (isAdmin) {
    const expirySeconds = parseInt(process.env.SIGNED_URL_EXPIRY) || 3600;
    lessons = await Promise.all(lessons.map(async (lesson) => {
      const lessonObj = lesson.toObject();
      if (lessonObj.videoKey) {
        try {
          const { streamUrl } = await getPresignedStreamUrl(lessonObj.videoKey, expirySeconds);
          lessonObj.videoUrl = streamUrl;
        } catch (err) {}
      }
      return lessonObj;
    }));
  }

  res.json({ success: true, data: lessons });
};

exports.getLessonById = async (req, res) => {
  const lesson = await Lesson.findById(req.params.id).select('-videoKey');
  if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });
  res.json({ success: true, data: lesson });
};

exports.createLesson = async (req, res) => {
  const module = await Module.findById(req.params.moduleId);
  if (!module) return res.status(404).json({ success: false, message: 'Module not found' });

  const lesson = await Lesson.create({ ...req.body, module: module._id, course: module.course });

  await Course.findByIdAndUpdate(module.course, {
    $inc: { totalLessons: 1, totalDuration: req.body.duration || 0 },
  });

  res.status(201).json({ success: true, data: lesson });
};

exports.updateLesson = async (req, res) => {
  const lesson = await Lesson.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });
  res.json({ success: true, data: lesson });
};

exports.deleteLesson = async (req, res) => {
  const lesson = await Lesson.findByIdAndDelete(req.params.id);
  if (lesson) {
    if (lesson.videoKey) {
      try { await deleteFromS3(lesson.videoKey); } catch (e) { /* ignore */ }
    }
    await Course.findByIdAndUpdate(lesson.course, {
      $inc: { totalLessons: -1, totalDuration: -(lesson.duration || 0) },
    });
  }
  res.json({ success: true, message: 'Lesson deleted' });
};

exports.reorderLessons = async (req, res) => {
  const { orders } = req.body; // [{ id, order }]
  const bulkOps = orders.map(({ id, order }) => ({
    updateOne: { filter: { _id: id }, update: { order } },
  }));
  await Lesson.bulkWrite(bulkOps);
  res.json({ success: true, message: 'Lessons reordered' });
};

// ──────────────────── VIDEO UPLOAD (S3) ───────────────────────────────────────

/**
 * Step 1: Admin requests a presigned upload URL
 * Frontend uploads directly to S3 using this URL
 */
exports.getVideoUploadPresignedUrl = async (req, res) => {
  const { lessonId, filename, contentType } = req.body;

  if (!lessonId || !filename) {
    return res.status(400).json({ success: false, message: 'lessonId and filename required' });
  }

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });

  const { uploadUrl, key } = await getVideoUploadUrl(lesson.course, lessonId, filename);

  // Store the pending key on the lesson
  await Lesson.findByIdAndUpdate(lessonId, { videoKey: key, uploadStatus: 'pending' });

  res.json({
    success: true,
    data: {
      uploadUrl,
      key,
      lessonId,
      expiresIn: 7200,
      instructions: 'PUT the video file to uploadUrl with Content-Type: video/mp4',
    },
  });
};

/**
 * Step 2: After upload completes, confirm and update lesson
 */
exports.confirmVideoUpload = async (req, res) => {
  const { lessonId, key, duration } = req.body;

  const lesson = await Lesson.findByIdAndUpdate(
    lessonId,
    {
      videoKey: key,
      uploadStatus: 'ready',
      duration: duration || 0,
      isEncrypted: false, // set true if using DRM
    },
    { new: true }
  );

  if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });

  // Update course total duration
  if (duration) {
    await Course.findByIdAndUpdate(lesson.course, { $inc: { totalDuration: duration } });
  }

  res.json({ success: true, message: 'Video confirmed and lesson updated', data: lesson });
};

/**
 * Direct upload (small files) - multipart/form-data
 */
exports.uploadVideoDirectly = async (req, res) => {
  const { lessonId } = req.params;
  if (!req.file) return res.status(400).json({ success: false, message: 'No video file provided' });

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });

  // Delete old video if exists
  if (lesson.videoKey) {
    try { await deleteFromS3(lesson.videoKey); } catch (e) { /* ignore */ }
  }

  const key = generateS3Key(`videos/${lesson.course}/${lessonId}`, req.file.originalname);
  await uploadToS3(req.file.buffer, key, req.file.mimetype);

  const updated = await Lesson.findByIdAndUpdate(
    lessonId,
    { videoKey: key, uploadStatus: 'ready' },
    { new: true }
  );

  res.json({ success: true, message: 'Video uploaded successfully', data: { lesson: updated, key } });
};

// ──────────────────── SECURE VIDEO STREAM (S3 Presigned) ──────────────────────

exports.getStreamUrl = async (req, res) => {
  const lesson = await Lesson.findById(req.params.lessonId);
  if (!lesson || !lesson.isPublished) {
    return res.status(404).json({ success: false, message: 'Lesson not found or not published' });
  }

  if (!lesson.videoKey) {
    return res.status(400).json({ success: false, message: 'No video uploaded for this lesson' });
  }

  const userId = req.user._id.toString();
  const ip = req.ip;

  // Anti-piracy check
  const { isSuspicious, uniqueIPs } = await detectAbnormalPlayback(userId, ip);
  if (isSuspicious) {
    await analyzeUserBehavior(userId, 'suspicious_activity', { uniqueIPs, ip });
    await SecurityLog.create({
      user: userId, event: 'suspicious_activity', ip,
      severity: 'critical',
      details: { lessonId: lesson._id, uniqueIPsLastHour: uniqueIPs },
    });
  }

  // Generate real S3 presigned streaming URL
  const expirySeconds = parseInt(process.env.SIGNED_URL_EXPIRY) || 3600;
  const { streamUrl, expires } = await getPresignedStreamUrl(lesson.videoKey, expirySeconds);

  // Log
  await SecurityLog.create({
    user: userId, event: 'playback_started', ip,
    deviceId: req.headers['x-device-id'],
    details: { lessonId: lesson._id, title: lesson.title },
  });

  await Lesson.findByIdAndUpdate(lesson._id, { $inc: { totalViews: 1 } });

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

// ──────────────────── THUMBNAIL UPLOAD ────────────────────────────────────────

exports.uploadThumbnail = async (req, res) => {
  const { courseId } = req.params;
  if (!req.file) return res.status(400).json({ success: false, message: 'No image file provided' });

  const course = await Course.findById(courseId);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

  if (course.thumbnailKey) {
    try { await deleteFromS3(course.thumbnailKey); } catch (e) { /* ignore */ }
  }

  const result = await uploadThumbnail(req.file.buffer, req.file.originalname);
  const updated = await Course.findByIdAndUpdate(
    courseId,
    { thumbnail: result.url, thumbnailKey: result.key },
    { new: true }
  );

  res.json({ success: true, data: { url: result.url, course: updated } });
};

// ──────────────────── SECURITY EVENT (from mobile) ────────────────────────────

exports.reportSecurityEvent = async (req, res) => {
  const { event, lessonId } = req.body;
  const allowed = ['screen_record_attempt', 'screenshot_attempt', 'piracy_attempt'];
  if (!allowed.includes(event)) {
    return res.status(400).json({ success: false, message: 'Invalid event type' });
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

// ──────────────────── WATCH HISTORY ───────────────────────────────────────────

exports.updateWatchHistory = async (req, res) => {
  const { lessonId, progress } = req.body;
  const user = await User.findById(req.user._id);
  const histIdx = user.watchHistory.findIndex((h) => h.lesson.toString() === lessonId);

  if (histIdx >= 0) {
    user.watchHistory[histIdx].progress = progress;
    user.watchHistory[histIdx].watchedAt = new Date();
  } else {
    user.watchHistory.push({ lesson: lessonId, progress });
  }
  await user.save();
  res.json({ success: true, message: 'Watch history updated' });
};

exports.getWatchHistory = async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate({ path: 'watchHistory.lesson', select: 'title duration thumbnail course' })
    .select('watchHistory');
  res.json({ success: true, data: user.watchHistory });
};

// ──────────────────── BOOKMARKS ───────────────────────────────────────────────

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
