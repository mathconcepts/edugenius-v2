// @ts-nocheck
/**
 * GBrain Layer 1 — Student Model
 *
 * Living profile that updates every interaction. Contains mastery vectors,
 * error patterns, cognitive preferences, emotional state, and exam strategy.
 *
 * Key operations:
 *   getOrCreate(sessionId)     — Load or initialize student model
 *   updateMastery(...)         — Bayesian update after problem attempt
 *   updateMotivation(...)      — Detect motivation state from session patterns
 *   updateCognitiveProfile(...)— Infer cognitive preferences from performance
 *   computeExamStrategy(...)   — Generate personalized exam playbook
 */

import pg from 'pg';
import { CONCEPT_MAP, traceWeakestPrerequisite, getConceptsForTopic } from '../constants/concept-graph';
import { MARKS_WEIGHTS } from '../engine/priority-engine';

const { Pool } = pg;

let _pool: any = null;
function getPool() {
  if (_pool) return _pool;
  _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
  });
  return _pool;
}

// ============================================================================
// Types
// ============================================================================

export interface MasteryEntry {
  score: number;       // 0.0–1.0 Bayesian posterior
  attempts: number;
  correct: number;
  last_update: string; // ISO date
}

export interface SpeedEntry {
  avg_ms: number;
  by_difficulty: { easy: number; medium: number; hard: number };
  samples: number;
}

export interface StudentModel {
  id: string;
  session_id: string;
  user_id: string | null;

  // Academic
  mastery_vector: Record<string, MasteryEntry>;
  speed_profile: Record<string, SpeedEntry>;
  prerequisite_alerts: Array<{ concept: string; shaky_prereqs: string[]; severity: string }>;

  // Cognitive
  representation_mode: 'algebraic' | 'geometric' | 'numerical' | 'balanced';
  abstraction_comfort: number;
  working_memory_est: number;

  // Motivational
  motivation_state: 'driven' | 'steady' | 'flagging' | 'frustrated' | 'anxious';
  confidence_calibration: {
    overconfident_rate: number;
    underconfident_rate: number;
    calibration_score: number;
  };
  frustration_threshold: number;
  consecutive_failures: number;

  // Exam
  exam_strategy: {
    attempt_sequence?: string[];
    skip_threshold?: number;
    time_budget?: Record<string, number>;
    score_maximization?: Array<{
      topic: string;
      current: number;
      target: number;
      expected_gain: number;
    }>;
  };

  updated_at: string;
}

// ============================================================================
// Core CRUD
// ============================================================================

/** Get or create a student model for a session */
export async function getOrCreateStudentModel(sessionId: string): Promise<StudentModel> {
  const pool = getPool();

  const existing = await pool.query(
    'SELECT * FROM student_model WHERE session_id = $1',
    [sessionId],
  );

  if (existing.rows.length > 0) {
    return existing.rows[0] as StudentModel;
  }

  // Create new model
  const result = await pool.query(
    `INSERT INTO student_model (session_id) VALUES ($1) RETURNING *`,
    [sessionId],
  );

  return result.rows[0] as StudentModel;
}

/** Save student model updates */
export async function saveStudentModel(model: StudentModel): Promise<void> {
  const pool = getPool();

  await pool.query(
    `UPDATE student_model SET
       mastery_vector = $2,
       speed_profile = $3,
       prerequisite_alerts = $4,
       representation_mode = $5,
       abstraction_comfort = $6,
       working_memory_est = $7,
       motivation_state = $8,
       confidence_calibration = $9,
       frustration_threshold = $10,
       consecutive_failures = $11,
       exam_strategy = $12,
       updated_at = NOW()
     WHERE session_id = $1`,
    [
      model.session_id,
      JSON.stringify(model.mastery_vector),
      JSON.stringify(model.speed_profile),
      JSON.stringify(model.prerequisite_alerts),
      model.representation_mode,
      model.abstraction_comfort,
      model.working_memory_est,
      model.motivation_state,
      JSON.stringify(model.confidence_calibration),
      model.frustration_threshold,
      model.consecutive_failures,
      JSON.stringify(model.exam_strategy),
    ],
  );
}

// ============================================================================
// Pillar 1: Bayesian Mastery Updates
// ============================================================================

/**
 * Update mastery for a concept after a problem attempt.
 * Uses Bayesian-inspired update: hard correct = bigger bump, easy wrong = bigger decay.
 */
export function updateMastery(
  model: StudentModel,
  conceptId: string,
  isCorrect: boolean,
  difficulty: number, // 0-1
  timeTakenMs?: number,
): StudentModel {
  const entry = model.mastery_vector[conceptId] || {
    score: 0.3, // prior
    attempts: 0,
    correct: 0,
    last_update: new Date().toISOString(),
  };

  entry.attempts += 1;
  if (isCorrect) entry.correct += 1;

  // Bayesian-inspired update:
  // Correct on hard problem → big positive update
  // Wrong on easy problem → big negative update
  const learningRate = Math.max(0.05, 0.3 / Math.sqrt(entry.attempts)); // decays with experience
  const surprise = isCorrect
    ? difficulty * learningRate          // hard correct = high surprise = big bump
    : -(1 - difficulty) * learningRate;  // easy wrong = high surprise = big decay

  entry.score = Math.max(0, Math.min(1, entry.score + surprise));
  entry.last_update = new Date().toISOString();

  model.mastery_vector[conceptId] = entry;

  // Update speed profile
  if (timeTakenMs) {
    const concept = CONCEPT_MAP.get(conceptId);
    if (concept) {
      updateSpeedProfile(model, concept.topic, difficulty, timeTakenMs);
    }
  }

  // Check for consecutive failures
  if (!isCorrect) {
    model.consecutive_failures += 1;
    if (model.consecutive_failures >= model.frustration_threshold) {
      model.motivation_state = 'frustrated';
    }
  } else {
    model.consecutive_failures = 0;
    if (model.motivation_state === 'frustrated') {
      model.motivation_state = 'steady';
    }
  }

  // Refresh prerequisite alerts
  refreshPrerequisiteAlerts(model);

  return model;
}

/** Update speed profile for a topic */
function updateSpeedProfile(
  model: StudentModel,
  topic: string,
  difficulty: number,
  timeTakenMs: number,
): void {
  const entry = model.speed_profile[topic] || {
    avg_ms: timeTakenMs,
    by_difficulty: { easy: 0, medium: 0, hard: 0 },
    samples: 0,
  };

  entry.samples += 1;
  // Exponential moving average
  const alpha = Math.min(0.3, 1 / entry.samples);
  entry.avg_ms = entry.avg_ms * (1 - alpha) + timeTakenMs * alpha;

  // Bucket by difficulty
  const bucket = difficulty < 0.33 ? 'easy' : difficulty < 0.66 ? 'medium' : 'hard';
  if (entry.by_difficulty[bucket] === 0) {
    entry.by_difficulty[bucket] = timeTakenMs;
  } else {
    entry.by_difficulty[bucket] = entry.by_difficulty[bucket] * (1 - alpha) + timeTakenMs * alpha;
  }

  model.speed_profile[topic] = entry;
}

/** Refresh prerequisite alerts based on current mastery vector */
function refreshPrerequisiteAlerts(model: StudentModel): void {
  const alerts: Array<{ concept: string; shaky_prereqs: string[]; severity: string }> = [];

  for (const [conceptId, entry] of Object.entries(model.mastery_vector)) {
    if (entry.score < 0.5 && entry.attempts >= 3) {
      const weakPrereqs = traceWeakestPrerequisite(conceptId, model.mastery_vector, 0.3);
      if (weakPrereqs.length > 0) {
        alerts.push({
          concept: conceptId,
          shaky_prereqs: weakPrereqs.map(w => w.id),
          severity: weakPrereqs.some(w => (model.mastery_vector[w.id]?.score ?? 0) < 0.15)
            ? 'critical'
            : 'warning',
        });
      }
    }
  }

  model.prerequisite_alerts = alerts;
}

// ============================================================================
// Confidence Calibration
// ============================================================================

/** Update confidence calibration after a confidence-rated attempt */
export function updateConfidenceCalibration(
  model: StudentModel,
  confidenceBefore: number, // 0-1, student's self-rated confidence
  wasCorrect: boolean,
): StudentModel {
  const cal = model.confidence_calibration;

  // Track overconfident: confident but wrong
  // Track underconfident: unconfident but right
  const isOverconfident = confidenceBefore >= 0.6 && !wasCorrect;
  const isUnderconfident = confidenceBefore < 0.4 && wasCorrect;

  // Exponential moving average of rates
  const alpha = 0.1;
  cal.overconfident_rate = cal.overconfident_rate * (1 - alpha) + (isOverconfident ? 1 : 0) * alpha;
  cal.underconfident_rate = cal.underconfident_rate * (1 - alpha) + (isUnderconfident ? 1 : 0) * alpha;
  cal.calibration_score = 1 - (cal.overconfident_rate + cal.underconfident_rate) / 2;

  model.confidence_calibration = cal;
  return model;
}

// ============================================================================
// Topic-Level Mastery Aggregation
// ============================================================================

/** Get aggregated mastery score for a topic (average of concept scores) */
export function getTopicMastery(model: StudentModel, topic: string): number {
  const concepts = getConceptsForTopic(topic);
  if (concepts.length === 0) return 0;

  const scores = concepts.map(c => model.mastery_vector[c.id]?.score ?? 0);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/** Get mastery summary across all topics */
export function getMasterySummary(model: StudentModel): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const topic of Object.keys(MARKS_WEIGHTS)) {
    summary[topic] = getTopicMastery(model, topic);
  }
  return summary;
}

/** Get the concept in zone of proximal development (mastery 0.3-0.7) for a topic */
export function getZPDConcept(model: StudentModel, topic: string): string | null {
  const concepts = getConceptsForTopic(topic);

  // Sort by mastery, find the first one in ZPD range
  const zpd = concepts
    .map(c => ({ id: c.id, score: model.mastery_vector[c.id]?.score ?? 0 }))
    .filter(c => c.score >= 0.2 && c.score <= 0.7)
    .sort((a, b) => a.score - b.score);

  return zpd.length > 0 ? zpd[0].id : null;
}

/** Serialize student model for inclusion in LLM prompts (compact) */
export function serializeForPrompt(model: StudentModel): string {
  const topicMastery = getMasterySummary(model);
  const weakTopics = Object.entries(topicMastery)
    .filter(([_, v]) => v < 0.4)
    .sort((a, b) => a[1] - b[1])
    .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`);

  const recentErrors = model.prerequisite_alerts
    .filter(a => a.severity === 'critical')
    .map(a => `${a.concept} (needs: ${a.shaky_prereqs.join(', ')})`);

  const parts: string[] = [];

  parts.push(`Motivation: ${model.motivation_state}`);
  parts.push(`Representation: ${model.representation_mode}`);
  parts.push(`Abstraction comfort: ${Math.round(model.abstraction_comfort * 100)}%`);
  parts.push(`Working memory: ~${model.working_memory_est} steps`);

  if (weakTopics.length > 0) {
    parts.push(`Weak topics: ${weakTopics.join(', ')}`);
  }

  if (recentErrors.length > 0) {
    parts.push(`Prerequisite gaps: ${recentErrors.join('; ')}`);
  }

  const cal = model.confidence_calibration;
  if (cal.overconfident_rate > 0.3) {
    parts.push('Confidence: tends to be overconfident — verify understanding before advancing');
  } else if (cal.underconfident_rate > 0.3) {
    parts.push('Confidence: tends to be underconfident — encourage more attempts');
  }

  if (model.consecutive_failures >= 2) {
    parts.push(`Recent streak: ${model.consecutive_failures} failures in a row — consider confidence building`);
  }

  return parts.join('\n');
}
