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
 * API server fetches from S3 (same region, keep-alive) — smoother than browser → S3 direct.
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
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Content-Type', s3Response.ContentType || guessContentType(videoKey));
  // Allow <video> on admin/web domains to load this cross-origin stream
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type');

  if (s3Response.ContentLength != null) {
    res.setHeader('Content-Length', String(s3Response.ContentLength));
  }
  if (s3Response.ContentRange) {
    res.setHeader('Content-Range', s3Response.ContentRange);
  }
  if (s3Response.ETag) {
    res.setHeader('ETag', s3Response.ETag);
  }

  await new Promise((resolve, reject) => {
    const body = s3Response.Body;
    const cleanup = () => {
      req.off('close', onClose);
    };
    const onClose = () => {
      if (body?.destroy) body.destroy();
    };

    req.on('close', onClose);
    body.on('error', (err) => {
      cleanup();
      if (!res.headersSent) {
        reject(err);
        return;
      }
      res.destroy();
      reject(err);
    });
    res.on('error', (err) => {
      cleanup();
      if (body?.destroy) body.destroy();
      reject(err);
    });
    res.on('finish', () => {
      cleanup();
      resolve();
    });
    body.pipe(res);
  });
};

module.exports = { pipeS3VideoToResponse, guessContentType };
