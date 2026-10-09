import pg from 'pg';
import { exec } from 'child_process';
import util from 'util';
import config from './env.mjs';

const execPromise = util.promisify(exec);
const { Pool } = pg;

const isCloudDatabase = Boolean(
  config.databaseUrl?.includes('neon.tech') ||
  config.databaseUrl?.includes('sslmode=require') ||
  config.databaseUrl?.includes('amazonaws.com') ||
  config.env === 'production'
);

export const pool = new Pool({
  connectionString: config.databaseUrl,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20,
  ...(isCloudDatabase ? { ssl: { rejectUnauthorized: false } } : {}),
});

// Avoid process crash on idle client errors
pool.on('error', (err) => {
  if (err.message?.includes('terminating connection') || err.code === 'ECONNRESET') {
    return;
  }
  console.error('[PostgreSQL Pool Error]', err.message);
});

// Wrap pool.connect for automatic WSL reconnection resilience
const origPoolConnect = pool.connect.bind(pool);
pool.connect = async (...args) => {
  try {
    return await origPoolConnect(...args);
  } catch (err) {
    if (
      process.platform === 'win32' &&
      (err.code === 'ECONNREFUSED' ||
        err.message?.includes('terminating connection') ||
        err.message?.includes('Connection refused') ||
        err.name === 'AggregateError')
    ) {
      try {
        console.warn('[PostgreSQL] Database pool connect lost. Attempting auto-recovery in WSL2...');
        await execPromise('wsl -d Ubuntu -u root service postgresql start');
        await new Promise((r) => setTimeout(r, 1200));
        return await origPoolConnect(...args);
      } catch (_) {
        throw err;
      }
    }
    throw err;
  }
};

/**
 * Execute a parameterized query with automatic WSL reconnection resilience
 */
export const query = async (text, params) => {
  try {
    return await pool.query(text, params);
  } catch (err) {
    // If connection was refused or terminated on Windows, auto-recover WSL service and retry once
    if (
      process.platform === 'win32' &&
      (err.code === 'ECONNREFUSED' ||
        err.message?.includes('terminating connection') ||
        err.message?.includes('Connection refused') ||
        err.message?.includes('closed') ||
        err.name === 'AggregateError')
    ) {
      try {
        console.warn('[PostgreSQL] Database connection lost. Attempting auto-recovery in WSL2...');
        await execPromise('wsl -d Ubuntu -u root service postgresql start');
        await new Promise((r) => setTimeout(r, 1200));
        return await pool.query(text, params);
      } catch (_) {
        throw err;
      }
    }
    throw err;
  }
};

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
        err.message?.includes('terminating connection') ||
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
