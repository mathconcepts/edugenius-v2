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

// ─── Structured Research Report ──────────────────────────────────────────────
//
// Each research subtopic (archetype, pain points, engagement, channels, etc.)
// is documented with: summary, user intent, data sources, and an action
// objective determined by the system. A consolidated table is always generated
// and can be progressively updated as new signals arrive.

export type ResearchDataSource =
  | 'behavioral_signals'    // session durations, skip patterns, topic time
  | 'explicit_feedback'     // thumbs up/down, ratings, surveys
  | 'implicit_signals'      // re-reads, hint usage, message count
  | 'cohort_analytics'      // aggregate patterns across similar students
  | 'topic_mastery_bkt'     // Bayesian Knowledge Tracing mastery scores
  | 'spaced_rep_queue'      // overdue review topics (SR algorithm)
  | 'frustration_heuristic' // consecutive wrong answers, session abandonment
  | 'persona_inference'     // LLM-inferred from question tone and style
  | 'platform_metadata';    // device, channel, time-of-day, streak data

export type ResearchSubtopicId =
  | 'archetype'
  | 'motivation'
  | 'pain_points'
  | 'engagement_patterns'
  | 'content_preferences'
  | 'channel_behaviour'
  | 'knowledge_gaps'
  | 'emotional_state'
  | 'trajectory'
  | 'churn_risk';

export interface ResearchSubtopic {
  id: ResearchSubtopicId;
  title: string;
  emoji: string;

  /** 2–3 sentence synthesis of what was found for this dimension */
  summary: string;

  /** What the user is trying to do / what they need at this stage */
  userIntent: string;

  /** Which data sources were used to derive this finding */
  dataSources: ResearchDataSource[];

  /** Confidence: how reliable is this finding given available data */
  confidence: 'high' | 'medium' | 'low';

  /**
   * System-determined action objective:
   * What should an agent DO with this insight, right now?
   */
  actionObjective: string;

  /** Which agents should act on this */
  responsibleAgents: string[];

  /** Signal to emit (if applicable) */
  signalToEmit?: string;

  /** Last updated timestamp */
  updatedAt: string;
}

export interface UserResearchReport {
  userId: string;
  exam: string;
  generatedAt: string;
  updatedAt: string;

  /** The underlying profile (unchanged) */
  profile: UserResearchProfile;

  /** Per-subtopic deep-dive entries */
  subtopics: ResearchSubtopic[];

  /**
   * Consolidated summary table — one row per subtopic:
   * [Subtopic | Key Finding | User Intent | Data Source | Action Objective]
   */
  consolidatedTable: Array<{
    subtopic: string;
    keyFinding: string;
    userIntent: string;
    primarySource: string;
    actionObjective: string;
    agents: string;
    confidence: string;
  }>;

  /** Progressive update log — each entry records when a subtopic was refreshed */
  updateLog: Array<{
    ts: string;
    subtopicId: ResearchSubtopicId;
    change: string;
  }>;
}

// ─── Subtopic builders ────────────────────────────────────────────────────────

function buildArchetypeSubtopic(profile: UserResearchProfile): ResearchSubtopic {
  const archetypeName = profile.archetype.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return {
    id: 'archetype',
    title: 'Student Archetype',
    emoji: '🧠',
    summary: `Student matches the "${archetypeName}" archetype. ${ARCHETYPE_DESCRIPTIONS[profile.archetype].split('\n')[0]}`,
    userIntent: 'To be taught in a way that matches their natural learning personality and motivation style — not forced into a one-size-fits-all approach.',
    dataSources: ['behavioral_signals', 'topic_mastery_bkt', 'frustration_heuristic', 'platform_metadata'],
    confidence: profile.archetype === 'the_casual' ? 'medium' : 'high',
    actionObjective: `Sage should adopt the "${archetypeName}" response style immediately. Mentor should adjust nudge frequency and tone to match this archetype's motivational drivers.`,
    responsibleAgents: ['sage', 'mentor'],
    signalToEmit: undefined,
    updatedAt: new Date().toISOString(),
  };
}

function buildMotivationSubtopic(profile: UserResearchProfile): ResearchSubtopic {
  const motivationMap: Record<string, string> = {
    career: 'Student is motivated by career outcomes — rank, placement, salary. Responds to concrete score benchmarks and job-outcome framing.',
    academic: 'Student is primarily academically motivated — driven by understanding and grades. Responds to concept mastery and curriculum alignment.',
    curiosity: 'Student is curiosity-driven. Loves exploring. Responds to "did you know?" hooks and cross-topic connections.',
    parental_pressure: 'Student is under external (parental) pressure. May be anxious. Needs reassurance and quick-win milestones to self-motivate.',
    unknown: 'Motivation is unclear. More data needed — use early Sage sessions to probe primary goals.',
  };
  return {
    id: 'motivation',
    title: 'Primary Motivation',
    emoji: '🎯',
    summary: motivationMap[profile.primaryMotivation] ?? 'Motivation not yet established.',
    userIntent: 'To feel like the platform understands WHY they are studying, and uses that to frame lessons in a personally relevant way.',
    dataSources: ['persona_inference', 'platform_metadata', 'explicit_feedback'],
    confidence: profile.primaryMotivation === 'unknown' ? 'low' : 'medium',
    actionObjective: `Sage should frame every lesson through the lens of ${profile.primaryMotivation.replace(/_/g, ' ')}. Herald should use this in ad copy targeting. Mentor should reference it in re-engagement messages.`,
    responsibleAgents: ['sage', 'mentor', 'herald'],
    updatedAt: new Date().toISOString(),
  };
}

function buildPainPointsSubtopic(profile: UserResearchProfile): ResearchSubtopic {
  const hasPains = profile.topPainPoints.length > 0;
  const topPain = profile.topPainPoints[0] ?? 'No critical pain points detected yet.';
  return {
    id: 'pain_points',
    title: 'Pain Points',
    emoji: '⚠️',
    summary: hasPains
      ? `${profile.topPainPoints.length} pain points identified. Primary: ${topPain}. Topic-level frustrations concentrated in: ${profile.topicFrustrations.slice(0, 3).join(', ') || 'none yet'}.`
      : 'No significant pain points detected from available signals. Continue monitoring.',
    userIntent: 'To have their specific blockers removed — not be given generic advice. They want the platform to notice where they are struggling and act on it.',
    dataSources: ['frustration_heuristic', 'topic_mastery_bkt', 'behavioral_signals', 'implicit_signals'],
    confidence: hasPains ? 'high' : 'low',
    actionObjective: profile.topicFrustrations.length > 0
      ? `Atlas should generate targeted content for: ${profile.topicFrustrations.slice(0, 2).join(', ')}. Sage should proactively offer help on these topics. Mentor should send empathy nudge if frustration_score ≥ 6.`
      : 'No immediate action required. Monitor for emerging frustrations.',
    responsibleAgents: ['atlas', 'sage', 'mentor'],
    signalToEmit: profile.topicFrustrations.length > 0 ? 'ENGAGEMENT_GAP' : undefined,
    updatedAt: new Date().toISOString(),
  };
}

function buildEngagementSubtopic(profile: UserResearchProfile): ResearchSubtopic {
  const isShortSession = profile.avgSessionMin < 20;
  const isLongSession = profile.avgSessionMin > 60;
  const sessionLabel = isShortSession ? 'very short' : isLongSession ? 'long, deep' : 'moderate';
  return {
    id: 'engagement_patterns',
    title: 'Engagement Patterns',
    emoji: '📊',
    summary: `Average session: ${profile.avgSessionMin} minutes (${sessionLabel}). Peak study hours: ${profile.peakStudyHours}. Study trajectory: ${profile.trajectoryLabel}. ${isShortSession ? 'Risk: shallow learning, low retention.' : isLongSession ? 'Risk: cognitive overload, burnout.' : 'Healthy engagement pattern.'}`,
    userIntent: 'To engage with content at a pace and time that fits their natural rhythm — not forced into session lengths that don\'t suit them.',
    dataSources: ['behavioral_signals', 'platform_metadata', 'cohort_analytics'],
    confidence: 'medium',
    actionObjective: isShortSession
      ? 'Sage should deliver shorter, denser sessions. Atlas should favour formula-cards and MCQs over long explanations. Mentor should nudge during peak hours only.'
      : isLongSession
      ? 'Mentor should inject study-break reminders after 50 minutes. Sage should pace questions and offer breaks. Cognitive load signal: medium→high.'
      : 'Continue current delivery. Maintain session structure. Oracle should monitor for trajectory changes.',
    responsibleAgents: ['sage', 'mentor', 'oracle'],
    updatedAt: new Date().toISOString(),
  };
}

function buildContentPreferencesSubtopic(profile: UserResearchProfile): ResearchSubtopic {
  return {
    id: 'content_preferences',
    title: 'Content Preferences',
    emoji: '📚',
    summary: `Preferred content format: ${profile.preferredContentType.replace(/_/g, ' ')}. Study style: ${profile.studyStyle}. Strong in: ${profile.strengths.slice(0, 2).join(', ') || 'none identified yet'}. Weak in: ${profile.gaps.slice(0, 2).join(', ') || 'none identified yet'}.`,
    userIntent: 'To receive content in the format they learn best from — not default explanations that don\'t match their learning style.',
    dataSources: ['implicit_signals', 'explicit_feedback', 'behavioral_signals', 'persona_inference'],
    confidence: 'medium',
    actionObjective: `Atlas should prioritise generating ${profile.preferredContentType.replace(/_/g, ' ')} for ${profile.exam} topics. Sage should default to this format in responses unless emotional state requires a switch. Oracle should track format-specific engagement rates.`,
    responsibleAgents: ['atlas', 'sage', 'oracle'],
    signalToEmit: 'FORMAT_REQUEST',
    updatedAt: new Date().toISOString(),
  };
}

function buildChannelSubtopic(profile: UserResearchProfile): ResearchSubtopic {
  const channel = profile.preferredChannel;
  const channelInsights: Record<string, string> = {
    'in-app': 'Student engages primarily through the web app. Full feature access. Richest interaction surface.',
    whatsapp: 'Student prefers WhatsApp. Needs concise, mobile-first answers. Emoji-friendly. Lower friction than app.',
    telegram: 'Student uses Telegram bot. Comfortable with async messaging. Good for daily nudges and quick questions.',
    email: 'Student responds to email. Prefers asynchronous updates. Best for weekly reports and parent-facing content.',
  };
  return {
    id: 'channel_behaviour',
    title: 'Channel Behaviour',
    emoji: '📱',
    summary: channelInsights[channel] ?? `Primary channel: ${channel}. Interaction patterns not yet fully characterised.`,
    userIntent: 'To receive help through the channel they are already using — without switching apps or contexts.',
    dataSources: ['platform_metadata', 'behavioral_signals'],
    confidence: channel === 'in-app' ? 'high' : 'medium',
    actionObjective: `All agent outputs should be adapted for ${channel} format. Mentor should send re-engagement nudges exclusively on ${channel}. Herald should run ${channel}-specific campaigns if applicable.`,
    responsibleAgents: ['mentor', 'herald', 'sage'],
    updatedAt: new Date().toISOString(),
  };
}

function buildKnowledgeGapsSubtopic(profile: UserResearchProfile): ResearchSubtopic {
  const gapCount = profile.gaps.length;
  return {
    id: 'knowledge_gaps',
    title: 'Knowledge Gaps',
    emoji: '🔍',
    summary: gapCount > 0
      ? `${gapCount} knowledge gaps identified. Weakest topics: ${profile.gaps.slice(0, 4).join(', ')}. Strong foundations in: ${profile.strengths.slice(0, 3).join(', ') || 'none yet'}.`
      : 'No significant knowledge gaps detected. Student appears broadly capable across measured topics.',
    userIntent: 'To understand exactly where their gaps are — and have those gaps addressed proactively, not discovered during the exam.',
    dataSources: ['topic_mastery_bkt', 'frustration_heuristic', 'implicit_signals'],
    confidence: gapCount > 0 ? 'high' : 'low',
    actionObjective: gapCount > 0
      ? `Atlas should immediately queue content generation for: ${profile.gaps.slice(0, 3).join(', ')}. Sage should prioritise these when selecting next topic. Oracle should track mastery delta weekly.`
      : 'Continue monitoring. Run readiness assessment on new topics as they are introduced.',
    responsibleAgents: ['atlas', 'sage', 'oracle'],
    signalToEmit: gapCount > 0 ? 'CONTENT_GAP' : undefined,
    updatedAt: new Date().toISOString(),
  };
}

function buildEmotionalStateSubtopic(profile: UserResearchProfile): ResearchSubtopic {
  const isFrustrated = profile.topPainPoints.some(p => p.includes('frustration'));
  const isAnxious = profile.topPainPoints.some(p => p.includes('anxiety') || p.includes('pressure'));
  const emotionalLabel = isFrustrated ? 'frustrated' : isAnxious ? 'anxious' : 'neutral';
  return {
    id: 'emotional_state',
    title: 'Emotional State',
    emoji: '💬',
    summary: isFrustrated
      ? 'Student showing frustration signals — consecutive incorrect answers, short sessions, or explicit feedback. Emotional support needed before content delivery.'
      : isAnxious
      ? 'Exam anxiety detected — daysToExam is low, study pattern irregular. Student needs reassurance and focus on controllable actions.'
      : 'Student appears emotionally stable. Standard tutoring tone appropriate. Monitor for changes near exam.',
    userIntent: 'To feel that the platform notices when they are struggling emotionally and responds with empathy — not just more questions.',
    dataSources: ['frustration_heuristic', 'behavioral_signals', 'implicit_signals', 'persona_inference'],
    confidence: isFrustrated ? 'high' : isAnxious ? 'medium' : 'low',
    actionObjective: isFrustrated
      ? 'Sage MUST address emotional state BEFORE content in next session. Mentor should send empathy nudge within 1 hour. No new complex topics until frustration resolves.'
      : isAnxious
      ? 'Mentor should send a calming, normalising message. Sage should switch to "revision" objective type. No new concept introductions.'
      : 'No immediate action. Sage should maintain current warm tone.',
    responsibleAgents: ['sage', 'mentor'],
    signalToEmit: isFrustrated ? 'FRUSTRATION_ALERT' : undefined,
    updatedAt: new Date().toISOString(),
  };
}

function buildTrajectorySubtopic(profile: UserResearchProfile): ResearchSubtopic {
  const labelDescriptions: Record<string, string> = {
    accelerating: 'Student performance is improving measurably week-on-week. Keep momentum — introduce harder content.',
    steady: 'Student is making consistent but not exceptional progress. At risk of plateauing. Needs a challenge or novelty injection.',
    plateauing: 'Progress has stalled. Likely hitting a conceptual ceiling or motivation dip. Requires intervention.',
    declining: 'Performance declining. Serious churn risk. Immediate intervention required from Mentor.',
  };
  return {
    id: 'trajectory',
    title: 'Learning Trajectory',
    emoji: '📈',
    summary: `Current trajectory: ${profile.trajectoryLabel}. ${labelDescriptions[profile.trajectoryLabel] ?? ''}`,
    userIntent: 'To see their progress visualised clearly — and feel confident that the platform is actively helping them improve, not just tracking them.',
    dataSources: ['topic_mastery_bkt', 'behavioral_signals', 'cohort_analytics'],
    confidence: 'high',
    actionObjective: profile.trajectoryLabel === 'declining'
      ? 'Mentor should trigger CHURN_RISK signal and send re-engagement campaign within 24 hours. Sage should reduce difficulty. CEO dashboard should flag this student.'
      : profile.trajectoryLabel === 'plateauing'
      ? 'Sage should introduce cross_connect or challenge objective. Atlas should generate harder variants. Mentor should celebrate any small win immediately.'
      : profile.trajectoryLabel === 'accelerating'
      ? 'Increase difficulty tier. Sage should challenge with advanced content. Oracle should surface this student as a potential referral/testimonial candidate.'
      : 'Maintain current approach. Monitor weekly.',
    responsibleAgents: profile.trajectoryLabel === 'declining' ? ['mentor', 'sage'] : ['sage', 'oracle'],
    signalToEmit: profile.trajectoryLabel === 'declining' ? 'CHURN_RISK' : undefined,
    updatedAt: new Date().toISOString(),
  };
}

function buildChurnRiskSubtopic(profile: UserResearchProfile): ResearchSubtopic {
  const streakBroken = profile.topPainPoints.some(p => p.includes('Inconsistent'));
  const shortSessions = profile.avgSessionMin < 15;
  const declining = profile.trajectoryLabel === 'declining';
  const riskLevel = (declining ? 2 : 0) + (streakBroken ? 1 : 0) + (shortSessions ? 1 : 0);
  const riskLabel = riskLevel >= 3 ? 'HIGH' : riskLevel >= 1 ? 'MEDIUM' : 'LOW';
  return {
    id: 'churn_risk',
    title: 'Churn Risk',
    emoji: '🚨',
    summary: `Churn risk: ${riskLabel}. ${declining ? 'Declining performance is the primary signal.' : ''} ${streakBroken ? 'Study streak broken.' : ''} ${shortSessions ? 'Sessions becoming very short.' : ''} ${riskLevel === 0 ? 'No significant churn signals detected.' : ''}`.trim(),
    userIntent: 'To feel noticed when they are pulling away — and have the platform reach out in a way that feels personal, not automated.',
    dataSources: ['behavioral_signals', 'platform_metadata', 'topic_mastery_bkt', 'cohort_analytics'],
    confidence: riskLevel >= 2 ? 'high' : 'medium',
    actionObjective: riskLabel === 'HIGH'
      ? 'Oracle → Mentor: emit CHURN_RISK signal immediately. Mentor should send personalised re-engagement within 2 hours via preferred channel. Sage should prepare a "welcome back" session with easy wins.'
      : riskLabel === 'MEDIUM'
      ? 'Mentor should schedule a proactive nudge for tomorrow morning. Oracle should set a churn alert threshold watch.'
      : 'No action required. Oracle to monitor passively.',
    responsibleAgents: riskLabel === 'LOW' ? ['oracle'] : ['oracle', 'mentor', 'sage'],
    signalToEmit: riskLabel === 'HIGH' ? 'CHURN_RISK' : undefined,
    updatedAt: new Date().toISOString(),
  };
}

// ─── Master report builder ────────────────────────────────────────────────────

/**
 * Build a full UserResearchReport for a student.
 * Includes per-subtopic breakdown + consolidated table + update log.
 *
 * This can be progressively updated: call with an existing report to
 * refresh only changed subtopics and append to the update log.
 */
export function buildUserResearchReport(
  userId: string,
  existingReport?: UserResearchReport,
): UserResearchReport {
  const profile = buildUserResearchProfile(userId);
  const now = new Date().toISOString();

  const subtopics: ResearchSubtopic[] = [
    buildArchetypeSubtopic(profile),
    buildMotivationSubtopic(profile),
    buildPainPointsSubtopic(profile),
    buildEngagementSubtopic(profile),
    buildContentPreferencesSubtopic(profile),
    buildChannelSubtopic(profile),
    buildKnowledgeGapsSubtopic(profile),
    buildEmotionalStateSubtopic(profile),
    buildTrajectorySubtopic(profile),
    buildChurnRiskSubtopic(profile),
  ];

  // Progressive update: detect which subtopics changed vs existing report
  const updateLog: UserResearchReport['updateLog'] = existingReport?.updateLog ?? [];
  if (existingReport) {
    for (const subtopic of subtopics) {
      const prev = existingReport.subtopics.find(s => s.id === subtopic.id);
      if (!prev || prev.summary !== subtopic.summary) {
        updateLog.push({
          ts: now,
          subtopicId: subtopic.id,
          change: prev
            ? `Updated: ${subtopic.title} — ${subtopic.confidence} confidence`
            : `New subtopic added: ${subtopic.title}`,
        });
      }
    }
  } else {
    updateLog.push({ ts: now, subtopicId: 'archetype', change: 'Initial report generated.' });
  }

  // Build consolidated table
  const consolidatedTable = subtopics.map(s => ({
    subtopic: `${s.emoji} ${s.title}`,
    keyFinding: s.summary.split('.')[0] + '.',   // first sentence
    userIntent: s.userIntent.split('.')[0] + '.',
    primarySource: s.dataSources[0].replace(/_/g, ' '),
    actionObjective: s.actionObjective.split('.')[0] + '.',
    agents: s.responsibleAgents.join(', '),
    confidence: s.confidence.toUpperCase(),
  }));

  return {
    userId,
    exam: profile.exam,
    generatedAt: existingReport?.generatedAt ?? now,
    updatedAt: now,
    profile,
    subtopics,
    consolidatedTable,
    updateLog,
  };
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

const REPORT_LS_KEY = (userId: string) => `edugenius_user_research_report_${userId}`;

export function saveResearchReport(report: UserResearchReport): void {
  try { localStorage.setItem(REPORT_LS_KEY(report.userId), JSON.stringify(report)); } catch { /**/ }
}

export function loadResearchReport(userId: string): UserResearchReport | null {
  try {
    const raw = localStorage.getItem(REPORT_LS_KEY(userId));
    return raw ? (JSON.parse(raw) as UserResearchReport) : null;
  } catch { return null; }
}

/**
 * Progressive update: load existing report, refresh with latest signals, save.
 * Only changed subtopics are logged in updateLog.
 */
export function refreshResearchReport(userId: string): UserResearchReport {
  const existing = loadResearchReport(userId);
  const updated = buildUserResearchReport(userId, existing ?? undefined);
  saveResearchReport(updated);
  return updated;
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
