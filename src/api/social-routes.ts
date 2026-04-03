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

// ── Post to platform (Telegram primary, Twitter optional) ─────────────────────

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_GROUP_IDS = (process.env.TELEGRAM_GROUP_IDS || '').split(',').filter(Boolean);
const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET;
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
const TWITTER_ACCESS_SECRET = process.env.TWITTER_ACCESS_SECRET;
const BASE_URL = process.env.BASE_URL || 'https://gate-math-api.onrender.com';

async function postToTelegram(content: string, topic?: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_GROUP_IDS.length === 0) {
    console.log('[social] Telegram not configured, skipping');
    return false;
  }

  try {
    for (const chatId of TELEGRAM_GROUP_IDS) {
      const blogLink = topic ? `${BASE_URL}/blog?topic=${encodeURIComponent(topic)}` : `${BASE_URL}/blog`;
      const message = `${content}\n\n📚 Read more: ${blogLink}\n🎯 Practice: ${BASE_URL}`;

      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text: message,
          parse_mode: 'HTML',
          reply_markup: JSON.stringify({
            inline_keyboard: [[
              { text: '📖 Read Article', url: blogLink },
              { text: '🎯 Practice Now', url: BASE_URL },
            ]],
          }),
        }),
      });
    }
    return true;
  } catch (err) {
    console.error('[social] Telegram post failed:', (err as Error).message);
    return false;
  }
}

async function postToTwitter(content: string): Promise<boolean> {
  if (!TWITTER_API_KEY || !TWITTER_ACCESS_TOKEN) {
    console.log('[social] Twitter not configured, skipping');
    return false;
  }

  // Twitter API v2 OAuth 1.0a posting
  // For simplicity, using Basic Bearer token flow if available
  try {
    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TWITTER_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: content.substring(0, 280) }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[social] Twitter API error: ${response.status} ${error}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[social] Twitter post failed:', (err as Error).message);
    return false;
  }
}

/**
 * POST /api/admin/social/:id/post — Actually post to platform
 */
async function handlePostToplatform(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const user = await requireRole(req, res, 'admin');
  if (!user) return;

  const { id } = req.params;
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT sc.*, pq.topic FROM social_content sc
       LEFT JOIN pyq_questions pq ON sc.pyq_id = pq.id
       WHERE sc.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 404, 'Content not found');
    }

    const post = result.rows[0];
    let posted = false;

    if (post.platform === 'twitter') {
      posted = await postToTwitter(post.content);
    } else {
      // For instagram/linkedin, post to Telegram as the primary channel
      posted = await postToTelegram(post.content, post.topic);
    }

    if (posted) {
      await pool.query(
        `UPDATE social_content SET status = 'published', published_at = NOW() WHERE id = $1`,
        [id]
      );
    }

    sendJSON(res, { posted, platform: post.platform });
  } catch (err) {
    console.error('[social] Post error:', (err as Error).message);
    sendError(res, 500, 'Failed to post content');
  }
}

/**
 * POST /api/social/auto-post — Cron: auto-post approved content
 * Posts approved content where scheduled_at <= now and published_at IS NULL.
 * Rate limit: 5/day Telegram, 3/day Twitter.
 */
async function handleAutoPost(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = (req.headers.authorization || '') as string;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return sendError(res, 401, 'Unauthorized');
  }

  try {
    const pool = getPool();

    // Check daily post counts
    const countResult = await pool.query(
      `SELECT platform, COUNT(*) as count
       FROM social_content
       WHERE status = 'published' AND published_at >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date
       GROUP BY platform`
    );
    const dailyCounts: Record<string, number> = {};
    countResult.rows.forEach(r => { dailyCounts[r.platform] = parseInt(r.count); });

    const limits: Record<string, number> = { twitter: 3, instagram: 5, linkedin: 5 };
    let posted = 0;

    // Get approved posts ready to publish
    const pendingResult = await pool.query(
      `SELECT sc.id, sc.platform, sc.content, pq.topic
       FROM social_content sc
       LEFT JOIN pyq_questions pq ON sc.pyq_id = pq.id
       WHERE sc.status = 'approved'
         AND (sc.scheduled_at IS NULL OR sc.scheduled_at <= NOW())
         AND sc.published_at IS NULL
       ORDER BY sc.created_at ASC
       LIMIT 10`
    );

    for (const post of pendingResult.rows) {
      if ((dailyCounts[post.platform] || 0) >= (limits[post.platform] || 5)) {
        continue; // Daily limit reached for this platform
      }

      let success = false;
      if (post.platform === 'twitter') {
        success = await postToTwitter(post.content);
      } else {
        success = await postToTelegram(post.content, post.topic);
      }

      if (success) {
        await pool.query(
          `UPDATE social_content SET status = 'published', published_at = NOW() WHERE id = $1`,
          [post.id]
        );
        dailyCounts[post.platform] = (dailyCounts[post.platform] || 0) + 1;
        posted++;
      }
    }

    console.log(`[social] Auto-post: ${posted} posts published`);
    sendJSON(res, { posted, dailyCounts });
  } catch (err) {
    console.error('[social] Auto-post error:', (err as Error).message);
    sendError(res, 500, 'Auto-post failed');
  }
}

export const socialRoutes: RouteDefinition[] = [
  { method: 'GET', path: '/api/admin/social', handler: handleList },
  { method: 'GET', path: '/api/admin/social/pending', handler: handlePending },
  { method: 'PUT', path: '/api/admin/social/:id', handler: handleUpdate },
  { method: 'POST', path: '/api/admin/social/:id/post', handler: handlePostToplatform },
  { method: 'POST', path: '/api/social/auto-post', handler: handleAutoPost },
];
