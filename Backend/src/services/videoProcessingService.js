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

const isEnabled = () => process.env.VIDEO_PROCESSING_ENABLED === 'true';

const maxHeight = () => parseInt(process.env.VIDEO_MAX_HEIGHT, 10) || 720;
const maxBitrateKbps = () => parseInt(process.env.VIDEO_MAX_BITRATE_KBPS, 10) || 2500;
const minSizeToOptimizeMb = () => parseInt(process.env.VIDEO_OPTIMIZE_MIN_SIZE_MB, 10) || 20;

/** Sync — never call S3 HeadObject on the playback hot path */
const getPlaybackVideoKey = (lesson) => {
  if (!lesson) return null;
  return lesson.streamVideoKey || lesson.videoKey || null;
};

/**
 * Resolve playback key without S3 HEAD round-trips (those were saturating sockets).
 * Stream endpoint falls back if a key is missing.
 */
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
  const bitrate = Number(stream.bit_rate || format.bit_rate || 0);
  const size = Number(format.size || 0);
  return {
    width: Number(stream.width || 0),
    height: Number(stream.height || 0),
    bitrate,
    size,
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
  // 15m, 30m, 1h — then stop permanently after MAX
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
    // Space out jobs so S3 sockets recover (avoid connection storms)
    setTimeout(drainQueue, 2000);
  }
};

const queueVideoOptimization = (lessonId) => {
  if (!isEnabled() || !lessonId) return;
  const id = lessonId.toString();
  if (queued.has(id)) return;
  queued.add(id);
  queue.push(id);
  setImmediate(drainQueue);
};

/**
 * DO NOT call from playback hot path — that caused infinite retry storms.
 * Only used after upload / admin batch / explicit queue.
 */
const maybeQueueExistingVideo = (lesson) => {
  if (!isEnabled()) return;
  if (!canAttemptOptimize(lesson)) return;
  queueVideoOptimization(lesson._id);
};

const queueAllUnoptimizedVideos = async () => {
  if (!isEnabled()) return { queued: 0, message: 'Video processing disabled' };

  const now = new Date();
  const lessons = await Lesson.find({
    videoKey: { $exists: true, $nin: [null, ''] },
    $or: [
      { streamVideoKey: { $exists: false } },
      { streamVideoKey: null },
      { streamVideoKey: '' },
    ],
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
  }).select('_id title');

  lessons.forEach((lesson) => queueVideoOptimization(lesson._id));

  return {
    queued: lessons.length,
    message: lessons.length
      ? `Queued ${lessons.length} video(s) for streaming optimization`
      : 'No videos eligible for optimization right now',
  };
};

/** Clear lessons stuck in processing after crash/restart */
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
  maybeQueueExistingVideo,
  queueAllUnoptimizedVideos,
  resetStuckProcessing,
  isEnabled,
};
