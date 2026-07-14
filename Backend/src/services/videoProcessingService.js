/**
 * Video delivery architecture (permanent):
 *
 * 1. PLAYBACK (hot path) — only signs a direct S3 URL. Never downloads, never queues optimize.
 *    Browser/app talks to S3 → instant start. API does not stream bytes.
 *
 * 2. OPTIMIZE (cold path) — after admin upload only. One background job, max 3 attempts,
 *    backoff, then give up. Original file remains playable forever.
 *
 * 3. Never re-queue from /stream or /play. Never batch on every server restart by default.
 */
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Lesson } = require('../models/Content');
const s3Service = require('./s3Service');

const execFileAsync = promisify(execFile);

const queue = [];
const queued = new Set();
let workerBusy = false;

const MAX_OPTIMIZE_ATTEMPTS = parseInt(process.env.VIDEO_OPTIMIZE_MAX_ATTEMPTS, 10) || 3;

/** New uploads optimize by default. Set VIDEO_PROCESSING_ENABLED=false to disable. */
const isEnabled = () => process.env.VIDEO_PROCESSING_ENABLED !== 'false';

const maxHeight = () => parseInt(process.env.VIDEO_MAX_HEIGHT, 10) || 720;
const maxBitrateKbps = () => parseInt(process.env.VIDEO_MAX_BITRATE_KBPS, 10) || 2500;
const minSizeToOptimizeMb = () => parseInt(process.env.VIDEO_OPTIMIZE_MIN_SIZE_MB, 10) || 20;

/** Prefer optimized copy if present; else original. Sync — no S3 calls. */
const getPlaybackVideoKey = (lesson) => {
  if (!lesson) return null;
  return lesson.streamVideoKey || lesson.videoKey || null;
};

const resolvePlaybackVideoKey = async (lesson) => getPlaybackVideoKey(lesson);

const streamKeyFor = (sourceKey) => {
  const ext = path.extname(sourceKey) || '.mp4';
  const base = sourceKey.slice(0, -ext.length);
  return `${base}-stream${ext}`;
};

const probeVideo = async (filePath) => {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,bit_rate',
    '-show_entries', 'format=bit_rate,size',
    '-of', 'json',
    filePath,
  ], { timeout: 120_000 });

  const data = JSON.parse(stdout || '{}');
  const stream = data.streams?.[0] || {};
  const format = data.format || {};
  return {
    width: Number(stream.width || 0),
    height: Number(stream.height || 0),
    bitrate: Number(stream.bit_rate || format.bit_rate || 0),
    size: Number(format.size || 0),
  };
};

const runFfmpeg = (args) =>
  execFileAsync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], {
    timeout: 60 * 60 * 1000,
    maxBuffer: 10 * 1024 * 1024,
  });

const remuxFaststart = (inputPath, outputPath) =>
  runFfmpeg(['-i', inputPath, '-c', 'copy', '-movflags', '+faststart', outputPath]);

const transcodeForStreaming = (inputPath, outputPath) => {
  const height = maxHeight();
  const bitrate = `${maxBitrateKbps()}k`;
  const bufsize = `${maxBitrateKbps() * 2}k`;
  return runFfmpeg([
    '-i', inputPath,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-profile:v', 'main',
    '-pix_fmt', 'yuv420p',
    '-vf', `scale='min(1280,iw)':min(${height}\\,ih):force_original_aspect_ratio=decrease`,
    '-crf', '23',
    '-maxrate', bitrate,
    '-bufsize', bufsize,
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    outputPath,
  ]);
};

const cleanupFiles = (...files) => {
  for (const file of files) {
    try {
      if (file && fs.existsSync(file)) fs.unlinkSync(file);
    } catch {}
  }
};

const backoffMs = (attempts) => {
  const minutes = Math.min(60, 15 * 2 ** Math.max(0, attempts - 1));
  return minutes * 60 * 1000;
};

const canAttemptOptimize = (lesson) => {
  if (!lesson?.videoKey || lesson.streamVideoKey) return false;
  if (lesson.uploadStatus === 'processing') return false;
  const attempts = Number(lesson.optimizeAttempts || 0);
  if (attempts >= MAX_OPTIMIZE_ATTEMPTS) return false;
  if (lesson.optimizeNextAttemptAt && new Date(lesson.optimizeNextAttemptAt) > new Date()) {
    return false;
  }
  return true;
};

const optimizeLessonVideo = async (lessonId) => {
  const lesson = await Lesson.findById(lessonId);
  if (!canAttemptOptimize(lesson)) return;

  const tmpDir = path.join(os.tmpdir(), 'drsallah-video');
  fs.mkdirSync(tmpDir, { recursive: true });
  const inputPath = path.join(tmpDir, `${lessonId}-in.mp4`);
  const outputPath = path.join(tmpDir, `${lessonId}-out.mp4`);

  await Lesson.findByIdAndUpdate(lessonId, { uploadStatus: 'processing' });

  try {
    await s3Service.downloadToFile(lesson.videoKey, inputPath);
    const info = await probeVideo(inputPath);
    const needsTranscode =
      info.height > maxHeight() ||
      info.bitrate > maxBitrateKbps() * 1000 * 1.2 ||
      info.size > minSizeToOptimizeMb() * 1024 * 1024;

    if (needsTranscode) {
      await transcodeForStreaming(inputPath, outputPath);
    } else {
      await remuxFaststart(inputPath, outputPath);
    }

    const streamKey = streamKeyFor(lesson.videoKey);
    const outStats = fs.statSync(outputPath);
    await s3Service.uploadVideoFromPath(outputPath, streamKey, 'video/mp4');

    if (lesson.streamVideoKey && lesson.streamVideoKey !== lesson.videoKey) {
      await s3Service.deleteFromS3(lesson.streamVideoKey).catch(() => {});
    }

    await Lesson.findByIdAndUpdate(lessonId, {
      streamVideoKey: streamKey,
      uploadStatus: 'ready',
      videoSize: outStats.size,
      optimizeAttempts: 0,
      optimizeNextAttemptAt: null,
      optimizeLastError: null,
    });

    console.log(`✅ Video optimized for lesson ${lessonId}`);
  } catch (err) {
    const attempts = Number(lesson.optimizeAttempts || 0) + 1;
    const permanentlyDone = attempts >= MAX_OPTIMIZE_ATTEMPTS;
    const nextAt = permanentlyDone
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + backoffMs(attempts));

    console.error(
      `❌ Video optimize failed for lesson ${lessonId} (attempt ${attempts}/${MAX_OPTIMIZE_ATTEMPTS}):`,
      err.message
    );

    // Always leave as ready so students can still play the ORIGINAL upload
    await Lesson.findByIdAndUpdate(lessonId, {
      uploadStatus: 'ready',
      optimizeAttempts: attempts,
      optimizeNextAttemptAt: nextAt,
      optimizeLastError: String(err.message || err).slice(0, 500),
    });
  } finally {
    cleanupFiles(inputPath, outputPath);
  }
};

const drainQueue = async () => {
  if (workerBusy || queue.length === 0) return;
  workerBusy = true;
  const lessonId = queue.shift();
  try {
    await optimizeLessonVideo(lessonId);
  } finally {
    queued.delete(lessonId);
    workerBusy = false;
    setTimeout(drainQueue, 3000);
  }
};

/** Only call after upload or admin batch — never from playback. */
const queueVideoOptimization = (lessonId) => {
  if (!isEnabled() || !lessonId) return;
  const id = lessonId.toString();
  if (queued.has(id)) return;
  queued.add(id);
  queue.push(id);
  setImmediate(drainQueue);
};

/**
 * After a fresh upload: reset attempt counters and queue optimize once.
 * Playback works immediately with the original file.
 */
const queueAfterUpload = (lessonId) => {
  if (!isEnabled() || !lessonId) return;
  Lesson.findByIdAndUpdate(lessonId, {
    $set: {
      optimizeAttempts: 0,
      optimizeNextAttemptAt: null,
      optimizeLastError: null,
      streamVideoKey: null,
    },
  })
    .then(() => queueVideoOptimization(lessonId))
    .catch((err) => console.error('queueAfterUpload error:', err.message));
};

const queueAllUnoptimizedVideos = async () => {
  if (!isEnabled()) return { queued: 0, message: 'Video processing disabled' };

  const now = new Date();
  const lessons = await Lesson.find({
    videoKey: { $exists: true, $nin: [null, ''] },
    $or: [{ streamVideoKey: { $exists: false } }, { streamVideoKey: null }, { streamVideoKey: '' }],
    uploadStatus: { $ne: 'processing' },
    $and: [
      {
        $or: [
          { optimizeAttempts: { $exists: false } },
          { optimizeAttempts: { $lt: MAX_OPTIMIZE_ATTEMPTS } },
        ],
      },
      {
        $or: [
          { optimizeNextAttemptAt: { $exists: false } },
          { optimizeNextAttemptAt: null },
          { optimizeNextAttemptAt: { $lte: now } },
        ],
      },
    ],
  }).select('_id');

  lessons.forEach((lesson) => queueVideoOptimization(lesson._id));

  return {
    queued: lessons.length,
    message: lessons.length
      ? `Queued ${lessons.length} video(s) for optimization`
      : 'No videos eligible for optimization',
  };
};

const resetStuckProcessing = async () => {
  const result = await Lesson.updateMany(
    { uploadStatus: 'processing' },
    { $set: { uploadStatus: 'ready' } }
  );
  return result.modifiedCount || 0;
};

module.exports = {
  getPlaybackVideoKey,
  resolvePlaybackVideoKey,
  queueVideoOptimization,
  queueAfterUpload,
  queueAllUnoptimizedVideos,
  resetStuckProcessing,
  isEnabled,
};
