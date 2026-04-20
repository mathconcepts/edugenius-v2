/**
 * GBrain Client Controller — Local-First.
 *
 * Orchestrates all 6 pillars from the browser:
 *   - Student model lives in IndexedDB
 *   - Pure functions (Bayesian updates, ZPD) run in JS
 *   - Gemini calls go through stateless /api/gemini/* endpoints
 *
 * This is the DB-less counterpart to /api/gbrain/attempt.
 */

import {
  getStudentModel, saveStudentModel, logError, logAttempt, logConfidence,
  getErrors, searchMaterials, getCachedProblems, saveGeneratedProblem,
  getChunksForMaterial,
} from './db';
import { embed } from './embedder';
import { trackAggregate } from './aggregate';
import {
  createEmptyStudentModel, updateMasteryPure, updateConfidenceCalibrationPure,
  getMasterySummaryPure, getTopicMasteryPure, getZPDConceptPure,
  generateAttemptSequencePure, EXAM_CONFIGS_PURE, runTaskReasonerPure,
  serializeForPromptPure,
  type StudentModel,
} from './core';
import type { ConceptNode } from './concept-loader';

// ============================================================================
// Model lifecycle
// ============================================================================

export async function loadOrCreateModel(sessionId: string): Promise<StudentModel> {
  const existing = await getStudentModel(sessionId);
  if (existing) return existing as StudentModel;
  const fresh = createEmptyStudentModel(sessionId);
  await saveStudentModel(fresh);
  return fresh;
}

// ============================================================================
// Record attempt — updates mastery, classifies error, logs, saves
// ============================================================================

export interface AttemptInput {
  sessionId: string;
  problem: string;
  studentAnswer: string;
  correctAnswer: string;
  conceptId: string;
  isCorrect: boolean;
  difficulty: number;
  timeTakenMs?: number;
  confidenceBefore?: number;
  problemId?: string;
}

export interface AttemptResult {
  mastery_update: { concept: string; new_score: number; attempts: number };
  error_diagnosis: any | null;
  motivation_state: string;
  consecutive_failures: number;
  prerequisite_alerts: Array<{ concept: string; shaky_prereqs: string[]; severity: string }>;
}

export async function recordAttempt(input: AttemptInput): Promise<AttemptResult> {
  let model = await loadOrCreateModel(input.sessionId);

  // Pure Bayesian update (async — loads concept metadata)
  model = await updateMasteryPure(model, input.conceptId, input.isCorrect, input.difficulty, input.timeTakenMs);

  // Confidence calibration
  if (input.confidenceBefore !== undefined) {
    model = updateConfidenceCalibrationPure(model, input.confidenceBefore, input.isCorrect);
    await logConfidence({
      session_id: input.sessionId,
      concept_id: input.conceptId,
      confidence_before: input.confidenceBefore,
      was_correct: input.isCorrect,
    });
  }

  // Log attempt
  await logAttempt({
    session_id: input.sessionId,
    problem_id: input.problemId,
    concept_id: input.conceptId,
    is_correct: input.isCorrect,
    difficulty: input.difficulty,
    time_taken_ms: input.timeTakenMs,
  });

  // Classify error if wrong
  let errorDiagnosis: any = null;
  if (!input.isCorrect && input.problem && input.studentAnswer && input.correctAnswer) {
    try {
      const res = await fetch('/api/gemini/classify-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem: input.problem,
          studentAnswer: input.studentAnswer,
          correctAnswer: input.correctAnswer,
          timeTakenMs: input.timeTakenMs,
        }),
      });
      if (res.ok) {
        errorDiagnosis = await res.json();
        await logError({
          session_id: input.sessionId,
          concept_id: errorDiagnosis.concept_id || input.conceptId,
          topic: input.conceptId,
          error_type: errorDiagnosis.error_type,
          misconception_id: errorDiagnosis.misconception_id,
          diagnosis: errorDiagnosis.diagnosis,
          why_tempting: errorDiagnosis.why_tempting,
          why_wrong: errorDiagnosis.why_wrong,
          corrective_hint: errorDiagnosis.corrective_hint,
          student_answer: input.studentAnswer,
          correct_answer: input.correctAnswer,
          time_taken_ms: input.timeTakenMs,
          confidence_before: input.confidenceBefore,
        });
        // Fire anonymized aggregate if user opted in
        trackAggregate({
          concept_id: errorDiagnosis.concept_id || input.conceptId,
          topic: input.conceptId,
          error_type: errorDiagnosis.error_type,
          misconception_id: errorDiagnosis.misconception_id,
          misconception_description: errorDiagnosis.diagnosis,
          motivation_state: model.motivation_state,
        });
      }
    } catch {
      // Non-fatal
    }
  }

  await saveStudentModel(model);

  return {
    mastery_update: {
      concept: input.conceptId,
      new_score: model.mastery_vector[input.conceptId]?.score || 0,
      attempts: model.mastery_vector[input.conceptId]?.attempts || 0,
    },
    error_diagnosis: errorDiagnosis,
    motivation_state: model.motivation_state,
    consecutive_failures: model.consecutive_failures,
    prerequisite_alerts: model.prerequisite_alerts.filter(a => a.severity === 'critical'),
  };
}

// ============================================================================
// Exam strategy
// ============================================================================

export async function getExamStrategy(sessionId: string, examKey: string = 'gate') {
  const model = await loadOrCreateModel(sessionId);
  const config = EXAM_CONFIGS_PURE[examKey] || EXAM_CONFIGS_PURE.gate;
  return await generateAttemptSequencePure(model, config);
}

// ============================================================================
// Error pattern report (client-side aggregation)
// ============================================================================

export async function getErrorReport(sessionId: string, days = 7) {
  const errors = await getErrors(sessionId, days);
  const byType: Record<string, number> = {};
  const byConcept: Record<string, number> = {};
  const misconceptions: Record<string, { count: number; description: string }> = {};

  for (const e of errors) {
    byType[e.error_type] = (byType[e.error_type] || 0) + 1;
    byConcept[e.concept_id] = (byConcept[e.concept_id] || 0) + 1;
    const mc = e.misconception_id || 'unknown';
    misconceptions[mc] = misconceptions[mc] || { count: 0, description: e.diagnosis };
    misconceptions[mc].count++;
  }

  const prevErrors = await getErrors(sessionId, days * 2);
  const currentCount = errors.length;
  const prevCount = prevErrors.length - currentCount;
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (prevCount > 0) {
    const ratio = currentCount / prevCount;
    if (ratio < 0.8) trend = 'improving';
    else if (ratio > 1.2) trend = 'declining';
  }

  const recommendations: string[] = [];
  if ((byType.arithmetic || 0) > currentCount * 0.3) recommendations.push('Over 30% arithmetic errors — slow down, write intermediate steps.');
  if ((byType.conceptual || 0) > currentCount * 0.3) recommendations.push('Many conceptual errors — revisit foundational theory.');
  if ((byType.time_pressure || 0) > currentCount * 0.2) recommendations.push('Time pressure — practice untimed first, then tighten.');
  if ((byType.overconfidence_skip || 0) > currentCount * 0.2) recommendations.push('Skipping steps — write every step; speed comes from fluency.');

  return {
    session_id: sessionId,
    total_errors: currentCount,
    by_type: byType,
    by_concept: byConcept,
    top_misconceptions: Object.entries(misconceptions)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([id, { count, description }]) => ({ id, count, description })),
    trend,
    recommendations,
  };
}

// ============================================================================
// Problem generation (client-cached)
// ============================================================================

export async function generateProblemClient(
  sessionId: string,
  conceptId: string,
  conceptLabel: string,
  difficulty: number,
  targetErrorType?: string,
): Promise<any> {
  // Check client cache first
  const cached = await getCachedProblems(conceptId, difficulty);
  if (cached.length > 0) {
    return cached[Math.floor(Math.random() * cached.length)];
  }

  // Generate via stateless proxy
  const res = await fetch('/api/gemini/generate-problem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conceptId, conceptLabel, difficulty, targetErrorType }),
  });
  if (!res.ok) throw new Error(`Generation failed: ${res.status}`);
  const data = await res.json();

  if (data.verified) {
    const id = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    await saveGeneratedProblem({
      id,
      concept_id: conceptId,
      topic: conceptId, // TODO: infer topic from concept
      difficulty,
      question_text: data.question_text,
      correct_answer: data.correct_answer,
      solution_steps: data.solution_steps || [],
      distractors: data.distractors || [],
      target_error_type: targetErrorType,
      verified: true,
      created_at: new Date().toISOString(),
    });
    return { id, ...data };
  }
  return data;
}

// ============================================================================
// Grounded chat — retrieves top-K material chunks, streams Gemini response
// ============================================================================

export async function streamGroundedChat(
  sessionId: string,
  message: string,
  history: Array<{ role: string; content: string }>,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): Promise<void> {
  let groundingChunks: string[] = [];

  try {
    // Embed query + search materials
    const queryVec = await embed(message);
    const matches = await searchMaterials(queryVec, 3);

    // Fetch chunk texts for top matches with score > 0.35
    const { getDB } = await import('./db');
    const db = await getDB();
    for (const m of matches) {
      if (m.score > 0.35) {
        const chunk = await db.get('chunks', m.chunk_id);
        if (chunk) groundingChunks.push(chunk.text);
      }
    }
  } catch {
    // Non-fatal — continue without grounding
  }

  const model = await loadOrCreateModel(sessionId);
  const reasonerDecision = runTaskReasonerPure(message, model);
  const studentProfile = await serializeForPromptPure(model);
  const systemPrompt = `You are GBrain, an expert GATE Engineering Mathematics tutor.

TASK REASONER DECISION:
Intent: ${reasonerDecision.intent}
Action: ${reasonerDecision.action}
Reasoning: ${reasonerDecision.reasoning}

STUDENT PROFILE:
${studentProfile}

Use LaTeX: inline $..$ and display $$...$$.`;

  // Stream
  const res = await fetch('/api/gemini/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message, history, systemPrompt, groundingChunks,
    }),
  });

  if (!res.ok || !res.body) return onError(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const data = line.replace(/^data:\s*/, '');
        if (!data) continue;
        try {
          const evt = JSON.parse(data);
          if (evt.type === 'chunk') onChunk(evt.content);
          else if (evt.type === 'done') onDone();
          else if (evt.type === 'error') onError(evt.error);
        } catch { /* ignore */ }
      }
    }
  } catch (err) {
    onError((err as Error).message);
  }
}

// ============================================================================
// Convenience re-exports
// ============================================================================

export {
  getMasterySummaryPure,
  getTopicMasteryPure,
  getZPDConceptPure,
  type StudentModel,
};
