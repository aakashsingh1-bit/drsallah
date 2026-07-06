export const WATCH_PROGRESS_SAVE_INTERVAL_MS = 15_000;
export const WATCH_PROGRESS_MIN_DELTA_SEC = 5;
const COMPLETION_RATIO = 0.9;
const COMPLETION_TAIL_SEC = 5;
const RESUME_MIN_SEC = 5;

export function isLessonComplete(progressSeconds: number, durationSeconds: number): boolean {
  const progress = Math.max(0, progressSeconds || 0);
  const duration = Math.max(0, durationSeconds || 0);
  if (duration <= 0) return progress > 0;
  if (progress >= duration - COMPLETION_TAIL_SEC) return true;
  return progress / duration >= COMPLETION_RATIO;
}

export function getLessonProgressPercent(progressSeconds: number, durationSeconds: number): number {
  const progress = Math.max(0, progressSeconds || 0);
  const duration = Math.max(0, durationSeconds || 0);
  if (duration <= 0) return progress > 0 ? 100 : 0;
  return Math.min(100, Math.round((progress / duration) * 100));
}

/** Resume near last position unless lesson is almost done */
export function getResumePosition(savedSeconds: number, durationSeconds: number): number {
  const saved = Math.max(0, savedSeconds || 0);
  const duration = Math.max(0, durationSeconds || 0);
  if (saved < RESUME_MIN_SEC) return 0;
  if (duration > 0 && isLessonComplete(saved, duration)) return 0;
  if (duration > 0 && saved >= duration - RESUME_MIN_SEC) return 0;
  return saved;
}

export function shouldSaveWatchProgress(
  lastSavedAt: number,
  lastSavedProgress: number,
  currentProgress: number,
  now = Date.now()
): boolean {
  if (currentProgress <= 0) return false;
  if (currentProgress - lastSavedProgress >= WATCH_PROGRESS_MIN_DELTA_SEC) return true;
  if (now - lastSavedAt >= WATCH_PROGRESS_SAVE_INTERVAL_MS) return true;
  return false;
}

export type LessonWatchProgress = {
  position?: number;
  percent?: number;
  completed?: boolean;
};

export function getWatchProgressForLesson(lesson: {
  watchProgress?: LessonWatchProgress | null;
  duration?: number;
}): LessonWatchProgress {
  const wp = lesson.watchProgress;
  if (wp) return wp;
  return { position: 0, percent: 0, completed: false };
}
