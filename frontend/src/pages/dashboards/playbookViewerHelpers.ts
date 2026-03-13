/**
 * playbookViewerHelpers.ts — Re-export subset of coursePlaybookService for the CEO viewer.
 * Avoids direct circular imports in the page layer.
 */

export {
  getAllPlaybooks,
  getPlaybookCompleteness,
  getPlaybookHealthScore,
  type CoursePlaybook,
} from '@/services/coursePlaybookService';

import { getAllPlaybooks } from '@/services/coursePlaybookService';

/**
 * Thin wrapper exposed to the viewer — same as reconcilePlaybooks but with
 * a return type that matches what the viewer expects.
 */
export async function reconcilePlaybooksFromViewer(): Promise<{ audited: number; gaps: number; queued: number }> {
  const { reconcilePlaybooks } = await import('@/services/playbookProgressiveUpdater');
  return reconcilePlaybooks();
}

/**
 * Get all unique exam IDs from stored playbooks.
 */
export function getExamIds(): string[] {
  return Array.from(new Set(getAllPlaybooks().map(b => b.examId)));
}

/**
 * Get all unique topic IDs for a given exam (or all exams).
 */
export function getTopicIds(examId?: string): string[] {
  const playbooks = examId ? getAllPlaybooks(examId) : getAllPlaybooks();
  return Array.from(new Set(playbooks.map(b => b.topicId)));
}
