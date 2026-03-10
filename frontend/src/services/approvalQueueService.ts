/**
 * approvalQueueService.ts — Admin Approval Workflow with Audit Trail
 *
 * Human-in-the-loop gate before content gets posted to social platforms.
 * Supports 1-click approve/edit/reject with full audit trail.
 *
 * Auto-approval rules:
 * - humanizationScore > 8 AND antiSpamScore > 8
 * - intentType NOT in ['motivation_drop', 'result_anxiety'] (always need human review)
 * - Admin can configure threshold
 *
 * Storage keys: `edugenius_social_queue_*`
 */

import type { SocialPlatform } from './socialIntentScoutService';
import type { CraftedAnswer } from './answerCrafterService';
import { updateAnswerStatus, updateAnswerContent, saveAnswer } from './answerCrafterService';
import { schedulePost } from './postSchedulerService';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ApprovalAction = 'approved' | 'rejected' | 'edited_approved';

export interface ApprovalItem {
  id: string;
  answerId: string;
  signalId: string;
  platform: SocialPlatform;
  exam: string;
  urgency: 'high' | 'medium' | 'low';
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  action?: ApprovalAction;
  rejectionReason?: string;
  scheduledFor?: number;
  autoApproveEligible: boolean;
  autoApproved?: boolean;
}

export interface QueueStats {
  pending: number;
  approved: number;
  rejected: number;
  autoApproved: number;
  posted: number;
  total: number;
}

// ─── Storage Keys ──────────────────────────────────────────────────────────────

const QUEUE_KEY = 'edugenius_social_queue';
const SETTINGS_KEY = 'edugenius_social_queue_settings';

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface QueueSettings {
  autoApproveEnabled: boolean;
  autoApproveThreshold: number; // min score (0-10) for both humanization + antiSpam
}

function getSettings(): QueueSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw
      ? JSON.parse(raw)
      : { autoApproveEnabled: false, autoApproveThreshold: 8 };
  } catch {
    return { autoApproveEnabled: false, autoApproveThreshold: 8 };
  }
}

export function setAutoApproveThreshold(score: number): void {
  const settings = getSettings();
  settings.autoApproveThreshold = Math.min(10, Math.max(0, score));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function setAutoApproveEnabled(enabled: boolean): void {
  const settings = getSettings();
  settings.autoApproveEnabled = enabled;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getQueueSettings(): QueueSettings {
  return getSettings();
}

// ─── Eligibility Check ─────────────────────────────────────────────────────────

const AUTO_APPROVE_EXCLUDED_INTENTS = ['motivation_drop', 'result_anxiety'];

export function isAutoApproveEligible(answer: CraftedAnswer, threshold: number): boolean {
  return (
    answer.humanizationScore >= threshold &&
    answer.antiSpamScore >= threshold &&
    !AUTO_APPROVE_EXCLUDED_INTENTS.includes(answer.intentType)
  );
}

// ─── Queue Operations ─────────────────────────────────────────────────────────

export function getQueue(filter?: { action?: ApprovalAction | 'pending' }): ApprovalItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const all: ApprovalItem[] = raw ? JSON.parse(raw) : [];

    if (!filter) return all;
    if (filter.action === 'pending') return all.filter(i => !i.action);
    if (filter.action) return all.filter(i => i.action === filter.action);
    return all;
  } catch {
    return [];
  }
}

function saveQueue(items: ApprovalItem[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

/**
 * Add a crafted answer to the approval queue.
 * Checks auto-approve eligibility and applies if enabled.
 */
export function addToQueue(
  answer: CraftedAnswer,
  urgency: 'high' | 'medium' | 'low'
): ApprovalItem {
  const settings = getSettings();
  const eligible = isAutoApproveEligible(answer, settings.autoApproveThreshold);

  const item: ApprovalItem = {
    id: `qi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    answerId: answer.id,
    signalId: answer.signalId,
    platform: answer.platform,
    exam: answer.exam,
    urgency,
    createdAt: Date.now(),
    autoApproveEligible: eligible,
  };

  // Auto-approve if enabled and eligible
  if (settings.autoApproveEnabled && eligible) {
    item.action = 'approved';
    item.reviewedAt = Date.now();
    item.reviewedBy = 'auto';
    item.autoApproved = true;

    updateAnswerStatus(answer.id, 'approved');

    // Schedule the post
    const formattedContent = answer.formatted[answer.platform as keyof typeof answer.formatted]
      || answer.formatted.reddit;
    schedulePost(answer.id, answer.platform, formattedContent);

    localStorage.setItem('social:answers_ready', JSON.stringify({
      ts: Date.now(),
      autoApproved: true,
      answerId: answer.id,
    }));
  } else {
    updateAnswerStatus(answer.id, 'pending_review');
  }

  const all = getQueue();
  all.push(item);
  saveQueue(all);

  return item;
}

/**
 * Approve a queue item and schedule for posting.
 */
export function approve(itemId: string, scheduledFor?: number): void {
  const all = getQueue();
  const item = all.find(i => i.id === itemId);
  if (!item || item.action) return;

  item.action = 'approved';
  item.reviewedAt = Date.now();
  item.reviewedBy = 'admin';
  if (scheduledFor) item.scheduledFor = scheduledFor;

  saveQueue(all);
  updateAnswerStatus(item.answerId, scheduledFor ? 'scheduled' : 'approved');

  // Schedule the post
  const answers = JSON.parse(localStorage.getItem('edugenius_social_answers') || '[]') as CraftedAnswer[];
  const answer = answers.find(a => a.id === item.answerId);
  if (answer) {
    const formattedContent = answer.formatted[answer.platform as keyof typeof answer.formatted]
      || answer.formatted.reddit;
    schedulePost(answer.id, answer.platform, formattedContent, scheduledFor ? new Date(scheduledFor) : undefined);
  }

  localStorage.setItem('social:posts_scheduled', JSON.stringify({ ts: Date.now(), itemId }));
}

/**
 * Reject a queue item with a reason.
 */
export function reject(itemId: string, reason: string): void {
  const all = getQueue();
  const item = all.find(i => i.id === itemId);
  if (!item || item.action) return;

  item.action = 'rejected';
  item.reviewedAt = Date.now();
  item.reviewedBy = 'admin';
  item.rejectionReason = reason;

  saveQueue(all);
  updateAnswerStatus(item.answerId, 'rejected', reason);
}

/**
 * Edit content and approve in one action.
 */
export function editAndApprove(
  itemId: string,
  editedContent: Partial<Pick<CraftedAnswer, 'hook' | 'body' | 'cta' | 'formatted'>>,
  scheduledFor?: number
): void {
  const all = getQueue();
  const item = all.find(i => i.id === itemId);
  if (!item || item.action) return;

  item.action = 'edited_approved';
  item.reviewedAt = Date.now();
  item.reviewedBy = 'admin';
  if (scheduledFor) item.scheduledFor = scheduledFor;

  saveQueue(all);

  // Update the answer content
  updateAnswerContent(item.answerId, editedContent);
  updateAnswerStatus(item.answerId, scheduledFor ? 'scheduled' : 'approved');

  // Schedule post with potentially edited content
  const formattedContent = editedContent.formatted?.[item.platform as keyof typeof editedContent.formatted]
    || editedContent.body
    || '';
  if (formattedContent) {
    schedulePost(item.answerId, item.platform, formattedContent, scheduledFor ? new Date(scheduledFor) : undefined);
  }
}

/**
 * Bulk approve multiple items.
 */
export function bulkApprove(itemIds: string[]): void {
  const all = getQueue();
  const now = Date.now();

  for (const itemId of itemIds) {
    const item = all.find(i => i.id === itemId);
    if (!item || item.action) continue;

    item.action = 'approved';
    item.reviewedAt = now;
    item.reviewedBy = 'admin_bulk';

    updateAnswerStatus(item.answerId, 'approved');

    // Schedule each post
    const answers = JSON.parse(localStorage.getItem('edugenius_social_answers') || '[]') as CraftedAnswer[];
    const answer = answers.find(a => a.id === item.answerId);
    if (answer) {
      const formattedContent = answer.formatted[answer.platform as keyof typeof answer.formatted]
        || answer.formatted.reddit;
      schedulePost(answer.id, answer.platform, formattedContent);
    }
  }

  saveQueue(all);
  localStorage.setItem('social:posts_scheduled', JSON.stringify({ ts: now, bulk: true, count: itemIds.length }));
}

/**
 * Get queue statistics.
 */
export function getQueueStats(): QueueStats {
  const all = getQueue();
  return {
    pending: all.filter(i => !i.action).length,
    approved: all.filter(i => i.action === 'approved' || i.action === 'edited_approved').length,
    rejected: all.filter(i => i.action === 'rejected').length,
    autoApproved: all.filter(i => i.autoApproved).length,
    posted: all.filter(i => i.action === 'approved' || i.action === 'edited_approved').length,
    total: all.length,
  };
}

/**
 * Get full audit log (all reviewed items).
 */
export function getAuditLog(): ApprovalItem[] {
  return getQueue().filter(i => i.action);
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}
