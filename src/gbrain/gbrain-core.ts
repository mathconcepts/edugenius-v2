// @ts-nocheck
/**
 * GBrain Core — Pure Functions
 *
 * Pure, side-effect-free versions of Bayesian updates, mastery aggregation,
 * prerequisite tracing, ZPD selection. Runs on either server (Node) or client (browser).
 *
 * This is the computational heart of GBrain — all 6 pillars' logic without any
 * storage dependency. Callers pass in the student model, get back updated model.
 */

import { CONCEPT_MAP, traceWeakestPrerequisite, getConceptsForTopic } from '../constants/concept-graph';
import { MARKS_WEIGHTS, TOPIC_NAMES } from '../engine/priority-engine';

// ============================================================================
// Types (same shape as student-model.ts, but portable)
// ============================================================================

export interface MasteryEntry {
  score: number;
  attempts: number;
  correct: number;
  last_update: string;
}

export interface SpeedEntry {
  avg_ms: number;
  by_difficulty: { easy: number; medium: number; hard: number };
  samples: number;
}

export interface StudentModel {
  session_id: string;
  mastery_vector: Record<string, MasteryEntry>;
  speed_profile: Record<string, SpeedEntry>;
  prerequisite_alerts: Array<{ concept: string; shaky_prereqs: string[]; severity: string }>;
  representation_mode: 'algebraic' | 'geometric' | 'numerical' | 'balanced';
  abstraction_comfort: number;
  working_memory_est: number;
  motivation_state: 'driven' | 'steady' | 'flagging' | 'frustrated' | 'anxious';
  confidence_calibration: {
    overconfident_rate: number;
    underconfident_rate: number;
    calibration_score: number;
  };
  frustration_threshold: number;
  consecutive_failures: number;
  exam_strategy: any;
  updated_at: string;
}

/** Fresh empty student model with sensible defaults */
export function createEmptyStudentModel(sessionId: string): StudentModel {
  return {
    session_id: sessionId,
    mastery_vector: {},
    speed_profile: {},
    prerequisite_alerts: [],
    representation_mode: 'balanced',
    abstraction_comfort: 0.5,
    working_memory_est: 4,
    motivation_state: 'steady',
    confidence_calibration: { overconfident_rate: 0, underconfident_rate: 0, calibration_score: 0.5 },
    frustration_threshold: 3,
    consecutive_failures: 0,
    exam_strategy: {},
    updated_at: new Date().toISOString(),
  };
}

// ============================================================================
// Pillar 1: Bayesian Mastery Update
// ============================================================================

/** Update mastery vector for a concept after an attempt. Returns a new model (pure). */
export function updateMasteryPure(
  model: StudentModel,
  conceptId: string,
  isCorrect: boolean,
  difficulty: number,
  timeTakenMs?: number,
): StudentModel {
  const next = { ...model, mastery_vector: { ...model.mastery_vector }, speed_profile: { ...model.speed_profile } };

  const entry = next.mastery_vector[conceptId]
    ? { ...next.mastery_vector[conceptId] }
    : { score: 0.3, attempts: 0, correct: 0, last_update: new Date().toISOString() };

  entry.attempts += 1;
  if (isCorrect) entry.correct += 1;

  const learningRate = Math.max(0.05, 0.3 / Math.sqrt(entry.attempts));
  const surprise = isCorrect
    ? difficulty * learningRate
    : -(1 - difficulty) * learningRate;

  entry.score = Math.max(0, Math.min(1, entry.score + surprise));
  entry.last_update = new Date().toISOString();

  next.mastery_vector[conceptId] = entry;

  // Speed profile
  if (timeTakenMs) {
    const concept = CONCEPT_MAP.get(conceptId);
    if (concept) {
      const topic = concept.topic;
      const sp = next.speed_profile[topic]
        ? { ...next.speed_profile[topic], by_difficulty: { ...next.speed_profile[topic].by_difficulty } }
        : { avg_ms: timeTakenMs, by_difficulty: { easy: 0, medium: 0, hard: 0 }, samples: 0 };

      sp.samples += 1;
      const alpha = Math.min(0.3, 1 / sp.samples);
      sp.avg_ms = sp.avg_ms * (1 - alpha) + timeTakenMs * alpha;

      const bucket = difficulty < 0.33 ? 'easy' : difficulty < 0.66 ? 'medium' : 'hard';
      if (sp.by_difficulty[bucket] === 0) sp.by_difficulty[bucket] = timeTakenMs;
      else sp.by_difficulty[bucket] = sp.by_difficulty[bucket] * (1 - alpha) + timeTakenMs * alpha;

      next.speed_profile[topic] = sp;
    }
  }

  // Consecutive failures + motivation
  if (!isCorrect) {
    next.consecutive_failures = next.consecutive_failures + 1;
    if (next.consecutive_failures >= next.frustration_threshold) next.motivation_state = 'frustrated';
  } else {
    next.consecutive_failures = 0;
    if (next.motivation_state === 'frustrated') next.motivation_state = 'steady';
  }

  // Refresh prerequisite alerts
  next.prerequisite_alerts = computePrerequisiteAlerts(next);
  next.updated_at = new Date().toISOString();

  return next;
}

/** Update confidence calibration. Pure. */
export function updateConfidenceCalibrationPure(
  model: StudentModel,
  confidenceBefore: number,
  wasCorrect: boolean,
): StudentModel {
  const next = { ...model, confidence_calibration: { ...model.confidence_calibration } };
  const cal = next.confidence_calibration;

  const isOverconfident = confidenceBefore >= 0.6 && !wasCorrect;
  const isUnderconfident = confidenceBefore < 0.4 && wasCorrect;

  const alpha = 0.1;
  cal.overconfident_rate = cal.overconfident_rate * (1 - alpha) + (isOverconfident ? 1 : 0) * alpha;
  cal.underconfident_rate = cal.underconfident_rate * (1 - alpha) + (isUnderconfident ? 1 : 0) * alpha;
  cal.calibration_score = 1 - (cal.overconfident_rate + cal.underconfident_rate) / 2;

  next.updated_at = new Date().toISOString();
  return next;
}

// ============================================================================
// Pillar 3: Prerequisite Alerts (pure compute)
// ============================================================================

function computePrerequisiteAlerts(model: StudentModel): Array<{ concept: string; shaky_prereqs: string[]; severity: string }> {
  const alerts: Array<{ concept: string; shaky_prereqs: string[]; severity: string }> = [];

  for (const [conceptId, entry] of Object.entries(model.mastery_vector)) {
    if (entry.score < 0.5 && entry.attempts >= 3) {
      const weakPrereqs = traceWeakestPrerequisite(conceptId, model.mastery_vector, 0.3);
      if (weakPrereqs.length > 0) {
        alerts.push({
          concept: conceptId,
          shaky_prereqs: weakPrereqs.map(w => w.id),
          severity: weakPrereqs.some(w => (model.mastery_vector[w.id]?.score ?? 0) < 0.15) ? 'critical' : 'warning',
        });
      }
    }
  }

  return alerts;
}

// ============================================================================
// Aggregations (pure compute)
// ============================================================================

export function getTopicMasteryPure(model: StudentModel, topic: string): number {
  const concepts = getConceptsForTopic(topic);
  if (concepts.length === 0) return 0;
  const scores = concepts.map(c => model.mastery_vector[c.id]?.score ?? 0);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function getMasterySummaryPure(model: StudentModel): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const topic of Object.keys(MARKS_WEIGHTS)) {
    summary[topic] = getTopicMasteryPure(model, topic);
  }
  return summary;
}

export function getZPDConceptPure(model: StudentModel, topic: string): string | null {
  const concepts = getConceptsForTopic(topic);
  const zpd = concepts
    .map(c => ({ id: c.id, score: model.mastery_vector[c.id]?.score ?? 0 }))
    .filter(c => c.score >= 0.2 && c.score <= 0.7)
    .sort((a, b) => a.score - b.score);
  return zpd.length > 0 ? zpd[0].id : null;
}

export function serializeForPromptPure(model: StudentModel): string {
  const topicMastery = getMasterySummaryPure(model);
  const weakTopics = Object.entries(topicMastery).filter(([_, v]) => v < 0.4)
    .sort((a, b) => a[1] - b[1]).map(([k, v]) => `${k}: ${Math.round(v * 100)}%`);

  const recentErrors = model.prerequisite_alerts.filter(a => a.severity === 'critical')
    .map(a => `${a.concept} (needs: ${a.shaky_prereqs.join(', ')})`);

  const parts: string[] = [];
  parts.push(`Motivation: ${model.motivation_state}`);
  parts.push(`Representation: ${model.representation_mode}`);
  parts.push(`Abstraction comfort: ${Math.round(model.abstraction_comfort * 100)}%`);
  parts.push(`Working memory: ~${model.working_memory_est} steps`);
  if (weakTopics.length > 0) parts.push(`Weak topics: ${weakTopics.join(', ')}`);
  if (recentErrors.length > 0) parts.push(`Prerequisite gaps: ${recentErrors.join('; ')}`);

  const cal = model.confidence_calibration;
  if (cal.overconfident_rate > 0.3) parts.push('Confidence: tends overconfident — verify before advancing');
  else if (cal.underconfident_rate > 0.3) parts.push('Confidence: tends underconfident — encourage more attempts');

  if (model.consecutive_failures >= 2) parts.push(`Recent streak: ${model.consecutive_failures} failures — consider confidence building`);

  return parts.join('\n');
}

// ============================================================================
// Pillar 5: Exam Strategy (pure compute)
// ============================================================================

export interface ExamConfig {
  name: string;
  total_time_minutes: number;
  total_questions: number;
  marks_per_correct: number;
  marks_per_wrong: number;
}

export const EXAM_CONFIGS_PURE: Record<string, ExamConfig> = {
  gate: { name: 'GATE Engineering Mathematics', total_time_minutes: 180, total_questions: 65, marks_per_correct: 2, marks_per_wrong: -0.67 },
  bitsat: { name: 'BITSAT Mathematics', total_time_minutes: 180, total_questions: 45, marks_per_correct: 3, marks_per_wrong: -1 },
  'jee-main': { name: 'JEE Main Mathematics', total_time_minutes: 60, total_questions: 30, marks_per_correct: 4, marks_per_wrong: -1 },
};

export interface ExamPlaybook {
  exam: string;
  attempt_sequence: Array<{ topic: string; label: string; reason: string; expected_accuracy: number; avg_time_per_question_sec: number }>;
  time_budget: Record<string, number>;
  skip_threshold: number;
  expected_score: { optimistic: number; realistic: number; conservative: number };
  strategic_notes: string[];
}

export function generateAttemptSequencePure(model: StudentModel, examConfig: ExamConfig = EXAM_CONFIGS_PURE.gate): ExamPlaybook {
  const mastery = getMasterySummaryPure(model);
  const topics = Object.keys(MARKS_WEIGHTS);

  const topicMetrics = topics.map(topic => {
    const accuracy = mastery[topic] || 0;
    const speedEntry = model.speed_profile[topic];
    const avgTimeSec = speedEntry ? speedEntry.avg_ms / 1000 : 180;
    const marksPerMin = (accuracy * examConfig.marks_per_correct + (1 - accuracy) * Math.abs(examConfig.marks_per_wrong)) / (avgTimeSec / 60);
    return { topic, label: TOPIC_NAMES[topic] || topic, accuracy, avgTimeSec, marksPerMin, weight: MARKS_WEIGHTS[topic] || 0.08 };
  });

  const sorted = [...topicMetrics].sort((a, b) => b.marksPerMin - a.marksPerMin);

  const attempt_sequence = sorted.map(t => ({
    topic: t.topic,
    label: t.label,
    reason: t.accuracy >= 0.7 ? `Strong (${Math.round(t.accuracy * 100)}%) + fast (${Math.round(t.avgTimeSec)}s avg)`
      : t.accuracy >= 0.4 ? `Moderate (${Math.round(t.accuracy * 100)}%) — attempt if time permits`
      : `Weak (${Math.round(t.accuracy * 100)}%) — skip unless confident`,
    expected_accuracy: t.accuracy,
    avg_time_per_question_sec: t.avgTimeSec,
  }));

  const time_budget: Record<string, number> = {};
  const totalWeight = topicMetrics.reduce((s, m) => s + m.weight, 0);
  const available = examConfig.total_time_minutes * 0.9;
  for (const m of topicMetrics) {
    const baseMins = (m.weight / totalWeight) * available;
    const avgMinPerQ = m.avgTimeSec / 60;
    const expectedQs = Math.round(examConfig.total_questions * (m.weight / totalWeight));
    time_budget[m.topic] = Math.round(Math.max(5, Math.min(baseMins * 1.5, avgMinPerQ * expectedQs)));
  }

  const breakeven = Math.abs(examConfig.marks_per_wrong) / (examConfig.marks_per_correct + Math.abs(examConfig.marks_per_wrong));
  let skip_threshold = breakeven;
  if (model.confidence_calibration.overconfident_rate > 0.3) skip_threshold = Math.min(0.9, breakeven + 0.15);
  else if (model.confidence_calibration.underconfident_rate > 0.3) skip_threshold = Math.max(0.2, breakeven - 0.1);

  let totalMarks = 0;
  for (const m of topicMetrics) {
    const qs = Math.round(examConfig.total_questions * (m.weight / Object.keys(MARKS_WEIGHTS).length));
    const attemptRate = m.accuracy > skip_threshold ? 1.0 : 0.5;
    const attempted = qs * attemptRate;
    totalMarks += attempted * m.accuracy * examConfig.marks_per_correct + attempted * (1 - m.accuracy) * examConfig.marks_per_wrong;
  }

  const strategic_notes: string[] = [];
  const strong = topicMetrics.filter(t => t.accuracy >= 0.7);
  const weak = topicMetrics.filter(t => t.accuracy < 0.3);
  if (strong.length > 0) strategic_notes.push(`Anchor topics (attempt first): ${strong.map(t => t.label).join(', ')}.`);
  if (weak.length > 0) strategic_notes.push(`Skip-first topics: ${weak.map(t => t.label).join(', ')}. Attempt only if confidence > ${Math.round(skip_threshold * 100)}%.`);

  return {
    exam: examConfig.name,
    attempt_sequence,
    time_budget,
    skip_threshold,
    expected_score: {
      conservative: Math.round(totalMarks * 0.85),
      realistic: Math.round(totalMarks),
      optimistic: Math.round(totalMarks * 1.15),
    },
    strategic_notes,
  };
}

// ============================================================================
// Task Reasoner (heuristic-only pure version for client-side)
// ============================================================================

export function runTaskReasonerPure(
  message: string,
  model: StudentModel,
): {
  intent: string;
  action: string;
  selected_concept: string | null;
  selected_difficulty: number;
  reasoning: string;
} {
  const msg = message.toLowerCase();
  let intent = 'open_study';
  if (msg.match(/^(hi|hello|hey|good morning)/)) intent = 'greeting';
  else if (msg.match(/solve|answer|verify|check|is this right/)) intent = 'solution_check';
  else if (msg.match(/practice|drill|problems|give me/)) intent = 'practice_request';
  else if (msg.match(/strategy|exam|plan|prepare/)) intent = 'strategy_advice';
  else if (msg.match(/confused|don't understand|stuck|help/)) intent = 'expressing_confusion';
  else if (msg.match(/frustrated|can't|give up|hate|impossible/)) intent = 'expressing_frustration';
  else if (msg.match(/what|why|how|explain|define/)) intent = 'concept_question';

  let action = 'worked_example';
  let reasoning = '';

  if (intent === 'expressing_frustration' || model.motivation_state === 'frustrated') {
    action = 'emotional_support';
    reasoning = 'Student frustrated — address emotion first';
  } else if (intent === 'greeting') {
    action = 'progress_reflection';
    reasoning = 'Greeting — show progress';
  } else if (intent === 'strategy_advice') {
    action = 'strategy_coaching';
    reasoning = 'Strategy question';
  } else if (model.consecutive_failures >= model.frustration_threshold) {
    action = 'confidence_building';
    reasoning = `${model.consecutive_failures} failures — serve easier win`;
  } else if (intent === 'solution_check') {
    action = 'error_diagnosis';
    reasoning = 'Checking submitted work';
  }

  return { intent, action, selected_concept: null, selected_difficulty: 0.5, reasoning };
}
