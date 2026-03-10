/**
 * contentStrategyService.ts — Content Strategy Engine
 *
 * A "strategy" determines HOW content is generated and sequenced for a user.
 * CEO sets the platform default; individual users can override for themselves.
 */

import type { ContentAtomType, LearningMoment, GenerationSpec } from './contentFramework';
import { loadCurrentUser } from './userService';

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
