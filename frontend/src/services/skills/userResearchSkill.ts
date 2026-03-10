/**
 * userResearchSkill.ts — Student/Teacher User Research Framework
 * VoltAgent pattern: Multi-agent research workflow.
 *
 * Synthesizes signals from multiple sources to build user understanding:
 *   - Behavioral signals (session duration, topic engagement)
 *   - Explicit feedback (thumbs, ratings)
 *   - Implicit signals (questions asked, skips)
 *   - Cohort patterns (aggregate trends)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserResearchSignal {
  userId: string;
  signalType: 'behavioral' | 'explicit' | 'implicit' | 'cohort';
  metric: string;
  value: number | string;
  timestamp: number;
  context?: string;
}

export interface UserResearchProfile {
  userId: string;
  exam: string;
  generatedAt: string;

  // Motivations
  primaryMotivation: 'career' | 'academic' | 'curiosity' | 'parental_pressure' | 'unknown';
  studyStyle: 'structured' | 'exploratory' | 'reactive' | 'mixed';

  // Pain points
  topPainPoints: string[];
  topicFrustrations: string[]; // topics where they struggle most

  // Engagement
  peakStudyHours: string;         // e.g. "10pm-12am"
  avgSessionMin: number;
  preferredContentType: string;   // most engaged atom type
  preferredChannel: string;       // WhatsApp/Telegram/in-app

  // Progress
  strengths: string[];            // top topics by score
  gaps: string[];                 // weakest topics
  trajectoryLabel: 'accelerating' | 'steady' | 'plateauing' | 'declining';

  // Persona archetype
  archetype: 'the_grinder' | 'the_strategist' | 'the_panicker' | 'the_casual' | 'the_topper';
  archetypeDescription: string;
}

// ─── Archetype definitions ────────────────────────────────────────────────────

const ARCHETYPE_DESCRIPTIONS: Record<UserResearchProfile['archetype'], string> = {
  the_grinder: `"The Grinder" studies long hours but struggles with efficiency. High quantity, variable quality. 
Motivated by fear of failure. Responds to: structured plans, progress tracking, spaced repetition reminders.
Risk: burnout. Opportunity: teach smarter techniques.`,

  the_strategist: `"The Strategist" is focused and efficient — they pick high-value topics and skip the rest.
Strong metacognition. Motivated by scores and ranking. Responds to: analytics, topper benchmarks, gap analysis.
Risk: overconfidence in gaps. Opportunity: fill blind spots they've consciously skipped.`,

  the_panicker: `"The Panicker" is anxious, inconsistent, and prone to inaction. Often brilliant but paralysed by pressure.
Motivated by reassurance and small wins. Responds to: calm mentoring, very small next steps, peer normalisation.
Risk: dropout near exam. Opportunity: steady mentorship dramatically changes outcomes.`,

  the_casual: `"The Casual" studies when convenient, engages lightly, and hasn't fully committed.
Motivated by interest and social proof. Responds to: engaging content, low-friction nudges, community belonging.
Risk: low retention. Opportunity: a great Sage conversation can convert them.`,

  the_topper: `"The Topper" is consistent, high-performing, and self-directed.
Motivated by excellence and peer competition. Responds to: hard challenges, deep content, peer ranking.
Risk: boredom with basic content. Opportunity: make them an internal champion/referrer.`,
};

// ─── Archetype inference from persona data ────────────────────────────────────

type ArchetypeKey = UserResearchProfile['archetype'];

function inferArchetype(data: {
  avgSessionMin: number;
  streakDays: number;
  currentScore: number;
  frustrationScore: number;
  daysToExam: number;
  tier: string;
}): ArchetypeKey {
  const { avgSessionMin, streakDays, currentScore, frustrationScore, tier } = data;

  if (currentScore >= 80 && streakDays >= 20) return 'the_topper';
  if (avgSessionMin >= 120 && frustrationScore < 4) return 'the_strategist';
  if (avgSessionMin >= 90 && streakDays >= 10) return 'the_grinder';
  if (frustrationScore >= 7 || (tier === 'struggling' && streakDays < 5)) return 'the_panicker';
  return 'the_casual';
}

// ─── Core builder ─────────────────────────────────────────────────────────────

/**
 * Build a UserResearchProfile by synthesizing from persona + feedback + notebook data.
 */
export function buildUserResearchProfile(userId: string): UserResearchProfile {
  // Try to load from studentPersonaEngine
  let persona: Record<string, unknown> | null = null;
  let feedbackLog: unknown[] = [];
  let notebookState: Record<string, unknown> | null = null;

  try {
    // Dynamic require for circular dependency avoidance
    const { loadPersona } = require('../studentPersonaEngine');
    persona = loadPersona();
  } catch { /* not available in this context */ }

  try {
    const { getAtomPerformanceLog } = require('../contentFeedbackService');
    feedbackLog = getAtomPerformanceLog?.() ?? [];
  } catch { /* not available */ }

  // If no persona, build a default profile
  const p = persona as {
    exam?: string; weakSubjects?: string[]; strongSubjects?: string[];
    avgSessionMinutes?: number; streakDays?: number; daysToExam?: number;
    currentScore?: number; frustrationScore?: number; tier?: string;
    emotionalState?: string; learningStyle?: string;
  } | null;

  const exam = p?.exam ?? 'GATE';
  const weakSubjects: string[] = p?.weakSubjects ?? [];
  const strongSubjects: string[] = p?.strongSubjects ?? [];
  const avgSessionMin = p?.avgSessionMinutes ?? 45;
  const streakDays = p?.streakDays ?? 0;
  const daysToExam = p?.daysToExam ?? 60;
  const currentScore = p?.currentScore ?? 50;
  const frustrationScore = p?.frustrationScore ?? 3;
  const tier = p?.tier ?? 'average';

  // Infer archetype
  const archetype = inferArchetype({ avgSessionMin, streakDays, currentScore, frustrationScore, daysToExam, tier });

  // Trajectory label from score trend
  const trajectoryLabel: UserResearchProfile['trajectoryLabel'] =
    currentScore >= 75 ? 'accelerating' :
    currentScore >= 55 && streakDays >= 7 ? 'steady' :
    streakDays < 3 ? 'declining' : 'plateauing';

  // Infer study style from learning style
  const learningStyle = p?.learningStyle ?? 'unknown';
  const studyStyle: UserResearchProfile['studyStyle'] =
    learningStyle === 'analytical' ? 'structured' :
    learningStyle === 'practice-first' ? 'structured' :
    learningStyle === 'exploratory' ? 'exploratory' :
    streakDays > 0 ? 'reactive' : 'mixed';

  // Pain points from weak subjects + frustration
  const topPainPoints: string[] = [];
  if (weakSubjects.length > 0) {
    topPainPoints.push(`Struggles with: ${weakSubjects.slice(0, 3).join(', ')}`);
  }
  if (frustrationScore >= 6) {
    topPainPoints.push('High frustration level — needs emotional support before content');
  }
  if (avgSessionMin < 20) {
    topPainPoints.push('Very short sessions — may not have enough study time or focus');
  }
  if (daysToExam < 30) {
    topPainPoints.push('Exam pressure building — anxiety risk is elevated');
  }
  if (streakDays < 3) {
    topPainPoints.push('Inconsistent study habit — prone to skipping days');
  }

  // Preferred content type (heuristic)
  const preferredContentType =
    learningStyle === 'visual' ? 'formula_card' :
    learningStyle === 'practice-first' ? 'mcq' :
    learningStyle === 'story-driven' ? 'worked_example' :
    learningStyle === 'analytical' ? 'worked_example' :
    'flashcard';

  // Peak study hours (heuristic — not tracked yet, so use exam-day common patterns)
  const peakStudyHours =
    exam.includes('GATE') ? '9pm-11pm' :
    exam.includes('JEE') ? '7pm-11pm' :
    exam.includes('NEET') ? '6am-9am' :
    '8pm-11pm';

  return {
    userId,
    exam,
    generatedAt: new Date().toISOString(),
    primaryMotivation: currentScore > 70 ? 'career' : daysToExam < 30 ? 'parental_pressure' : 'academic',
    studyStyle,
    topPainPoints,
    topicFrustrations: weakSubjects.slice(0, 5),
    peakStudyHours,
    avgSessionMin,
    preferredContentType,
    preferredChannel: 'in-app',
    strengths: strongSubjects.slice(0, 5),
    gaps: weakSubjects.slice(0, 5),
    trajectoryLabel,
    archetype,
    archetypeDescription: ARCHETYPE_DESCRIPTIONS[archetype],
  };
}

// ─── Archetype description ────────────────────────────────────────────────────

export function getArchetypeDescription(archetype: UserResearchProfile['archetype']): string {
  return ARCHETYPE_DESCRIPTIONS[archetype];
}

// ─── Topic frustrations ───────────────────────────────────────────────────────

/**
 * Returns topics with high attempt rate + low score, sourced from feedback service.
 */
export function getTopicFrustrations(userId: string): string[] {
  try {
    const { getAtomPerformanceSummary } = require('../contentFeedbackService');
    const summary = getAtomPerformanceSummary?.() ?? {};

    // Filter: topics where score < 50 and attempts > 2
    const frustrations: string[] = [];
    for (const [topicId, perf] of Object.entries(summary)) {
      const p = perf as { avgScore?: number; attempts?: number };
      if ((p.avgScore ?? 100) < 50 && (p.attempts ?? 0) > 2) {
        frustrations.push(topicId.replace(/-/g, ' '));
      }
    }
    return frustrations.slice(0, 5);
  } catch {
    return [];
  }
}

// ─── Agent prompt summary ─────────────────────────────────────────────────────

/**
 * Build a concise research summary formatted for injection into an agent's system prompt.
 *
 * @param userId - The student's ID
 * @param agentId - Which agent will consume this (sage, mentor, scout, oracle)
 * @returns A 1-3 sentence summary string
 */
export function buildResearchSummaryForAgent(userId: string, agentId: string): string {
  const profile = buildUserResearchProfile(userId);
  const archetypeName = profile.archetype.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  switch (agentId) {
    case 'sage': {
      const frustrations = profile.topicFrustrations.length > 0
        ? `Struggles with: ${profile.topicFrustrations.slice(0, 3).join(', ')}.`
        : '';
      return `Student is a "${archetypeName}" archetype, ${profile.exam}, ${
        profile.gaps.length > 0 ? `gaps in ${profile.gaps.slice(0, 2).join(' & ')}.` : ''
      } Peak study: ${profile.peakStudyHours}. ${frustrations} Prefers: ${profile.preferredContentType.replace(/_/g, ' ')} over MCQs. Trajectory: ${profile.trajectoryLabel}.`.trim();
    }

    case 'mentor': {
      return `Student archetype: "${archetypeName}". ${profile.topPainPoints[0] ?? ''}. Avg session: ${profile.avgSessionMin} min. Trajectory: ${profile.trajectoryLabel}. Preferred channel: ${profile.preferredChannel}. Motivation: ${profile.primaryMotivation.replace(/_/g, ' ')}.`;
    }

    case 'oracle': {
      return `User Research Profile [${userId}]: Archetype="${archetypeName}", Exam=${profile.exam}, Gaps=[${profile.gaps.join(', ')}], Strengths=[${profile.strengths.join(', ')}], Trajectory=${profile.trajectoryLabel}, AvgSession=${profile.avgSessionMin}min.`;
    }

    case 'scout': {
      return `Student segment: "${archetypeName}" archetype, ${profile.exam}, ${profile.studyStyle} study style. Top frustrations: ${profile.topicFrustrations.join(', ')}. Content preference: ${profile.preferredContentType}. This profile is representative of the ${profile.trajectoryLabel} student cohort.`;
    }

    default:
      return `User ${userId}: ${archetypeName} archetype for ${profile.exam}. Trajectory: ${profile.trajectoryLabel}.`;
  }
}
