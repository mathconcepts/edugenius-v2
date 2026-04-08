// @ts-nocheck
/**
 * Content Prioritizer — Weighted Priority Scoring
 *
 * Combines 5 signals to decide what topics the flywheel should generate next:
 *   30% user_struggle  — low accuracy topics need more content
 *   25% trend_signal   — what's being searched/discussed NOW
 *   20% conversion_rate — topics whose blog posts drive signups
 *   15% view_velocity  — fast-growing views = organic demand
 *   10% coverage_gap   — inverse problem count (existing behavior)
 *
 * Falls back gracefully: if no trend data → internal signals only.
 * If no data at all → returns equal priority for all topics.
 *
 * Cron endpoint: POST /api/content/prioritize (Bearer CRON_SECRET)
 */

import { ServerResponse } from 'http';
import { GATE_TOPICS } from '../constants/topics';
import { BLOG_CONTENT_TYPES } from '../constants/content-types';

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

// GATE_TOPICS imported from ../constants/topics
// BLOG_CONTENT_TYPES imported from ../constants/content-types
const CONTENT_TYPES = BLOG_CONTENT_TYPES;

// ============================================================================
// Database
// ============================================================================

let _pool: any = null;

function getPool() {
  if (_pool) return _pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('[prioritizer] DATABASE_URL not configured');
  const { Pool } = require('pg');
  _pool = new Pool({ connectionString, max: 3, idleTimeoutMillis: 30_000 });
  return _pool;
}

// ============================================================================
// Signal Computation
// ============================================================================

function normalize(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, value / max));
}

async function computeUserStruggle(): Promise<Record<string, number>> {
  const pool = getPool();
  const result: Record<string, number> = {};

  try {
    const { rows } = await pool.query(`
      SELECT topic, AVG(accuracy) as avg_accuracy
      FROM (
        SELECT
          q.topic,
          CASE WHEN s.selected_answer = q.correct_answer THEN 1.0 ELSE 0.0 END as accuracy
        FROM sr_sessions s
        JOIN pyq_questions q ON q.id = s.question_id
        WHERE s.created_at > NOW() - INTERVAL '30 days'
          AND q.topic IS NOT NULL
      ) sub
      GROUP BY topic
    `);

    for (const row of rows) {
      // Low accuracy = high struggle = high priority
      result[row.topic] = 1 - parseFloat(row.avg_accuracy || '0.5');
    }
  } catch (err) {
    console.warn('[prioritizer] User struggle query failed:', (err as Error).message);
  }

  // Default: 0.5 struggle for topics with no data
  for (const topic of GATE_TOPICS) {
    if (!(topic in result)) result[topic] = 0.5;
  }
  return result;
}

async function computeTrendSignal(): Promise<Record<string, number>> {
  const pool = getPool();
  const result: Record<string, number> = {};

  try {
    const { rows } = await pool.query(`
      SELECT topic_match, COUNT(*) as count
      FROM trend_signals
      WHERE topic_match IS NOT NULL
        AND collected_at > NOW() - INTERVAL '7 days'
      GROUP BY topic_match
    `);

    const maxCount = Math.max(...rows.map(r => parseInt(r.count, 10)), 1);
    for (const row of rows) {
      result[row.topic_match] = normalize(parseInt(row.count, 10), maxCount);
    }
  } catch (err) {
    console.warn('[prioritizer] Trend signal query failed:', (err as Error).message);
  }

  for (const topic of GATE_TOPICS) {
    if (!(topic in result)) result[topic] = 0;
  }
  return result;
}

async function computeConversionRate(): Promise<Record<string, number>> {
  const pool = getPool();
  const result: Record<string, number> = {};

  try {
    const { rows } = await pool.query(`
      SELECT
        metadata->>'blog_topic' as topic,
        COUNT(*) FILTER (WHERE event_type = 'signup_complete') as signups,
        COUNT(*) FILTER (WHERE event_type = 'page_view') as views
      FROM funnel_events
      WHERE metadata->>'blog_topic' IS NOT NULL
        AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY metadata->>'blog_topic'
    `);

    for (const row of rows) {
      const views = parseInt(row.views, 10) || 1;
      const signups = parseInt(row.signups, 10) || 0;
      result[row.topic] = Math.min(1, signups / views);
    }
  } catch (err) {
    console.warn('[prioritizer] Conversion rate query failed:', (err as Error).message);
  }

  for (const topic of GATE_TOPICS) {
    if (!(topic in result)) result[topic] = 0;
  }
  return result;
}

async function computeViewVelocity(): Promise<Record<string, number>> {
  const pool = getPool();
  const result: Record<string, number> = {};

  try {
    const { rows } = await pool.query(`
      SELECT topic, SUM(views) as total_views,
             GREATEST(1, EXTRACT(EPOCH FROM NOW() - MIN(published_at)) / 86400) as days
      FROM blog_posts
      WHERE status = 'published'
        AND published_at > NOW() - INTERVAL '14 days'
        AND topic IS NOT NULL
      GROUP BY topic
    `);

    const velocities: Record<string, number> = {};
    let maxVelocity = 0;
    for (const row of rows) {
      const velocity = parseFloat(row.total_views) / parseFloat(row.days);
      velocities[row.topic] = velocity;
      if (velocity > maxVelocity) maxVelocity = velocity;
    }

    for (const [topic, velocity] of Object.entries(velocities)) {
      result[topic] = normalize(velocity, maxVelocity);
    }
  } catch (err) {
    console.warn('[prioritizer] View velocity query failed:', (err as Error).message);
  }

  for (const topic of GATE_TOPICS) {
    if (!(topic in result)) result[topic] = 0;
  }
  return result;
}

async function computeCoverageGap(): Promise<Record<string, number>> {
  const pool = getPool();
  const result: Record<string, number> = {};

  try {
    const { rows } = await pool.query(`
      SELECT topic, COUNT(*) as count
      FROM pyq_questions
      WHERE topic IS NOT NULL
      GROUP BY topic
    `);

    const maxCount = Math.max(...rows.map(r => parseInt(r.count, 10)), 1);
    for (const row of rows) {
      // Fewer problems = higher gap = higher priority
      result[row.topic] = 1 - normalize(parseInt(row.count, 10), maxCount);
    }
  } catch (err) {
    console.warn('[prioritizer] Coverage gap query failed:', (err as Error).message);
  }

  // Topics with zero problems get max gap
  for (const topic of GATE_TOPICS) {
    if (!(topic in result)) result[topic] = 1;
  }
  return result;
}

// ============================================================================
// Content Type Selection
// ============================================================================

function selectContentType(
  topic: string,
  struggle: number,
  trendSignal: number,
  conversion: number
): string {
  // High user struggle → solved problems (users need practice)
  if (struggle > 0.7) return 'solved_problem';
  // High trend signal → topic explainer (capture search traffic)
  if (trendSignal > 0.6) return 'topic_explainer';
  // High conversion → whatever converts (default: exam_strategy)
  if (conversion > 0.3) return 'exam_strategy';
  // Default: rotate
  const idx = GATE_TOPICS.indexOf(topic) % CONTENT_TYPES.length;
  return CONTENT_TYPES[idx >= 0 ? idx : 0];
}

// ============================================================================
// Main Prioritization Pipeline
// ============================================================================

interface PriorityResult {
  topic: string;
  content_type: string;
  priority_score: number;
  signals: Record<string, number>;
}

async function runPrioritization(): Promise<PriorityResult[]> {
  // Compute all signals in parallel
  const [struggle, trends, conversion, velocity, coverage] = await Promise.all([
    computeUserStruggle(),
    computeTrendSignal(),
    computeConversionRate(),
    computeViewVelocity(),
    computeCoverageGap(),
  ]);

  const priorities: PriorityResult[] = [];

  for (const topic of GATE_TOPICS) {
    const signals = {
      user_struggle: struggle[topic] || 0,
      trend_signal: trends[topic] || 0,
      conversion_rate: conversion[topic] || 0,
      view_velocity: velocity[topic] || 0,
      coverage_gap: coverage[topic] || 0,
    };

    const priority_score =
      0.30 * signals.user_struggle +
      0.25 * signals.trend_signal +
      0.20 * signals.conversion_rate +
      0.15 * signals.view_velocity +
      0.10 * signals.coverage_gap;

    const content_type = selectContentType(
      topic,
      signals.user_struggle,
      signals.trend_signal,
      signals.conversion_rate
    );

    priorities.push({ topic, content_type, priority_score, signals });
  }

  // Sort by priority descending
  priorities.sort((a, b) => b.priority_score - a.priority_score);

  // Persist to DB
  const pool = getPool();
  for (const p of priorities) {
    try {
      await pool.query(
        `INSERT INTO content_priorities (topic, content_type, priority_score, signals)
         VALUES ($1, $2, $3, $4)`,
        [p.topic, p.content_type, p.priority_score, JSON.stringify(p.signals)]
      );
    } catch (err) {
      console.warn(`[prioritizer] Insert failed for ${p.topic}:`, (err as Error).message);
    }
  }

  console.log('[prioritizer] Complete:', priorities.map(p => `${p.topic}=${p.priority_score.toFixed(3)}`).join(', '));
  return priorities;
}

// ============================================================================
// Route Handler
// ============================================================================

async function handlePrioritize(req: ParsedRequest, res: ServerResponse): Promise<void> {
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
    const result = await runPrioritization();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'complete', priorities: result }));
  } catch (err) {
    console.error('[prioritizer] Pipeline error:', (err as Error).message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}

// ============================================================================
// Exports
// ============================================================================

export { runPrioritization, computeUserStruggle, computeTrendSignal, computeConversionRate, computeViewVelocity, computeCoverageGap, selectContentType, normalize };

export const contentPrioritizerRoutes: RouteDefinition[] = [
  { method: 'POST', path: '/api/content/prioritize', handler: handlePrioritize },
];
