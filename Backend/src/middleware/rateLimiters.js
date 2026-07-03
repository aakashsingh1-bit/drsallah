const rateLimit = require('express-rate-limit');

const rateLimitMessage = (message) => ({ success: false, message });

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage('Too many requests, please try again later.'),
  skip: (req) => req.method === 'GET' && req.path === '/health',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage('Too many auth attempts, please try again in 15 minutes.'),
});

/** Throttled client saves ~4/min; this allows comfortable headroom per user */
const watchHistoryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.WATCH_HISTORY_RATE_LIMIT_MAX, 10) || 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage('Too many progress updates. Please wait a moment.'),
});

module.exports = {
  globalLimiter,
  authLimiter,
  watchHistoryLimiter,
};
