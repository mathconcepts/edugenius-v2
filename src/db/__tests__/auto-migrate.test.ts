import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs and pg before importing the module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('pg', () => {
  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };
  const mockPool = {
    query: vi.fn(),
    connect: vi.fn().mockResolvedValue(mockClient),
  };
  return { default: { Pool: vi.fn(() => mockPool) }, Pool: vi.fn(() => mockPool) };
});

import fs from 'fs';
import { autoMigrate } from '../auto-migrate';
import pg from 'pg';

describe('autoMigrate', () => {
  let pool: any;
  let client: any;

  beforeEach(() => {
    vi.clearAllMocks();
    pool = new pg.Pool();
    client = { query: vi.fn(), release: vi.fn() };
    pool.connect.mockResolvedValue(client);
  });

  it('creates _migrations table and applies pending migrations', async () => {
    // No migrations applied yet
    pool.query
      .mockResolvedValueOnce({}) // CREATE TABLE _migrations
      .mockResolvedValueOnce({ rows: [] }); // SELECT applied

    (fs.existsSync as any).mockReturnValue(true);
    (fs.readdirSync as any).mockReturnValue(['001_init.sql', '002_update.sql']);
    (fs.readFileSync as any).mockReturnValue('CREATE TABLE IF NOT EXISTS test (id INT);');

    // Each migration: BEGIN, sql, INSERT, COMMIT
    client.query.mockResolvedValue({});

    const count = await autoMigrate(pool);
    expect(count).toBe(2);

    // Verify _migrations table created
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(pool.query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS _migrations');

    // Verify transactions were used
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('skips already applied migrations', async () => {
    pool.query
      .mockResolvedValueOnce({}) // CREATE TABLE _migrations
      .mockResolvedValueOnce({ rows: [{ filename: '001_init.sql' }] }); // 001 already applied

    (fs.existsSync as any).mockReturnValue(true);
    (fs.readdirSync as any).mockReturnValue(['001_init.sql', '002_update.sql']);
    (fs.readFileSync as any).mockReturnValue('SELECT 1;');
    client.query.mockResolvedValue({});

    const count = await autoMigrate(pool);
    expect(count).toBe(1); // Only 002 applied
  });

  it('rolls back on migration failure and continues', async () => {
    pool.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] });

    (fs.existsSync as any).mockReturnValue(true);
    (fs.readdirSync as any).mockReturnValue(['001_bad.sql', '002_good.sql']);
    (fs.readFileSync as any).mockReturnValue('SELECT 1;');

    // First migration fails on SQL execution
    let callCount = 0;
    client.query.mockImplementation(async (sql: string) => {
      callCount++;
      // Fail on the 2nd call of the first migration (the SQL itself, after BEGIN)
      if (callCount === 2) throw new Error('syntax error');
      return {};
    });

    const count = await autoMigrate(pool);
    // 001 failed + rolled back, 002 should still run
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(count).toBe(1); // Only 002 succeeded
  });

  it('returns 0 when no migrations directory exists', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    (fs.existsSync as any).mockReturnValue(false);

    const count = await autoMigrate(pool);
    expect(count).toBe(0);
  });

  it('filters non-sql files', async () => {
    pool.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] });

    (fs.existsSync as any).mockReturnValue(true);
    (fs.readdirSync as any).mockReturnValue(['001_init.sql', 'README.md', '.DS_Store']);
    (fs.readFileSync as any).mockReturnValue('SELECT 1;');
    client.query.mockResolvedValue({});

    const count = await autoMigrate(pool);
    expect(count).toBe(1); // Only the .sql file
  });
});
