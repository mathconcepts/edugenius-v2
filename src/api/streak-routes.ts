// @ts-nocheck
/**
 * Streak + GATE Countdown API
 *
 * Tracks consecutive-day streaks per user/session.
 * Resets at IST midnight (UTC+5:30).
 *
 *   GET  /api/streak/:id    → Get streak state
 *   POST /api/streak/:id    → Record activity (called on correct answer)
 */

import { ServerResponse } from 'http';
import pg from 'pg';
const { Pool } = pg;

// ============================================================================
// Types
// ============================================================================

interface ParsedRequest {
  pathname: string;
  query: URLSearchParams;
  params: Record<string, string>;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
}

type RouteHandler = (req: ParsedRequest, res: ServerResponse) => Promise<void>;

interface RouteDefinition {
  method: string;
  path: string;
  handler: RouteHandler;
}

// ============================================================================
// Database
// ============================================================================

let _pool: any = null;

function getPool() {
  if (_pool) return _pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('[streak] DATABASE_URL not configured');
  _pool = new Pool({ connectionString, max: 3, idleTimeoutMillis: 30_000 });
  return _pool;
}

function sendJSON(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ============================================================================
// IST date helper
// ============================================================================

/** Get current date in IST (UTC+5:30) as YYYY-MM-DD */
function getISTDate(): string {
  const now = new Date();
  // IST = UTC + 5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  return istTime.toISOString().slice(0, 10);
}

// ============================================================================
// Handlers
// ============================================================================

async function handleGetStreak(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const id = req.params.id;
  if (!id) return sendJSON(res, { error: 'ID required' }, 400);

  const pool = getPool();
  const result = await pool.query(
    'SELECT current_streak, longest_streak, last_active_date FROM streaks WHERE identifier = $1',
    [id],
  );

  if (result.rows.length === 0) {
    return sendJSON(res, {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      isActiveToday: false,
    });
  }

  const row = result.rows[0];
  const todayIST = getISTDate();
  const isActiveToday = row.last_active_date?.toISOString().slice(0, 10) === todayIST;

  // Check if streak is still valid (last active was yesterday IST or today)
  const yesterdayIST = new Date(new Date(todayIST).getTime() - 86400000).toISOString().slice(0, 10);
  const lastDate = row.last_active_date?.toISOString().slice(0, 10);
  const streakAlive = lastDate === todayIST || lastDate === yesterdayIST;

  sendJSON(res, {
    currentStreak: streakAlive ? row.current_streak : 0,
    longestStreak: row.longest_streak,
    lastActiveDate: row.last_active_date,
    isActiveToday,
  });
}

async function handleRecordActivity(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const id = req.params.id;
  if (!id) return sendJSON(res, { error: 'ID required' }, 400);

  const pool = getPool();
  const todayIST = getISTDate();
  const yesterdayIST = new Date(new Date(todayIST).getTime() - 86400000).toISOString().slice(0, 10);

  // Upsert streak
  const existing = await pool.query(
    'SELECT current_streak, longest_streak, last_active_date FROM streaks WHERE identifier = $1',
    [id],
  );

  if (existing.rows.length === 0) {
    // First activity ever
    await pool.query(
      `INSERT INTO streaks (identifier, current_streak, longest_streak, last_active_date, updated_at)
       VALUES ($1, 1, 1, $2, NOW())
       ON CONFLICT (identifier) DO NOTHING`,
      [id, todayIST],
    );
    return sendJSON(res, { currentStreak: 1, longestStreak: 1, isActiveToday: true });
  }

  const row = existing.rows[0];
  const lastDate = row.last_active_date?.toISOString().slice(0, 10);

  // Already active today — no change
  if (lastDate === todayIST) {
    return sendJSON(res, {
      currentStreak: row.current_streak,
      longestStreak: row.longest_streak,
      isActiveToday: true,
    });
  }

  let newStreak: number;
  if (lastDate === yesterdayIST) {
    // Consecutive day — increment
    newStreak = row.current_streak + 1;
  } else {
    // Streak broken — restart
    newStreak = 1;
  }

  const newLongest = Math.max(row.longest_streak, newStreak);

  await pool.query(
    `UPDATE streaks SET current_streak = $2, longest_streak = $3, last_active_date = $4, updated_at = NOW()
     WHERE identifier = $1`,
    [id, newStreak, newLongest, todayIST],
  );

  sendJSON(res, {
    currentStreak: newStreak,
    longestStreak: newLongest,
    isActiveToday: true,
  });
}

// ============================================================================
// Route Definitions
// ============================================================================

export const streakRoutes: RouteDefinition[] = [
  { method: 'GET', path: '/api/streak/:id', handler: handleGetStreak },
  { method: 'POST', path: '/api/streak/:id', handler: handleRecordActivity },
];
