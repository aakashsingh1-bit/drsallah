const { pipeline } = require('stream/promises');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { s3, BUCKET } = require('./s3Service');

const guessContentType = (key) => {
  const ext = (key || '').split('.').pop()?.toLowerCase();
  const map = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    m4v: 'video/x-m4v',
  };
  return map[ext] || 'video/mp4';
};

/**
 * Stream S3 video to client with HTTP Range support (206 Partial Content).
 * Required for smooth HTML5 playback, seeking, and buffering.
 */
const pipeS3VideoToResponse = async (videoKey, req, res) => {
  const params = {
    Bucket: BUCKET,
    Key: videoKey,
  };

  if (req.headers.range) {
    params.Range = req.headers.range;
  }

  const s3Response = await s3.send(new GetObjectCommand(params));
  const isPartial = Boolean(req.headers.range && s3Response.ContentRange);

  res.status(isPartial ? 206 : 200);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Content-Type', s3Response.ContentType || guessContentType(videoKey));

  if (s3Response.ContentLength != null) {
    res.setHeader('Content-Length', String(s3Response.ContentLength));
  }
  if (s3Response.ContentRange) {
    res.setHeader('Content-Range', s3Response.ContentRange);
  }
  if (s3Response.ETag) {
    res.setHeader('ETag', s3Response.ETag);
  }

  s3Response.Body.on('error', () => {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Video stream interrupted' });
      return;
    }
    res.destroy();
  });

  req.on('close', () => {
    if (s3Response.Body?.destroy) s3Response.Body.destroy();
  });

  await pipeline(s3Response.Body, res);
};

module.exports = { pipeS3VideoToResponse, guessContentType };
