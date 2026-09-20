import app from './app.mjs';
import config from './config/env.mjs';
import { testDbConnection, pool } from './config/database.mjs';

const server = app.listen(config.port, async () => {
  console.log(`[Express] Server running on http://localhost:${config.port} in ${config.env} mode (ES Module)`);
  console.log(`[Express] Health check available at http://localhost:${config.port}/health`);

  // Initial non-blocking database connectivity check
  const dbStatus = await testDbConnection();
  if (dbStatus.connected) {
    console.log(`[PostgreSQL] Connected successfully at ${dbStatus.timestamp}`);
  } else {
    console.warn(`[PostgreSQL] Note: Database not connected (${dbStatus.error}). Running with offline DB handling.`);
  }
});

// Graceful shutdown handling
const handleShutdown = (signal) => {
  console.log(`\n[Express] Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    console.log('[Express] HTTP server closed.');
    try {
      await pool.end();
      console.log('[PostgreSQL] Connection pool closed.');
    } catch (err) {
      console.error('[PostgreSQL] Error closing pool:', err.message);
    }
    process.exit(0);
  });

  // Force exit after 5 seconds if graceful close hangs
  setTimeout(() => {
    console.error('[Express] Forced shutdown after timeout.');
    process.exit(1);
  }, 5000);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export default server;
