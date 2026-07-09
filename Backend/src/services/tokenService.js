const jwt = require('jsonwebtoken');

const generateAccessToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
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
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.PLAYBACK_TOKEN_EXPIRES_IN || '4h' }
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
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generatePlaybackToken,
  verifyPlaybackToken,
};