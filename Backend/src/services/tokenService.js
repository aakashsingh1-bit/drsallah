const jwt = require('jsonwebtoken');

const TIMESPAN_PATTERN = /^\d+[smhdw]$/i;

/** jsonwebtoken rejects empty/invalid expiresIn — normalize env values safely */
const resolveJwtExpiresIn = (value, fallback) => {
  if (value == null) return fallback;
  const raw = String(value).trim();
  if (!raw) return fallback;
  if (/^\d+$/.test(raw)) {
    const seconds = parseInt(raw, 10);
    return seconds > 0 ? seconds : fallback;
  }
  if (TIMESPAN_PATTERN.test(raw)) return raw;
  return fallback;
};

const generateAccessToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: resolveJwtExpiresIn(process.env.JWT_EXPIRES_IN, '15m'),
  });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: resolveJwtExpiresIn(process.env.JWT_REFRESH_EXPIRES_IN, '7d'),
  });
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

/** Short-lived token for <video src=".../play?token="> (no Authorization header) */
const generatePlaybackToken = (userId, lessonId, courseId, options = {}) => {
  return jwt.sign(
    {
      id: userId.toString(),
      lessonId: lessonId.toString(),
      courseId: courseId?.toString(),
      scope: 'playback',
      isFree: Boolean(options.isFree),
      isAdmin: Boolean(options.isAdmin),
    },
    process.env.JWT_SECRET,
    { expiresIn: resolveJwtExpiresIn(process.env.PLAYBACK_TOKEN_EXPIRES_IN, '4h') }
  );
};

const verifyPlaybackToken = (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (decoded.scope !== 'playback') {
    throw new Error('Invalid playback token');
  }
  return decoded;
};

module.exports = {
  resolveJwtExpiresIn,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generatePlaybackToken,
  verifyPlaybackToken,
};