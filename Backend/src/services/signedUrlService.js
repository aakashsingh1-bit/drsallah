const crypto = require('crypto');

/**
 * Generate a signed URL for secure video streaming.
 * The URL expires after SIGNED_URL_EXPIRY seconds.
 * In production this would be an S3 pre-signed URL or CDN token.
 */
const generateSignedUrl = (videoKey, userId) => {
  const expirySeconds = parseInt(process.env.SIGNED_URL_EXPIRY) || 3600;
  const expires = Math.floor(Date.now() / 1000) + expirySeconds;
  const secret = process.env.SIGNED_URL_SECRET;

  // Create HMAC signature: HMAC(secret, videoKey + userId + expires)
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${videoKey}:${userId}:${expires}`)
    .digest('hex');

  return {
    url: `/api/v1/stream/${encodeURIComponent(videoKey)}?userId=${userId}&expires=${expires}&sig=${signature}`,
    expires,
  };
};

const verifySignedUrl = (videoKey, userId, expires, signature) => {
  const secret = process.env.SIGNED_URL_SECRET;
  const now = Math.floor(Date.now() / 1000);

  if (now > parseInt(expires)) {
    return { valid: false, reason: 'URL has expired' };
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${videoKey}:${userId}:${expires}`)
    .digest('hex');

  if (expected !== signature) {
    return { valid: false, reason: 'Invalid signature' };
  }

  return { valid: true };
};

module.exports = { generateSignedUrl, verifySignedUrl };