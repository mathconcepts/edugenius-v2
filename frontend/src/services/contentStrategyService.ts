/**
 * contentStrategyService.ts — Content Strategy Engine
 *
 * A "strategy" determines HOW content is generated and sequenced for a user.
 * CEO sets the platform default; individual users can override for themselves.
 *
 * Extended with:
 *   - Per-channel strategies (blog, vlog, youtube, social, short-form, email)
 *   - Per-exam strategies (GATE, JEE, NEET, CAT, UPSC, CBSE)
 *   - Per-audience strategies (student beginner/intermediate/advanced, teacher, parent, aspirant)
 *   - Strategy selector matrix: exam × audience × channel
 *   - Hook library: exam-specific opening hooks per platform
 *   - Content calendar generator
 */

import type { ContentAtomType, LearningMoment, GenerationSpec } from './contentFramework';
import { loadCurrentUser } from './userService';
import type { SupportedExam, ContentChannel, ContentAudience } from './contentGenerationHub';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ContentStrategyId =
  | 'adaptive'    // Default: hyper-personalised, LearningMoment-driven
  | 'generic'     // Fixed curriculum order, same for all students
  | 'socratic'    // Guided discovery: questions first, explanations after
  | 'spaced_rep'  // Spaced repetition: revisit weak topics at optimal intervals
  | 'exam_sprint' // Fast-paced: MCQs + formulas only
  | 'story_mode'; // Narrative-driven: concepts told as stories

export interface ContentStrategy {
  id: ContentStrategyId;
  name: string;
  description: string;
  emoji: string;
  bestFor: string;
  atomTypePriority: ContentAtomType[];
  momentOverride?: LearningMoment;
  paceMultiplier: number;     // 1.0 = normal, 0.7 = slower, 1.5 = faster
  feedbackRequired: boolean;  // whether to show feedback widget after each atom
}

// ── Strategy definitions ──────────────────────────────────────────────────────

export const CONTENT_STRATEGIES: Record<ContentStrategyId, ContentStrategy> = {
  adaptive: {
    id: 'adaptive',
    name: 'Adaptive (Smart)',
    emoji: '🧠',
    description: 'AI picks the right content type for your mood and performance in real-time.',
    bestFor: 'Solo exam prep',
    atomTypePriority: ['mcq', 'worked_example', 'flashcard', 'analogy', 'formula_card', 'summary'],
    paceMultiplier: 1.0,
    feedbackRequired: true,
  },
  generic: {
    id: 'generic',
    name: 'Generic (Curriculum)',
    emoji: '📋',
    description: 'Fixed order matching the official syllabus. Same for all students.',
    bestFor: 'Classroom instruction',
    atomTypePriority: ['lesson_block', 'summary', 'mcq', 'practice_set'],
    momentOverride: 'building_concept',  // maps to focused_learning concept
    paceMultiplier: 1.0,
    feedbackRequired: false,
  },
  socratic: {
    id: 'socratic',
    name: 'Socratic (Discovery)',
    emoji: '🤔',
    description: 'You figure it out — guided by questions, not direct answers.',
    bestFor: 'Deep conceptual understanding',
    atomTypePriority: ['mcq', 'analogy', 'worked_example', 'misconception', 'summary'],
    momentOverride: 'doubt_resolution',  // maps to deep_dive concept
    paceMultiplier: 0.8,
    feedbackRequired: true,
  },
  spaced_rep: {
    id: 'spaced_rep',
    name: 'Spaced Repetition',
    emoji: '🔄',
    description: 'Weak topics come back at perfect intervals. Science-backed retention.',
    bestFor: 'Long-term retention',
    atomTypePriority: ['flashcard', 'mcq', 'formula_card', 'summary'],
    paceMultiplier: 1.2,
    feedbackRequired: true,
  },
  exam_sprint: {
    id: 'exam_sprint',
    name: 'Exam Sprint',
    emoji: '⚡',
    description: 'Fast mode: MCQs and formulas only. No fluff. High-density exam prep.',
    bestFor: 'Last 30 days before exam',
    atomTypePriority: ['mcq', 'formula_card', 'exam_tip', 'practice_set'],
    momentOverride: 'quick_revision',   // maps to exam_mode concept
    paceMultiplier: 1.5,
    feedbackRequired: false,
  },
  story_mode: {
    id: 'story_mode',
    name: 'Story Mode',
    emoji: '📖',
    description: 'Physics concepts through stories. High engagement, great for beginners.',
    bestFor: 'First exposure to concepts',
    atomTypePriority: ['analogy', 'visual_explainer', 'worked_example', 'summary', 'mcq'],
    momentOverride: 'first_encounter',  // maps to first_contact concept
    paceMultiplier: 0.7,
    feedbackRequired: true,
  },
};

// ── Storage keys ──────────────────────────────────────────────────────────────

const PLATFORM_STRATEGY_KEY = 'edugenius_content_strategy_platform';  // CEO sets this
const USER_STRATEGY_KEY = 'edugenius_content_strategy_user';           // per-user override prefix

function userStrategyKey(userId?: string): string {
  const uid = userId ?? loadCurrentUser()?.uid ?? 'anon';
  return `${USER_STRATEGY_KEY}_${uid}`;
}

// ── Platform strategy (CEO-controlled) ───────────────────────────────────────

export function getPlatformStrategy(): ContentStrategyId {
  try {
    const raw = localStorage.getItem(PLATFORM_STRATEGY_KEY);
    if (raw && raw in CONTENT_STRATEGIES) return raw as ContentStrategyId;
  } catch {
    // localStorage unavailable
  }
  return 'adaptive';
}

export function setPlatformStrategy(id: ContentStrategyId): void {
  try {
    localStorage.setItem(PLATFORM_STRATEGY_KEY, id);
  } catch {
    // localStorage unavailable
  }
}

// ── Per-user strategy override ────────────────────────────────────────────────

export function getUserStrategy(userId?: string): ContentStrategyId | null {
  try {
    const raw = localStorage.getItem(userStrategyKey(userId));
    if (raw && raw in CONTENT_STRATEGIES) return raw as ContentStrategyId;
  } catch {
    // localStorage unavailable
  }
  return null;
}

export function setUserStrategy(id: ContentStrategyId, userId?: string): void {
  try {
    localStorage.setItem(userStrategyKey(userId), id);
  } catch {
    // localStorage unavailable
  }
}

export function clearUserStrategy(userId?: string): void {
  try {
    localStorage.removeItem(userStrategyKey(userId));
  } catch {
    // localStorage unavailable
  }
}

// ── Effective strategy resolution ─────────────────────────────────────────────

/**
 * Priority: user override → platform default → 'adaptive'
 */
export function getEffectiveStrategy(userId?: string): ContentStrategy {
  const userPick = getUserStrategy(userId);
  if (userPick) return CONTENT_STRATEGIES[userPick];

  const platformPick = getPlatformStrategy();
  return CONTENT_STRATEGIES[platformPick] ?? CONTENT_STRATEGIES.adaptive;
}

// ── Apply strategy to a generation request ────────────────────────────────────

/**
 * Modifies atom type priority and moment override based on the active strategy.
 * Returns a modified copy of the GenerationSpec.
 */
export function applyStrategyToAtomRequest(
  strategy: ContentStrategy,
  baseRequest: GenerationSpec,
): GenerationSpec {
  const updated: GenerationSpec = { ...baseRequest };

  // Override atom type if the strategy has a prioritised first choice
  if (strategy.atomTypePriority.length > 0) {
    const preferredType = strategy.atomTypePriority[0];
    updated.atomType = preferredType;
  }

  // Override the customer profile's learning moment if strategy demands it
  if (strategy.momentOverride && updated.targetCustomer) {
    updated.targetCustomer = {
      ...updated.targetCustomer,
      moment: strategy.momentOverride,
    };
  }

  return updated;
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 2 — EXTENDED CHANNEL / EXAM / AUDIENCE STRATEGY ENGINE
// ═══════════════════════════════════════════════════════════════════

// ─── Channel strategy specs ───────────────────────────────────────────────────

export interface ChannelStrategySpec {
  channel: ContentChannel;
  bestContentTypes: string[];
  tone: string;
  idealLength: string;
  cta: string;
  publishFrequency: string;
  bestTimeToPost: string;
}

export const CHANNEL_STRATEGIES: Record<ContentChannel, ChannelStrategySpec> = {
  blog: {
    channel: 'blog', bestContentTypes: ['how_to', 'guide', 'myth_bust'],
    tone: 'educational', idealLength: '1200-2000 words', cta: 'Start free trial',
    publishFrequency: '3x/week', bestTimeToPost: '9am IST weekdays',
  },
  vlog: {
    channel: 'vlog', bestContentTypes: ['how_to', 'success_story', 'tour'],
    tone: 'conversational', idealLength: '8-15 minutes', cta: 'Subscribe + free trial',
    publishFrequency: '2x/week', bestTimeToPost: '5pm IST',
  },
  youtube: {
    channel: 'youtube', bestContentTypes: ['tutorial', 'deep_dive', 'comparison'],
    tone: 'educational + engaging', idealLength: '10-20 minutes', cta: 'Subscribe + link in description',
    publishFrequency: '3x/week', bestTimeToPost: '6pm IST',
  },
  short_video: {
    channel: 'short_video', bestContentTypes: ['tip', 'myth_bust', 'quick_how_to'],
    tone: 'urgent + punchy', idealLength: '30-60 seconds', cta: 'Follow + link in bio',
    publishFrequency: 'daily', bestTimeToPost: '7pm IST',
  },
  x_twitter: {
    channel: 'x_twitter', bestContentTypes: ['thread', 'hot_take', 'data_insight'],
    tone: 'direct + opinionated', idealLength: '5-8 tweet thread', cta: 'Reply + follow',
    publishFrequency: '2-3x/day', bestTimeToPost: '8am, 12pm, 8pm IST',
  },
  reddit: {
    channel: 'reddit', bestContentTypes: ['resource', 'discussion', 'ama'],
    tone: 'value-first, no promotional', idealLength: '400-800 words', cta: 'subtle mention',
    publishFrequency: '2x/week', bestTimeToPost: '10am-2pm IST',
  },
  quora: {
    channel: 'quora', bestContentTypes: ['detailed_answer', 'expert_guide'],
    tone: 'authoritative + helpful', idealLength: '600-1000 words', cta: 'credentials mention',
    publishFrequency: '3-5x/week', bestTimeToPost: 'anytime',
  },
  linkedin: {
    channel: 'linkedin', bestContentTypes: ['insight', 'personal_story', 'industry_data'],
    tone: 'professional + personal', idealLength: '300-600 words', cta: 'Comment + connect',
    publishFrequency: '3x/week', bestTimeToPost: '8am, 12pm IST weekdays',
  },
  instagram: {
    channel: 'instagram', bestContentTypes: ['tip', 'motivation', 'infographic'],
    tone: 'visual + emotional', idealLength: '150-200 words caption', cta: 'Link in bio',
    publishFrequency: 'daily', bestTimeToPost: '6pm-9pm IST',
  },
  email: {
    channel: 'email', bestContentTypes: ['newsletter', 'resource', 'offer'],
    tone: 'personal + direct', idealLength: '300-500 words', cta: 'click CTA button',
    publishFrequency: '2x/week', bestTimeToPost: '9am IST Tuesday/Thursday',
  },
};

// ─── Exam-specific strategy specs ────────────────────────────────────────────

export interface ExamStrategySpec {
  exam: SupportedExam;
  primaryAudience: ContentAudience[];
  contentPillars: string[];
  urgencyLevel: 'low' | 'medium' | 'high' | 'extreme';
  avgExamPrep: string;
  topTopics: string[];
}

export const EXAM_STRATEGIES: Record<SupportedExam, ExamStrategySpec> = {
  GATE: {
    exam: 'GATE', primaryAudience: ['student_intermediate', 'student_advanced', 'aspirant'],
    contentPillars: ['concept_clarity', 'numerical_practice', 'previous_papers', 'tips_shortcuts'],
    urgencyLevel: 'high', avgExamPrep: '6-12 months',
    topTopics: ['Engineering Mathematics', 'Signals & Systems', 'Control Systems', 'Networks', 'Electromagnetics'],
  },
  JEE: {
    exam: 'JEE', primaryAudience: ['student_beginner', 'student_intermediate', 'student_advanced'],
    contentPillars: ['foundation_building', 'practice_problems', 'exam_strategy', 'motivation'],
    urgencyLevel: 'extreme', avgExamPrep: '2-3 years',
    topTopics: ['Mechanics', 'Electrodynamics', 'Organic Chemistry', 'Calculus', 'Algebra'],
  },
  NEET: {
    exam: 'NEET', primaryAudience: ['student_beginner', 'student_intermediate', 'student_advanced'],
    contentPillars: ['ncert_mastery', 'diagram_practice', 'memorisation_tricks', 'time_management'],
    urgencyLevel: 'extreme', avgExamPrep: '2-3 years',
    topTopics: ['Human Physiology', 'Genetics', 'Organic Chemistry', 'Physics Optics', 'Plant Biology'],
  },
  CAT: {
    exam: 'CAT', primaryAudience: ['aspirant', 'student_advanced'],
    contentPillars: ['quant_skills', 'verbal_ability', 'logical_reasoning', 'time_management'],
    urgencyLevel: 'high', avgExamPrep: '6-12 months',
    topTopics: ['Arithmetic', 'Algebra', 'Reading Comprehension', 'Data Interpretation', 'Logical Reasoning'],
  },
  UPSC: {
    exam: 'UPSC', primaryAudience: ['aspirant', 'student_advanced'],
    contentPillars: ['current_affairs', 'optional_subject', 'answer_writing', 'static_gk'],
    urgencyLevel: 'medium', avgExamPrep: '1-3 years',
    topTopics: ['Indian Polity', 'History', 'Economy', 'Geography', 'Science & Tech'],
  },
  CBSE: {
    exam: 'CBSE', primaryAudience: ['student_beginner', 'student_intermediate', 'teacher', 'parent'],
    contentPillars: ['ncert_based', 'sample_papers', 'chapter_summaries', 'parent_guidance'],
    urgencyLevel: 'low', avgExamPrep: '1 year',
    topTopics: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English'],
  },
};

// ─── Hook library ─────────────────────────────────────────────────────────────

export const HOOK_LIBRARY: Record<SupportedExam, Record<ContentChannel, string[]>> = {
  GATE: {
    blog: [
      'Every year, 9 lakh engineers write GATE. Only the top 15% score above 50. Here\'s what separates them:',
      'GATE 2025 analysis: This one topic appears in 18% of questions yet most students skip it.',
      'I failed GATE twice. The third attempt, I scored AIR 47. The difference? One system.',
    ],
    youtube: [
      'This 10-minute formula will save you 40 marks on GATE — let me show you exactly how.',
      'The GATE topper I interviewed had one unusual study habit. You won\'t expect it.',
      'GATE 2024 paper analysis: the 3 topics that tripped everyone up.',
    ],
    x_twitter: [
      'Most GATE aspirants waste 60% of their study time on low-yield topics. A thread 🧵',
      'I\'ve mentored 200+ GATE toppers. The #1 mistake I see: (thread)',
      'GATE EM formulas cheat sheet — save this thread 🔖',
    ],
    short_video: [
      'If you\'re studying this for GATE, stop. Here\'s what you should be doing instead.',
      'GATE AIR 47 here. The one habit that changed everything for me.',
      '3 GATE shortcuts your coaching institute never taught you.',
    ],
    instagram: [
      '📐 GATE aspirant? Save this formula card. You\'ll need it. 👇',
      '🎯 This GATE topic has appeared 12 times in 10 years. Are you ready for it?',
      '⚡ 30 days to GATE. Here\'s your daily checklist.',
    ],
    linkedin: [
      'I scored GATE AIR 47 after failing twice. Here\'s the honest account of what changed.',
      'The GATE exam doesn\'t just test engineering knowledge. It tests decision-making under pressure.',
      'A data-driven look at GATE preparation: what works, what doesn\'t.',
    ],
    reddit: [
      '[Study Notes] Complete EM theory with solved examples — sharing for the community',
      'After 2 attempts, I finally cracked GATE. AMA about my preparation strategy.',
      'Honest review: comparing the top 5 GATE prep resources (no affiliate links)',
    ],
    quora: [
      'How do I start preparing for GATE with zero prior preparation?',
      'What separates GATE rank 1-100 from rank 1000-5000 in terms of preparation?',
      'Is 6 months enough to crack GATE with a good rank?',
    ],
    email: [
      'Subject: The GATE formula sheet your textbook forgot to mention',
      'Subject: Why 87% of GATE aspirants fail in the same predictable way',
      'Subject: [Free] GATE 2024 PYQ analysis — your exam is in X days',
    ],
    vlog: [
      'Come study with me: 5 hours of focused GATE prep (no fluff).',
      'Day 30 before GATE: my last-minute strategy revealed.',
      'I visited IIT Delhi to ask toppers their #1 GATE tip.',
    ],
  },
  JEE: {
    blog: [
      '11.5 lakh students write JEE Mains. 250,000 qualify for Advanced. Here\'s how to be one of them.',
      'The JEE chapter that is worth 40 marks but takes only 2 weeks to master:',
      'From 85 percentile to 99 percentile: exactly what changed in my JEE prep.',
    ],
    youtube: ['JEE Physics shortcut that 99% of students don\'t know.',
      'I solved 10 years of JEE papers. Here\'s the pattern I found.',
      'The one concept JEE setters love the most (and most students hate).'],
    x_twitter: ['JEE Mains is in X days. If you start this NOW, you can still crack it 🧵',
      'Organic chemistry for JEE in 15 tweets. Bookmark this. 🔖',
      'My JEE failure taught me this about preparation that no coaching tells you:'],
    short_video: ['Stop! This JEE shortcut will save you 20 minutes per paper.',
      '3 JEE tips from AIR 212 that took 10 seconds to apply.',
      'Every JEE topper does this 15 minutes before the exam.'],
    instagram: ['📚 JEE Chemistry reactions — save this carousel!', '⚡ JEE rank predictor formula (quick maths).',
      '🔥 JEE 2025: The 10 most expected topics according to PYQ analysis.'],
    linkedin: ['What preparing for JEE taught me about discipline that I apply daily at work.',
      'IIT graduates: did JEE actually predict your success? Honest poll.',
      'The JEE coaching industry is broken. Here\'s what actual toppers say.'],
    reddit: ['[Resource] All JEE 2024 papers compiled with solutions — free download',
      'Realistic monthly study plan for JEE Mains in 3 months — what worked for me',
      'Honest review: FIITJEE vs Allen vs self-study for JEE Advanced'],
    quora: ['Can I crack JEE Mains without coaching?', 'What are the most important topics for JEE Advanced?',
      'How much time should I spend on JEE mock tests?'],
    email: ['Subject: Your JEE prep has a hidden gap (and here\'s how to fix it)',
      'Subject: Free JEE formula book for [topic] — limited time',
      'Subject: [Alert] JEE pattern change 2025 — are you prepared?'],
    vlog: ['JEE preparation room tour + daily routine.', 'I gave a JEE mock test live. Watch me solve it.',
      '5 hours of JEE prep with me: electrostatics chapter.'],
  },
  NEET: {
    blog: ['NEET Biology: the 15 diagrams that appear every single year.',
      'From 550 to 700 in NEET: the exact changes I made to my study routine.',
      'NEET Chemistry: organic reactions you cannot afford to skip.'],
    youtube: ['NEET Biology in 30 minutes: everything from Chapter 1 to 16.',
      'The NEET diagrams that appear every year (and how to draw them fast).',
      'I interviewed 10 NEET toppers. This is the advice they all agreed on.'],
    x_twitter: ['NEET Biology thread: 50 most important one-liners 🧵 Save this.',
      'NEET 2024 paper was harder than expected. Here\'s what you need to know for 2025.',
      'NEET preparation roadmap for dropers: what I wish I had known.'],
    short_video: ['This NEET Biology trick is worth 15 marks. Watch.',
      'NEET Chemistry in 60 seconds: the reactions you must know.',
      '700+ in NEET? This is the one habit that separates toppers.'],
    instagram: ['🌱 NEET Biology cheat sheet — save this!', '💊 NEET Chemistry important reactions.',
      '🏆 NEET 2025 marks vs rank analysis.'],
    linkedin: ['What preparing for NEET taught me about perseverance and systems thinking.',
      'Why NEET is one of the toughest exams in the world — a data story.',
      'The future of medical education in India: what NEET results tell us.'],
    reddit: ['[Free Notes] Complete NEET Biology from NCERT — chapter by chapter',
      'My NEET journey: 480 in first attempt to 680 in second. What changed.',
      'Honest comparison: NEET coaching vs self-study — my experience'],
    quora: ['Is NCERT enough for NEET Biology?', 'How many hours should I study for NEET per day?',
      'What is the best way to revise NEET Chemistry in the last month?'],
    email: ['Subject: NEET Biology: the 5 diagrams in every paper',
      'Subject: Free NEET mock test — 180 questions, fully solved',
      'Subject: Your NEET preparation checklist for [month]'],
    vlog: ['Study with me for NEET: 6 hours + break timer.',
      'NEET topper\'s room tour and daily routine.',
      'I attended a NEET coaching class in Kota. My honest review.'],
  },
  CAT: {
    blog: ['CAT 2024 analysis: quant section got harder. Here\'s how to adapt.',
      'VARC for CAT: the reading strategy that took me from 70 to 98 percentile.',
      'The CAT preparation timeline that actually works (month by month guide).'],
    youtube: ['CAT Quant: 30 most important concepts with shortcuts.',
      'Data Interpretation for CAT: how to solve sets in under 5 minutes.',
      'CAT vs GMAT: which should you take? Honest comparison.'],
    x_twitter: ['CAT Quant thread: 10 shortcuts that save 30 minutes per paper 🧵',
      'CAT VARC strategy that works even if you\'re not a strong reader.',
      '99 percentile in CAT. Here\'s exactly what I did differently. (thread)'],
    short_video: ['This CAT trick cuts DILR time in half. Seriously.',
      'CAT VARC: the one technique that transformed my reading speed.',
      '99 percentile in CAT — watch this before your mock test.'],
    instagram: ['📊 CAT DI shortcuts — save this set!', '📖 CAT RC: the 3-minute reading hack.',
      '🎯 CAT 2025 important topics — analysis from last 5 years.'],
    linkedin: ['I scored 99.8 percentile in CAT and joined IIM-A. Here\'s what the prep really taught me.',
      'CAT vs getting an MBA abroad: a cost-benefit analysis.',
      'The skills CAT actually tests vs what MBA programmes value.'],
    reddit: ['[Detailed Guide] CAT Quant preparation — all formulas and approach',
      'Six-month CAT preparation while working full time — my strategy',
      'Honest CAT coaching review: TIME vs IMS vs CL — which is best?'],
    quora: ['Can I crack CAT in 3 months without coaching?',
      'What is the ideal CAT mock test strategy?',
      'Which MBA colleges accept CAT score besides IIMs?'],
    email: ['Subject: CAT Quant formula sheet — your free download is ready',
      'Subject: 30-day CAT sprint: the plan that gets results',
      'Subject: CAT mock analysis — where are you losing marks?'],
    vlog: ['My CAT preparation diary: week 1 of 12.',
      'I toured IIM Ahmedabad. Here\'s what motivates me to crack CAT.',
      '3 hours of focused CAT prep with me.'],
  },
  UPSC: {
    blog: ['UPSC CSE: the 5 mistakes that eliminate 80% of aspirants in Prelims.',
      'Current affairs strategy for UPSC that actually works in 2024.',
      'UPSC optional subject selection guide: data-driven analysis.'],
    youtube: ['Complete UPSC roadmap for beginners: where to start and how.',
      'UPSC answer writing: 10 techniques that get full marks.',
      'Topper interviews: what UPSC rank 1-100 do differently.'],
    x_twitter: ['UPSC current affairs thread for today: the 5 things you must know. 🧵',
      'UPSC Mains answer writing mistakes that cost marks — a thread.',
      'My UPSC preparation timeline that helped me crack Prelims in first attempt.'],
    short_video: ['This UPSC revision technique saves 20 hours per month.',
      'Current affairs in 60 seconds: what matters for UPSC today.',
      'UPSC aspirant? This one mindset shift changes everything.'],
    instagram: ['📰 UPSC current affairs — today\'s essentials.',
      '📝 UPSC answer writing tips — save this!',
      '🇮🇳 UPSC Prelims important topics 2025.'],
    linkedin: ['What 3 years of UPSC preparation taught me about persistence and systems.',
      'The civil service exam vs the corporate track: an honest comparison.',
      'Why I chose UPSC over an IIT placement — my story.'],
    reddit: ['[Compilation] Free UPSC resources — the only list you need',
      'Working professional cracking UPSC in first attempt — my honest account',
      'UPSC vs state PCS: which should I target? Detailed comparison'],
    quora: ['How do I start UPSC preparation from zero?',
      'Is UPSC possible without coaching?',
      'What is the best optional subject for UPSC with engineering background?'],
    email: ['Subject: Today\'s UPSC current affairs — 5 essential updates',
      'Subject: UPSC Prelims countdown: your last 30-day plan',
      'Subject: Free UPSC Polity notes — download now'],
    vlog: ['A day in the life of a UPSC aspirant — real and unfiltered.',
      'I visited Mukherjee Nagar to understand the UPSC ecosystem.',
      'UPSC mock interview experience — what they asked me.'],
  },
  CBSE: {
    blog: ['CBSE Class 12 Mathematics: the chapters with highest weightage.',
      'CBSE Board exam strategy: how toppers approach the 3-hour paper.',
      'CBSE vs ICSE: which board actually prepares you better? A parent\'s guide.'],
    youtube: ['CBSE Class 12 Physics: full chapter revision in 1 hour.',
      'CBSE Board exam writing tips that can add 10 marks to your score.',
      'NCERT is enough for CBSE Boards? The honest truth.'],
    x_twitter: ['CBSE Class 12 important questions thread — save this before boards 🧵',
      'CBSE marking scheme secrets: how examiners really award marks.',
      'Last 15 days before CBSE Boards: your checklist. 🔖'],
    short_video: ['This CBSE exam trick is worth 8 marks. Watch now.',
      'CBSE Class 12 Maths formula revision in 60 seconds.',
      '3 hours before CBSE exam? Do this.'],
    instagram: ['📚 CBSE Class 12 important formulas — save this!',
      '🎯 CBSE 2025 board exam prediction — trending topics.',
      '📝 Last-minute CBSE revision tips.'],
    linkedin: ['What CBSE board exams taught me about performing under pressure.',
      'A parent\'s guide to supporting your child through CBSE boards.',
      'Why CBSE\'s shift to competency-based questions is actually good.'],
    reddit: ['[Free PDF] CBSE Class 12 sample papers — all subjects',
      'CBSE boards survivor here — my tips for scoring 90%+',
      'Honest review: which CBSE reference books are actually worth buying?'],
    quora: ['How should I study in the last month before CBSE boards?',
      'Is NCERT enough to score 95% in CBSE Class 12?',
      'What are the most important chapters for CBSE Class 12 Maths?'],
    email: ['Subject: CBSE Class 12 exam blueprint 2025 — your free copy',
      'Subject: Board exam week: your daily revision plan',
      'Subject: [Free] CBSE sample paper with marking scheme'],
    vlog: ['CBSE board exam preparation: my 30-day study plan.',
      'I got 98% in CBSE Class 12. Here\'s how.',
      'Class 12 study with me — 5 hours of board prep.'],
  },
};

// ─── Strategy selector matrix ─────────────────────────────────────────────────

export interface StrategyMatrixResult {
  bestContentType: string;
  tone: string;
  length: string;
  cta: string;
  publishingTip: string;
  hooks: string[];
}

export function selectStrategy(
  exam: SupportedExam,
  audience: ContentAudience,
  channel: ContentChannel,
  daysToExam?: number,
): StrategyMatrixResult {
  const channelSpec = CHANNEL_STRATEGIES[channel];
  const examSpec = EXAM_STRATEGIES[exam];
  const hooks = HOOK_LIBRARY[exam]?.[channel] ?? ['Start your journey today with EduGenius.'];

  // Urgency-based tone adjustment
  const urgency = daysToExam !== undefined
    ? (daysToExam <= 7 ? 'extreme' : daysToExam <= 30 ? 'high' : daysToExam <= 90 ? 'medium' : 'low')
    : 'medium';

  const toneMap: Record<string, string> = {
    extreme: 'urgent + laser-focused',
    high: 'motivating + practical',
    medium: 'educational + encouraging',
    low: 'inspirational + strategic',
  };

  const audienceCtas: Record<ContentAudience, string> = {
    student_beginner: 'Start your free personalised study plan',
    student_intermediate: 'Get your weak topic analysis — free',
    student_advanced: 'Take the EduGenius mock test and benchmark yourself',
    teacher: 'Try EduGenius for your students — free for 30 days',
    parent: 'See your child\'s personalised study plan today',
    aspirant: 'Build your study system with EduGenius — free trial',
  };

  return {
    bestContentType: channelSpec.bestContentTypes[0],
    tone: toneMap[urgency] ?? channelSpec.tone,
    length: channelSpec.idealLength,
    cta: audienceCtas[audience] ?? channelSpec.cta,
    publishingTip: `Best time: ${channelSpec.bestTimeToPost}. Frequency: ${channelSpec.publishFrequency}.`,
    hooks: hooks.slice(0, 3),
  };
}

// ─── Content calendar generator ───────────────────────────────────────────────

export interface CalendarEntry {
  week: number;
  startDate: string;
  daysToExam: number;
  theme: string;
  suggestedTopics: string[];
  primaryChannel: ContentChannel;
  supportingChannels: ContentChannel[];
  contentTypes: string[];
  urgency: 'low' | 'medium' | 'high' | 'extreme';
  focus: string;
}

export interface ContentCalendar {
  exam: SupportedExam;
  examDate: string;
  generatedAt: string;
  weeks: CalendarEntry[];
}

export function generateContentCalendar(
  exam: SupportedExam,
  examDate: string,
  today: string = new Date().toISOString().split('T')[0],
): ContentCalendar {
  const examSpec = EXAM_STRATEGIES[exam];
  const examTs = new Date(examDate).getTime();
  const todayTs = new Date(today).getTime();
  const totalDays = Math.ceil((examTs - todayTs) / 86400000);
  const totalWeeks = Math.min(Math.ceil(totalDays / 7), 16); // max 16 weeks

  const weeks: CalendarEntry[] = [];

  for (let w = 0; w < totalWeeks; w++) {
    const weekStart = new Date(todayTs + w * 7 * 86400000);
    const daysToExam = Math.max(0, totalDays - w * 7);

    const urgency: CalendarEntry['urgency'] =
      daysToExam <= 7 ? 'extreme' :
      daysToExam <= 30 ? 'high' :
      daysToExam <= 90 ? 'medium' : 'low';

    const topicIndex = w % examSpec.topTopics.length;
    const topic = examSpec.topTopics[topicIndex];
    const nextTopic = examSpec.topTopics[(topicIndex + 1) % examSpec.topTopics.length];

    const focusMap: Record<CalendarEntry['urgency'], string> = {
      low: 'Foundation building + awareness content',
      medium: 'Deep dives + practice-focused content',
      high: 'Revision + motivation + mock analysis',
      extreme: 'Last-minute tips + confidence boosters + quick revisions',
    };

    const primaryChannelByUrgency: Record<CalendarEntry['urgency'], ContentChannel> = {
      low: 'blog',
      medium: 'youtube',
      high: 'short_video',
      extreme: 'x_twitter',
    };

    const supportingByUrgency: Record<CalendarEntry['urgency'], ContentChannel[]> = {
      low: ['linkedin', 'reddit', 'email'],
      medium: ['instagram', 'x_twitter', 'email'],
      high: ['instagram', 'email', 'reddit'],
      extreme: ['instagram', 'email', 'short_video'],
    };

    // Filter out any invalid channels
    const validChannels: ContentChannel[] = ['blog', 'vlog', 'youtube', 'short_video', 'x_twitter', 'reddit', 'quora', 'linkedin', 'instagram', 'email'];
    const supporting = (supportingByUrgency[urgency] ?? []).filter(c => validChannels.includes(c)) as ContentChannel[];

    weeks.push({
      week: w + 1,
      startDate: weekStart.toISOString().split('T')[0],
      daysToExam,
      theme: `Week ${w + 1}: ${topic} + ${nextTopic}`,
      suggestedTopics: [topic, nextTopic],
      primaryChannel: primaryChannelByUrgency[urgency],
      supportingChannels: supporting,
      contentTypes: examSpec.contentPillars.slice(0, 3),
      urgency,
      focus: focusMap[urgency],
    });
  }

  return {
    exam,
    examDate,
    generatedAt: new Date().toISOString(),
    weeks,
  };
}

// ─── Calendar storage ─────────────────────────────────────────────────────────

export function saveContentCalendar(calendar: ContentCalendar): void {
  try {
    localStorage.setItem(
      `edugenius_content_calendar_${calendar.exam}`,
      JSON.stringify(calendar),
    );
  } catch { /* ignore */ }
}

export function loadContentCalendar(exam: SupportedExam): ContentCalendar | null {
  try {
    const raw = localStorage.getItem(`edugenius_content_calendar_${exam}`);
    if (!raw) return null;
    return JSON.parse(raw) as ContentCalendar;
  } catch {
    return null;
  }
}
