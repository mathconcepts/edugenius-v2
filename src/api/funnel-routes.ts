// @ts-nocheck
/**
 * Funnel Routes — Acquisition funnel event tracking
 *
 * POST /api/funnel/event      — track funnel event (public, rate-limited)
 * GET  /api/admin/funnel      — funnel metrics (admin only)
 */

import { ServerResponse } from 'http';
import pg from 'pg';

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

const pool = new pg.Pool({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL });

// ── Rate limiter (in-memory, per IP) ──────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100; // events per minute per IP
const RATE_WINDOW = 60_000; // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 300_000);

// ── Allowed event types ───────────────────────────────────────────────────────

const ALLOWED_EVENTS = new Set([
  'page_view', 'cta_click', 'signup_start', 'signup_complete',
  'first_practice', 'activated', 'blog_read', 'social_click',
]);

const ALLOWED_SOURCES = new Set([
  'blog', 'social', 'direct', 'telegram', 'organic', 'referral', 'email',
]);

// ── Track funnel event ────────────────────────────────────────────────────────

async function handleTrackEvent(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.headers['x-real-ip'] as string
    || 'unknown';

  if (isRateLimited(ip)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
    return;
  }

  const body = req.body as {
    session_id?: string;
    event_type?: string;
    source?: string;
    utm_params?: Record<string, string>;
    metadata?: Record<string, unknown>;
  } | null;

  if (!body?.session_id || !body?.event_type) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'session_id and event_type required' }));
    return;
  }

  if (!ALLOWED_EVENTS.has(body.event_type)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Invalid event_type. Allowed: ${[...ALLOWED_EVENTS].join(', ')}` }));
    return;
  }

  const source = body.source && ALLOWED_SOURCES.has(body.source) ? body.source : null;

  await pool.query(
    `INSERT INTO funnel_events (session_id, event_type, source, utm_params, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [body.session_id, body.event_type, source, JSON.stringify(body.utm_params || {}), JSON.stringify(body.metadata || {})]
  );

  res.writeHead(201, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
}

// ── Admin: funnel metrics ─────────────────────────────────────────────────────

async function handleFunnelMetrics(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const days = parseInt(req.query.get('days') || '30', 10);

  // Stage counts
  const stageResult = await pool.query(
    `SELECT event_type, COUNT(DISTINCT session_id) as unique_sessions, COUNT(*) as total_events
     FROM funnel_events
     WHERE created_at >= NOW() - INTERVAL '1 day' * $1
     GROUP BY event_type
     ORDER BY total_events DESC`,
    [days]
  );

  // Source breakdown
  const sourceResult = await pool.query(
    `SELECT source, event_type, COUNT(DISTINCT session_id) as unique_sessions
     FROM funnel_events
     WHERE created_at >= NOW() - INTERVAL '1 day' * $1 AND source IS NOT NULL
     GROUP BY source, event_type
     ORDER BY source, unique_sessions DESC`,
    [days]
  );

  // Daily trend
  const trendResult = await pool.query(
    `SELECT DATE(created_at) as day, event_type, COUNT(DISTINCT session_id) as sessions
     FROM funnel_events
     WHERE created_at >= NOW() - INTERVAL '1 day' * $1
     GROUP BY DATE(created_at), event_type
     ORDER BY day DESC`,
    [days]
  );

  // Top blog posts by signups driven (via metadata.blog_slug)
  const blogResult = await pool.query(
    `SELECT metadata->>'blog_slug' as blog_slug, COUNT(*) as conversions
     FROM funnel_events
     WHERE event_type IN ('signup_start', 'signup_complete')
       AND metadata->>'blog_slug' IS NOT NULL
       AND created_at >= NOW() - INTERVAL '1 day' * $1
     GROUP BY metadata->>'blog_slug'
     ORDER BY conversions DESC
     LIMIT 10`,
    [days]
  );

  const stages = stageResult.rows;
  const funnelOrder = ['page_view', 'blog_read', 'cta_click', 'signup_start', 'signup_complete', 'first_practice', 'activated'];
  const orderedStages = funnelOrder.map(type => {
    const row = stages.find(s => s.event_type === type);
    return { event_type: type, unique_sessions: row ? parseInt(row.unique_sessions) : 0 };
  });

  // Compute conversion rates between stages
  const conversions = [];
  for (let i = 1; i < orderedStages.length; i++) {
    const from = orderedStages[i - 1];
    const to = orderedStages[i];
    conversions.push({
      from: from.event_type,
      to: to.event_type,
      rate: from.unique_sessions > 0 ? (to.unique_sessions / from.unique_sessions * 100).toFixed(1) + '%' : '0%',
    });
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    period_days: days,
    stages: orderedStages,
    conversions,
    by_source: sourceResult.rows,
    daily_trend: trendResult.rows,
    top_blog_posts: blogResult.rows,
  }));
}

// ── Export ─────────────────────────────────────────────────────────────────────

export const funnelRoutes: RouteDefinition[] = [
  { method: 'POST', path: '/api/funnel/event', handler: handleTrackEvent },
  { method: 'GET', path: '/api/admin/funnel', handler: handleFunnelMetrics },
];
