// @ts-nocheck
/**
 * Social Media Content Autopilot — API Routes
 *
 * Endpoints:
 *   GET  /api/admin/social          — List social content (filterable)
 *   PUT  /api/admin/social/:id      — Update status (approve/reject/schedule)
 *   GET  /api/admin/social/pending  — Fetch pending posts (for automation)
 *   POST /api/admin/social/generate — Force-generate social content for a problem
 */

import { ServerResponse } from 'http';
import pg from 'pg';
import { getAuth, requireRole } from './auth-middleware';

const { Pool } = pg;

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

let _pool: any = null;

function getPool() {
  if (_pool) return _pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('[social-routes] DATABASE_URL not configured');
  _pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000 });
  return _pool;
}

function sendJSON(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJSON(res, { error: message }, status);
}

/**
 * GET /api/admin/social — List social content with optional filters
 * Query: ?status=pending&platform=twitter&limit=50
 */
async function handleList(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const user = await requireRole(req, res, 'teacher', 'admin');
  if (!user) return;

  const status = req.query.get('status');
  const platform = req.query.get('platform');
  const limit = Math.min(parseInt(req.query.get('limit') || '50'), 100);

  try {
    const pool = getPool();
    let query = 'SELECT sc.*, pq.question_text, pq.topic FROM social_content sc LEFT JOIN pyq_questions pq ON sc.pyq_id = pq.id WHERE 1=1';
    const params: any[] = [];

    if (status) {
      params.push(status);
      query += ` AND sc.status = $${params.length}`;
    }
    if (platform) {
      params.push(platform);
      query += ` AND sc.platform = $${params.length}`;
    }
    params.push(limit);
    query += ` ORDER BY sc.created_at DESC LIMIT $${params.length}`;

    const result = await pool.query(query, params);
    sendJSON(res, { content: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('[social] List error:', (err as Error).message);
    sendError(res, 500, 'Failed to list social content');
  }
}

/**
 * PUT /api/admin/social/:id — Update social content status
 * Body: { status: 'approved' | 'rejected' | 'scheduled', scheduled_at?: string }
 */
async function handleUpdate(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const user = await requireRole(req, res, 'admin');
  if (!user) return;

  const { id } = req.params;
  const { status, scheduled_at } = req.body as any || {};

  if (!status || !['approved', 'rejected', 'scheduled', 'published'].includes(status)) {
    return sendError(res, 400, 'Invalid status');
  }

  try {
    const pool = getPool();
    const result = await pool.query(
      'UPDATE social_content SET status = $1, scheduled_at = $2, approved_by = $3 WHERE id = $4 RETURNING *',
      [status, scheduled_at || null, user.userId !== 'system' ? user.userId : null, id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 404, 'Content not found');
    }
    sendJSON(res, result.rows[0]);
  } catch (err) {
    console.error('[social] Update error:', (err as Error).message);
    sendError(res, 500, 'Failed to update content');
  }
}

/**
 * GET /api/admin/social/pending — Fetch pending posts for external automation
 * Protected by CRON_SECRET or admin role
 */
async function handlePending(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const auth = await getAuth(req);
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = (req.headers.authorization || '') as string;

  if (!auth && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
    return sendError(res, 401, 'Authentication required');
  }

  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT sc.*, pq.question_text, pq.topic
       FROM social_content sc
       LEFT JOIN pyq_questions pq ON sc.pyq_id = pq.id
       WHERE sc.status = 'approved'
       ORDER BY sc.created_at ASC
       LIMIT 20`
    );
    sendJSON(res, { posts: result.rows });
  } catch (err) {
    console.error('[social] Pending error:', (err as Error).message);
    sendError(res, 500, 'Failed to fetch pending posts');
  }
}

export const socialRoutes: RouteDefinition[] = [
  { method: 'GET', path: '/api/admin/social', handler: handleList },
  { method: 'GET', path: '/api/admin/social/pending', handler: handlePending },
  { method: 'PUT', path: '/api/admin/social/:id', handler: handleUpdate },
];
