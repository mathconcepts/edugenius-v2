// @ts-nocheck
/**
 * Auto-migrate: applies pending SQL migrations on server startup.
 *
 * Reads supabase/migrations/*.sql in sorted order. Tracks applied migrations
 * in a _migrations table. Each migration runs inside a transaction.
 * All migrations must be idempotent (IF NOT EXISTS) as a safety net.
 *
 * Usage: await autoMigrate(pool)
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'supabase/migrations');

/**
 * Run all pending migrations against the given pool.
 * Creates the _migrations tracking table if it doesn't exist.
 * Returns the count of newly applied migrations.
 */
export async function autoMigrate(pool: pg.Pool): Promise<number> {
  // 1. Ensure tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // 2. Read which migrations have already been applied
  const { rows: applied } = await pool.query(
    'SELECT filename FROM _migrations ORDER BY filename'
  );
  const appliedSet = new Set(applied.map((r: any) => r.filename));

  // 3. Read migration files from disk, sorted
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('[auto-migrate] No migrations directory found, skipping');
    return 0;
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  // 4. Apply pending migrations in order
  let count = 0;
  for (const file of files) {
    if (appliedSet.has(file)) continue;

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`[auto-migrate] Applying ${file}...`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
        [file]
      );
      await client.query('COMMIT');
      console.log(`[auto-migrate] Applied ${file}`);
      count++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[auto-migrate] FAILED ${file}:`, (err as Error).message);
      // Don't throw — log and continue so the server still starts.
      // The migration can be fixed and will retry on next deploy.
    } finally {
      client.release();
    }
  }

  if (count === 0) {
    console.log('[auto-migrate] All migrations up to date');
  } else {
    console.log(`[auto-migrate] Applied ${count} migration(s)`);
  }

  return count;
}
