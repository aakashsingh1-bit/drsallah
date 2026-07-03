const { Course, Module, Lesson } = require('../models/Content');

const publishedLessonFilter = (courseId, moduleIds = null) => {
  const filter = { course: courseId, isPublished: true };
  if (moduleIds) filter.module = { $in: moduleIds };
  return filter;
};

/**
 * Recalculate module.totalLessons = count of published lessons in that module.
 */
const recalculateModuleStats = async (moduleId) => {
  const totalLessons = await Lesson.countDocuments({ module: moduleId, isPublished: true });
  await Module.findByIdAndUpdate(moduleId, { totalLessons });
  return totalLessons;
};

/**
 * Recalculate course.totalLessons / totalDuration from published modules + published lessons only.
 */
const recalculateCourseStats = async (courseId) => {
  if (!courseId) return { totalLessons: 0, totalDuration: 0 };

  const publishedModules = await Module.find({ course: courseId, isPublished: true }).select('_id');
  const publishedModuleIds = publishedModules.map((m) => m._id);

  const lessons = publishedModuleIds.length
    ? await Lesson.find(publishedLessonFilter(courseId, publishedModuleIds)).select('duration module')
    : [];

  const totalLessons = lessons.length;
  const totalDuration = lessons.reduce((sum, lesson) => sum + (lesson.duration || 0), 0);

  await Course.findByIdAndUpdate(courseId, { totalLessons, totalDuration });

  const allModules = await Module.find({ course: courseId }).select('_id');
  await Promise.all(allModules.map((m) => recalculateModuleStats(m._id)));

  return { totalLessons, totalDuration };
};

const recalculateAfterLessonChange = async (lesson) => {
  if (!lesson) return;
  await recalculateModuleStats(lesson.module);
  await recalculateCourseStats(lesson.course);
};

const recalculateAllCourses = async () => {
  const courses = await Course.find().select('_id');
  const results = await Promise.all(courses.map((c) => recalculateCourseStats(c._id)));
  return results.length;
};

const countModuleLessons = async (moduleId, { includeUnpublished = false } = {}) => {
  const filter = { module: moduleId };
  if (!includeUnpublished) filter.isPublished = true;
  return Lesson.countDocuments(filter);
};

module.exports = {
  recalculateModuleStats,
  recalculateCourseStats,
  recalculateAfterLessonChange,
  recalculateAllCourses,
  countModuleLessons,
};
