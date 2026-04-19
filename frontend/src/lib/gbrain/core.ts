/**
 * Client-side pure GBrain core.
 *
 * Mirror of src/gbrain/gbrain-core.ts but uses the concept-loader (lazy-loaded
 * JSON bundle) instead of direct imports from server-side constants.
 * All functions are pure and synchronous where possible.
 */

import { getConcept, getAllConcepts, traceWeakestPrerequisiteClient } from './concept-loader';

// MARKS_WEIGHTS & TOPIC_NAMES — duplicated from src/engine/priority-engine.ts
// (small static data, no need to fetch)
export const MARKS_WEIGHTS_CLIENT: Record<string, number> = {
  'linear-algebra': 0.15,
  'calculus': 0.15,
  'probability-statistics': 0.12,
  'differential-equations': 0.10,
  'complex-variables': 0.08,
  'transform-theory': 0.08,
  'numerical-methods': 0.08,
  'discrete-mathematics': 0.08,
  'graph-theory': 0.08,
  'vector-calculus': 0.08,
};

export const TOPIC_NAMES_CLIENT: Record<string, string> = {
  'linear-algebra': 'Linear Algebra',
  'calculus': 'Calculus',
  'differential-equations': 'Differential Equations',
  'complex-variables': 'Complex Variables',
  'probability-statistics': 'Probability & Statistics',
  'numerical-methods': 'Numerical Methods',
  'transform-theory': 'Transform Theory',
  'discrete-mathematics': 'Discrete Mathematics',
  'graph-theory': 'Graph Theory',
  'vector-calculus': 'Vector Calculus',
};

// ============================================================================
// Types
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
  confidence_calibration: { overconfident_rate: number; underconfident_rate: number; calibration_score: number };
  frustration_threshold: number;
  consecutive_failures: number;
  exam_strategy: any;
  updated_at: string;
}

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
// Pure updates (async because concept lookup may be lazy-loaded)
// ============================================================================

export async function updateMasteryPure(
  model: StudentModel,
  conceptId: string,
  isCorrect: boolean,
  difficulty: number,
  timeTakenMs?: number,
): Promise<StudentModel> {
  const next = { ...model, mastery_vector: { ...model.mastery_vector }, speed_profile: { ...model.speed_profile } };

  const entry = next.mastery_vector[conceptId]
    ? { ...next.mastery_vector[conceptId] }
    : { score: 0.3, attempts: 0, correct: 0, last_update: new Date().toISOString() };

  entry.attempts += 1;
  if (isCorrect) entry.correct += 1;

  const learningRate = Math.max(0.05, 0.3 / Math.sqrt(entry.attempts));
  const surprise = isCorrect ? difficulty * learningRate : -(1 - difficulty) * learningRate;
  entry.score = Math.max(0, Math.min(1, entry.score + surprise));
  entry.last_update = new Date().toISOString();
  next.mastery_vector[conceptId] = entry;

  if (timeTakenMs) {
    const concept = await getConcept(conceptId);
    if (concept) {
      const sp = next.speed_profile[concept.topic]
        ? { ...next.speed_profile[concept.topic], by_difficulty: { ...next.speed_profile[concept.topic].by_difficulty } }
        : { avg_ms: timeTakenMs, by_difficulty: { easy: 0, medium: 0, hard: 0 }, samples: 0 };
      sp.samples += 1;
      const alpha = Math.min(0.3, 1 / sp.samples);
      sp.avg_ms = sp.avg_ms * (1 - alpha) + timeTakenMs * alpha;
      const bucket = difficulty < 0.33 ? 'easy' : difficulty < 0.66 ? 'medium' : 'hard';
      sp.by_difficulty[bucket] = sp.by_difficulty[bucket] === 0
        ? timeTakenMs
        : sp.by_difficulty[bucket] * (1 - alpha) + timeTakenMs * alpha;
      next.speed_profile[concept.topic] = sp;
    }
  }

  if (!isCorrect) {
    next.consecutive_failures = next.consecutive_failures + 1;
    if (next.consecutive_failures >= next.frustration_threshold) next.motivation_state = 'frustrated';
  } else {
    next.consecutive_failures = 0;
    if (next.motivation_state === 'frustrated') next.motivation_state = 'steady';
  }

  next.prerequisite_alerts = await computePrerequisiteAlerts(next);
  next.updated_at = new Date().toISOString();
  return next;
}

export function updateConfidenceCalibrationPure(
  model: StudentModel,
  confidenceBefore: number,
  wasCorrect: boolean,
): StudentModel {
  const next = { ...model, confidence_calibration: { ...model.confidence_calibration } };
  const cal = next.confidence_calibration;
  const isOver = confidenceBefore >= 0.6 && !wasCorrect;
  const isUnder = confidenceBefore < 0.4 && wasCorrect;
  const alpha = 0.1;
  cal.overconfident_rate = cal.overconfident_rate * (1 - alpha) + (isOver ? 1 : 0) * alpha;
  cal.underconfident_rate = cal.underconfident_rate * (1 - alpha) + (isUnder ? 1 : 0) * alpha;
  cal.calibration_score = 1 - (cal.overconfident_rate + cal.underconfident_rate) / 2;
  next.updated_at = new Date().toISOString();
  return next;
}

async function computePrerequisiteAlerts(model: StudentModel) {
  const alerts: Array<{ concept: string; shaky_prereqs: string[]; severity: string }> = [];
  for (const [conceptId, entry] of Object.entries(model.mastery_vector)) {
    if (entry.score < 0.5 && entry.attempts >= 3) {
      const weakPrereqs = await traceWeakestPrerequisiteClient(conceptId, model.mastery_vector, 0.3);
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
// Aggregations
// ============================================================================

export async function getTopicMasteryPure(model: StudentModel, topic: string): Promise<number> {
  const { getConceptsForTopicClient } = await import('./concept-loader');
  const concepts = await getConceptsForTopicClient(topic);
  if (concepts.length === 0) return 0;
  const scores = concepts.map(c => model.mastery_vector[c.id]?.score ?? 0);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export async function getMasterySummaryPure(model: StudentModel): Promise<Record<string, number>> {
  const summary: Record<string, number> = {};
  for (const topic of Object.keys(MARKS_WEIGHTS_CLIENT)) {
    summary[topic] = await getTopicMasteryPure(model, topic);
  }
  return summary;
}

export async function getZPDConceptPure(model: StudentModel, topic: string): Promise<string | null> {
  const { getConceptsForTopicClient } = await import('./concept-loader');
  const concepts = await getConceptsForTopicClient(topic);
  const zpd = concepts
    .map(c => ({ id: c.id, score: model.mastery_vector[c.id]?.score ?? 0 }))
    .filter(c => c.score >= 0.2 && c.score <= 0.7)
    .sort((a, b) => a.score - b.score);
  return zpd.length > 0 ? zpd[0].id : null;
}

export async function serializeForPromptPure(model: StudentModel): Promise<string> {
  const topicMastery = await getMasterySummaryPure(model);
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
  if (cal.overconfident_rate > 0.3) parts.push('Confidence: tends overconfident');
  else if (cal.underconfident_rate > 0.3) parts.push('Confidence: tends underconfident');
  if (model.consecutive_failures >= 2) parts.push(`Recent: ${model.consecutive_failures} failures`);
  return parts.join('\n');
}

// ============================================================================
// Exam strategy
// ============================================================================

export interface ExamConfig {
  name: string; total_time_minutes: number; total_questions: number;
  marks_per_correct: number; marks_per_wrong: number;
}

export const EXAM_CONFIGS_PURE: Record<string, ExamConfig> = {
  gate: { name: 'GATE Engineering Mathematics', total_time_minutes: 180, total_questions: 65, marks_per_correct: 2, marks_per_wrong: -0.67 },
  bitsat: { name: 'BITSAT Mathematics', total_time_minutes: 180, total_questions: 45, marks_per_correct: 3, marks_per_wrong: -1 },
  'jee-main': { name: 'JEE Main Mathematics', total_time_minutes: 60, total_questions: 30, marks_per_correct: 4, marks_per_wrong: -1 },
};

export async function generateAttemptSequencePure(model: StudentModel, examConfig: ExamConfig = EXAM_CONFIGS_PURE.gate) {
  const mastery = await getMasterySummaryPure(model);
  const topics = Object.keys(MARKS_WEIGHTS_CLIENT);

  const topicMetrics = topics.map(topic => {
    const accuracy = mastery[topic] || 0;
    const sp = model.speed_profile[topic];
    const avgTimeSec = sp ? sp.avg_ms / 1000 : 180;
    const marksPerMin = (accuracy * examConfig.marks_per_correct + (1 - accuracy) * Math.abs(examConfig.marks_per_wrong)) / (avgTimeSec / 60);
    return { topic, label: TOPIC_NAMES_CLIENT[topic] || topic, accuracy, avgTimeSec, marksPerMin, weight: MARKS_WEIGHTS_CLIENT[topic] || 0.08 };
  });

  const sorted = [...topicMetrics].sort((a, b) => b.marksPerMin - a.marksPerMin);
  const attempt_sequence = sorted.map(t => ({
    topic: t.topic, label: t.label,
    reason: t.accuracy >= 0.7 ? `Strong (${Math.round(t.accuracy * 100)}%) + fast`
      : t.accuracy >= 0.4 ? `Moderate (${Math.round(t.accuracy * 100)}%)`
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
    const qs = Math.round(examConfig.total_questions * (m.weight / Object.keys(MARKS_WEIGHTS_CLIENT).length));
    const attemptRate = m.accuracy > skip_threshold ? 1.0 : 0.5;
    const attempted = qs * attemptRate;
    totalMarks += attempted * m.accuracy * examConfig.marks_per_correct + attempted * (1 - m.accuracy) * examConfig.marks_per_wrong;
  }

  const strategic_notes: string[] = [];
  const strong = topicMetrics.filter(t => t.accuracy >= 0.7);
  const weak = topicMetrics.filter(t => t.accuracy < 0.3);
  if (strong.length > 0) strategic_notes.push(`Anchor: ${strong.map(t => t.label).join(', ')}`);
  if (weak.length > 0) strategic_notes.push(`Skip-first: ${weak.map(t => t.label).join(', ')}`);

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
// Task Reasoner (synchronous heuristic)
// ============================================================================

export function runTaskReasonerPure(message: string, model: StudentModel) {
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
    action = 'emotional_support'; reasoning = 'Student frustrated — address emotion first';
  } else if (intent === 'greeting') {
    action = 'progress_reflection'; reasoning = 'Greeting — show progress';
  } else if (intent === 'strategy_advice') {
    action = 'strategy_coaching'; reasoning = 'Strategy question';
  } else if (model.consecutive_failures >= model.frustration_threshold) {
    action = 'confidence_building'; reasoning = `${model.consecutive_failures} failures — easier win`;
  } else if (intent === 'solution_check') {
    action = 'error_diagnosis'; reasoning = 'Checking submitted work';
  }

  return { intent, action, selected_concept: null, selected_difficulty: 0.5, reasoning };
}
