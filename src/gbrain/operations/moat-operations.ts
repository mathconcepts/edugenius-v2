// @ts-nocheck
/**
 * GBrain MOAT Operations
 *
 * Consolidated implementation of all MOAT skills beyond student-audit:
 *   - cohortAnalysis()           — population-level insights
 *   - findContentGaps()          — scan problem inventory for gaps
 *   - fillContentGaps()          — auto-generate to fill gaps
 *   - gbrainHealthCheck()        — full system health report
 *   - dailyIntelligence()        — nightly refresh for all students
 *   - generateMockExam()         — full-length timed mock
 *   - weeklyDigest()             — student-facing weekly report
 *   - mineMisconceptions()       — top misconceptions aggregated
 *   - seedRagCache()             — pre-seed RAG with PYQ patterns
 *   - verifySweep()              — re-verify all generated problems
 */

import pg from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ALL_CONCEPTS, CONCEPT_MAP } from '../../constants/concept-graph';
import { MARKS_WEIGHTS, TOPIC_NAMES } from '../../engine/priority-engine';
import { getOrCreateStudentModel, getMasterySummary, saveStudentModel } from '../student-model';
import { generateAttemptSequence, generateScoreMaximizationPlan, EXAM_CONFIGS, computeAndSaveExamStrategy } from '../exam-strategy';
import { generateProblems } from '../problem-generator';
import { getErrorPatternReport } from '../error-taxonomy';

const { Pool } = pg;
let _pool: any = null;
function getPool() {
  if (_pool) return _pool;
  _pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  return _pool;
}

// ============================================================================
// COHORT ANALYSIS
// ============================================================================

export async function cohortAnalysis(daysBack: number = 30) {
  const pool = getPool();

  // Top misconceptions across all students
  const misconceptions = await pool.query(
    `SELECT misconception_id, concept_id, diagnosis, COUNT(*) as count
     FROM error_log WHERE created_at >= NOW() - ($1 || ' days')::interval
     GROUP BY misconception_id, concept_id, diagnosis
     ORDER BY count DESC LIMIT 20`,
    [daysBack]
  );

  // Error type distribution
  const errorTypes = await pool.query(
    `SELECT error_type, COUNT(*) as count
     FROM error_log WHERE created_at >= NOW() - ($1 || ' days')::interval
     GROUP BY error_type ORDER BY count DESC`,
    [daysBack]
  );

  // Bottleneck concepts — highest % of students with mastery < 0.3 after ≥3 attempts
  const bottlenecks = await pool.query(
    `SELECT concept_id, COUNT(*) as struggler_count
     FROM error_log WHERE created_at >= NOW() - ($1 || ' days')::interval
     GROUP BY concept_id ORDER BY struggler_count DESC LIMIT 15`,
    [daysBack]
  );

  // Motivation health
  const motivationDist = await pool.query(
    `SELECT motivation_state, COUNT(*) as count FROM student_model GROUP BY motivation_state`
  );

  const studentCount = await pool.query(`SELECT COUNT(DISTINCT session_id) as total FROM student_model`);

  return {
    period_days: daysBack,
    total_students: parseInt(studentCount.rows[0].total),
    top_misconceptions: misconceptions.rows.map((r: any) => ({
      id: r.misconception_id,
      concept: r.concept_id,
      description: r.diagnosis,
      count: parseInt(r.count),
      impact_score: parseInt(r.count) * (MARKS_WEIGHTS[CONCEPT_MAP.get(r.concept_id)?.topic || ''] || 0.08),
    })),
    error_type_distribution: errorTypes.rows.map((r: any) => ({ type: r.error_type, count: parseInt(r.count) })),
    bottleneck_concepts: bottlenecks.rows.map((r: any) => ({
      concept_id: r.concept_id,
      label: CONCEPT_MAP.get(r.concept_id)?.label || r.concept_id,
      struggler_count: parseInt(r.struggler_count),
    })),
    motivation_health: motivationDist.rows.reduce((acc: any, r: any) => {
      acc[r.motivation_state] = parseInt(r.count);
      return acc;
    }, {}),
  };
}

// ============================================================================
// CONTENT GAP (SCAN + FILL)
// ============================================================================

export async function findContentGaps(minPerSlot: number = 5) {
  const pool = getPool();
  const gaps: Array<{ concept_id: string; topic: string; difficulty_bucket: string; current_count: number; gate_frequency: string; priority: number }> = [];

  for (const concept of ALL_CONCEPTS) {
    for (const bucket of ['easy', 'medium', 'hard']) {
      const diffRange = bucket === 'easy' ? [0, 0.33] : bucket === 'medium' ? [0.34, 0.66] : [0.67, 1];

      const { rows } = await pool.query(
        `SELECT COUNT(*) as c FROM generated_problems
         WHERE concept_id = $1 AND verified = true AND difficulty BETWEEN $2 AND $3`,
        [concept.id, diffRange[0], diffRange[1]]
      );
      const count = parseInt(rows[0].c);

      if (count < minPerSlot) {
        const freqWeight = concept.gate_frequency === 'high' ? 3 : concept.gate_frequency === 'medium' ? 2 : 1;
        gaps.push({
          concept_id: concept.id,
          topic: concept.topic,
          difficulty_bucket: bucket,
          current_count: count,
          gate_frequency: concept.gate_frequency,
          priority: freqWeight * (minPerSlot - count),
        });
      }
    }
  }

  return gaps.sort((a, b) => b.priority - a.priority);
}

export async function fillContentGaps(budget: number = 20, topic?: string) {
  const gaps = await findContentGaps();
  const filtered = topic ? gaps.filter(g => g.topic === topic) : gaps;
  const toFill = filtered.slice(0, budget);

  const results = [];
  // Need a student model reference for the problem generator API — use a synthetic "gen-worker" session
  const workerModel = await getOrCreateStudentModel('content-gap-worker');

  for (const gap of toFill) {
    const diff = gap.difficulty_bucket === 'easy' ? 0.25 : gap.difficulty_bucket === 'medium' ? 0.5 : 0.75;
    try {
      const problems = await generateProblems({
        sessionId: 'content-gap-worker',
        conceptId: gap.concept_id,
        difficulty: diff,
        count: 1,
      }, workerModel);

      results.push({
        concept: gap.concept_id,
        difficulty_bucket: gap.difficulty_bucket,
        generated: problems.length,
        verified: problems.filter(p => p.verified).length,
      });
    } catch (err) {
      results.push({
        concept: gap.concept_id,
        difficulty_bucket: gap.difficulty_bucket,
        error: (err as Error).message,
      });
    }
  }

  return { gaps_identified: gaps.length, processed: toFill.length, results };
}

// ============================================================================
// GBRAIN HEALTH CHECK
// ============================================================================

export async function gbrainHealthCheck() {
  const pool = getPool();
  const checks: Array<{ name: string; status: 'ok' | 'warn' | 'fail'; value: any; message: string }> = [];

  // 1. student_model rows
  try {
    const { rows } = await pool.query(`SELECT COUNT(*) as c FROM student_model`);
    const count = parseInt(rows[0].c);
    checks.push({
      name: 'student_model',
      status: 'ok',
      value: count,
      message: `${count} students tracked`,
    });
  } catch (err) {
    checks.push({ name: 'student_model', status: 'fail', value: null, message: (err as Error).message });
  }

  // 2. error_log growth (7d)
  try {
    const { rows } = await pool.query(`SELECT COUNT(*) as c FROM error_log WHERE created_at >= NOW() - INTERVAL '7 days'`);
    const count = parseInt(rows[0].c);
    checks.push({
      name: 'error_log_7d',
      status: 'ok',
      value: count,
      message: `${count} errors logged in last 7 days`,
    });
  } catch (err) {
    checks.push({ name: 'error_log_7d', status: 'fail', value: null, message: (err as Error).message });
  }

  // 3. generated_problems verification rate
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE verified = true)::float / NULLIF(COUNT(*), 0) as rate,
         COUNT(*) as total
       FROM generated_problems`
    );
    const rate = parseFloat(rows[0].rate) || 0;
    const total = parseInt(rows[0].total);
    checks.push({
      name: 'generated_problems_verified_rate',
      status: total === 0 ? 'ok' : rate >= 0.85 ? 'ok' : 'warn',
      value: Math.round(rate * 100),
      message: total === 0 ? 'No generated problems yet' : `${Math.round(rate * 100)}% verified (${total} total)`,
    });
  } catch (err) {
    checks.push({ name: 'generated_problems_verified_rate', status: 'fail', value: null, message: (err as Error).message });
  }

  // 4. task_reasoner avg latency
  try {
    const { rows } = await pool.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (created_at - created_at)) * 1000) as avg_ms,
              COUNT(*) as count
       FROM task_reasoner_log WHERE created_at >= NOW() - INTERVAL '24 hours'`
    );
    const count = parseInt(rows[0].count);
    checks.push({
      name: 'task_reasoner_usage',
      status: 'ok',
      value: count,
      message: `${count} reasoner calls in last 24h`,
    });
  } catch (err) {
    checks.push({ name: 'task_reasoner_usage', status: 'fail', value: null, message: (err as Error).message });
  }

  // 5. concept_graph integrity
  const orphanConcepts = ALL_CONCEPTS.filter(c =>
    c.prerequisites.some(p => !CONCEPT_MAP.has(p))
  );
  checks.push({
    name: 'concept_graph_integrity',
    status: orphanConcepts.length === 0 ? 'ok' : 'fail',
    value: ALL_CONCEPTS.length,
    message: orphanConcepts.length === 0
      ? `${ALL_CONCEPTS.length} concepts, all prerequisites valid`
      : `${orphanConcepts.length} concepts with broken prerequisite references`,
  });

  // 6. Gemini connectivity
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      checks.push({ name: 'gemini_api', status: 'warn', value: false, message: 'GEMINI_API_KEY not set — reasoner runs in heuristic mode' });
    } else {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const start = Date.now();
      await Promise.race([
        model.generateContent('Respond with just OK'),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))
      ]);
      const latency = Date.now() - start;
      checks.push({
        name: 'gemini_api',
        status: latency < 3000 ? 'ok' : 'warn',
        value: latency,
        message: `Gemini responded in ${latency}ms`,
      });
    }
  } catch (err) {
    checks.push({ name: 'gemini_api', status: 'fail', value: null, message: (err as Error).message });
  }

  const overallStatus = checks.some(c => c.status === 'fail') ? 'fail'
    : checks.some(c => c.status === 'warn') ? 'degraded' : 'healthy';

  return {
    status: overallStatus,
    generated_at: new Date().toISOString(),
    checks,
    summary: `${checks.filter(c => c.status === 'ok').length}/${checks.length} checks passing`,
  };
}

// ============================================================================
// DAILY INTELLIGENCE (NIGHTLY REFRESH)
// ============================================================================

export async function dailyIntelligence() {
  const pool = getPool();
  const results = { processed: 0, flagged_for_intervention: [], refreshed_strategies: 0, errors: [] as any[] };

  // Get active students (updated in last 30 days)
  const { rows: students } = await pool.query(
    `SELECT session_id FROM student_model WHERE updated_at >= NOW() - INTERVAL '30 days'`
  );

  for (const { session_id } of students) {
    try {
      const model = await getOrCreateStudentModel(session_id);

      // Recompute exam strategy (refreshes attempt order + skip threshold)
      computeAndSaveExamStrategy(model, EXAM_CONFIGS['gate']);
      await saveStudentModel(model);
      results.refreshed_strategies++;

      // Flag intervention candidates
      if (model.motivation_state === 'frustrated' && model.consecutive_failures >= 5) {
        (results.flagged_for_intervention as any[]).push({
          session_id,
          consecutive_failures: model.consecutive_failures,
          last_update: model.updated_at,
        });
      }

      results.processed++;
    } catch (err) {
      results.errors.push({ session_id, error: (err as Error).message });
    }
  }

  // Prune stale error_log entries (> 90 days old)
  const pruneResult = await pool.query(
    `DELETE FROM error_log WHERE created_at < NOW() - INTERVAL '90 days' RETURNING id`
  );

  return {
    ...results,
    pruned_error_log: pruneResult.rowCount || 0,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// MOCK EXAM GENERATOR
// ============================================================================

export async function generateMockExam(sessionId: string, examKey: string = 'gate') {
  const pool = getPool();
  const examConfig = EXAM_CONFIGS[examKey] || EXAM_CONFIGS['gate'];
  const model = await getOrCreateStudentModel(sessionId);
  const mastery = getMasterySummary(model);

  const totalQuestions = examConfig.total_questions;
  const questions: any[] = [];

  for (const topic of Object.keys(MARKS_WEIGHTS)) {
    const topicQCount = Math.round(totalQuestions * (MARKS_WEIGHTS[topic] || 0.08));
    const topicMastery = mastery[topic] || 0;

    // Difficulty distribution: 40% easy, 40% medium, 20% hard
    // If mastery > 0.7, bias toward hard (30% easy, 40% medium, 30% hard)
    const [pE, pM, pH] = topicMastery > 0.7 ? [0.3, 0.4, 0.3] : [0.4, 0.4, 0.2];
    const nEasy = Math.round(topicQCount * pE);
    const nMed = Math.round(topicQCount * pM);
    const nHard = topicQCount - nEasy - nMed;

    for (const [bucket, n, diffRange] of [
      ['easy', nEasy, [0, 0.33]],
      ['medium', nMed, [0.34, 0.66]],
      ['hard', nHard, [0.67, 1.0]],
    ] as const) {
      if (n <= 0) continue;
      // Pull from PYQ bank first, then generated_problems
      const { rows: pyq } = await pool.query(
        `SELECT id, question_text, options, correct_answer, topic, difficulty, marks
         FROM pyq_questions WHERE topic = $1
         ${bucket === 'easy' ? `AND difficulty = 'easy'` : bucket === 'medium' ? `AND difficulty = 'medium'` : `AND difficulty = 'hard'`}
         ORDER BY RANDOM() LIMIT $2`,
        [topic, n]
      );
      for (const q of pyq) questions.push({ ...q, source: 'pyq' });

      const remaining = n - pyq.length;
      if (remaining > 0) {
        const { rows: gen } = await pool.query(
          `SELECT id, question_text, correct_answer, topic, concept_id, difficulty, 2 as marks
           FROM generated_problems
           WHERE topic = $1 AND verified = true AND difficulty BETWEEN $2 AND $3
           ORDER BY RANDOM() LIMIT $4`,
          [topic, diffRange[0], diffRange[1], remaining]
        );
        for (const q of gen) questions.push({ ...q, source: 'generated' });
      }
    }
  }

  // Shuffle
  questions.sort(() => Math.random() - 0.5);

  const examId = `mock-${examKey}-${Date.now()}-${sessionId.slice(0, 6)}`;

  // Save mock exam metadata
  await pool.query(
    `CREATE TABLE IF NOT EXISTS mock_exams (
       id TEXT PRIMARY KEY,
       session_id TEXT NOT NULL,
       exam_key TEXT NOT NULL,
       questions JSONB NOT NULL,
       time_limit_minutes INT NOT NULL,
       created_at TIMESTAMPTZ DEFAULT NOW(),
       submitted_at TIMESTAMPTZ,
       analysis JSONB
     )`
  ).catch(() => {});
  await pool.query(
    `INSERT INTO mock_exams (id, session_id, exam_key, questions, time_limit_minutes) VALUES ($1, $2, $3, $4, $5)`,
    [examId, sessionId, examKey, JSON.stringify(questions), examConfig.total_time_minutes]
  ).catch(() => {});

  return {
    exam_id: examId,
    exam_name: examConfig.name,
    time_limit_minutes: examConfig.total_time_minutes,
    total_questions: questions.length,
    marks_scheme: {
      correct: examConfig.marks_per_correct,
      wrong: examConfig.marks_per_wrong,
    },
    questions,
    section_breakdown: questions.reduce((acc: any, q: any) => {
      acc[q.topic] = (acc[q.topic] || 0) + 1;
      return acc;
    }, {}),
    post_analysis_hook: `/api/gbrain/mock-exam/${examId}/analyze`,
  };
}

// ============================================================================
// WEEKLY DIGEST
// ============================================================================

export async function weeklyDigest(sessionId: string) {
  const pool = getPool();
  const model = await getOrCreateStudentModel(sessionId);
  const mastery = getMasterySummary(model);

  // This week's stats
  const { rows: weekStats } = await pool.query(
    `SELECT COUNT(*) as attempts,
            COUNT(*) FILTER (WHERE was_correct) as correct
     FROM confidence_log WHERE session_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
    [sessionId]
  );
  const attempts = parseInt(weekStats[0]?.attempts || '0');
  const correct = parseInt(weekStats[0]?.correct || '0');
  const accuracy = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;

  // Streak
  const { rows: streakRows } = await pool.query(
    `SELECT current_streak FROM streaks WHERE session_id = $1`,
    [sessionId]
  ).catch(() => ({ rows: [] }));
  const streak = streakRows[0]?.current_streak || 0;

  // Topics that improved (concepts where mastery score grew this week)
  const weekErrors = await getErrorPatternReport(sessionId, 7);
  const previousErrors = await getErrorPatternReport(sessionId, 14);
  const errorsFixed = Math.max(0, (previousErrors.total_errors - weekErrors.total_errors));

  // Find strongest improvement topic
  const sortedMastery = Object.entries(mastery).sort((a, b) => b[1] - a[1]);
  const topStrength = sortedMastery[0];
  const weakestTopic = sortedMastery[sortedMastery.length - 1];

  // Opening tone by motivation
  let opening = '';
  switch (model.motivation_state) {
    case 'driven':
      opening = `You're on fire this week. ${streak}-day streak and climbing.`; break;
    case 'steady':
      opening = `Another solid week of progress.`; break;
    case 'flagging':
      opening = `Small steps add up. Every problem you attempted this week taught your brain something.`; break;
    case 'frustrated':
      opening = `Tough week. Here's something important: struggling is a sign you're growing, not failing.`; break;
    case 'anxious':
      opening = `Deep breath. Your progress is real — let's look at the numbers.`; break;
  }

  // Predicted score
  const playbook = generateAttemptSequence(model, EXAM_CONFIGS['gate']);

  return {
    session_id: sessionId,
    generated_at: new Date().toISOString(),
    opening,
    stats: {
      problems_this_week: attempts,
      accuracy_pct: accuracy,
      streak_days: streak,
      errors_fixed: errorsFixed,
    },
    growth_proof: topStrength && topStrength[1] > 0.3
      ? `You've built mastery in ${TOPIC_NAMES[topStrength[0]] || topStrength[0]} (${Math.round(topStrength[1] * 100)}%).`
      : `Still building your foundation — that's okay. Consistency wins.`,
    ugly_truth: weakestTopic
      ? `Biggest gap: ${TOPIC_NAMES[weakestTopic[0]] || weakestTopic[0]} at ${Math.round(weakestTopic[1] * 100)}%. This is where your next week should focus.`
      : null,
    one_action: buildOneAction(model, mastery),
    predicted_score: {
      current_trajectory: playbook.expected_score.realistic,
      range: `${playbook.expected_score.conservative}–${playbook.expected_score.optimistic}`,
    },
  };
}

function buildOneAction(model: any, mastery: any): string {
  // Prioritize: prerequisite repair > weakest topic > confidence build
  if (model.prerequisite_alerts?.length > 0) {
    const top = model.prerequisite_alerts[0];
    return `Spend 30 minutes on ${top.shaky_prereqs[0].replace(/-/g, ' ')} this week. It's blocking ${top.concept.replace(/-/g, ' ')}.`;
  }
  const weakest = Object.entries(mastery).sort((a: any, b: any) => a[1] - b[1])[0];
  if (weakest && weakest[1] < 0.3) {
    return `Do 5 problems in ${TOPIC_NAMES[weakest[0]] || weakest[0]} this week. Don't aim for speed — aim to understand why each answer is right.`;
  }
  return `Take a full mock exam this weekend. You're ready to see where you actually stand.`;
}

// ============================================================================
// MISCONCEPTION MINER
// ============================================================================

export async function mineMisconceptions(topN: number = 20) {
  const pool = getPool();

  const { rows } = await pool.query(
    `SELECT misconception_id, concept_id,
            array_agg(DISTINCT diagnosis) as diagnoses,
            array_agg(DISTINCT why_wrong) FILTER (WHERE why_wrong IS NOT NULL) as reasons,
            COUNT(*) as count,
            array_agg(DISTINCT error_type) as error_types
     FROM error_log
     WHERE misconception_id IS NOT NULL AND misconception_id NOT IN ('classification-failed', 'unclassified')
     GROUP BY misconception_id, concept_id
     ORDER BY count DESC LIMIT $1`,
    [topN]
  );

  return rows.map((r: any) => {
    const concept = CONCEPT_MAP.get(r.concept_id);
    const topic = concept?.topic || 'unknown';
    const weight = MARKS_WEIGHTS[topic] || 0.08;
    const freqMult = concept?.gate_frequency === 'high' ? 3 : concept?.gate_frequency === 'medium' ? 2 : 1;

    return {
      id: r.misconception_id,
      concept_id: r.concept_id,
      concept_label: concept?.label || r.concept_id,
      topic,
      count: parseInt(r.count),
      impact_score: Math.round(parseInt(r.count) * weight * freqMult * 10) / 10,
      error_types: r.error_types,
      example_diagnoses: r.diagnoses.slice(0, 3),
      example_reasons: (r.reasons || []).slice(0, 3),
    };
  });
}

// ============================================================================
// SEED RAG CACHE
// ============================================================================

export async function seedRagCache(source: 'pyq' | 'generated' | 'all' = 'pyq', budget: number = 500) {
  const pool = getPool();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { error: 'GEMINI_API_KEY not set — cannot generate embeddings', seeded: 0 };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const embedModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });

  let problems: any[] = [];
  if (source === 'pyq' || source === 'all') {
    const { rows } = await pool.query(
      `SELECT id, question_text, correct_answer, topic, explanation
       FROM pyq_questions WHERE explanation IS NOT NULL AND explanation != '' LIMIT $1`,
      [budget]
    );
    problems.push(...rows.map((r: any) => ({ ...r, source: 'pyq' })));
  }
  if (source === 'generated' || source === 'all') {
    const { rows } = await pool.query(
      `SELECT id, question_text, correct_answer, topic
       FROM generated_problems WHERE verified = true LIMIT $1`,
      [budget - problems.length]
    );
    problems.push(...rows.map((r: any) => ({ ...r, source: 'generated' })));
  }

  let seeded = 0;
  let skipped = 0;
  const errors: any[] = [];

  for (const p of problems) {
    try {
      // Dedup
      const existing = await pool.query(
        `SELECT id FROM rag_cache WHERE problem = $1 LIMIT 1`,
        [p.question_text]
      );
      if (existing.rows.length > 0) { skipped++; continue; }

      // Embed
      const content = `${p.question_text}\n\nAnswer: ${p.correct_answer}\n\n${p.explanation || ''}`;
      const result = await embedModel.embedContent(content);
      const embedding = result.embedding.values;

      // Insert
      await pool.query(
        `INSERT INTO rag_cache (problem, answer, topic, embedding) VALUES ($1, $2, $3, $4::vector)`,
        [p.question_text, p.correct_answer, p.topic, JSON.stringify(embedding)]
      );
      seeded++;
    } catch (err) {
      errors.push({ id: p.id, error: (err as Error).message });
      // If we hit quota, bail early
      if ((err as Error).message.includes('429') || (err as Error).message.includes('quota')) break;
    }
  }

  return { source, total_candidates: problems.length, seeded, skipped, errors: errors.length, error_details: errors.slice(0, 5) };
}

// ============================================================================
// VERIFY SWEEP
// ============================================================================

export async function verifySweep(opts: { topic?: string; strict?: boolean; limit?: number } = {}) {
  const pool = getPool();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: 'GEMINI_API_KEY not set', re_verified: 0 };

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  let sql = `SELECT id, question_text, correct_answer, topic FROM generated_problems WHERE verified = true`;
  const params: any[] = [];
  if (opts.topic) {
    sql += ` AND topic = $${params.length + 1}`;
    params.push(opts.topic);
  }
  sql += ` ORDER BY times_served DESC LIMIT $${params.length + 1}`;
  params.push(opts.limit || 100);

  const { rows: problems } = await pool.query(sql, params);

  const results = { total: problems.length, passed: 0, demoted: 0, errors: 0, demotions: [] as any[] };

  for (const p of problems) {
    try {
      const prompt = `Solve this problem independently, don't look at any provided answer.

Problem: ${p.question_text}

Solve step by step. End with: ANSWER: <final answer>`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const match = text.match(/ANSWER:\s*(.+)/i);
      const newAnswer = match ? match[1].trim() : null;

      if (!newAnswer) { results.errors++; continue; }

      // Compare
      const expected = p.correct_answer.trim();
      const actual = newAnswer.trim();

      const normalize = (s: string) => s.replace(/\s+/g, '').replace(/\$/g, '').toLowerCase();
      const matches = expected === actual ||
                      normalize(expected) === normalize(actual) ||
                      (!isNaN(parseFloat(expected)) && !isNaN(parseFloat(actual)) &&
                       Math.abs(parseFloat(expected) - parseFloat(actual)) < 0.001);

      if (matches) {
        await pool.query(
          `UPDATE generated_problems SET verification_confidence = 0.95 WHERE id = $1`,
          [p.id]
        );
        results.passed++;
      } else {
        // Demote
        await pool.query(
          `UPDATE generated_problems SET verified = false, verification_method = 'sweep-demoted' WHERE id = $1`,
          [p.id]
        );
        results.demoted++;
        results.demotions.push({
          id: p.id,
          problem: p.question_text.slice(0, 100),
          old_answer: expected,
          new_answer: actual,
        });
      }
    } catch (err) {
      results.errors++;
      // Rate limit handling
      if ((err as Error).message.includes('429')) break;
    }
  }

  return results;
}
