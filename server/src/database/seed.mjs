import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, testDbConnection } from '../config/database.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const seedsDir = path.resolve(__dirname, '../../../database/seeds');

export const runSeeds = async () => {
  console.log('[Seed] Starting database seed process...');

  const connectionTest = await testDbConnection();
  if (!connectionTest.connected) {
    console.error(`[Seed Error] Unable to connect to PostgreSQL: ${connectionTest.error || 'Connection refused'}`);
    console.info('[Seed Info] Ensure PostgreSQL is running and DATABASE_URL is configured properly.');
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    if (!fs.existsSync(seedsDir)) {
      throw new Error(`Seeds directory not found at: ${seedsDir}`);
    }

    const seedFiles = fs
      .readdirSync(seedsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    if (seedFiles.length === 0) {
      console.log('[Seed] No seed files found in database/seeds.');
      return;
    }

    for (const file of seedFiles) {
      const filePath = path.join(seedsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf8');

      console.log(`[Seed] Executing: ${file}...`);
      await client.query('BEGIN');
      try {
        await client.query(sqlContent);
        await client.query('COMMIT');
        console.log(`[Seed] Successfully executed: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Seed Failed] Error executing ${file}:`, err.message);
        throw err;
      }
    }

    const { rows } = await client.query('SELECT COUNT(*) as total FROM skills');
    console.log(`[Seed Complete] Master skills catalog contains ${rows[0].total} skill(s).`);
  } finally {
    client.release();
  }
};

// Run automatically when executed directly via CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSeeds()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Seed Error]', err.message);
      await pool.end();
      process.exit(1);
    });
}
