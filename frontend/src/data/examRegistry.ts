/**
 * examRegistry.ts — EduGenius Exam Registry
 *
 * Single source of truth for all supported exams.
 * Add new exams here; all platform surfaces read from this registry.
 *
 * Status values:
 *   "live"      — fully live with real content and API
 *   "live-stub" — UI live, API keys pending (VITE_GEMINI_API_KEY required for full features)
 *   "coming-soon" — visible but gated
 */

export interface DifficultyDistribution {
  easy: number;   // 0–1 fraction
  medium: number;
  hard: number;
}

export interface ApiGatedConfig {
  explanations: 'gemini' | 'openai' | 'none';
  socraticTutor: 'gemini' | 'openai' | 'none';
  contentGeneration: 'gemini' | 'openai' | 'none';
}

export interface TopicWeight {
  topicId: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ExamConfig {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  description: string;
  category: 'engineering' | 'medical' | 'boards' | 'management' | 'civil-services';
  duration: number;         // minutes
  totalQuestions: number;
  difficultyDistribution: DifficultyDistribution;
  topics: string[];
  /** Optional per-topic priority weights — used for content emphasis and competitor gap targeting */
  topicWeights?: TopicWeight[];
  apiGated: ApiGatedConfig;
  /** 'live-stub' → changes to 'live' when VITE_GEMINI_API_KEY is set */
  status: 'live' | 'live-stub' | 'coming-soon';
  route: string;            // URL slug for /website/exams/:examCode
  /** ISO date — when the exam was first made available on the platform */
  launchDate?: string;
  /** Primary marketing angle / messaging frame */
  marketingAngle?: string;
  /** Topic slugs where competitors have weakest coverage — focus areas for differentiation */
  competitorGap?: string[];
}

// ─────────────────────────────────────────────────────────────
// REGISTRY
// ─────────────────────────────────────────────────────────────

export const EXAM_REGISTRY: ExamConfig[] = [
  // ── JEE ──────────────────────────────────────────────────
  {
    id: 'jee-main',
    name: 'JEE Main',
    shortName: 'JEE',
    icon: '⚡',
    description: 'Crack IIT with AI-powered preparation. Personalised practice, topic-wise tests, and Socratic tutoring designed for JEE aspirants.',
    category: 'engineering',
    duration: 180,
    totalQuestions: 90,
    difficultyDistribution: { easy: 0.25, medium: 0.50, hard: 0.25 },
    topics: [
      'mechanics', 'thermodynamics', 'electromagnetism', 'optics', 'modern-physics',
      'organic-chemistry', 'inorganic-chemistry', 'physical-chemistry',
      'calculus', 'algebra', 'coordinate-geometry', 'trigonometry',
    ],
    apiGated: {
      explanations: 'gemini',
      socraticTutor: 'gemini',
      contentGeneration: 'gemini',
    },
    status: 'live',
    route: 'jee',
  },

  // ── NEET ─────────────────────────────────────────────────
  {
    id: 'neet',
    name: 'NEET UG',
    shortName: 'NEET',
    icon: '🧬',
    description: 'Your path to MBBS starts here. Master Biology, Physics, and Chemistry with NCERT-focused AI tutoring.',
    category: 'medical',
    duration: 200,
    totalQuestions: 200,
    difficultyDistribution: { easy: 0.30, medium: 0.50, hard: 0.20 },
    topics: [
      'human-physiology', 'plant-physiology', 'genetics', 'ecology', 'cell-biology',
      'mechanics', 'thermodynamics', 'electromagnetism',
      'organic-chemistry', 'physical-chemistry', 'inorganic-chemistry',
    ],
    apiGated: {
      explanations: 'gemini',
      socraticTutor: 'gemini',
      contentGeneration: 'gemini',
    },
    status: 'live',
    route: 'neet',
  },

  // ── GATE Engineering Mathematics ─────────────────────────
  {
    id: 'gate-engineering-maths',
    name: 'GATE Engineering Mathematics',
    shortName: 'GATE EM',
    icon: '⚙️',
    description: 'Complete Engineering Mathematics preparation for GATE — covering all 10 core topics tested in CS, EC, EE, ME, CE streams.',
    category: 'engineering',
    duration: 180,
    totalQuestions: 65,
    difficultyDistribution: {
      easy: 0.30,
      medium: 0.50,
      hard: 0.20,
    },
    topics: [
      'linear-algebra',
      'calculus',
      'differential-equations',
      'complex-variables',
      'probability-statistics',
      'numerical-methods',
      'transform-theory',
      'discrete-mathematics',
      'graph-theory',
      'vector-calculus',
    ],
    // Scout intel: numerical-methods + complex-variables have weakest competitor coverage
    topicWeights: [
      { topicId: 'numerical-methods',      priority: 'high' },
      { topicId: 'complex-variables',      priority: 'high' },
      { topicId: 'linear-algebra',         priority: 'medium' },
      { topicId: 'probability-statistics', priority: 'medium' },
      { topicId: 'calculus',               priority: 'medium' },
      { topicId: 'differential-equations', priority: 'medium' },
      { topicId: 'transform-theory',       priority: 'medium' },
      { topicId: 'discrete-mathematics',   priority: 'medium' },
      { topicId: 'graph-theory',           priority: 'medium' },
      { topicId: 'vector-calculus',        priority: 'medium' },
    ],
    apiGated: {
      explanations: 'gemini',       // [PENDING_API: gemini]
      socraticTutor: 'gemini',      // [PENDING_API: gemini]
      contentGeneration: 'gemini',  // [PENDING_API: gemini]
    },
    // "live-stub" → switches to "live" when VITE_GEMINI_API_KEY is set via env
    status: 'live-stub',
    route: 'gate-em',
    launchDate: '2026-02-26',
    marketingAngle: 'conversational-socratic',
    competitorGap: ['numerical-methods', 'complex-variables'],
  },

  // ── CBSE ─────────────────────────────────────────────────
  {
    id: 'cbse-12',
    name: 'CBSE Class 12',
    shortName: 'CBSE',
    icon: '📚',
    description: 'Score 95%+ in boards with structured preparation. NCERT mastery, sample papers, and marking scheme insights.',
    category: 'boards',
    duration: 180,
    totalQuestions: 65,
    difficultyDistribution: { easy: 0.40, medium: 0.45, hard: 0.15 },
    topics: [
      'mechanics', 'electromagnetism', 'optics',
      'organic-chemistry', 'inorganic-chemistry', 'physical-chemistry',
      'calculus', 'algebra', 'vectors',
      'biology',
    ],
    apiGated: {
      explanations: 'gemini',
      socraticTutor: 'gemini',
      contentGeneration: 'gemini',
    },
    status: 'live',
    route: 'cbse',
  },

  // ── CAT ──────────────────────────────────────────────────
  {
    id: 'cat',
    name: 'CAT & MBA Entrance',
    shortName: 'CAT',
    icon: '📊',
    description: 'Crack CAT 2024 with AI-powered prep. Personalised Quant practice, VARC strategies, and DILR puzzle training — all tutored by Sage, your AI mentor.',
    category: 'management',
    duration: 120,
    totalQuestions: 66,
    difficultyDistribution: { easy: 0.25, medium: 0.50, hard: 0.25 },
    topics: ['quantitative-aptitude', 'verbal-ability', 'reading-comprehension', 'dilr'],
    topicWeights: [
      { topicId: 'dilr',                   priority: 'high' },
      { topicId: 'reading-comprehension',   priority: 'high' },
      { topicId: 'quantitative-aptitude',   priority: 'medium' },
      { topicId: 'verbal-ability',          priority: 'medium' },
    ],
    apiGated: {
      explanations: 'gemini',       // [PENDING_API: gemini]
      socraticTutor: 'gemini',      // [PENDING_API: gemini]
      contentGeneration: 'gemini',  // [PENDING_API: gemini]
    },
    // "live-stub" → switches to "live" when VITE_GEMINI_API_KEY is set via env
    status: 'live-stub',
    route: 'cat',
    launchDate: '2026-03-02',
    marketingAngle: 'conversational-socratic',
    competitorGap: ['dilr', 'reading-comprehension'],
  },
];

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/** Look up an exam by its registry id */
export function getExamById(id: string): ExamConfig | undefined {
  return EXAM_REGISTRY.find((e) => e.id === id);
}

/** Look up an exam by its URL route slug */
export function getExamByRoute(route: string): ExamConfig | undefined {
  return EXAM_REGISTRY.find((e) => e.route === route);
}

/** Return only live or live-stub exams (visible to students) */
export function getLiveExams(): ExamConfig[] {
  return EXAM_REGISTRY.filter((e) => e.status === 'live' || e.status === 'live-stub');
}

/** Check if an exam's full AI features are enabled (API key present) */
export function isExamFullyLive(exam: ExamConfig): boolean {
  if (exam.status === 'live') return true;
  // For live-stub exams, full features activate when VITE_GEMINI_API_KEY is set at build time.
  // Runtime check is handled by the consuming component via environment variables.
  if (exam.status === 'live-stub') return false;
  return false;
}
