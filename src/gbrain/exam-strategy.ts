// @ts-nocheck
/**
 * GBrain — Exam Strategy Optimizer (Pillar 5)
 *
 * Generates personalized exam playbooks:
 *   - Optimal attempt sequence (fastest/strongest topics first)
 *   - Time budget per section
 *   - Skip threshold for negative marking
 *   - Score maximization plan (study allocation)
 *   - Negative marking trainer (confidence calibration game)
 */

import type { StudentModel, SpeedEntry } from './student-model';
import { getTopicMastery, getMasterySummary } from './student-model';
import { MARKS_WEIGHTS, TOPIC_NAMES } from '../engine/priority-engine';

// ============================================================================
// Types
// ============================================================================

export interface ExamConfig {
  name: string;
  total_time_minutes: number;
  total_questions: number;
  marks_per_correct: number;
  marks_per_wrong: number;   // negative value for negative marking
  sections?: Array<{
    name: string;
    topic: string;
    questions: number;
    marks_per_correct: number;
    marks_per_wrong: number;
  }>;
}

export interface ExamPlaybook {
  exam: string;
  attempt_sequence: Array<{
    topic: string;
    label: string;
    reason: string;
    expected_accuracy: number;
    avg_time_per_question_sec: number;
  }>;
  time_budget: Record<string, number>; // topic → minutes
  skip_threshold: number;              // 0-1, personalized
  expected_score: {
    optimistic: number;
    realistic: number;
    conservative: number;
  };
  strategic_notes: string[];
}

export interface ScoreMaximizationPlan {
  allocations: Array<{
    topic: string;
    label: string;
    current_mastery: number;
    target_mastery: number;
    expected_marks_gain: number;
    hours_needed: number;
    priority_rank: number;
  }>;
  total_expected_improvement: number;
  days_until_exam: number;
  daily_hours_needed: number;
}

export interface NegativeMarkingChallenge {
  problem_id: string;
  question_text: string;
  concept_id: string;
  difficulty: number;
  should_attempt: boolean; // Based on student's calibrated accuracy
  confidence_threshold: number;
}

// ============================================================================
// Exam Configurations
// ============================================================================

export const EXAM_CONFIGS: Record<string, ExamConfig> = {
  'gate': {
    name: 'GATE Engineering Mathematics',
    total_time_minutes: 180,
    total_questions: 65, // approx
    marks_per_correct: 2, // weighted average
    marks_per_wrong: -0.67, // 1/3 negative marking
  },
  'bitsat': {
    name: 'BITSAT Mathematics',
    total_time_minutes: 180,
    total_questions: 45,
    marks_per_correct: 3,
    marks_per_wrong: -1,
  },
  'jee-main': {
    name: 'JEE Main Mathematics',
    total_time_minutes: 60, // math section
    total_questions: 30,
    marks_per_correct: 4,
    marks_per_wrong: -1,
  },
};

// ============================================================================
// Attempt Sequence Optimizer
// ============================================================================

/**
 * Generate optimal attempt sequence based on speed and accuracy profiles.
 * Strategy: highest (accuracy × speed) first = maximize expected marks per minute.
 */
export function generateAttemptSequence(
  model: StudentModel,
  examConfig: ExamConfig = EXAM_CONFIGS['gate'],
): ExamPlaybook {
  const mastery = getMasterySummary(model);
  const topics = Object.keys(MARKS_WEIGHTS);

  // Compute expected marks per minute for each topic
  const topicMetrics = topics.map(topic => {
    const accuracy = mastery[topic] || 0;
    const speedEntry = model.speed_profile[topic] as SpeedEntry | undefined;
    const avgTimeSec = speedEntry ? speedEntry.avg_ms / 1000 : 180; // default 3 min
    const marksPerMin = (accuracy * examConfig.marks_per_correct + (1 - accuracy) * Math.abs(examConfig.marks_per_wrong)) / (avgTimeSec / 60);

    return {
      topic,
      label: TOPIC_NAMES[topic] || topic,
      accuracy,
      avgTimeSec,
      marksPerMin,
      weight: MARKS_WEIGHTS[topic] || 0.08,
    };
  });

  // Sort by marks per minute (descending) — attempt most efficient first
  const sorted = [...topicMetrics].sort((a, b) => b.marksPerMin - a.marksPerMin);

  const attempt_sequence = sorted.map(t => ({
    topic: t.topic,
    label: t.label,
    reason: t.accuracy >= 0.7
      ? `Strong (${Math.round(t.accuracy * 100)}%) + fast (${Math.round(t.avgTimeSec)}s avg)`
      : t.accuracy >= 0.4
        ? `Moderate (${Math.round(t.accuracy * 100)}%) — attempt if time permits`
        : `Weak (${Math.round(t.accuracy * 100)}%) — skip unless confident`,
    expected_accuracy: t.accuracy,
    avg_time_per_question_sec: t.avgTimeSec,
  }));

  // Compute time budget
  const time_budget = computeTimeBudget(topicMetrics, examConfig);

  // Compute skip threshold
  const skip_threshold = computeSkipThreshold(model, examConfig);

  // Compute expected scores
  const expected_score = computeExpectedScore(topicMetrics, examConfig, skip_threshold);

  // Strategic notes
  const strategic_notes: string[] = [];

  const strongTopics = topicMetrics.filter(t => t.accuracy >= 0.7);
  const weakTopics = topicMetrics.filter(t => t.accuracy < 0.3);

  if (strongTopics.length > 0) {
    strategic_notes.push(
      `Anchor topics (attempt first): ${strongTopics.map(t => t.label).join(', ')}. These are your fastest marks.`
    );
  }
  if (weakTopics.length > 0) {
    strategic_notes.push(
      `Skip-first topics: ${weakTopics.map(t => t.label).join(', ')}. Only attempt if you're ${Math.round(skip_threshold * 100)}%+ confident.`
    );
  }

  const cal = model.confidence_calibration;
  if (cal.overconfident_rate > 0.3) {
    strategic_notes.push(
      `⚠️ You tend to be overconfident. Raise your skip threshold — if unsure, skip. The negative marks hurt more than you think.`
    );
  }
  if (cal.underconfident_rate > 0.3) {
    strategic_notes.push(
      `Your data shows you're underconfident — you skip questions you'd likely get right. Try attempting more borderline questions.`
    );
  }

  return {
    exam: examConfig.name,
    attempt_sequence,
    time_budget,
    skip_threshold,
    expected_score,
    strategic_notes,
  };
}

/** Compute time allocation per topic */
function computeTimeBudget(
  metrics: Array<{ topic: string; accuracy: number; avgTimeSec: number; weight: number }>,
  exam: ExamConfig,
): Record<string, number> {
  const totalMinutes = exam.total_time_minutes;
  const reviewBuffer = totalMinutes * 0.1; // 10% buffer for review
  const available = totalMinutes - reviewBuffer;

  const budget: Record<string, number> = {};

  // Allocate proportional to (weight × expected questions), with speed adjustment
  const totalWeight = metrics.reduce((sum, m) => sum + m.weight, 0);

  for (const m of metrics) {
    const baseMins = (m.weight / totalWeight) * available;
    // Adjust: give more time to slower topics (but cap at 1.5x)
    const avgMinPerQ = m.avgTimeSec / 60;
    const expectedQuestions = Math.round(exam.total_questions * (m.weight / totalWeight));
    const neededMins = Math.min(baseMins * 1.5, avgMinPerQ * expectedQuestions);
    budget[m.topic] = Math.round(Math.max(5, neededMins)); // minimum 5 min per topic
  }

  return budget;
}

/** Compute personalized skip threshold for negative marking */
function computeSkipThreshold(model: StudentModel, exam: ExamConfig): number {
  if (exam.marks_per_wrong >= 0) return 0; // No negative marking

  // Threshold = breakeven probability
  // Expected value of attempting = p * marks_correct + (1-p) * marks_wrong
  // Set EV = 0: p = |marks_wrong| / (marks_correct + |marks_wrong|)
  const breakeven = Math.abs(exam.marks_per_wrong) / (exam.marks_per_correct + Math.abs(exam.marks_per_wrong));

  // Adjust for calibration
  const cal = model.confidence_calibration;
  if (cal.overconfident_rate > 0.3) {
    // Overconfident students should have a higher threshold
    return Math.min(0.9, breakeven + 0.15);
  }
  if (cal.underconfident_rate > 0.3) {
    // Underconfident students can lower threshold slightly
    return Math.max(0.2, breakeven - 0.1);
  }

  return breakeven;
}

/** Compute expected score range */
function computeExpectedScore(
  metrics: Array<{ topic: string; accuracy: number; weight: number }>,
  exam: ExamConfig,
  skipThreshold: number,
): { optimistic: number; realistic: number; conservative: number } {
  let totalMarks = 0;
  const maxMarks = exam.total_questions * exam.marks_per_correct;

  for (const m of metrics) {
    const questions = Math.round(exam.total_questions * (m.weight / Object.keys(MARKS_WEIGHTS).length));
    const attemptRate = m.accuracy > skipThreshold ? 1.0 : 0.5; // skip weak topics partially
    const attempted = questions * attemptRate;
    const correct = attempted * m.accuracy;
    const wrong = attempted * (1 - m.accuracy);
    totalMarks += correct * exam.marks_per_correct + wrong * exam.marks_per_wrong;
  }

  return {
    optimistic: Math.round(totalMarks * 1.15),
    realistic: Math.round(totalMarks),
    conservative: Math.round(totalMarks * 0.85),
  };
}

// ============================================================================
// Score Maximization Planner
// ============================================================================

/**
 * Given current mastery and exam weights, compute optimal study allocation.
 * Answers: "Which topics should I invest my remaining study time in?"
 */
export function generateScoreMaximizationPlan(
  model: StudentModel,
  daysUntilExam: number,
  weeklyHours: number = 15,
): ScoreMaximizationPlan {
  const mastery = getMasterySummary(model);
  const topics = Object.keys(MARKS_WEIGHTS);

  // Compute expected marks gain per topic if mastery improves by 0.2
  const allocations = topics.map(topic => {
    const current = mastery[topic] || 0;
    const weight = MARKS_WEIGHTS[topic] || 0.08;

    // Target: improve by up to 0.2, capped at 0.85
    const target = Math.min(0.85, current + 0.2);
    const improvement = target - current;

    // Expected marks gain = weight × total_marks × improvement
    const totalMarks = 130; // approximate GATE total
    const expectedGain = weight * totalMarks * improvement;

    // Hours needed: harder to improve at higher mastery (diminishing returns)
    const difficultyMultiplier = 1 + current; // takes longer to go from 0.6→0.8 than 0.2→0.4
    const hoursNeeded = improvement * 20 * difficultyMultiplier; // rough estimate

    return {
      topic,
      label: TOPIC_NAMES[topic] || topic,
      current_mastery: current,
      target_mastery: target,
      expected_marks_gain: Math.round(expectedGain * 10) / 10,
      hours_needed: Math.round(hoursNeeded * 10) / 10,
      priority_rank: 0,
      efficiency: expectedGain / Math.max(1, hoursNeeded), // marks per hour
    };
  });

  // Sort by efficiency (marks per hour of study)
  allocations.sort((a, b) => (b as any).efficiency - (a as any).efficiency);
  allocations.forEach((a, i) => { a.priority_rank = i + 1; });

  // Compute daily hours needed
  const totalHoursAvailable = (daysUntilExam / 7) * weeklyHours;
  const totalHoursNeeded = allocations.reduce((sum, a) => sum + a.hours_needed, 0);
  const dailyHoursNeeded = Math.min(
    totalHoursNeeded / Math.max(1, daysUntilExam),
    weeklyHours / 7 * 1.5, // don't exceed 1.5x normal rate
  );

  return {
    allocations: allocations.map(({ efficiency, ...rest }) => rest), // strip internal field
    total_expected_improvement: allocations.reduce((sum, a) => sum + a.expected_marks_gain, 0),
    days_until_exam: daysUntilExam,
    daily_hours_needed: Math.round(dailyHoursNeeded * 10) / 10,
  };
}

// ============================================================================
// Save Strategy to Student Model
// ============================================================================

/** Compute and persist exam strategy in the student model */
export function computeAndSaveExamStrategy(
  model: StudentModel,
  examConfig: ExamConfig = EXAM_CONFIGS['gate'],
  daysUntilExam?: number,
): StudentModel {
  const playbook = generateAttemptSequence(model, examConfig);

  model.exam_strategy = {
    attempt_sequence: playbook.attempt_sequence.map(a => a.topic),
    skip_threshold: playbook.skip_threshold,
    time_budget: playbook.time_budget,
    score_maximization: daysUntilExam
      ? generateScoreMaximizationPlan(model, daysUntilExam).allocations.map(a => ({
          topic: a.topic,
          current: a.current_mastery,
          target: a.target_mastery,
          expected_gain: a.expected_marks_gain,
        }))
      : undefined,
  };

  return model;
}
