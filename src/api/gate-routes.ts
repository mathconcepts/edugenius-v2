// @ts-nocheck
/**
 * GATE Math App — API Routes
 *
 * Endpoints:
 *   POST /api/verify          — Verify a student answer (3-tier cascade)
 *   POST /api/verify-any      — Verify arbitrary math input (rate-limited)
 *   GET  /api/topics           — List all GATE math topics
 *   GET  /api/problems/:topic  — Get problems for a topic
 *   GET  /api/problems/id/:id  — Get a single problem by ID
 *   GET  /api/sr/:sessionId    — Get SR state for a session
 *   POST /api/sr/:sessionId    — Update SR state after answer
 *   GET  /api/progress/:sessionId — Get progress + weak topics
 *   GET  /solutions/:slug      — SEO page (pre-rendered HTML)
 */

import { ServerResponse } from 'http';
import pg from 'pg';
import { detectTopic } from '../utils/topic-detection';
import { GATE_TOPICS, TOPIC_LABELS, TOPIC_ICONS } from '../constants/topics';
const { Pool } = pg;

// ============================================================================
// Types (matching server.ts pattern)
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
  if (!connectionString) throw new Error('[gate-routes] DATABASE_URL not configured');
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
// GATE Topics (static — derived from seed data)
// ============================================================================

// GATE_TOPICS, TOPIC_LABELS, TOPIC_ICONS imported from ../constants/topics
const GATE_TOPIC_OBJECTS = GATE_TOPICS.map(id => ({
  id,
  name: TOPIC_LABELS[id],
  icon: TOPIC_ICONS[id],
}));

async function handleGetTopics(_req: ParsedRequest, res: ServerResponse): Promise<void> {
  const pool = getPool();
  // Get problem counts per topic
  const result = await pool.query(`
    SELECT topic, COUNT(*) as count
    FROM pyq_questions
    GROUP BY topic
    ORDER BY topic
  `);

  const countMap: Record<string, number> = {};
  for (const row of result.rows) {
    countMap[row.topic] = parseInt(row.count, 10);
  }

  const topics = GATE_TOPIC_OBJECTS.map(t => ({
    ...t,
    problemCount: countMap[t.id] || 0,
  }));

  sendJSON(res, { topics });
}

// ============================================================================
// Problems
// ============================================================================

async function handleGetProblems(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const topic = req.params.topic;
  if (!topic) return sendError(res, 400, 'Topic required');

  const pool = getPool();
  const result = await pool.query(
    `SELECT id, exam_id, year, question_text, options, correct_answer,
            topic, difficulty, marks, negative_marks
     FROM pyq_questions
     WHERE topic = $1
     ORDER BY year DESC, difficulty`,
    [topic],
  );

  sendJSON(res, { problems: result.rows });
}

async function handleGetProblemById(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const id = req.params.id;
  if (!id) return sendError(res, 400, 'Problem ID required');

  const pool = getPool();
  const result = await pool.query(
    `SELECT id, exam_id, year, question_text, options, correct_answer,
            explanation, topic, difficulty, marks, negative_marks
     FROM pyq_questions WHERE id = $1 LIMIT 1`,
    [id],
  );

  if (result.rows.length === 0) return sendError(res, 404, 'Problem not found');
  sendJSON(res, { problem: result.rows[0] });
}

// ============================================================================
// Verification (placeholder — wired to orchestrator in server.ts)
// ============================================================================

// The actual orchestrator is injected via setOrchestrator() from server.ts.
// These handlers call it and log to verification_log.

let _orchestrator: any = null;
let _geminiModel: any = null;

export function setOrchestrator(orch: any): void {
  _orchestrator = orch;
}

export function setGeminiModel(model: any): void {
  _geminiModel = model;
}

async function handleVerify(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = req.body as { problem?: string; answer?: string; sessionId?: string };
  if (!body?.problem || !body?.answer) {
    return sendError(res, 400, 'problem and answer required');
  }

  if (!_orchestrator) {
    return sendError(res, 503, 'Verification service not ready');
  }

  try {
    const result = await _orchestrator.verify(body.problem, body.answer);

    // Log to verification_log
    try {
      const pool = getPool();
      await pool.query(
        `INSERT INTO verification_log
         (trace_id, session_id, problem, answer, tier_used, status, confidence,
          tier1_ms, tier2_ms, tier3_ms, total_ms, rag_score, llm_agreement)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          result.traceId,
          body.sessionId || null,
          body.problem,
          body.answer,
          result.tierUsed,
          result.overallStatus,
          result.overallConfidence,
          result.tierTimings.tier1Ms || null,
          result.tierTimings.tier2Ms || null,
          result.tierTimings.tier3Ms || null,
          result.metadata.totalDurationMs,
          result.ragScore || null,
          result.llmAgreement ?? null,
        ],
      );
    } catch (logErr) {
      console.error('[gate-routes] Failed to log verification:', (logErr as Error).message);
    }

    // Auto-populate notebook
    try {
      const topic = detectTopic(body.problem);
      const nbStatus = result.overallStatus === 'verified' ? 'mastered' :
                        result.overallStatus === 'partial' ? 'in_progress' : 'to_review';
      await pool.query(
        `INSERT INTO notebook_entries (session_id, source, source_id, topic, query_text, answer_text, status, confidence)
         VALUES ($1, 'verify', $2, $3, $4, $5, $6, $7)
         ON CONFLICT (session_id, source, source_id) WHERE source_id IS NOT NULL
         DO UPDATE SET status = $6, confidence = $7, updated_at = NOW()`,
        [body.sessionId, result.traceId, topic, body.problem.slice(0, 200), body.answer, nbStatus, result.overallConfidence]
      );
    } catch (nbErr) {
      console.error('[gate-routes] Notebook persist error:', (nbErr as Error).message);
    }

    sendJSON(res, {
      traceId: result.traceId,
      status: result.overallStatus,
      confidence: result.overallConfidence,
      tierUsed: result.tierUsed,
      durationMs: result.metadata.totalDurationMs,
      checks: result.checks.map((c: any) => ({
        verifier: c.verifier,
        status: c.status,
        confidence: c.confidence,
        details: c.details,
      })),
    });
  } catch (err) {
    console.error('[gate-routes] Verification error:', (err as Error).message);
    sendError(res, 500, 'Verification failed');
  }
}

// Rate-limited verify-any: uses IP + session for rate limiting
const verifyAnyRateLimit = new Map<string, { count: number; resetAt: number }>();
const VERIFY_ANY_LIMIT = 10; // per hour per session
const VERIFY_ANY_WINDOW = 60 * 60 * 1000; // 1 hour

async function handleVerifyAny(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = req.body as { problem?: string; answer?: string; sessionId?: string; image?: string; imageMimeType?: string };

  // If image provided but no problem text, extract via Gemini vision
  if (body?.image && !body?.problem && _geminiModel) {
    try {
      const extractResult = await _geminiModel.generateContent([
        { text: 'Extract the math problem from this image. Return ONLY the problem text exactly as written, no solutions or commentary.' },
        { inlineData: { mimeType: body.imageMimeType || 'image/jpeg', data: body.image } },
      ]);
      body.problem = extractResult.response.text().trim();
    } catch (err) {
      console.error('[gate-routes] Image extraction error:', (err as Error).message);
      return sendError(res, 422, 'Could not extract problem from image');
    }
  }

  if (!body?.problem || !body?.answer) {
    return sendError(res, 400, 'problem and answer required (or provide an image)');
  }

  // Rate limit by session + IP
  const ip = req.headers['x-forwarded-for'] as string || 'unknown';
  const key = `${body.sessionId || ip}`;
  const now = Date.now();
  const entry = verifyAnyRateLimit.get(key);

  if (entry && now < entry.resetAt) {
    if (entry.count >= VERIFY_ANY_LIMIT) {
      return sendError(res, 429, `Rate limit: ${VERIFY_ANY_LIMIT} verifications per hour`);
    }
    entry.count++;
  } else {
    verifyAnyRateLimit.set(key, { count: 1, resetAt: now + VERIFY_ANY_WINDOW });
  }

  // Use same handler
  return handleVerify(req, res);
}

// ============================================================================
// Spaced Repetition (SM-2)
// ============================================================================

async function handleGetSR(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const sessionId = req.params.sessionId;
  if (!sessionId) return sendError(res, 400, 'Session ID required');

  const pool = getPool();

  // Get due reviews
  const due = await pool.query(
    `SELECT sr.*, pq.question_text, pq.topic, pq.difficulty
     FROM sr_sessions sr
     JOIN pyq_questions pq ON pq.id = sr.pyq_id
     WHERE sr.session_id = $1 AND sr.next_review <= CURRENT_DATE
     ORDER BY sr.easiness ASC, sr.next_review ASC
     LIMIT 20`,
    [sessionId],
  );

  // Get overall stats
  const stats = await pool.query(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN next_review <= CURRENT_DATE THEN 1 ELSE 0 END) as due,
       AVG(easiness) as avg_easiness,
       SUM(correct_count) as total_correct,
       SUM(attempts) as total_attempts
     FROM sr_sessions WHERE session_id = $1`,
    [sessionId],
  );

  sendJSON(res, {
    dueReviews: due.rows,
    stats: stats.rows[0] || { total: 0, due: 0, avg_easiness: 2.5, total_correct: 0, total_attempts: 0 },
  });
}

async function handleUpdateSR(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const sessionId = req.params.sessionId;
  const body = req.body as { pyqId?: string; quality?: number; answer?: string };

  if (!sessionId || !body?.pyqId || body.quality === undefined) {
    return sendError(res, 400, 'sessionId, pyqId, and quality (0-5) required');
  }

  const quality = Math.max(0, Math.min(5, Math.round(body.quality)));
  const pool = getPool();

  // Upsert SR session with SM-2 algorithm
  const existing = await pool.query(
    'SELECT * FROM sr_sessions WHERE session_id = $1 AND pyq_id = $2',
    [sessionId, body.pyqId],
  );

  let easiness: number, interval: number, repetitions: number;

  if (existing.rows.length === 0) {
    // First attempt — create new entry
    easiness = Math.max(1.3, 2.5 + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    interval = quality >= 3 ? 1 : 0;
    repetitions = quality >= 3 ? 1 : 0;

    await pool.query(
      `INSERT INTO sr_sessions (session_id, pyq_id, easiness, interval_days, repetitions,
         next_review, last_quality, attempts, correct_count, last_answer)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE + ($4::integer || ' days')::interval, $6, 1, $7, $8)`,
      [
        sessionId, body.pyqId, easiness, interval, repetitions,
        quality, quality >= 3 ? 1 : 0, body.answer || null,
      ],
    );
  } else {
    // Update existing — SM-2 algorithm
    const prev = existing.rows[0];
    easiness = Math.max(1.3, prev.easiness + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

    if (quality >= 3) {
      repetitions = prev.repetitions + 1;
      if (repetitions === 1) interval = 1;
      else if (repetitions === 2) interval = 6;
      else interval = Math.round(prev.interval_days * easiness);
    } else {
      repetitions = 0;
      interval = 0; // Review again today
    }

    await pool.query(
      `UPDATE sr_sessions SET
         easiness = $3, interval_days = $4, repetitions = $5,
         next_review = CURRENT_DATE + ($4::integer || ' days')::interval, last_quality = $6,
         attempts = attempts + 1,
         correct_count = correct_count + $7,
         last_answer = $8,
         updated_at = NOW()
       WHERE session_id = $1 AND pyq_id = $2`,
      [
        sessionId, body.pyqId, easiness, interval, repetitions,
        quality, quality >= 3 ? 1 : 0, body.answer || null,
      ],
    );
  }

  // Auto-populate notebook from SR
  try {
    const questionResult = await pool.query('SELECT topic, question_text FROM pyq_questions WHERE id = $1', [body.pyqId]);
    if (questionResult.rows.length > 0) {
      const q = questionResult.rows[0];
      const nbStatus = quality >= 4 ? 'mastered' : quality >= 3 ? 'in_progress' : 'to_review';
      await pool.query(
        `INSERT INTO notebook_entries (session_id, source, source_id, topic, query_text, status, confidence)
         VALUES ($1, 'practice', $2, $3, $4, $5, $6)
         ON CONFLICT (session_id, source, source_id) WHERE source_id IS NOT NULL
         DO UPDATE SET status = $5, confidence = $6, updated_at = NOW()`,
        [sessionId, body.pyqId, q.topic, (q.question_text || '').slice(0, 200), nbStatus, quality / 5]
      );
    }
  } catch (nbErr) {
    console.error('[gate-routes] Notebook SR persist error:', (nbErr as Error).message);
  }

  sendJSON(res, {
    easiness,
    intervalDays: interval,
    repetitions,
    nextReview: new Date(Date.now() + interval * 86400000).toISOString().slice(0, 10),
  });
}

// ============================================================================
// Progress + Weak Topics
// ============================================================================

async function handleGetProgress(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const sessionId = req.params.sessionId;
  if (!sessionId) return sendError(res, 400, 'Session ID required');

  const pool = getPool();

  // Per-topic mastery
  const topicStats = await pool.query(
    `SELECT
       pq.topic,
       COUNT(*) as total_problems,
       SUM(sr.correct_count) as correct,
       SUM(sr.attempts) as attempts,
       AVG(sr.easiness) as avg_easiness,
       SUM(CASE WHEN sr.next_review <= CURRENT_DATE THEN 1 ELSE 0 END) as due
     FROM sr_sessions sr
     JOIN pyq_questions pq ON pq.id = sr.pyq_id
     WHERE sr.session_id = $1
     GROUP BY pq.topic
     ORDER BY AVG(sr.easiness) ASC`,
    [sessionId],
  );

  // Overall stats
  const overall = await pool.query(
    `SELECT
       COUNT(DISTINCT sr.pyq_id) as problems_attempted,
       SUM(sr.correct_count) as total_correct,
       SUM(sr.attempts) as total_attempts,
       SUM(CASE WHEN sr.next_review <= CURRENT_DATE THEN 1 ELSE 0 END) as due_today
     FROM sr_sessions sr
     WHERE sr.session_id = $1`,
    [sessionId],
  );

  // Weak topics: lowest easiness = hardest for student
  const weakTopics = topicStats.rows
    .filter((r: any) => parseFloat(r.avg_easiness) < 2.5 || (parseInt(r.attempts) > 0 && parseInt(r.correct) / parseInt(r.attempts) < 0.6))
    .map((r: any) => ({
      topic: r.topic,
      mastery: parseInt(r.attempts) > 0 ? parseInt(r.correct) / parseInt(r.attempts) : 0,
      easiness: parseFloat(r.avg_easiness),
      due: parseInt(r.due),
    }));

  sendJSON(res, {
    topics: topicStats.rows.map((r: any) => ({
      topic: r.topic,
      totalProblems: parseInt(r.total_problems),
      correct: parseInt(r.correct) || 0,
      attempts: parseInt(r.attempts) || 0,
      mastery: parseInt(r.attempts) > 0 ? parseInt(r.correct) / parseInt(r.attempts) : 0,
      easiness: parseFloat(r.avg_easiness),
      due: parseInt(r.due),
    })),
    overall: overall.rows[0],
    weakTopics,
  });
}

// ============================================================================
// Exam Readiness Score
// ============================================================================

async function handleExamReadiness(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const sessionId = req.params.sessionId;
  if (!sessionId) return sendError(res, 400, 'Session ID required');

  const pool = getPool();

  try {
    // Topic coverage + accuracy from sr_sessions
    const srStats = await pool.query(
      `SELECT
         COUNT(DISTINCT pq.topic) as topics_attempted,
         SUM(sr.correct_count) as total_correct,
         SUM(sr.attempts) as total_attempts,
         COUNT(*) as total_sr,
         SUM(CASE WHEN sr.next_review >= CURRENT_DATE THEN 1 ELSE 0 END) as on_schedule
       FROM sr_sessions sr
       JOIN pyq_questions pq ON pq.id = sr.pyq_id
       WHERE sr.session_id = $1`,
      [sessionId],
    );

    // Weak topics (mastery < 50%)
    const weakTopics = await pool.query(
      `SELECT pq.topic, SUM(sr.correct_count) as correct, SUM(sr.attempts) as attempts
       FROM sr_sessions sr
       JOIN pyq_questions pq ON pq.id = sr.pyq_id
       WHERE sr.session_id = $1
       GROUP BY pq.topic
       HAVING SUM(sr.attempts) > 0 AND (SUM(sr.correct_count)::float / SUM(sr.attempts)) < 0.5`,
      [sessionId],
    );

    // Streak
    const streak = await pool.query(
      'SELECT current_streak FROM streaks WHERE identifier = $1',
      [sessionId],
    );

    const stats = srStats.rows[0] || {};
    const topicsAttempted = parseInt(stats.topics_attempted) || 0;
    const totalCorrect = parseInt(stats.total_correct) || 0;
    const totalAttempts = parseInt(stats.total_attempts) || 0;
    const totalSR = parseInt(stats.total_sr) || 0;
    const onSchedule = parseInt(stats.on_schedule) || 0;
    const currentStreak = parseInt(streak.rows[0]?.current_streak) || 0;
    const weakCount = weakTopics.rows.length;

    // Sub-scores (each 0-1)
    const coverage = topicsAttempted / GATE_TOPICS.length;
    const accuracy = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;
    const srHealth = totalSR > 0 ? onSchedule / totalSR : 0;
    const weakPenalty = topicsAttempted > 0 ? 1 - (weakCount / topicsAttempted) : 0;
    const consistency = Math.min(currentStreak / 30, 1.0);

    // Composite score (0-100)
    const score = Math.round(
      (coverage * 0.30 + accuracy * 0.25 + srHealth * 0.25 + weakPenalty * 0.10 + consistency * 0.10) * 100
    );

    // Days until GATE 2027 (Feb 1)
    const gateDate = new Date('2027-02-01T00:00:00+05:30');
    const daysLeft = Math.max(0, Math.ceil((gateDate.getTime() - Date.now()) / 86400000));

    sendJSON(res, {
      score,
      breakdown: {
        coverage: Math.round(coverage * 100),
        accuracy: Math.round(accuracy * 100),
        srHealth: Math.round(srHealth * 100),
        weakSpots: Math.round(weakPenalty * 100),
        consistency: Math.round(consistency * 100),
      },
      daysLeft,
      topicsAttempted,
      weakTopicCount: weakCount,
    });
  } catch (err) {
    console.error('[gate-routes] Exam readiness error:', (err as Error).message);
    sendError(res, 500, 'Failed to compute exam readiness');
  }
}

// ============================================================================
// SEO Pages
// ============================================================================

async function handleGetSEOPage(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const slug = req.params.slug;
  if (!slug) return sendError(res, 400, 'Slug required');

  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM seo_pages WHERE slug = $1 LIMIT 1',
    [slug],
  );

  if (result.rows.length === 0) return sendError(res, 404, 'Page not found');

  const page = result.rows[0];

  // Serve as HTML with meta tags
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${page.title} | GATE Math Practice</title>
  <meta name="description" content="${page.meta_desc || page.title}">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.28/dist/katex.min.css">
</head>
<body>
  ${page.html_content}
</body>
</html>`);
}

// ============================================================================
// Analytics (fire-and-forget, inserts into analytics_events)
// ============================================================================

async function handleAnalytics(req: ParsedRequest, res: ServerResponse) {
  const body = req.body as { event_type?: string; identifier?: string; metadata?: object } | null;
  if (!body?.event_type) {
    res.writeHead(204);
    res.end();
    return;
  }
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO analytics_events (event_type, identifier, metadata) VALUES ($1, $2, $3)`,
      [body.event_type, body.identifier || null, JSON.stringify(body.metadata || {})]
    );
  } catch {
    // Silently ignore — analytics should never break the app
  }
  res.writeHead(204);
  res.end();
}

// ============================================================================
// Route Definitions
// ============================================================================

export const gateRoutes: RouteDefinition[] = [
  // Topics
  { method: 'GET', path: '/api/topics', handler: handleGetTopics },

  // Problems
  { method: 'GET', path: '/api/problems/:topic', handler: handleGetProblems },
  { method: 'GET', path: '/api/problems/id/:id', handler: handleGetProblemById },

  // Verification
  { method: 'POST', path: '/api/verify', handler: handleVerify },
  { method: 'POST', path: '/api/verify-any', handler: handleVerifyAny },

  // Spaced Repetition
  { method: 'GET', path: '/api/sr/:sessionId', handler: handleGetSR },
  { method: 'POST', path: '/api/sr/:sessionId', handler: handleUpdateSR },

  // Progress
  { method: 'GET', path: '/api/progress/:sessionId', handler: handleGetProgress },

  // Exam Readiness
  { method: 'GET', path: '/api/exam-readiness/:sessionId', handler: handleExamReadiness },

  // Analytics
  { method: 'POST', path: '/api/analytics', handler: handleAnalytics },

  // SEO Pages
  { method: 'GET', path: '/solutions/:slug', handler: handleGetSEOPage },
];
