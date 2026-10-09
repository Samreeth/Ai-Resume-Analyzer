import app from './app.mjs';
import config from './config/env.mjs';
import { testDbConnection, pool, ensureSchema } from './config/database.mjs';
import { runStartupRecovery, runStaleRecovery } from './services/processing.service.mjs';

let server = null;
let staleTimer = null;

/**
 * Deterministic Server Initialization Sequence:
 * 1. Connect to PostgreSQL.
 * 2. Run startup recovery (marks orphaned PROCESSING rows as FAILED).
 * 3. Complete startup recovery.
 * 4. Bind app.listen() to open port.
 * 5. Accept incoming requests.
 *
 * NOTE: Single-instance operational restriction. Unconditional startup recovery
 * assumes this is the only server process accessing the database. In clustered
 * or multi-instance environments, distributed lease locks must be used.
 */
export const startServer = async () => {
  // 1. Connect to PostgreSQL
  const dbStatus = await testDbConnection();
  if (dbStatus.connected) {
    console.log(`[PostgreSQL] Connected successfully at ${dbStatus.timestamp}`);

    // Ensure database schema (e.g. file_data column)
    await ensureSchema();

    // 2 & 3. Run and complete startup recovery BEFORE binding HTTP listener
    try {
      await runStartupRecovery();
    } catch (recErr) {
      console.error('[RECOVERY] Startup recovery error:', recErr.message);
    }

    // Periodic stale recovery sweep (every 60 seconds)
    staleTimer = setInterval(async () => {
      try {
        await runStaleRecovery();
      } catch (staleErr) {
        console.error('[RECOVERY] Stale recovery error:', staleErr.message);
      }
    }, 60000);
    if (typeof staleTimer.unref === 'function') staleTimer.unref();
  } else {
    console.warn(`[PostgreSQL] Note: Database not connected (${dbStatus.error}). Running with offline DB handling.`);
  }

  // 4 & 5. Bind app.listen() to start accepting incoming requests
  return new Promise((resolve) => {
    server = app.listen(config.port, () => {
      console.log(`[Express] Server running on http://localhost:${config.port} in ${config.env} mode (ES Module)`);
      console.log(`[Express] Health check available at http://localhost:${config.port}/health`);
      resolve(server);
    });
  });
};

startServer().catch((err) => {
  console.error('[Server] Fatal startup failure:', err);
  process.exit(1);
});

// Graceful shutdown handling
const handleShutdown = (signal) => {
  console.log(`\n[Express] Received ${signal}. Shutting down gracefully...`);
  if (staleTimer) {
    clearInterval(staleTimer);
    staleTimer = null;
  }
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
