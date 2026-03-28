// @ts-nocheck
/**
 * GATE Math App — Smart Notebook Routes
 *
 * Endpoints:
 *   GET  /api/notebook/:sessionId          — List notebook entries (filterable)
 *   GET  /api/notebook/:sessionId/summary  — Topic-wise completion stats
 *   PUT  /api/notebook/:sessionId/:entryId — Update entry status
 */

import { ServerResponse } from 'http';
import pg from 'pg';
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
  if (!connectionString) throw new Error('[notebook-routes] DATABASE_URL not configured');
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

// ============================================================================
// Handlers
// ============================================================================

async function handleGetNotebook(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const sessionId = req.params.sessionId;
  if (!sessionId) return sendError(res, 400, 'Session ID required');

  const topic = req.query.get('topic');
  const status = req.query.get('status');
  const limit = Math.min(parseInt(req.query.get('limit') || '50', 10), 100);
  const offset = parseInt(req.query.get('offset') || '0', 10);

  const pool = getPool();

  let query = 'SELECT * FROM notebook_entries WHERE session_id = $1';
  const params: any[] = [sessionId];
  let paramIdx = 2;

  if (topic && topic !== 'all') {
    query += ` AND topic = $${paramIdx}`;
    params.push(topic);
    paramIdx++;
  }

  if (status) {
    query += ` AND status = $${paramIdx}`;
    params.push(status);
    paramIdx++;
  }

  // Get total count
  const countResult = await pool.query(
    query.replace('SELECT *', 'SELECT COUNT(*) as total'),
    params,
  );

  query += ` ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);

  sendJSON(res, {
    entries: result.rows,
    total: parseInt(countResult.rows[0]?.total) || 0,
  });
}

async function handleGetNotebookSummary(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const sessionId = req.params.sessionId;
  if (!sessionId) return sendError(res, 400, 'Session ID required');

  const pool = getPool();

  const result = await pool.query(
    `SELECT
       topic,
       COUNT(*) as total,
       SUM(CASE WHEN status = 'mastered' THEN 1 ELSE 0 END) as mastered,
       SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
       SUM(CASE WHEN status = 'to_review' THEN 1 ELSE 0 END) as to_review
     FROM notebook_entries
     WHERE session_id = $1
     GROUP BY topic
     ORDER BY topic`,
    [sessionId],
  );

  const totalResult = await pool.query(
    'SELECT COUNT(*) as total FROM notebook_entries WHERE session_id = $1',
    [sessionId],
  );

  sendJSON(res, {
    topics: result.rows.map((r: any) => ({
      topic: r.topic,
      total: parseInt(r.total),
      mastered: parseInt(r.mastered),
      inProgress: parseInt(r.in_progress),
      toReview: parseInt(r.to_review),
    })),
    totalEntries: parseInt(totalResult.rows[0]?.total) || 0,
  });
}

async function handleUpdateNotebookEntry(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { sessionId, entryId } = req.params;
  const body = req.body as { status?: string };

  if (!sessionId || !entryId) return sendError(res, 400, 'sessionId and entryId required');
  if (!body?.status || !['mastered', 'in_progress', 'to_review'].includes(body.status)) {
    return sendError(res, 400, 'status must be mastered, in_progress, or to_review');
  }

  const pool = getPool();

  const result = await pool.query(
    'UPDATE notebook_entries SET status = $3, updated_at = NOW() WHERE session_id = $1 AND id = $2 RETURNING id',
    [sessionId, entryId, body.status],
  );

  if (result.rowCount === 0) return sendError(res, 404, 'Entry not found');
  sendJSON(res, { ok: true });
}

// ============================================================================
// Route Definitions (summary BEFORE entryId to avoid param conflict)
// ============================================================================

export const notebookRoutes: RouteDefinition[] = [
  { method: 'GET', path: '/api/notebook/:sessionId/summary', handler: handleGetNotebookSummary },
  { method: 'GET', path: '/api/notebook/:sessionId', handler: handleGetNotebook },
  { method: 'PUT', path: '/api/notebook/:sessionId/:entryId', handler: handleUpdateNotebookEntry },
];
