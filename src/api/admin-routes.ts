// @ts-nocheck
/**
 * Analytics Dashboard API
 *
 * Simple admin endpoints that query verification_log, pyq_questions,
 * and analytics_events tables for dashboard metrics.
 *
 * Protected by ADMIN_EMAILS env var allowlist (checked by session/email).
 * For now, protected by CRON_SECRET (same pattern) since auth is not wired yet.
 *
 *   GET /api/admin/stats          → DAU, problems solved, signups
 *   GET /api/admin/verification   → Tier stats, costs
 *   GET /api/admin/content        → Content velocity, generated vs published
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
// Database + Auth
// ============================================================================

let _pool: any = null;

function getPool() {
  if (_pool) return _pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('[admin] DATABASE_URL not configured');
  _pool = new Pool({ connectionString, max: 3, idleTimeoutMillis: 30_000 });
  return _pool;
}

function sendJSON(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/** Simple admin auth: CRON_SECRET bearer token (will upgrade to JWT + ADMIN_EMAILS later) */
function checkAdminAuth(req: ParsedRequest, res: ServerResponse): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    sendJSON(res, { error: 'Admin not configured' }, 500);
    return false;
  }
  const authHeader = (req.headers?.['authorization'] || req.headers?.['Authorization']) as string | undefined;
  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    sendJSON(res, { error: 'Unauthorized' }, 401);
    return false;
  }
  return true;
}

// ============================================================================
// Handlers
// ============================================================================

async function handleStats(req: ParsedRequest, res: ServerResponse): Promise<void> {
  if (!checkAdminAuth(req, res)) return;
  const pool = getPool();

  const [verifications, problems, sessions] = await Promise.all([
    pool.query(`SELECT COUNT(*) as count FROM verification_log WHERE created_at > NOW() - INTERVAL '24 hours'`),
    pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE source = 'generated') as generated FROM pyq_questions`),
    pool.query(`SELECT COUNT(DISTINCT session_id) as active FROM sr_sessions WHERE updated_at > NOW() - INTERVAL '24 hours'`),
  ]);

  sendJSON(res, {
    verificationsLast24h: parseInt(verifications.rows[0].count, 10),
    totalProblems: parseInt(problems.rows[0].total, 10),
    generatedProblems: parseInt(problems.rows[0].generated, 10),
    activeSessionsLast24h: parseInt(sessions.rows[0].active, 10),
  });
}

async function handleVerificationStats(req: ParsedRequest, res: ServerResponse): Promise<void> {
  if (!checkAdminAuth(req, res)) return;
  const pool = getPool();

  const [tierBreakdown, recentCalls] = await Promise.all([
    pool.query(`
      SELECT tier_used, COUNT(*) as count,
             AVG(total_ms) as avg_ms,
             AVG(confidence) as avg_confidence
      FROM verification_log
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY tier_used
      ORDER BY tier_used
    `),
    pool.query(`
      SELECT COUNT(*) as wolfram_calls
      FROM verification_log
      WHERE tier_used = 'tier3_wolfram'
        AND created_at > NOW() - INTERVAL '24 hours'
    `),
  ]);

  const wolframCalls = parseInt(recentCalls.rows[0]?.wolfram_calls || '0', 10);

  sendJSON(res, {
    tierBreakdown: tierBreakdown.rows.map((r: any) => ({
      tier: r.tier_used,
      count: parseInt(r.count, 10),
      avgMs: Math.round(parseFloat(r.avg_ms)),
      avgConfidence: parseFloat(parseFloat(r.avg_confidence).toFixed(3)),
    })),
    wolframCallsLast24h: wolframCalls,
    estimatedWolframCostLast24h: `$${(wolframCalls * 0.01).toFixed(2)}`,
  });
}

async function handleContentStats(req: ParsedRequest, res: ServerResponse): Promise<void> {
  if (!checkAdminAuth(req, res)) return;
  const pool = getPool();

  const [velocity, cumulative] = await Promise.all([
    pool.query(`
      SELECT COUNT(*) as count
      FROM pyq_questions
      WHERE source = 'generated'
        AND generated_at > NOW() - INTERVAL '7 days'
    `),
    pool.query(`
      SELECT
        DATE(generated_at) as date,
        COUNT(*) as count
      FROM pyq_questions
      WHERE source = 'generated' AND generated_at IS NOT NULL
      GROUP BY DATE(generated_at)
      ORDER BY date DESC
      LIMIT 30
    `),
  ]);

  sendJSON(res, {
    contentVelocity7d: parseInt(velocity.rows[0].count, 10),
    dailyGeneration: cumulative.rows.map((r: any) => ({
      date: r.date,
      count: parseInt(r.count, 10),
    })),
  });
}

// ============================================================================
// Route Definitions
// ============================================================================

export const adminRoutes: RouteDefinition[] = [
  { method: 'GET', path: '/api/admin/stats', handler: handleStats },
  { method: 'GET', path: '/api/admin/verification', handler: handleVerificationStats },
  { method: 'GET', path: '/api/admin/content', handler: handleContentStats },
];
