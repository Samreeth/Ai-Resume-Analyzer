import pg from 'pg';
import config from './env.mjs';

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
 * Non-blocking connectivity test
 * @returns {Promise<{ connected: boolean, timestamp?: string, error?: string }>}
 */
export const testDbConnection = async () => {
  try {
    const res = await pool.query('SELECT NOW() as current_time');
    return {
      connected: true,
      timestamp: res.rows[0].current_time,
    };
  } catch (err) {
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
