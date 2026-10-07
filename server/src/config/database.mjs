import pg from 'pg';
import { exec } from 'child_process';
import util from 'util';
import config from './env.mjs';

const execPromise = util.promisify(exec);
const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 30000,
  max: 20,
});

// Avoid process crash on idle client errors
pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]', err.message);
});

/**
 * Execute a parameterized query
 */
export const query = (text, params) => pool.query(text, params);

/**
 * Non-blocking connectivity test with automatic WSL recovery
 * @returns {Promise<{ connected: boolean, timestamp?: string, error?: string }>}
 */
export const testDbConnection = async (isRetry = false) => {
  try {
    const res = await pool.query('SELECT NOW() as current_time');
    return {
      connected: true,
      timestamp: res.rows[0].current_time,
    };
  } catch (err) {
    // If connection refused on Windows, attempt to auto-start PostgreSQL service in WSL
    if (
      !isRetry &&
      process.platform === 'win32' &&
      (err.code === 'ECONNREFUSED' ||
        err.message?.includes('timeout') ||
        err.message?.includes('Connection refused') ||
        err.name === 'AggregateError')
    ) {
      try {
        console.info('[PostgreSQL] Database not reachable. Attempting to auto-start PostgreSQL service in WSL2...');
        await execPromise('wsl -d Ubuntu -u root service postgresql start');
        await new Promise((r) => setTimeout(r, 1200));
        return await testDbConnection(true);
      } catch (_) {
        // Fall through if WSL service command fails
      }
    }

    return {
      connected: false,
      error: err.message,
    };
  }
};

export default {
  pool,
  query,
  testDbConnection,
};
