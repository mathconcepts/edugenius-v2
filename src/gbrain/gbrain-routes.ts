// @ts-nocheck
/**
 * GBrain API Routes
 *
 * Endpoints:
 *   GET  /api/gbrain/model/:sessionId          — Get student model
 *   POST /api/gbrain/attempt                    — Record a problem attempt (updates model + error taxonomy)
 *   GET  /api/gbrain/errors/:sessionId          — Get error pattern report
 *   GET  /api/gbrain/prerequisites/:sessionId/:conceptId — Get prerequisite repair plan
 *   POST /api/gbrain/generate-problems          — Generate adaptive practice problems
 *   GET  /api/gbrain/exam-strategy/:sessionId   — Get personalized exam playbook
 *   GET  /api/gbrain/score-plan/:sessionId      — Get score maximization plan
 *   GET  /api/gbrain/concepts/:topic            — Get concept graph for a topic
 *   POST /api/gbrain/confidence                 — Log confidence rating
 */

import { ServerResponse } from 'http';
import pg from 'pg';
import {
  getOrCreateStudentModel,
  saveStudentModel,
  updateMastery,
  updateConfidenceCalibration,
  getMasterySummary,
  getTopicMastery,
  serializeForPrompt,
} from './student-model';
import {
  classifyError,
  generateMisconceptionExplanation,
  logError,
  getErrorPatternReport,
} from './error-taxonomy';
import { generateProblems, recordProblemAttempt } from './problem-generator';
import {
  generateAttemptSequence,
  generateScoreMaximizationPlan,
  computeAndSaveExamStrategy,
  EXAM_CONFIGS,
} from './exam-strategy';
import { getConceptsForTopic, traceWeakestPrerequisite, CONCEPT_MAP, ALL_CONCEPTS } from '../constants/concept-graph';
import { requireRole } from '../api/auth-middleware';
import {
  cohortAnalysis,
  findContentGaps,
  fillContentGaps,
  gbrainHealthCheck,
  dailyIntelligence,
  generateMockExam,
  weeklyDigest,
  mineMisconceptions,
  seedRagCache,
  verifySweep,
} from './operations/moat-operations';
import { auditStudent, formatAuditMarkdown } from './operations/student-audit';

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

function sendJSON(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJSON(res, { error: message }, status);
}

// ============================================================================
// GET /api/gbrain/model/:sessionId — Student Model
// ============================================================================

async function handleGetModel(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { sessionId } = req.params;
  if (!sessionId) return sendError(res, 400, 'sessionId required');

  const model = await getOrCreateStudentModel(sessionId);
  const summary = getMasterySummary(model);

  sendJSON(res, {
    model: {
      ...model,
      topic_mastery: summary,
      profile_summary: serializeForPrompt(model),
    },
  });
}

// ============================================================================
// POST /api/gbrain/attempt — Record Problem Attempt
// ============================================================================

async function handleAttempt(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = req.body as any;
  const { sessionId, problem, studentAnswer, correctAnswer, conceptId, isCorrect, difficulty, timeTakenMs, confidenceBefore, problemId } = body || {};

  if (!sessionId || isCorrect === undefined) {
    return sendError(res, 400, 'sessionId and isCorrect required');
  }

  // Load student model
  const model = await getOrCreateStudentModel(sessionId);

  // Determine concept
  const concept = conceptId || 'unknown';
  const diff = difficulty || 0.5;

  // Update mastery (Pillar 1)
  updateMastery(model, concept, isCorrect, diff, timeTakenMs);

  // Update confidence calibration if provided
  if (confidenceBefore !== undefined) {
    updateConfidenceCalibration(model, confidenceBefore, isCorrect);
  }

  // If wrong, classify error (Pillar 2)
  let errorDiagnosis = null;
  if (!isCorrect && problem && studentAnswer && correctAnswer) {
    errorDiagnosis = await classifyError(problem, studentAnswer, correctAnswer, timeTakenMs);

    // Generate misconception explanation
    errorDiagnosis = await generateMisconceptionExplanation(
      errorDiagnosis, problem, model.representation_mode
    );

    // Log to error_log
    await logError(sessionId, errorDiagnosis, {
      problemId,
      studentAnswer,
      correctAnswer,
      timeTakenMs,
      confidenceBefore,
    });

    // Update mastery with the classified concept (more precise)
    if (errorDiagnosis.concept_id && errorDiagnosis.concept_id !== concept) {
      updateMastery(model, errorDiagnosis.concept_id, false, diff, timeTakenMs);
    }
  }

  // Record for generated problem calibration
  if (problemId) {
    recordProblemAttempt(problemId, isCorrect).catch(() => {});
  }

  // Save updated model
  await saveStudentModel(model);

  // Log confidence if provided
  if (confidenceBefore !== undefined) {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      `INSERT INTO confidence_log (session_id, problem_id, concept_id, confidence_before, was_correct, time_taken_ms)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [sessionId, problemId || null, concept, confidenceBefore, isCorrect, timeTakenMs || null],
    ).catch(() => {});
  }

  sendJSON(res, {
    mastery_update: {
      concept,
      new_score: model.mastery_vector[concept]?.score,
      attempts: model.mastery_vector[concept]?.attempts,
    },
    error_diagnosis: errorDiagnosis,
    motivation_state: model.motivation_state,
    consecutive_failures: model.consecutive_failures,
    prerequisite_alerts: model.prerequisite_alerts.filter(a => a.severity === 'critical'),
  });
}

// ============================================================================
// GET /api/gbrain/errors/:sessionId — Error Pattern Report
// ============================================================================

async function handleGetErrors(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { sessionId } = req.params;
  if (!sessionId) return sendError(res, 400, 'sessionId required');

  const days = parseInt(req.query.get('days') || '7');
  const report = await getErrorPatternReport(sessionId, days);

  sendJSON(res, { report });
}

// ============================================================================
// GET /api/gbrain/prerequisites/:sessionId/:conceptId — Prerequisite Repair
// ============================================================================

async function handleGetPrerequisites(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { sessionId, conceptId } = req.params;
  if (!sessionId || !conceptId) return sendError(res, 400, 'sessionId and conceptId required');

  const model = await getOrCreateStudentModel(sessionId);
  const weakPrereqs = traceWeakestPrerequisite(conceptId, model.mastery_vector, 0.3);

  const concept = CONCEPT_MAP.get(conceptId);

  sendJSON(res, {
    concept: concept ? { id: concept.id, label: concept.label, topic: concept.topic } : null,
    current_mastery: model.mastery_vector[conceptId]?.score ?? 0,
    weak_prerequisites: weakPrereqs.map(w => ({
      id: w.id,
      label: w.label,
      topic: w.topic,
      mastery: model.mastery_vector[w.id]?.score ?? 0,
      description: w.description,
    })),
    repair_sequence: weakPrereqs.map(w => w.id),
    message: weakPrereqs.length > 0
      ? `Before mastering ${concept?.label || conceptId}, strengthen: ${weakPrereqs.map(w => w.label).join(' → ')}`
      : `No weak prerequisites found for ${concept?.label || conceptId}.`,
  });
}

// ============================================================================
// POST /api/gbrain/generate-problems — Adaptive Problem Generation
// ============================================================================

async function handleGenerateProblems(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = req.body as any;
  const { sessionId, topic, conceptId, difficulty, targetErrorType, count, format } = body || {};

  if (!sessionId) return sendError(res, 400, 'sessionId required');

  const model = await getOrCreateStudentModel(sessionId);

  const problems = await generateProblems({
    sessionId,
    topic,
    conceptId,
    difficulty,
    targetErrorType,
    count: Math.min(count || 1, 5), // max 5 at a time
    format,
  }, model);

  sendJSON(res, {
    problems: problems.map(p => ({
      id: p.id,
      concept_id: p.concept_id,
      topic: p.topic,
      difficulty: p.difficulty,
      question_text: p.question_text,
      correct_answer: p.correct_answer,
      solution_steps: p.solution_steps,
      distractors: p.distractors,
      verified: p.verified,
      target_error_type: p.target_error_type,
    })),
    count: problems.length,
  });
}

// ============================================================================
// GET /api/gbrain/exam-strategy/:sessionId — Exam Playbook
// ============================================================================

async function handleGetExamStrategy(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { sessionId } = req.params;
  if (!sessionId) return sendError(res, 400, 'sessionId required');

  const exam = req.query.get('exam') || 'gate';
  const examConfig = EXAM_CONFIGS[exam] || EXAM_CONFIGS['gate'];

  const model = await getOrCreateStudentModel(sessionId);
  const playbook = generateAttemptSequence(model, examConfig);

  // Persist strategy in model
  computeAndSaveExamStrategy(model, examConfig);
  await saveStudentModel(model);

  sendJSON(res, { playbook });
}

// ============================================================================
// GET /api/gbrain/score-plan/:sessionId — Score Maximization Plan
// ============================================================================

async function handleGetScorePlan(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { sessionId } = req.params;
  if (!sessionId) return sendError(res, 400, 'sessionId required');

  const daysUntilExam = parseInt(req.query.get('days') || '90');
  const weeklyHours = parseFloat(req.query.get('hours') || '15');

  const model = await getOrCreateStudentModel(sessionId);
  const plan = generateScoreMaximizationPlan(model, daysUntilExam, weeklyHours);

  sendJSON(res, { plan });
}

// ============================================================================
// GET /api/gbrain/concepts/:topic — Concept Graph
// ============================================================================

async function handleGetConcepts(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { topic } = req.params;

  if (topic === 'all') {
    sendJSON(res, {
      concepts: ALL_CONCEPTS.map(c => ({
        id: c.id,
        topic: c.topic,
        label: c.label,
        description: c.description,
        difficulty_base: c.difficulty_base,
        gate_frequency: c.gate_frequency,
        prerequisites: c.prerequisites,
      })),
      total: ALL_CONCEPTS.length,
    });
    return;
  }

  const concepts = getConceptsForTopic(topic);

  sendJSON(res, {
    topic,
    concepts: concepts.map(c => ({
      id: c.id,
      label: c.label,
      description: c.description,
      difficulty_base: c.difficulty_base,
      gate_frequency: c.gate_frequency,
      prerequisites: c.prerequisites,
    })),
    total: concepts.length,
  });
}

// ============================================================================
// POST /api/gbrain/confidence — Log Confidence Rating
// ============================================================================

async function handleConfidence(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = req.body as any;
  const { sessionId, problemId, conceptId, confidenceBefore, wasCorrect, timeTakenMs } = body || {};

  if (!sessionId || confidenceBefore === undefined || wasCorrect === undefined) {
    return sendError(res, 400, 'sessionId, confidenceBefore, and wasCorrect required');
  }

  const model = await getOrCreateStudentModel(sessionId);
  updateConfidenceCalibration(model, confidenceBefore, wasCorrect);
  await saveStudentModel(model);

  sendJSON(res, {
    calibration: model.confidence_calibration,
    skip_threshold: model.exam_strategy?.skip_threshold,
  });
}

// ============================================================================
// MOAT OPERATIONS — Handlers
// ============================================================================

async function handleAudit(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { sessionId } = req.params;
  if (!sessionId) return sendError(res, 400, 'sessionId required');
  try {
    const report = await auditStudent(sessionId);
    const format = req.query.get('format');
    if (format === 'markdown') {
      res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
      res.end(formatAuditMarkdown(report));
    } else {
      sendJSON(res, { report });
    }
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
}

async function handleCohort(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const user = await requireRole(req, res, 'admin', 'teacher');
  if (!user) return;
  const days = parseInt(req.query.get('days') || '30');
  try {
    const result = await cohortAnalysis(days);
    sendJSON(res, result);
  } catch (err) { sendError(res, 500, (err as Error).message); }
}

async function handleContentGapScan(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const user = await requireRole(req, res, 'admin', 'teacher');
  if (!user) return;
  try {
    const gaps = await findContentGaps();
    sendJSON(res, { total_gaps: gaps.length, gaps: gaps.slice(0, 50) });
  } catch (err) { sendError(res, 500, (err as Error).message); }
}

async function handleContentGapFill(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const user = await requireRole(req, res, 'admin');
  if (!user) return;
  const body = (req.body as any) || {};
  try {
    const result = await fillContentGaps(body.budget || 10, body.topic);
    sendJSON(res, result);
  } catch (err) { sendError(res, 500, (err as Error).message); }
}

async function handleGbrainHealth(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const user = await requireRole(req, res, 'admin', 'teacher');
  if (!user) return;
  try {
    const result = await gbrainHealthCheck();
    sendJSON(res, result);
  } catch (err) { sendError(res, 500, (err as Error).message); }
}

async function handleDailyIntelligence(req: ParsedRequest, res: ServerResponse): Promise<void> {
  // Protected by CRON_SECRET
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return sendError(res, 401, 'Unauthorized');
  }
  try {
    const result = await dailyIntelligence();
    sendJSON(res, result);
  } catch (err) { sendError(res, 500, (err as Error).message); }
}

async function handleMockExam(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { sessionId } = req.params;
  const exam = req.query.get('exam') || 'gate';
  if (!sessionId) return sendError(res, 400, 'sessionId required');
  try {
    const result = await generateMockExam(sessionId, exam);
    sendJSON(res, result);
  } catch (err) { sendError(res, 500, (err as Error).message); }
}

async function handleWeeklyDigest(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { sessionId } = req.params;
  if (!sessionId) return sendError(res, 400, 'sessionId required');
  try {
    const result = await weeklyDigest(sessionId);
    sendJSON(res, result);
  } catch (err) { sendError(res, 500, (err as Error).message); }
}

async function handleMineMisconceptions(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const user = await requireRole(req, res, 'admin', 'teacher');
  if (!user) return;
  const topN = parseInt(req.query.get('top') || '20');
  try {
    const result = await mineMisconceptions(topN);
    sendJSON(res, { misconceptions: result, total: result.length });
  } catch (err) { sendError(res, 500, (err as Error).message); }
}

async function handleSeedRag(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return sendError(res, 401, 'Unauthorized');
  }
  const body = (req.body as any) || {};
  try {
    const result = await seedRagCache(body.source || 'pyq', body.budget || 500);
    sendJSON(res, result);
  } catch (err) { sendError(res, 500, (err as Error).message); }
}

async function handleVerifySweep(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return sendError(res, 401, 'Unauthorized');
  }
  const body = (req.body as any) || {};
  try {
    const result = await verifySweep({ topic: body.topic, strict: body.strict, limit: body.limit || 100 });
    sendJSON(res, result);
  } catch (err) { sendError(res, 500, (err as Error).message); }
}

// ============================================================================
// Route Export
// ============================================================================

export const gbrainRoutes: RouteDefinition[] = [
  // Core GBrain
  { method: 'GET', path: '/api/gbrain/model/:sessionId', handler: handleGetModel },
  { method: 'POST', path: '/api/gbrain/attempt', handler: handleAttempt },
  { method: 'GET', path: '/api/gbrain/errors/:sessionId', handler: handleGetErrors },
  { method: 'GET', path: '/api/gbrain/prerequisites/:sessionId/:conceptId', handler: handleGetPrerequisites },
  { method: 'POST', path: '/api/gbrain/generate-problems', handler: handleGenerateProblems },
  { method: 'GET', path: '/api/gbrain/exam-strategy/:sessionId', handler: handleGetExamStrategy },
  { method: 'GET', path: '/api/gbrain/score-plan/:sessionId', handler: handleGetScorePlan },
  { method: 'GET', path: '/api/gbrain/concepts/:topic', handler: handleGetConcepts },
  { method: 'POST', path: '/api/gbrain/confidence', handler: handleConfidence },

  // MOAT Operations
  { method: 'GET', path: '/api/gbrain/audit/:sessionId', handler: handleAudit },
  { method: 'GET', path: '/api/gbrain/cohort', handler: handleCohort },
  { method: 'GET', path: '/api/gbrain/content-gap/scan', handler: handleContentGapScan },
  { method: 'POST', path: '/api/gbrain/content-gap/fill', handler: handleContentGapFill },
  { method: 'GET', path: '/api/gbrain/health', handler: handleGbrainHealth },
  { method: 'POST', path: '/api/gbrain/daily-intelligence', handler: handleDailyIntelligence },
  { method: 'GET', path: '/api/gbrain/mock-exam/:sessionId', handler: handleMockExam },
  { method: 'GET', path: '/api/gbrain/weekly-digest/:sessionId', handler: handleWeeklyDigest },
  { method: 'GET', path: '/api/gbrain/misconceptions', handler: handleMineMisconceptions },
  { method: 'POST', path: '/api/gbrain/seed-rag', handler: handleSeedRag },
  { method: 'POST', path: '/api/gbrain/verify-sweep', handler: handleVerifySweep },
];
