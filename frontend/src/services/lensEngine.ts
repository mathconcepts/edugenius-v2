/**
 * lensEngine.ts — EduGenius Personalization Brain
 *
 * The Lens Engine compiles a rich LensContext object before every Sage response.
 * It replaces ad-hoc personalization scattered across sagePersonaPrompts.ts.
 *
 * Flow:
 *   Student message → LensEngine.build() → LensContext → Sage prompt builder → Gemini
 *
 * Data sources (all local, no external API required):
 *   - IndexedDB (topic mastery, interaction history) via persistenceDB
 *   - StudentPersona (emotional state, learning style) via studentPersonaEngine
 *   - ExamRegistry (topic weights, competitor gaps) via examRegistry
 *   - PYQ banks (static TypeScript bundles) — GATE EM + CAT
 *   - Static content bank (MCQs, formula sheets) — topic-keyed
 */

import {
  getTopicMastery,
  getWeakTopics,
  getMasteredTopics,
  getInteractionCount,
  getRecentInteractions,
  enqueueSignal,
  type TopicMasteryRecord,
} from './persistenceDB';
import { loadPersona, type StudentPersona, type LearningStyle, type EmotionalState } from './studentPersonaEngine';
import { getExamById } from '../data/examRegistry';
import { getTopperPromptAddendum } from './topperIntelligence';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContentStrategy =
  | 'deep_explain'       // Student has time, wants to understand
  | 'exam_shortcut'      // Exam pressure — give the trick fast
  | 'emotional_first'    // Student is frustrated/anxious — address emotion before content
  | 'quick_refresh'      // Student knows it, just needs a reminder
  | 'challenge_up'       // Student is confident — push harder
  | 'first_time';        // Student has never asked about this topic

export interface NextContentSuggestion {
  topicId: string;
  reason: string;
  contentType: 'mcq' | 'concept' | 'formula' | 'pyq';
  urgency: 'high' | 'medium' | 'low';
}

export interface LensContext {
  // ── Identity
  studentId: string;
  studentName: string;
  examId: string;

  // ── Emotional / Session state
  currentEmotion: EmotionalState;
  sessionFatigue: number;          // 0–10 (escalates with message count)
  sessionMessageCount: number;

  // ── Topic intelligence
  topicId: string;
  topicMastery: TopicMasteryRecord | null;
  timesAskedAboutTopic: number;    // cross-session interaction count
  isFirstTimeOnTopic: boolean;
  isTopicMastered: boolean;
  isTopicWeak: boolean;
  isTopicExamCritical: boolean;
  cohortStruggleAlert: boolean;    // true if topic mastery < 0.4 (well-known hard topic)

  // ── Exam urgency
  daysToExam: number;
  examUrgency: 'critical' | 'moderate' | 'relaxed'; // <14 | 14–60 | >60

  // ── Learning style
  learningStyle: LearningStyle;
  prefersShortAnswers: boolean;
  prefersAnalogies: boolean;

  // ── Content availability
  hasPYQContext: boolean;
  hasManimTemplate: boolean;
  staticContentAvailable: boolean;

  // ── Derived strategy
  contentStrategy: ContentStrategy;
  suggestedNextContent: NextContentSuggestion | null;

  // ── Raw persona (for downstream use)
  persona: StudentPersona;
}

// ─── Manim topic map ──────────────────────────────────────────────────────────

const MANIM_TOPICS = new Set([
  'linear-algebra', 'calculus', 'probability-statistics',
  'transform-theory', 'vector-calculus', 'graph-theory',
  'integration', 'eigenvalue', 'fourier', 'differential-equations',
]);

// ─── Cohort struggle thresholds (hardcoded from known GATE/CAT pain points) ──

const KNOWN_HARD_TOPICS = new Set([
  'complex-variables', 'numerical-methods', 'transform-theory',
  'dilr', 'reading-comprehension',
]);

// ─── Exam urgency thresholds ──────────────────────────────────────────────────

function computeExamUrgency(daysToExam: number): LensContext['examUrgency'] {
  if (daysToExam <= 14) return 'critical';
  if (daysToExam <= 60) return 'moderate';
  return 'relaxed';
}

// ─── Content strategy decision tree ──────────────────────────────────────────

function pickContentStrategy(
  emotion: EmotionalState,
  mastery: TopicMasteryRecord | null,
  daysToExam: number,
  isFirstTime: boolean,
  sessionMessageCount: number,
): ContentStrategy {
  // Emotion overrides everything if negative
  if (emotion === 'frustrated' || emotion === 'anxious' || emotion === 'exhausted') {
    return 'emotional_first';
  }

  // First time on topic
  if (isFirstTime || !mastery) {
    return 'first_time';
  }

  // Student is confident + mastered → push harder
  if ((emotion === 'confident' || emotion === 'motivated') && mastery.isMastered) {
    return 'challenge_up';
  }

  // High exam pressure → shortcuts
  if (daysToExam <= 14) {
    return 'exam_shortcut';
  }

  // Long session + topic seen before → quick refresh
  if (sessionMessageCount > 10 && mastery.correctCount > 2) {
    return 'quick_refresh';
  }

  return 'deep_explain';
}

// ─── Next content suggestion ──────────────────────────────────────────────────

async function suggestNextContent(
  studentId: string,
  examId: string,
  currentTopicId: string,
  examUrgency: LensContext['examUrgency'],
): Promise<NextContentSuggestion | null> {
  const weakTopics = await getWeakTopics(studentId, examId, 3);
  const exam = getExamById(examId);

  // Filter out current topic
  const otherWeak = weakTopics.filter((t) => t.topicId !== currentTopicId);

  if (otherWeak.length > 0) {
    const next = otherWeak[0];
    const isExamCritical = exam?.topicWeights?.find(
      (w) => w.topicId === next.topicId && w.priority === 'high'
    );

    return {
      topicId: next.topicId,
      reason: isExamCritical
        ? `High-priority topic for ${exam?.shortName} — only ${Math.round(next.masteryScore * 100)}% mastery`
        : `Weakest topic right now — ${Math.round(next.masteryScore * 100)}% mastery`,
      contentType: examUrgency === 'critical' ? 'pyq' : 'concept',
      urgency: isExamCritical ? 'high' : 'medium',
    };
  }

  return null;
}

// ─── Main Builder ─────────────────────────────────────────────────────────────

export interface BuildLensOptions {
  studentId: string;
  topicId: string;
  examId: string;
  sessionId: string;
  sessionMessageCount: number;
  /** Pass the detected emotion from Sage's NLP layer */
  detectedEmotion?: EmotionalState;
  /** Whether static PYQ context exists for this topic */
  hasPYQContext?: boolean;
}

export async function buildLensContext(opts: BuildLensOptions): Promise<LensContext> {
  const {
    studentId,
    topicId,
    examId,
    sessionMessageCount,
    detectedEmotion,
    hasPYQContext = false,
  } = opts;

  // ── Load all data sources in parallel ────────────────────────────────────
  const [persona, topicMastery, weakTopics, masteredTopics, interactionCount] =
    await Promise.all([
      loadStudentPersonaFromDB(studentId),
      getTopicMastery(studentId, examId, topicId),
      getWeakTopics(studentId, examId, 5),
      getMasteredTopics(studentId, examId),
      getInteractionCount(studentId, topicId),
    ]);

  const exam = getExamById(examId);

  // ── Compute derived fields ────────────────────────────────────────────────
  const emotion = detectedEmotion ?? persona.emotionalState;
  const daysToExam = persona.daysToExam;
  const examUrgency = computeExamUrgency(daysToExam);

  const isFirstTime = interactionCount === 0;
  const isTopicWeak = weakTopics.some((t) => t.topicId === topicId);
  const isTopicMastered = masteredTopics.includes(topicId);
  const isTopicExamCritical = exam?.topicWeights?.some(
    (w) => w.topicId === topicId && w.priority === 'high'
  ) ?? false;

  const cohortStruggleAlert = KNOWN_HARD_TOPICS.has(topicId);
  const hasManimTemplate = MANIM_TOPICS.has(topicId);

  // Session fatigue: 0 at start, escalates after 8+ messages
  const sessionFatigue = Math.min(10, Math.max(0, (sessionMessageCount - 8) * 1.5));

  const contentStrategy = pickContentStrategy(
    emotion,
    topicMastery,
    daysToExam,
    isFirstTime,
    sessionMessageCount,
  );

  const suggestedNextContent = await suggestNextContent(
    studentId, examId, topicId, examUrgency
  );

  // ── Fire signals for struggling students ─────────────────────────────────
  if (topicMastery && topicMastery.incorrectCount >= 3 && !topicMastery.isMastered) {
    await enqueueSignal({
      type: 'STRUGGLE_PATTERN',
      sourceAgent: 'sage',
      targetAgent: 'atlas',
      payload: {
        studentId,
        topicId,
        examId,
        incorrectCount: topicMastery.incorrectCount,
        masteryScore: topicMastery.masteryScore,
        requestType: 'new_analogy_or_variant',
      },
      studentId,
      topicId,
    });
  }

  if (emotion === 'frustrated' && (topicMastery?.incorrectCount ?? 0) >= 2) {
    await enqueueSignal({
      type: 'FRUSTRATION_ALERT',
      sourceAgent: 'sage',
      targetAgent: 'mentor',
      payload: {
        studentId,
        topicId,
        examId,
        severity: Math.min(5, (topicMastery?.incorrectCount ?? 0)),
      },
      studentId,
      topicId,
    });
  }

  // ── Topper intelligence: inject before response if topic is known ────────
  if (topicId !== 'general') {
    const studyPhase: import('./topperIntelligence').StudyPhase =
      examUrgency === 'critical' ? 'exam_ready'
      : (topicMastery?.masteryScore ?? 0) < 0.4 ? 'first_encounter'
      : (topicMastery?.masteryScore ?? 0) < 0.7 ? 'building'
      : 'consolidating';

    const topperAddendum = getTopperPromptAddendum(examId, topicId, studyPhase, !isFirstTime, true);
    if (topperAddendum) {
      // Store in signal queue for Sage to pick up
      await enqueueSignal({
        type: 'CONTENT_GAP',
        sourceAgent: 'lens',
        targetAgent: 'sage',
        payload: { topperAddendum, topicId, examId, phase: studyPhase },
        topicId,
      });
    }
  }

  return {
    studentId,
    studentName: persona.name,
    examId,
    currentEmotion: emotion,
    sessionFatigue,
    sessionMessageCount,
    topicId,
    topicMastery,
    timesAskedAboutTopic: interactionCount,
    isFirstTimeOnTopic: isFirstTime,
    isTopicMastered,
    isTopicWeak,
    isTopicExamCritical,
    cohortStruggleAlert,
    daysToExam,
    examUrgency,
    learningStyle: persona.learningStyle,
    prefersShortAnswers: persona.prefersShortAnswers,
    prefersAnalogies: persona.prefersAnalogies,
    hasPYQContext,
    hasManimTemplate,
    staticContentAvailable: true, // always true — static bank always present
    contentStrategy,
    suggestedNextContent,
    persona,
  };
}

// ─── Persona loader with DB fallback ─────────────────────────────────────────

async function loadStudentPersonaFromDB(studentId: string): Promise<StudentPersona> {
  // 1. Try IndexedDB first (cross-session data)
  const { loadStudentProfile } = await import('./persistenceDB');
  const stored = await loadStudentProfile(studentId);
  if (stored) return stored as StudentPersona;

  // 2. Fall back to in-memory/localStorage persona
  const { loadPersona } = await import('./studentPersonaEngine');
  return loadPersona();
}

// ─── Prompt generator from LensContext ───────────────────────────────────────

/**
 * Converts a LensContext into a structured Sage system prompt addendum.
 * This is injected AFTER the base Sage identity prompt.
 */
export function lensContextToPrompt(ctx: LensContext): string {
  const masteryPct = ctx.topicMastery
    ? Math.round(ctx.topicMastery.masteryScore * 100)
    : null;

  const urgencyLabel = {
    critical: '🚨 EXAM CRITICAL — less than 2 weeks',
    moderate: '⚡ Moderate urgency',
    relaxed: '📅 Relaxed timeline',
  }[ctx.examUrgency];

  const strategyInstructions: Record<ContentStrategy, string> = {
    emotional_first: `EMOTION FIRST: ${ctx.studentName} is ${ctx.currentEmotion}. 
Address the feeling in your FIRST sentence before any content. 
Keep explanation SHORT (3-4 sentences). One check question at the end only.`,

    first_time: `FIRST INTRODUCTION: ${ctx.studentName} has never asked about ${ctx.topicId} before.
Start from fundamentals. Use a concrete real-world hook. 
Don't assume prior knowledge. Build intuition before formulas.`,

    exam_shortcut: `EXAM MODE: ${urgencyLabel}.
Give the shortcut/trick first, then explain WHY it works.
Format: [Trick] → [Quick example] → [Tip for exam day].
Be concise — ${ctx.studentName} needs this fast.`,

    deep_explain: `DEEP LEARNING MODE: ${ctx.studentName} has time and wants to understand.
Go beyond the formula. Explain the intuition, the history if relevant, the 'why'.
Use ${ctx.prefersAnalogies ? 'analogies and real-world examples' : 'step-by-step logical reasoning'}.
Check understanding at the end.`,

    quick_refresh: `QUICK REFRESH: ${ctx.studentName} has seen this before (${ctx.timesAskedAboutTopic} times).
Skip the basics — they know them. Jump straight to the specific question.
One crisp explanation + one example is enough.`,

    challenge_up: `CHALLENGE MODE: ${ctx.studentName} has mastered this topic (${masteryPct}%).
Push them further. Ask a harder variant. Offer a twist problem.
"You've got the basics — let's try the GATE 2023 version of this..."`,
  };

  const parts: string[] = [];

  // Context block
  parts.push(`## LENS CONTEXT FOR THIS RESPONSE`);
  parts.push(`Student: ${ctx.studentName} | Exam: ${ctx.examId} | Topic: ${ctx.topicId}`);
  parts.push(`Emotion: ${ctx.currentEmotion} | Exam: ${urgencyLabel} | Session messages: ${ctx.sessionMessageCount}`);

  if (masteryPct !== null) {
    parts.push(`Topic mastery: ${masteryPct}% | Correct: ${ctx.topicMastery?.correctCount} / Wrong: ${ctx.topicMastery?.incorrectCount}`);
  }

  if (ctx.isTopicExamCritical) {
    parts.push(`⚠️ HIGH-PRIORITY TOPIC for ${ctx.examId} — competitors have weak coverage here`);
  }

  if (ctx.cohortStruggleAlert) {
    parts.push(`📊 COHORT NOTE: Many students struggle with ${ctx.topicId} — be extra patient here`);
  }

  if (ctx.hasPYQContext) {
    parts.push(`📚 PYQ context is available — reference it naturally if relevant`);
  }

  // Strategy instruction
  parts.push(`\n## RESPONSE STRATEGY: ${ctx.contentStrategy.toUpperCase()}`);
  parts.push(strategyInstructions[ctx.contentStrategy]);

  // Answer length
  const lengthGuide = ctx.prefersShortAnswers || ctx.sessionFatigue > 6
    ? 'BREVITY: Keep under 150 words unless the concept truly requires more.'
    : ctx.contentStrategy === 'deep_explain'
    ? 'LENGTH: Up to 300 words — this student wants depth.'
    : 'LENGTH: 100–200 words is ideal.';
  parts.push(`\n## FORMAT\n${lengthGuide}`);

  return parts.join('\n');
}
