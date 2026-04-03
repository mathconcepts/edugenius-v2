// @ts-nocheck
/**
 * Blog Routes — CRUD API for blog posts
 *
 * GET  /api/blog          — list published posts (paginated, filterable)
 * GET  /api/blog/:slug    — single post by slug
 * PUT  /api/admin/blog/:id — publish/archive (admin only)
 * POST /api/blog/:id/view — increment view count
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

// ── List published blog posts ─────────────────────────────────────────────────

async function handleListBlogPosts(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const page = parseInt(req.query.get('page') || '1', 10);
  const limit = Math.min(parseInt(req.query.get('limit') || '20', 10), 50);
  const offset = (page - 1) * limit;
  const topic = req.query.get('topic');
  const contentType = req.query.get('type');

  let where = "WHERE status = 'published'";
  const params: unknown[] = [];
  let paramIdx = 1;

  if (topic) {
    where += ` AND topic = $${paramIdx++}`;
    params.push(topic);
  }
  if (contentType) {
    where += ` AND content_type = $${paramIdx++}`;
    params.push(contentType);
  }

  const countResult = await pool.query(`SELECT COUNT(*) FROM blog_posts ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await pool.query(
    `SELECT id, slug, title, excerpt, content_type, topic, exam_tags, views, published_at, created_at
     FROM blog_posts ${where}
     ORDER BY published_at DESC NULLS LAST, created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
    [...params, limit, offset]
  );

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    posts: result.rows,
    total,
    page,
    pages: Math.ceil(total / limit),
  }));
}

// ── Get single blog post by slug ──────────────────────────────────────────────

async function handleGetBlogPost(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { slug } = req.params;
  const result = await pool.query(
    `SELECT * FROM blog_posts WHERE slug = $1 AND status = 'published'`,
    [slug]
  );

  if (result.rows.length === 0) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Blog post not found' }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result.rows[0]));
}

// ── Admin: publish/archive blog post ──────────────────────────────────────────

async function handleUpdateBlogPost(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { id } = req.params;
  const body = req.body as { status?: string } | null;

  if (!body?.status || !['draft', 'published', 'archived'].includes(body.status)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid status. Must be draft, published, or archived.' }));
    return;
  }

  const publishedAt = body.status === 'published' ? 'NOW()' : 'NULL';
  const result = await pool.query(
    `UPDATE blog_posts
     SET status = $1, published_at = ${body.status === 'published' ? 'COALESCE(published_at, NOW())' : 'published_at'},
         updated_at = NOW()
     WHERE id = $2
     RETURNING id, slug, status, published_at`,
    [body.status, id]
  );

  if (result.rows.length === 0) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Blog post not found' }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result.rows[0]));
}

// ── Increment view count ──────────────────────────────────────────────────────

async function handleBlogView(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { id } = req.params;
  // Fire-and-forget, don't wait for result
  pool.query('UPDATE blog_posts SET views = views + 1 WHERE id = $1', [id]).catch(() => {});
  res.writeHead(204);
  res.end();
}

// ── Admin: list all blog posts (including drafts) ─────────────────────────────

async function handleAdminListBlogPosts(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const result = await pool.query(
    `SELECT id, slug, title, excerpt, content_type, topic, status, views, published_at, created_at, updated_at
     FROM blog_posts
     ORDER BY created_at DESC
     LIMIT 100`
  );

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ posts: result.rows }));
}

// ── Export ─────────────────────────────────────────────────────────────────────

export const blogRoutes: RouteDefinition[] = [
  { method: 'GET', path: '/api/blog', handler: handleListBlogPosts },
  { method: 'GET', path: '/api/blog/:slug', handler: handleGetBlogPost },
  { method: 'GET', path: '/api/admin/blog', handler: handleAdminListBlogPosts },
  { method: 'PUT', path: '/api/admin/blog/:id', handler: handleUpdateBlogPost },
  { method: 'POST', path: '/api/blog/:id/view', handler: handleBlogView },
];
