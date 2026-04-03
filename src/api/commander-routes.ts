// @ts-nocheck
/**
 * Study Commander API Routes
 *
 * Endpoints:
 *   POST /api/onboard                    — Save study profile (onboarding)
 *   GET  /api/onboard/:sessionId         — Get study profile
 *   GET  /api/diagnostic/:sessionId      — Get diagnostic questions (10, 1/topic)
 *   POST /api/diagnostic/:sessionId      — Save diagnostic scores
 *   GET  /api/today/:sessionId           — Get/create today's daily plan
 *   POST /api/today/:sessionId/:taskIdx/rate — Rate task completion
 *   GET  /api/priority/:sessionId        — Get priority ranking
 */

import { ServerResponse } from 'http';
import { randomUUID } from 'crypto';
import pg from 'pg';
import { computePriority, generateDailyTasks, MARKS_WEIGHTS, TOPIC_NAMES } from '../engine/priority-engine';

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
  if (!connectionString) throw new Error('[commander] DATABASE_URL not configured');
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
// IST date helper
// ============================================================================

function getISTDate(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  return istTime.toISOString().slice(0, 10);
}

function getISTNow(): Date {
  const now = new Date();
  return new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
}

// ============================================================================
// Validation
// ============================================================================

const VALID_TOPIC_IDS = Object.keys(MARKS_WEIGHTS);

function validateOnboardInput(body: any): string | null {
  if (!body || typeof body !== 'object') return 'Request body required';
  const { exam_date, target_score, weekly_hours, topic_confidence } = body;

  if (!exam_date || typeof exam_date !== 'string') return 'exam_date is required (YYYY-MM-DD)';
  const examDate = new Date(exam_date);
  if (isNaN(examDate.getTime())) return 'exam_date must be a valid date';
  const todayIST = getISTDate();
  if (exam_date < todayIST) return 'exam_date must be today or later';

  if (target_score !== null && target_score !== undefined) {
    if (typeof target_score !== 'number' || target_score < 1 || target_score > 100) {
      return 'target_score must be between 1 and 100';
    }
  }

  if (weekly_hours !== undefined) {
    if (typeof weekly_hours !== 'number' || weekly_hours < 1 || weekly_hours > 100) {
      return 'weekly_hours must be between 1 and 100';
    }
  }

  if (!topic_confidence || typeof topic_confidence !== 'object') {
    return 'topic_confidence is required (object with topic keys)';
  }

  for (const topicId of VALID_TOPIC_IDS) {
    const val = topic_confidence[topicId];
    if (val === undefined || val === null) {
      return `topic_confidence missing key: ${topicId}`;
    }
    if (typeof val !== 'number' || val < 1 || val > 5) {
      return `topic_confidence[${topicId}] must be 1-5`;
    }
  }

  return null;
}

// ============================================================================
// Handlers
// ============================================================================

/** POST /api/onboard — Save study profile */
async function handlePostOnboard(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = req.body as any;
  const error = validateOnboardInput(body);
  if (error) return sendError(res, 400, error);

  const { session_id, exam_date, target_score, weekly_hours, topic_confidence } = body;
  if (!session_id || typeof session_id !== 'string') return sendError(res, 400, 'session_id is required');

  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO study_profiles (session_id, exam_date, target_score, weekly_hours, topic_confidence)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (session_id) DO UPDATE SET
       exam_date = EXCLUDED.exam_date,
       target_score = EXCLUDED.target_score,
       weekly_hours = EXCLUDED.weekly_hours,
       topic_confidence = EXCLUDED.topic_confidence,
       updated_at = NOW()
     RETURNING id, session_id, exam_date, target_score, weekly_hours, topic_confidence, created_at`,
    [session_id, exam_date, target_score || null, weekly_hours || 10, JSON.stringify(topic_confidence)]
  );

  sendJSON(res, { profile: result.rows[0] }, 201);
}

/** GET /api/onboard/:sessionId — Get study profile */
async function handleGetOnboard(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { sessionId } = req.params;
  if (!sessionId) return sendError(res, 400, 'sessionId required');

  const pool = getPool();
  const result = await pool.query(
    `SELECT id, session_id, exam_date, target_score, weekly_hours, topic_confidence,
            diagnostic_scores, diagnostic_taken_at, created_at, updated_at
     FROM study_profiles WHERE session_id = $1`,
    [sessionId]
  );

  if (result.rows.length === 0) {
    return sendJSON(res, { profile: null });
  }

  sendJSON(res, { profile: result.rows[0] });
}

/** GET /api/diagnostic/:sessionId — Get 10 diagnostic questions (1/topic) */
async function handleGetDiagnostic(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { sessionId } = req.params;
  if (!sessionId) return sendError(res, 400, 'sessionId required');

  const pool = getPool();

  // Get 1 question per topic, preferring easy/medium difficulty
  const result = await pool.query(`
    SELECT DISTINCT ON (topic) id, topic, question_text, options, difficulty, year
    FROM pyq_questions
    WHERE topic = ANY($1)
    ORDER BY topic,
      CASE WHEN difficulty IN ('easy', 'medium') THEN 0 ELSE 1 END,
      RANDOM()
  `, [VALID_TOPIC_IDS]);

  const questions = result.rows.map((row: any, idx: number) => ({
    index: idx,
    id: row.id,
    topic: row.topic,
    topic_name: TOPIC_NAMES[row.topic] || row.topic,
    question_text: row.question_text,
    options: row.options,
    difficulty: row.difficulty,
    year: row.year,
  }));

  sendJSON(res, { questions, total: questions.length });
}

/** POST /api/diagnostic/:sessionId — Save diagnostic scores */
async function handlePostDiagnostic(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { sessionId } = req.params;
  if (!sessionId) return sendError(res, 400, 'sessionId required');

  const body = req.body as any;
  if (!body || !body.scores || typeof body.scores !== 'object') {
    return sendError(res, 400, 'scores object required (topic_id → 0-1 accuracy)');
  }

  // Validate scores
  for (const [topic, score] of Object.entries(body.scores)) {
    if (!VALID_TOPIC_IDS.includes(topic)) {
      return sendError(res, 400, `Invalid topic: ${topic}`);
    }
    if (typeof score !== 'number' || score < 0 || score > 1) {
      return sendError(res, 400, `Score for ${topic} must be 0-1`);
    }
  }

  const pool = getPool();

  // Check profile exists
  const profileResult = await pool.query(
    'SELECT id, diagnostic_scores FROM study_profiles WHERE session_id = $1',
    [sessionId]
  );
  if (profileResult.rows.length === 0) {
    return sendError(res, 404, 'Study profile not found — complete onboarding first');
  }

  // Append to diagnostic_scores array (preserve history)
  const newEntry = {
    scores: body.scores,
    taken_at: new Date().toISOString(),
  };

  await pool.query(
    `UPDATE study_profiles
     SET diagnostic_scores = COALESCE(diagnostic_scores, '[]'::jsonb) || $2::jsonb,
         diagnostic_taken_at = NOW(),
         updated_at = NOW()
     WHERE session_id = $1`,
    [sessionId, JSON.stringify([newEntry])]
  );

  sendJSON(res, { ok: true, entry: newEntry });
}

/** GET /api/today/:sessionId — Get/create today's daily plan (idempotent) */
async function handleGetToday(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { sessionId } = req.params;
  if (!sessionId) return sendError(res, 400, 'sessionId required');

  const pool = getPool();
  const todayIST = getISTDate();

  // Check if plan already exists (most common path)
  const existing = await pool.query(
    'SELECT id, tasks, completed, plan_date, created_at FROM daily_plans WHERE session_id = $1 AND plan_date = $2',
    [sessionId, todayIST]
  );

  if (existing.rows.length > 0) {
    return sendJSON(res, { plan: existing.rows[0] });
  }

  // Get study profile
  const profileResult = await pool.query(
    `SELECT exam_date, target_score, weekly_hours, topic_confidence, diagnostic_scores
     FROM study_profiles WHERE session_id = $1`,
    [sessionId]
  );

  if (profileResult.rows.length === 0) {
    return sendError(res, 404, 'Study profile not found — complete onboarding first');
  }

  const profile = profileResult.rows[0];

  // Get SR stats for priority computation (JOIN with pyq_questions to get topic)
  const srResult = await pool.query(`
    SELECT
      pq.topic,
      AVG(CASE WHEN ss.correct_count > 0 THEN ss.correct_count::float / NULLIF(ss.attempts, 0) ELSE 0 END) as accuracy,
      COUNT(*) as sessions_count,
      MAX(ss.updated_at) as last_practice_date
    FROM sr_sessions ss
    JOIN pyq_questions pq ON ss.pyq_id = pq.id
    WHERE ss.session_id = $1 AND pq.topic IS NOT NULL
    GROUP BY pq.topic
  `, [sessionId]);

  const srStats = srResult.rows.map((row: any) => ({
    topic: row.topic,
    accuracy: parseFloat(row.accuracy) || 0,
    sessions_count: parseInt(row.sessions_count) || 0,
    accuracy_first_5: parseFloat(row.accuracy) || 0, // Simplified: use overall accuracy
    accuracy_last_5: parseFloat(row.accuracy) || 0,
    last_practice_date: row.last_practice_date ? new Date(row.last_practice_date).toISOString() : null,
  }));

  // Get SR-due topics (JOIN with pyq_questions to get topic from pyq_id)
  const dueResult = await pool.query(`
    SELECT DISTINCT pq.topic FROM sr_sessions ss
    JOIN pyq_questions pq ON ss.pyq_id = pq.id
    WHERE ss.session_id = $1 AND ss.next_review <= CURRENT_DATE AND pq.topic IS NOT NULL
  `, [sessionId]);
  const srDueTopics = dueResult.rows.map((r: any) => r.topic);

  // Compute priorities
  const studyProfile = {
    exam_date: profile.exam_date,
    target_score: profile.target_score,
    weekly_hours: profile.weekly_hours || 10,
    topic_confidence: profile.topic_confidence || {},
    diagnostic_scores: profile.diagnostic_scores || [],
  };

  const priorities = computePriority(studyProfile, srStats, getISTNow());
  const tasks = generateDailyTasks(priorities, srDueTopics, studyProfile.weekly_hours);

  // Attach content previews to each task (dedup via content_served table)
  for (const task of tasks) {
    try {
      // Try to find a problem not yet served to this user
      let previewResult = await pool.query(
        `SELECT id, question_text, options, difficulty
         FROM pyq_questions
         WHERE topic = $1
           AND id NOT IN (SELECT content_id FROM content_served WHERE session_id = $2)
         ORDER BY RANDOM() LIMIT 1`,
        [task.topic, sessionId]
      );

      // Fallback: if all content exhausted, pick any random problem
      if (previewResult.rows.length === 0) {
        previewResult = await pool.query(
          `SELECT id, question_text, options, difficulty
           FROM pyq_questions WHERE topic = $1
           ORDER BY RANDOM() LIMIT 1`,
          [task.topic]
        );
      }

      if (previewResult.rows.length > 0) {
        const preview = previewResult.rows[0];
        (task as any).content_preview = {
          pyq_id: preview.id,
          question_text: preview.question_text,
          options: preview.options,
          difficulty: preview.difficulty,
        };
        // Track what we served for dedup + observability (fire-and-forget)
        await pool.query(
          `INSERT INTO content_served (session_id, content_id, source)
           VALUES ($1, $2, 'commander_preview')
           ON CONFLICT (session_id, content_id) DO NOTHING`,
          [sessionId, preview.id]
        ).catch(() => {});
        pool.query(
          `INSERT INTO content_pipeline_log (trace_id, session_id, source, topic, content_id, tier_used, latency_ms)
           VALUES ($1, $2, 'commander_preview', $3, $4, 'pyq_questions', 0)`,
          [randomUUID(), sessionId, task.topic, preview.id]
        ).catch(() => {});
      } else {
        (task as any).content_preview = null;
      }
    } catch (err) {
      console.error('[commander] Content preview error:', (err as Error).message);
      (task as any).content_preview = null;
    }
  }

  // INSERT...ON CONFLICT DO NOTHING for race condition safety
  await pool.query(
    `INSERT INTO daily_plans (session_id, plan_date, tasks)
     VALUES ($1, $2, $3)
     ON CONFLICT (session_id, plan_date) DO NOTHING`,
    [sessionId, todayIST, JSON.stringify(tasks)]
  );

  // Always SELECT to get the authoritative row
  const planResult = await pool.query(
    'SELECT id, tasks, completed, plan_date, created_at FROM daily_plans WHERE session_id = $1 AND plan_date = $2',
    [sessionId, todayIST]
  );

  sendJSON(res, { plan: planResult.rows[0] });
}

/** POST /api/today/:sessionId/:taskIdx/rate — Rate a completed task */
async function handleRateTask(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { sessionId, taskIdx } = req.params;
  if (!sessionId) return sendError(res, 400, 'sessionId required');

  const idx = parseInt(taskIdx, 10);
  if (isNaN(idx) || idx < 0) return sendError(res, 400, 'Invalid taskIdx');

  const body = req.body as any;
  const rating = body?.rating;
  if (!rating || !['easy', 'medium', 'hard', 'skip'].includes(rating)) {
    return sendError(res, 400, 'rating must be one of: easy, medium, hard, skip');
  }

  const pool = getPool();
  const todayIST = getISTDate();

  // Get today's plan
  const planResult = await pool.query(
    'SELECT id, tasks, completed FROM daily_plans WHERE session_id = $1 AND plan_date = $2',
    [sessionId, todayIST]
  );

  if (planResult.rows.length === 0) {
    return sendError(res, 404, 'No plan found for today');
  }

  const plan = planResult.rows[0];
  const tasks = plan.tasks;

  if (idx >= tasks.length) {
    return sendError(res, 400, `taskIdx out of bounds (max: ${tasks.length - 1})`);
  }

  // Append completion entry
  const completionEntry = {
    task_idx: idx,
    rating,
    completed_at: new Date().toISOString(),
  };

  await pool.query(
    `UPDATE daily_plans
     SET completed = COALESCE(completed, '[]'::jsonb) || $3::jsonb
     WHERE session_id = $1 AND plan_date = $2`,
    [sessionId, todayIST, JSON.stringify([completionEntry])]
  );

  // Get updated plan
  const updated = await pool.query(
    'SELECT id, tasks, completed, plan_date, created_at FROM daily_plans WHERE session_id = $1 AND plan_date = $2',
    [sessionId, todayIST]
  );

  sendJSON(res, { plan: updated.rows[0] });
}

/** GET /api/priority/:sessionId — Get full priority ranking */
async function handleGetPriority(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { sessionId } = req.params;
  if (!sessionId) return sendError(res, 400, 'sessionId required');

  const pool = getPool();

  const profileResult = await pool.query(
    `SELECT exam_date, target_score, weekly_hours, topic_confidence, diagnostic_scores
     FROM study_profiles WHERE session_id = $1`,
    [sessionId]
  );

  if (profileResult.rows.length === 0) {
    return sendError(res, 404, 'Study profile not found — complete onboarding first');
  }

  const profile = profileResult.rows[0];

  const srResult = await pool.query(`
    SELECT
      topic,
      AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) as accuracy,
      COUNT(*) as sessions_count,
      MAX(created_at) as last_practice_date
    FROM sr_sessions
    WHERE session_id = $1 AND topic IS NOT NULL
    GROUP BY topic
  `, [sessionId]);

  const srStats = srResult.rows.map((row: any) => ({
    topic: row.topic,
    accuracy: parseFloat(row.accuracy) || 0,
    sessions_count: parseInt(row.sessions_count) || 0,
    accuracy_first_5: parseFloat(row.accuracy) || 0,
    accuracy_last_5: parseFloat(row.accuracy) || 0,
    last_practice_date: row.last_practice_date ? new Date(row.last_practice_date).toISOString() : null,
  }));

  const studyProfile = {
    exam_date: profile.exam_date,
    target_score: profile.target_score,
    weekly_hours: profile.weekly_hours || 10,
    topic_confidence: profile.topic_confidence || {},
    diagnostic_scores: profile.diagnostic_scores || [],
  };

  const priorities = computePriority(studyProfile, srStats, getISTNow());

  sendJSON(res, { priorities });
}

// ============================================================================
// Route definitions
// ============================================================================

export const commanderRoutes: RouteDefinition[] = [
  { method: 'POST', path: '/api/onboard', handler: handlePostOnboard },
  { method: 'GET', path: '/api/onboard/:sessionId', handler: handleGetOnboard },
  { method: 'GET', path: '/api/diagnostic/:sessionId', handler: handleGetDiagnostic },
  { method: 'POST', path: '/api/diagnostic/:sessionId', handler: handlePostDiagnostic },
  { method: 'GET', path: '/api/today/:sessionId', handler: handleGetToday },
  { method: 'POST', path: '/api/today/:sessionId/:taskIdx/rate', handler: handleRateTask },
  { method: 'GET', path: '/api/priority/:sessionId', handler: handleGetPriority },
];
