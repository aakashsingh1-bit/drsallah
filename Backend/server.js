require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');
const startSubscriptionJobs = require('./src/services/scheduledJobs');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
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