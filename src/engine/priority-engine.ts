// @ts-nocheck
/**
 * Deterministic Priority Engine for Study Commander
 *
 * Pure function: no DB access, no side effects.
 * Formula: priority = marks_weight × weakness × improvement_speed × recency_due × exam_proximity
 * All factors floored at 0.1 to prevent zero-product collapse.
 */

// ============================================================================
// Types
// ============================================================================

export interface StudyProfile {
  exam_date: string;         // ISO date string
  target_score: number | null;
  weekly_hours: number;
  topic_confidence: Record<string, number>;  // topic_id → 1-5
  diagnostic_scores: Array<{ scores: Record<string, number>; taken_at: string }>;
}

export interface TopicSRStats {
  topic: string;
  accuracy: number;          // 0-1, from SR data
  sessions_count: number;
  accuracy_first_5: number;  // avg accuracy of first 5 sessions
  accuracy_last_5: number;   // avg accuracy of last 5 sessions
  last_practice_date: string | null; // ISO date or null
}

export interface TopicPriority {
  topic: string;
  priority: number;
  marks_weight: number;
  weakness: number;
  improvement_speed: number;
  recency_due: number;
  exam_proximity: number;
  reason: string;
}

// ============================================================================
// Topic weights (GATE Engineering Mathematics, coaching institute analysis)
// ============================================================================

export const MARKS_WEIGHTS: Record<string, number> = {
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

export const TOPIC_NAMES: Record<string, string> = {
  'linear-algebra': 'Linear Algebra',
  'calculus': 'Calculus',
  'probability-statistics': 'Probability & Statistics',
  'differential-equations': 'Differential Equations',
  'complex-variables': 'Complex Variables',
  'transform-theory': 'Transform Theory',
  'numerical-methods': 'Numerical Methods',
  'discrete-mathematics': 'Discrete Mathematics',
  'graph-theory': 'Graph Theory',
  'vector-calculus': 'Vector Calculus',
};

const FLOOR = 0.1;

function floor(x: number): number {
  return Math.max(FLOOR, x);
}

// ============================================================================
// Sigmoid for exam proximity
// ============================================================================

function examProximitySigmoid(daysRemaining: number): number {
  // Ramps up inside 30 days: 1 / (1 + e^(-(30 - days) / 10))
  return 1 / (1 + Math.exp(-(30 - daysRemaining) / 10));
}

// ============================================================================
// Core computation
// ============================================================================

export function computePriority(
  profile: StudyProfile,
  srStats: TopicSRStats[],
  now: Date,
): TopicPriority[] {
  const examDate = new Date(profile.exam_date);
  const daysRemaining = Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Latest diagnostic scores (last entry in append-only array)
  const latestDiagnostic = profile.diagnostic_scores?.length
    ? profile.diagnostic_scores[profile.diagnostic_scores.length - 1].scores
    : null;

  // Build SR stats lookup
  const srMap = new Map<string, TopicSRStats>();
  for (const s of srStats) {
    srMap.set(s.topic, s);
  }

  const topicIds = Object.keys(MARKS_WEIGHTS);
  const results: TopicPriority[] = [];

  for (const topic of topicIds) {
    const marks_weight = MARKS_WEIGHTS[topic] || 0.08;
    const sr = srMap.get(topic);

    // Weakness: 1 - accuracy. Fall back to confidence mapping if no diagnostic/SR data.
    let weakness: number;
    if (sr && sr.sessions_count > 0) {
      weakness = 1 - sr.accuracy;
    } else if (latestDiagnostic && latestDiagnostic[topic] !== undefined) {
      weakness = 1 - latestDiagnostic[topic];
    } else {
      // Confidence fallback: 1 - (confidence / 5)
      const confidence = profile.topic_confidence[topic] || 3;
      weakness = 1 - (confidence / 5);
    }

    // Improvement speed: (accuracy_last_5 - accuracy_first_5) / sessions_count
    let improvement_speed = 0.5; // cold start default
    if (sr && sr.sessions_count >= 5) {
      const raw = (sr.accuracy_last_5 - sr.accuracy_first_5) / Math.max(1, sr.sessions_count);
      improvement_speed = Math.min(1, Math.max(0, raw + 0.5)); // shift to 0-1 range
    }

    // Recency due: min(1, days_since_last_practice / 14)
    let recency_due = 1.0; // never practiced
    if (sr && sr.last_practice_date) {
      const lastPractice = new Date(sr.last_practice_date);
      const daysSince = Math.max(0, (now.getTime() - lastPractice.getTime()) / (1000 * 60 * 60 * 24));
      recency_due = Math.min(1, daysSince / 14);
    }

    // Exam proximity sigmoid
    const exam_proximity = examProximitySigmoid(daysRemaining);

    // Priority with floors on all factors
    const priority = floor(marks_weight) * floor(weakness) * floor(improvement_speed) * floor(recency_due) * floor(exam_proximity);

    // Human-readable reason
    const topicName = TOPIC_NAMES[topic] || topic;
    const pct = Math.round(marks_weight * 100);
    let reason: string;
    if (weakness > 0.6) {
      reason = `${topicName} is ${pct}% of marks and one of your weakest areas`;
    } else if (recency_due > 0.7) {
      reason = `${topicName} is ${pct}% of marks and you haven't practiced it recently`;
    } else {
      reason = `${topicName} carries ${pct}% of marks — keep reinforcing`;
    }

    results.push({
      topic,
      priority,
      marks_weight,
      weakness: floor(weakness),
      improvement_speed: floor(improvement_speed),
      recency_due: floor(recency_due),
      exam_proximity: floor(exam_proximity),
      reason,
    });
  }

  // Sort descending by priority
  results.sort((a, b) => b.priority - a.priority);
  return results;
}

// ============================================================================
// Task generation from priorities
// ============================================================================

export interface DailyTask {
  type: 'practice' | 'study' | 'revise';
  topic: string;
  topic_name: string;
  reason: string;
  est_min: number;
}

export function generateDailyTasks(
  priorities: TopicPriority[],
  srDueTopics: string[],
  weeklyHours: number,
): DailyTask[] {
  const tasks: DailyTask[] = [];
  const minutesPerDay = Math.round((weeklyHours / 7) * 60);
  const taskMinutes = Math.max(15, Math.round(minutesPerDay / 3));

  if (priorities.length === 0) return tasks;

  // Task 1: Practice (highest priority topic)
  tasks.push({
    type: 'practice',
    topic: priorities[0].topic,
    topic_name: TOPIC_NAMES[priorities[0].topic] || priorities[0].topic,
    reason: priorities[0].reason,
    est_min: taskMinutes,
  });

  // Task 2: Study (second highest priority topic)
  if (priorities.length > 1) {
    tasks.push({
      type: 'study',
      topic: priorities[1].topic,
      topic_name: TOPIC_NAMES[priorities[1].topic] || priorities[1].topic,
      reason: priorities[1].reason,
      est_min: taskMinutes,
    });
  }

  // Task 3: Revise (if SR-due items exist) or Practice (3rd topic)
  if (srDueTopics.length > 0) {
    const reviseTopic = srDueTopics[0];
    tasks.push({
      type: 'revise',
      topic: reviseTopic,
      topic_name: TOPIC_NAMES[reviseTopic] || reviseTopic,
      reason: `You have items due for review in ${TOPIC_NAMES[reviseTopic] || reviseTopic}`,
      est_min: taskMinutes,
    });
  } else if (priorities.length > 2) {
    tasks.push({
      type: 'practice',
      topic: priorities[2].topic,
      topic_name: TOPIC_NAMES[priorities[2].topic] || priorities[2].topic,
      reason: priorities[2].reason,
      est_min: taskMinutes,
    });
  }

  return tasks;
}
