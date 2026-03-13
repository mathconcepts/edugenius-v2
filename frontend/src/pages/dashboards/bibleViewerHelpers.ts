/**
 * bibleViewerHelpers.ts — Re-export subset of subTopicBibleService for the CEO viewer.
 * Avoids direct circular imports in the page layer.
 */

export {
  getAllBibles,
  getBibleCompleteness,
  getBibleHealthScore,
  type SubTopicBible,
} from '@/services/subTopicBibleService';

import { getAllBibles } from '@/services/subTopicBibleService';

/**
 * Thin wrapper exposed to the viewer — same as reconcileBibles but with
 * a return type that matches what the viewer expects.
 */
export async function reconcileBiblesFromViewer(): Promise<{ audited: number; gaps: number; queued: number }> {
  const { reconcileBibles } = await import('@/services/bibleProgressiveUpdater');
  return reconcileBibles();
}

/**
 * Get all unique exam IDs from stored bibles.
 */
export function getExamIds(): string[] {
  return Array.from(new Set(getAllBibles().map(b => b.examId)));
}

/**
 * Get all unique topic IDs for a given exam (or all exams).
 */
export function getTopicIds(examId?: string): string[] {
  const bibles = examId ? getAllBibles(examId) : getAllBibles();
  return Array.from(new Set(bibles.map(b => b.topicId)));
}
