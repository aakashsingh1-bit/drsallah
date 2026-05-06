require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { apiReference } = require('@scalar/express-api-reference');
const swaggerSpec = require('./config/swagger');

// Routes
const authRoutes = require('./routes/authRoutes');
const contentRoutes = require('./routes/contentRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const galleryRoutes = require('./routes/galleryRoutes');
const { handleStripeWebhook } = require('./controllers/paymentController');

// Middleware
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ─── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts, please try again in 15 minutes.' },
});

app.use(globalLimiter);

// ─── Logging ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ─── Body Parsing ──────────────────────────────────────────────────────────────
// Stripe webhooks must receive the raw body before JSON parsing.
app.post('/api/v1/payments/stripe/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Dr. Sallah Education Platform API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── Scalar API Docs ───────────────────────────────────────────────────────────
app.get('/api-docs/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.use(
  '/api-docs',
  apiReference({
    spec: { url: '/api-docs/openapi.json' },
    theme: 'default',
    layout: 'modern',
    pageTitle: 'Dr. Sallah Education Platform API',
  })
);

// ─── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1', contentRoutes);
app.use('/api/v1', subscriptionRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1', galleryRoutes);

// ─── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── Global Error Handler ──────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
