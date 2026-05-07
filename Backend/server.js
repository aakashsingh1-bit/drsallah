require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');
const startSubscriptionJobs = require('./src/services/scheduledJobs');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║      Dr. Sallah Education Platform API           ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Server   : http://localhost:${PORT}                ║`);
    console.log(`║  API Base : http://localhost:${PORT}/api/v1          ║`);
    console.log(`║  API Docs : http://localhost:${PORT}/api-docs         ║`);
    console.log(`║  Health   : http://localhost:${PORT}/health           ║`);
    console.log(`║  Env      : ${process.env.NODE_ENV || 'development'}                      ║`);
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
  });

  // ─── Server Timeouts ─────────────────────────────────────────────────────
  // Default Node.js HTTP server timeout is 0 (no timeout), but we set a
  // generous 30-minute timeout for large video uploads.
  // This prevents the server from closing idle connections during long uploads.
  server.timeout = 30 * 60 * 1000; // 30 minutes

  // Keep-alive timeout — how long to wait for additional data on the same
  // connection after the last data chunk. Set to 5 minutes for upload streams.
  server.keepAliveTimeout = 5 * 60 * 1000; // 5 minutes

  // Maximum headers timeout
  server.headersTimeout = 60 * 1000; // 1 minute

  // ── Request timeout (Express 5+ / connect) ───────────────────────────────
  // For Express 4, we handle request timeouts via middleware in app.js.
  // The server.timeout above is the primary mechanism for Node's http.Server.

  // Start background jobs
  startSubscriptionJobs();
  console.log('⏰ Scheduled jobs started');
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err.message);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Graceful shutdown...');
  process.exit(0);
});

startServer();
