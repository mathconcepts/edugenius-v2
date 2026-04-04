// @ts-nocheck
/**
 * Feedback Scorer — Blog Post Performance Scoring
 *
 * Scores every published blog post on 3 metrics:
 *   40% engagement  — views per day since publish
 *   40% conversion  — signups driven / views
 *   20% relevance   — does topic match current trend signals?
 *
 * Auto-actions:
 *   - Top 5 posts → flagged for social promotion
 *   - Posts with score < 0.1 after 90 days → auto-archived
 *
 * Cron endpoint: POST /api/content/score (Bearer CRON_SECRET)
 */

import { ServerResponse } from 'http';

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

interface ScoredPost {
  id: string;
  slug: string;
  topic: string;
  content_score: number;
  engagement: number;
  conversion: number;
  relevance: number;
}

// ============================================================================
// Database
// ============================================================================

let _pool: any = null;

function getPool() {
  if (_pool) return _pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('[feedback-scorer] DATABASE_URL not configured');
  const { Pool } = require('pg');
  _pool = new Pool({ connectionString, max: 3, idleTimeoutMillis: 30_000 });
  return _pool;
}

// ============================================================================
// Scoring
// ============================================================================

function normalizeScore(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, value / max));
}

async function runFeedbackScoring(): Promise<{ scored: number; archived: number; topPosts: string[] }> {
  const pool = getPool();

  // Get all published blog posts
  const { rows: posts } = await pool.query(`
    SELECT id, slug, topic, views, published_at
    FROM blog_posts
    WHERE status = 'published'
  `);

  if (posts.length === 0) {
    console.log('[feedback-scorer] No published posts to score');
    return { scored: 0, archived: 0, topPosts: [] };
  }

  // Get conversion data (funnel events that reference blog slugs)
  const { rows: conversions } = await pool.query(`
    SELECT metadata->>'blog_slug' as slug, COUNT(*) as signups
    FROM funnel_events
    WHERE event_type = 'signup_complete'
      AND metadata->>'blog_slug' IS NOT NULL
    GROUP BY metadata->>'blog_slug'
  `);
  const conversionMap: Record<string, number> = {};
  for (const c of conversions) {
    conversionMap[c.slug] = parseInt(c.signups, 10);
  }

  // Get trending topics (last 7 days)
  const { rows: trendingTopics } = await pool.query(`
    SELECT DISTINCT topic_match
    FROM trend_signals
    WHERE topic_match IS NOT NULL
      AND collected_at > NOW() - INTERVAL '7 days'
  `);
  const trendingSet = new Set(trendingTopics.map(r => r.topic_match));

  // Score each post
  const scored: ScoredPost[] = [];
  let maxEngagement = 0;
  let maxConversion = 0;

  // First pass: compute raw values
  const rawScores = posts.map(post => {
    const daysLive = Math.max(1, (Date.now() - new Date(post.published_at).getTime()) / (86400 * 1000));
    const views = post.views || 0;
    const engagement = views / daysLive;
    const signups = conversionMap[post.slug] || 0;
    const conversion = signups / Math.max(views, 1);

    if (engagement > maxEngagement) maxEngagement = engagement;
    if (conversion > maxConversion) maxConversion = conversion;

    return { ...post, engagement, conversion, daysLive };
  });

  // Second pass: normalize and compute composite score
  for (const post of rawScores) {
    const normEngagement = normalizeScore(post.engagement, maxEngagement);
    const normConversion = normalizeScore(post.conversion, maxConversion);
    const relevance = trendingSet.has(post.topic) ? 1 : 0.5;

    const content_score =
      0.4 * normEngagement +
      0.4 * normConversion +
      0.2 * relevance;

    scored.push({
      id: post.id,
      slug: post.slug,
      topic: post.topic,
      content_score,
      engagement: normEngagement,
      conversion: normConversion,
      relevance,
    });
  }

  // Sort by score descending
  scored.sort((a, b) => b.content_score - a.content_score);

  // Update scores in DB
  for (const post of scored) {
    try {
      await pool.query(
        `UPDATE blog_posts SET content_score = $1, last_scored_at = NOW() WHERE id = $2`,
        [post.content_score, post.id]
      );
    } catch (err) {
      console.warn(`[feedback-scorer] Update failed for ${post.slug}:`, (err as Error).message);
    }
  }

  // Auto-archive low-scoring posts after 90 days
  let archived = 0;
  try {
    const archiveResult = await pool.query(`
      UPDATE blog_posts
      SET status = 'archived', updated_at = NOW()
      WHERE status = 'published'
        AND content_score < 0.1
        AND published_at < NOW() - INTERVAL '90 days'
      RETURNING id
    `);
    archived = archiveResult.rowCount || 0;
    if (archived > 0) {
      console.log(`[feedback-scorer] Auto-archived ${archived} low-performing posts`);
    }
  } catch (err) {
    console.warn('[feedback-scorer] Auto-archive failed:', (err as Error).message);
  }

  const topPosts = scored.slice(0, 5).map(p => p.slug);
  console.log(`[feedback-scorer] Scored ${scored.length} posts. Top: ${topPosts.join(', ')}`);

  return { scored: scored.length, archived, topPosts };
}

// ============================================================================
// Route Handler
// ============================================================================

async function handleFeedbackScore(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'CRON_SECRET not configured' }));
    return;
  }

  const authHeader = (req.headers?.['authorization'] || req.headers?.['Authorization']) as string | undefined;
  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  try {
    const result = await runFeedbackScoring();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'complete', ...result }));
  } catch (err) {
    console.error('[feedback-scorer] Pipeline error:', (err as Error).message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}

// ============================================================================
// Exports
// ============================================================================

/** For testing: inject a mock pool */
export function _setPool(pool: any): void { _pool = pool; }

export { runFeedbackScoring, normalizeScore };

export const feedbackScorerRoutes: RouteDefinition[] = [
  { method: 'POST', path: '/api/content/score', handler: handleFeedbackScore },
];
