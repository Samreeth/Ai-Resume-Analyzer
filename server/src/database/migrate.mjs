import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { pool, testDbConnection } from '../config/database.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, '../../../database/migrations');

const computeChecksum = (content) => {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
};

export const runMigrations = async () => {
  console.log('[Migration] Starting database migration check...');

  // 1. Verify Database Connectivity
  const connectionTest = await testDbConnection();
  if (!connectionTest.connected) {
    console.error(`[Migration Error] Unable to connect to PostgreSQL: ${connectionTest.error || 'Connection refused'}`);
    console.info('[Migration Info] Ensure PostgreSQL is running and DATABASE_URL is configured properly.');
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    // 2. Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        checksum VARCHAR(64) NOT NULL,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Fetch applied migrations from database
    const { rows: appliedRows } = await client.query(
      'SELECT name, checksum FROM schema_migrations ORDER BY id ASC'
    );
    const appliedMap = new Map(appliedRows.map((r) => [r.name, r.checksum]));

    // 4. Read migration files on disk
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found at: ${migrationsDir}`);
    }

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const diskFileSet = new Set(migrationFiles);

    // 5. Integrity Check: Detect missing applied migration files on disk
    for (const appliedName of appliedMap.keys()) {
      if (!diskFileSet.has(appliedName)) {
        throw new Error(
          `[Integrity Failure] Applied migration "${appliedName}" recorded in database is missing from disk at ${migrationsDir}!\nMigration history must be strictly preserved and immutable.`
        );
      }
    }

    // 6. Integrity Check: Checksum drift detection for applied migrations
    for (const file of migrationFiles) {
      if (appliedMap.has(file)) {
        const filePath = path.join(migrationsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const currentChecksum = computeChecksum(content);
        const recordedChecksum = appliedMap.get(file);

        if (currentChecksum !== recordedChecksum) {
          throw new Error(
            `[Integrity Failure] Applied migration "${file}" has been modified on disk after execution!\nRecorded checksum: ${recordedChecksum}\nCurrent checksum:  ${currentChecksum}\nAborting to prevent corrupted schema state.`
          );
        }
      }
    }

    // 7. Integrity Check: Prevent unsafe out-of-order migration additions
    let lastAppliedName = appliedRows.length > 0 ? appliedRows[appliedRows.length - 1].name : null;
    if (lastAppliedName) {
      for (const file of migrationFiles) {
        if (!appliedMap.has(file) && file < lastAppliedName) {
          throw new Error(
            `[Integrity Failure] Unapplied migration "${file}" precedes already-applied migration "${lastAppliedName}"!\nMigrations must be strictly append-only. Reordering applied migrations is unsafe.`
          );
        }
      }
    }

    // 8. Execute pending migrations inside atomic transactions
    let appliedCount = 0;
    for (const file of migrationFiles) {
      if (!appliedMap.has(file)) {
        const filePath = path.join(migrationsDir, file);
        const sqlContent = fs.readFileSync(filePath, 'utf8');
        const checksum = computeChecksum(sqlContent);

        console.log(`[Migration] Applying: ${file}...`);
        await client.query('BEGIN');
        try {
          await client.query(sqlContent);
          await client.query(
            'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
            [file, checksum]
          );
          await client.query('COMMIT');
          console.log(`[Migration] Successfully applied: ${file}`);
          appliedCount++;
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`[Migration Failed] Error in migration ${file}:`, err.message);
          throw err;
        }
      }
    }

    if (appliedCount === 0) {
      console.log(`[Migration] All ${migrationFiles.length} migration(s) are up to date.`);
    } else {
      console.log(`[Migration] Successfully applied ${appliedCount} new migration(s).`);
    }
  } finally {
    client.release();
  }
};

// Run automatically when executed directly via CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Migration Error]', err.message);
      await pool.end();
      process.exit(1);
    });
}
