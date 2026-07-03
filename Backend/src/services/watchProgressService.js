/** Lesson counts as complete at 90% watched or within 5s of the end */
const COMPLETION_RATIO = 0.9;
const COMPLETION_TAIL_SEC = 5;

function lessonDurationSeconds(lesson) {
  return Math.max(0, Number(lesson?.duration) || 0);
}

exports.isLessonComplete = (progressSeconds, durationSeconds) => {
  const progress = Math.max(0, Number(progressSeconds) || 0);
  const duration = Math.max(0, Number(durationSeconds) || 0);
  if (duration <= 0) return progress > 0;
  if (progress >= duration - COMPLETION_TAIL_SEC) return true;
  return progress / duration >= COMPLETION_RATIO;
};

exports.capProgressSeconds = (progressSeconds, durationSeconds) => {
  const progress = Math.max(0, Math.floor(Number(progressSeconds) || 0));
  const duration = Math.max(0, Number(durationSeconds) || 0);
  if (duration > 0) return Math.min(progress, duration);
  return progress;
};

exports.buildLessonProgress = (progressSeconds, durationSeconds) => {
  const position = exports.capProgressSeconds(progressSeconds, durationSeconds);
  const duration = Math.max(0, Number(durationSeconds) || 0);
  const percent =
    duration > 0 ? Math.min(100, Math.round((position / duration) * 100)) : position > 0 ? 100 : 0;
  const completed = exports.isLessonComplete(position, duration);
  return { position, percent, completed };
};

exports.buildWatchHistoryMap = (watchHistory = []) => {
  const map = new Map();
  for (const entry of watchHistory) {
    const lessonId = entry.lesson?._id?.toString?.() || entry.lesson?.toString?.();
    if (!lessonId) continue;
    map.set(lessonId, entry);
  }
  return map;
};

exports.computeCourseProgress = (watchHistory = [], publishedLessons = []) => {
  const lessonDurationMap = new Map(
    publishedLessons.map((l) => [l._id.toString(), lessonDurationSeconds(l)])
  );
  const lessonIdSet = new Set(publishedLessons.map((l) => l._id.toString()));

  const watchedInCourse = watchHistory.filter((h) => {
    const id = h.lesson?._id?.toString?.() || h.lesson?.toString?.();
    return id && lessonIdSet.has(id);
  });

  let watchedLessons = 0;
  let watchedDuration = 0;
  const totalDuration = publishedLessons.reduce((sum, l) => sum + lessonDurationSeconds(l), 0);

  for (const entry of watchedInCourse) {
    const lessonId = entry.lesson?._id?.toString?.() || entry.lesson?.toString?.();
    const duration = lessonDurationMap.get(lessonId) || 0;
    const position = exports.capProgressSeconds(entry.progress, duration);
    watchedDuration += Math.min(position, duration || position);
    if (exports.isLessonComplete(position, duration)) watchedLessons += 1;
  }

  const percentComplete =
    totalDuration > 0
      ? Math.min(100, Math.round((watchedDuration / totalDuration) * 100))
      : publishedLessons.length > 0
        ? Math.round((watchedLessons / publishedLessons.length) * 100)
        : 0;

  const lastWatched = watchedInCourse.length
    ? watchedInCourse.reduce((latest, entry) =>
        new Date(entry.watchedAt) > new Date(latest.watchedAt) ? entry : latest
      )
    : null;

  const lastLessonId = lastWatched
    ? lastWatched.lesson?._id?.toString?.() || lastWatched.lesson?.toString?.() || null
    : null;

  return {
    watchedLessons,
    totalLessons: publishedLessons.length,
    percentComplete,
    watchedDuration,
    totalDuration,
    lastWatchedAt: lastWatched?.watchedAt || null,
    lastLessonId,
  };
};

exports.attachLessonWatchProgress = (lessonObj, historyEntry) => {
  if (!historyEntry) {
    lessonObj.watchProgress = null;
    return lessonObj;
  }
  const duration = lessonDurationSeconds(lessonObj);
  lessonObj.watchProgress = {
    ...exports.buildLessonProgress(historyEntry.progress, duration),
    watchedAt: historyEntry.watchedAt,
  };
  return lessonObj;
};
