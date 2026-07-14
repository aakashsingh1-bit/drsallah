/**
 * Video delivery (YouTube-style):
 * - PLAY: HLS adaptive (360p/720p) when ready; optimized progressive MP4 fallback
 * - OPTIMIZE: after upload (or one-shot for large old lessons) — max 3 attempts
 * - Never optimize on every play (no S3 storm loop)
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
const LARGE_MB = parseInt(process.env.VIDEO_LARGE_FILE_MB, 10) || 80;
const HLS_ENABLED = () => process.env.VIDEO_HLS_ENABLED !== 'false';

const isEnabled = () => process.env.VIDEO_PROCESSING_ENABLED !== 'false';

const maxHeight = () => parseInt(process.env.VIDEO_MAX_HEIGHT, 10) || 720;
const maxBitrateKbps = () => parseInt(process.env.VIDEO_MAX_BITRATE_KBPS, 10) || 1800;

const getPlaybackVideoKey = (lesson) => {
  if (!lesson) return null;
  return lesson.streamVideoKey || lesson.videoKey || null;
};

const resolvePlaybackVideoKey = async (lesson) => getPlaybackVideoKey(lesson);

const isFullyOptimized = (lesson) =>
  Boolean(lesson?.streamVideoKey && (!HLS_ENABLED() || lesson.hlsPrefix));

const streamKeyFor = (sourceKey) => {
  const ext = path.extname(sourceKey) || '.mp4';
  const base = sourceKey.slice(0, -ext.length);
  return `${base}-stream${ext}`;
};

const hlsPrefixFor = (sourceKey) => {
  const ext = path.extname(sourceKey) || '.mp4';
  const base = sourceKey.slice(0, -ext.length);
  return `${base}-hls`;
};

const probeVideo = async (filePath) => {
  const { stdout } = await execFileAsync(
    'ffprobe',
    [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,bit_rate',
      '-show_entries', 'format=bit_rate,size,duration',
      '-of', 'json',
      filePath,
    ],
    { timeout: 180_000 }
  );

  const data = JSON.parse(stdout || '{}');
  const stream = data.streams?.[0] || {};
  const format = data.format || {};
  return {
    width: Number(stream.width || 0),
    height: Number(stream.height || 0),
    bitrate: Number(stream.bit_rate || format.bit_rate || 0),
    size: Number(format.size || 0),
    duration: Number(format.duration || 0),
  };
};

const runFfmpeg = (args) =>
  execFileAsync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], {
    timeout: 3 * 60 * 60 * 1000,
    maxBuffer: 10 * 1024 * 1024,
  });

/** Progressive MP4 fallback for Android / browsers without HLS */
const transcodeForStreaming = (inputPath, outputPath) => {
  const height = maxHeight();
  const kbps = maxBitrateKbps();
  return runFfmpeg([
    '-i', inputPath,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-profile:v', 'main',
    '-level', '4.0',
    '-pix_fmt', 'yuv420p',
    '-vf', `scale='min(1280,iw)':min(${height}\\,ih):force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2`,
    '-crf', '28',
    '-maxrate', `${kbps}k`,
    '-bufsize', `${kbps * 2}k`,
    '-c:a', 'aac',
    '-b:a', '96k',
    '-ac', '2',
    '-ar', '44100',
    '-movflags', '+faststart',
    '-f', 'mp4',
    outputPath,
  ]);
};

/** One HLS ladder rung (segment length ~6s — fewer auth hits, still adaptive) */
const transcodeHlsRung = (inputPath, outDir, name, height, videoKbps, audioKbps) => {
  const playlist = path.join(outDir, `${name}.m3u8`);
  const segmentPattern = path.join(outDir, `${name}_%03d.ts`);
  return runFfmpeg([
    '-i', inputPath,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-profile:v', 'main',
    '-level', '4.0',
    '-pix_fmt', 'yuv420p',
    '-vf', `scale=-2:min(${height}\\,ih)`,
    '-crf', '28',
    '-maxrate', `${videoKbps}k`,
    '-bufsize', `${videoKbps * 2}k`,
    '-c:a', 'aac',
    '-b:a', `${audioKbps}k`,
    '-ac', '2',
    '-ar', '44100',
    '-hls_time', '6',
    '-hls_playlist_type', 'vod',
    '-hls_flags', 'independent_segments',
    '-hls_segment_filename', segmentPattern,
    playlist,
  ]);
};

const writeMasterPlaylist = (outDir) => {
  const master = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=900000,AVERAGE-BANDWIDTH=700000,RESOLUTION=640x360,NAME="360p"
360p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2200000,AVERAGE-BANDWIDTH=1800000,RESOLUTION=1280x720,NAME="720p"
720p.m3u8
`;
  fs.writeFileSync(path.join(outDir, 'master.m3u8'), master, 'utf8');
};

const cleanupFiles = (...files) => {
  for (const file of files) {
    try {
      if (file && fs.existsSync(file)) fs.unlinkSync(file);
    } catch {}
  }
};

const cleanupDir = (dir) => {
  try {
    if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
};

const backoffMs = (attempts) => {
  const minutes = Math.min(120, 30 * 2 ** Math.max(0, attempts - 1));
  return minutes * 60 * 1000;
};

const canAttemptOptimize = (lesson) => {
  if (!lesson?.videoKey) return false;
  if (isFullyOptimized(lesson)) return false;
  if (lesson.uploadStatus === 'processing') return false;
  const attempts = Number(lesson.optimizeAttempts || 0);
  if (attempts >= MAX_OPTIMIZE_ATTEMPTS) return false;
  if (lesson.optimizeNextAttemptAt && new Date(lesson.optimizeNextAttemptAt) > new Date()) {
    return false;
  }
  return true;
};

const isLargeLesson = (lesson) => {
  const sizeMb =
    (Number(lesson.originalVideoSize) || Number(lesson.videoSize) || 0) / (1024 * 1024);
  return sizeMb >= LARGE_MB || sizeMb === 0;
};

const clearDerivedMedia = async (lesson) => {
  if (!lesson) return;
  if (lesson.streamVideoKey && lesson.streamVideoKey !== lesson.videoKey) {
    await s3Service.deleteFromS3(lesson.streamVideoKey).catch(() => {});
  }
  if (lesson.hlsPrefix) {
    await s3Service.deletePrefix(lesson.hlsPrefix).catch(() => {});
  }
};

const optimizeLessonVideo = async (lessonId) => {
  const lesson = await Lesson.findById(lessonId);
  if (!canAttemptOptimize(lesson)) return;

  const tmpDir = path.join(os.tmpdir(), 'drsallah-video');
  fs.mkdirSync(tmpDir, { recursive: true });
  const inputPath = path.join(tmpDir, `${lessonId}-in.mp4`);
  const outputPath = path.join(tmpDir, `${lessonId}-out.mp4`);
  const hlsDir = path.join(tmpDir, `${lessonId}-hls`);

  await Lesson.findByIdAndUpdate(lessonId, { uploadStatus: 'processing' });

  try {
    console.log(`🎬 Downloading for optimize: lesson ${lessonId}`);
    await s3Service.downloadToFile(lesson.videoKey, inputPath);

    const info = await probeVideo(inputPath);
    const sizeMb = info.size / (1024 * 1024);
    console.log(
      `🎬 Transcoding lesson ${lessonId} (${sizeMb.toFixed(0)} MB → 720p progressive` +
        (HLS_ENABLED() ? ' + HLS 360p/720p' : '') +
        `)`
    );

    await transcodeForStreaming(inputPath, outputPath);

    const streamKey = streamKeyFor(lesson.videoKey);
    const outStats = fs.statSync(outputPath);
    const outMb = outStats.size / (1024 * 1024);
    await s3Service.uploadVideoFromPath(outputPath, streamKey, 'video/mp4');

    let hlsPrefix = null;
    if (HLS_ENABLED()) {
      fs.mkdirSync(hlsDir, { recursive: true });
      const lowKbps = Math.min(800, maxBitrateKbps());
      const highKbps = maxBitrateKbps();
      await transcodeHlsRung(inputPath, hlsDir, '360p', 360, lowKbps, 64);
      await transcodeHlsRung(inputPath, hlsDir, '720p', maxHeight(), highKbps, 96);
      writeMasterPlaylist(hlsDir);
      hlsPrefix = hlsPrefixFor(lesson.videoKey);
      if (lesson.hlsPrefix && lesson.hlsPrefix !== hlsPrefix) {
        await s3Service.deletePrefix(lesson.hlsPrefix).catch(() => {});
      }
      await s3Service.uploadDirectory(hlsDir, hlsPrefix);
    }

    if (lesson.streamVideoKey && lesson.streamVideoKey !== lesson.videoKey && lesson.streamVideoKey !== streamKey) {
      await s3Service.deleteFromS3(lesson.streamVideoKey).catch(() => {});
    }

    await Lesson.findByIdAndUpdate(lessonId, {
      streamVideoKey: streamKey,
      hlsPrefix: hlsPrefix || lesson.hlsPrefix || null,
      uploadStatus: 'ready',
      originalVideoSize: lesson.originalVideoSize || info.size || lesson.videoSize || 0,
      videoSize: outStats.size,
      optimizeAttempts: 0,
      optimizeNextAttemptAt: null,
      optimizeLastError: null,
    });

    console.log(
      `✅ Optimized lesson ${lessonId}: ${sizeMb.toFixed(0)} MB → ${outMb.toFixed(0)} MB` +
        (hlsPrefix ? ' + HLS adaptive' : '')
    );
  } catch (err) {
    const attempts = Number(lesson.optimizeAttempts || 0) + 1;
    const permanentlyDone = attempts >= MAX_OPTIMIZE_ATTEMPTS;
    const nextAt = permanentlyDone
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + backoffMs(attempts));

    console.error(
      `❌ Optimize failed lesson ${lessonId} (${attempts}/${MAX_OPTIMIZE_ATTEMPTS}):`,
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
    cleanupDir(hlsDir);
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
    setTimeout(drainQueue, 5000);
  }
};

const queueVideoOptimization = (lessonId) => {
  if (!isEnabled() || !lessonId) return false;
  const id = lessonId.toString();
  if (queued.has(id)) return false;
  queued.add(id);
  queue.push(id);
  setImmediate(drainQueue);
  return true;
};

const queueAfterUpload = (lessonId) => {
  if (!isEnabled() || !lessonId) return;
  Lesson.findById(lessonId)
    .then(async (lesson) => {
      if (lesson) await clearDerivedMedia(lesson);
      await Lesson.findByIdAndUpdate(lessonId, {
        $set: {
          optimizeAttempts: 0,
          optimizeNextAttemptAt: null,
          optimizeLastError: null,
        },
        $unset: { streamVideoKey: 1, hlsPrefix: 1 },
      });
      queueVideoOptimization(lessonId);
    })
    .catch((err) => console.error('queueAfterUpload error:', err.message));
};

/**
 * Safe one-shot: large / incomplete optimize → queue once (attempt-limited).
 */
const queueIfNeedsStreamingOptimize = (lesson) => {
  if (!isEnabled() || !lesson?._id) return false;
  if (isFullyOptimized(lesson)) return false;
  if (!canAttemptOptimize(lesson)) return false;

  const needsHlsOnly = Boolean(lesson.streamVideoKey && HLS_ENABLED() && !lesson.hlsPrefix);
  if (!needsHlsOnly && !isLargeLesson(lesson) && Number(lesson.videoSize) > 0) return false;

  return queueVideoOptimization(lesson._id);
};

const queueAllUnoptimizedVideos = async () => {
  if (!isEnabled()) return { queued: 0, message: 'Video processing disabled' };

  const now = new Date();
  const missingDerived = HLS_ENABLED()
    ? {
        $or: [
          { streamVideoKey: { $exists: false } },
          { streamVideoKey: null },
          { streamVideoKey: '' },
          { hlsPrefix: { $exists: false } },
          { hlsPrefix: null },
          { hlsPrefix: '' },
        ],
      }
    : {
        $or: [
          { streamVideoKey: { $exists: false } },
          { streamVideoKey: null },
          { streamVideoKey: '' },
        ],
      };

  const lessons = await Lesson.find({
    videoKey: { $exists: true, $nin: [null, ''] },
    ...missingDerived,
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
      ? `Queued ${lessons.length} video(s) for compression / HLS`
      : 'No videos need compression right now',
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
  isFullyOptimized,
  clearDerivedMedia,
  queueVideoOptimization,
  queueAfterUpload,
  queueIfNeedsStreamingOptimize,
  queueAllUnoptimizedVideos,
  resetStuckProcessing,
  isEnabled,
};
