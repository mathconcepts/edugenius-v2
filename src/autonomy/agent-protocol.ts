/**
 * Agent-to-Agent Protocol
 *
 * Agents delegate tasks to each other via typed messages.
 * No agent calls another directly — always through the protocol.
 * This creates a full audit trail of who asked what, and when.
 */

import { EventEmitter } from 'events';

// ── Types ────────────────────────────────────────────────────────────────────

export type AgentId =
  | 'Scout'
  | 'Atlas'
  | 'Sage'
  | 'Mentor'
  | 'Herald'
  | 'Forge'
  | 'Oracle'
  | 'Nexus';

export interface AgentTask {
  id: string;
  from: AgentId;
  to: AgentId;
  taskType: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  payload: Record<string, unknown>;
  deadline?: Date;
  requiresApproval: boolean;
  createdAt: Date;
}

export interface AgentTaskResult {
  taskId: string;
  from: AgentId;
  success: boolean;
  output: Record<string, unknown>;
  confidenceScore: number;   // 0-1
  requiresCEOReview: boolean;
  completedAt: Date;
  duration: number;           // ms
}

// ── Common inter-agent task factories ────────────────────────────────────────

/** Scout → Herald: "I found a trending topic, write a blog post" */
export const SCOUT_TO_HERALD_TREND = (topic: string, keywords: string[]): AgentTask => ({
  id: `scout_herald_${Date.now()}`,
  from: 'Scout',
  to: 'Herald',
  taskType: 'content:blog_from_trend',
  priority: 'normal',
  payload: { topic, keywords, wordCount: 1200, targetExam: 'JEE' },
  requiresApproval: false,
  createdAt: new Date(),
});

/** Oracle → Mentor: "These students are at-risk based on analytics" */
export const ORACLE_TO_MENTOR_ATRISK = (
  studentIds: string[],
  reason: string,
): AgentTask => ({
  id: `oracle_mentor_${Date.now()}`,
  from: 'Oracle',
  to: 'Mentor',
  taskType: 'outreach:at_risk_intervention',
  priority: 'high',
  payload: { studentIds, reason, suggestedChannel: 'whatsapp' },
  requiresApproval: false,
  createdAt: new Date(),
});

/** Scout → Oracle: "Update pricing based on market data" */
export const SCOUT_TO_ORACLE_PRICING = (
  competitorData: Record<string, unknown>,
): AgentTask => ({
  id: `scout_oracle_${Date.now()}`,
  from: 'Scout',
  to: 'Oracle',
  taskType: 'pricing:recalibrate',
  priority: 'normal',
  payload: { competitorData, action: 'recompute_recommended_pricing' },
  requiresApproval: false,
  createdAt: new Date(),
});

/** Oracle → Herald: "Campaign X has 40% open rate, replicate the pattern" */
export const ORACLE_TO_HERALD_REPLICATE = (
  campaignId: string,
  pattern: Record<string, unknown>,
): AgentTask => ({
  id: `oracle_herald_${Date.now()}`,
  from: 'Oracle',
  to: 'Herald',
  taskType: 'content:replicate_winning_pattern',
  priority: 'normal',
  payload: { campaignId, pattern },
  requiresApproval: false,
  createdAt: new Date(),
});

/** Atlas → Forge: "New content batch ready, deploy to CDN" */
export const ATLAS_TO_FORGE_DEPLOY = (contentBatch: unknown[]): AgentTask => ({
  id: `atlas_forge_${Date.now()}`,
  from: 'Atlas',
  to: 'Forge',
  taskType: 'deploy:content_batch',
  priority: 'normal',
  payload: { contentBatch, targetEnvironment: 'production' },
  requiresApproval: false,
  createdAt: new Date(),
});

/** Oracle → Mentor: "Subscription renewal coming up for these students" */
export const ORACLE_TO_MENTOR_RENEWAL = (
  studentIds: string[],
  daysToExpiry: number,
): AgentTask => ({
  id: `oracle_mentor_renewal_${Date.now()}`,
  from: 'Oracle',
  to: 'Mentor',
  taskType: 'outreach:renewal_nudge',
  priority: 'high',
  payload: { studentIds, daysToExpiry, channel: 'whatsapp' },
  requiresApproval: false,
  createdAt: new Date(),
});

/** Any agent → CEO (for things above threshold) — routed via Oracle */
export const ANY_TO_CEO_APPROVAL = (
  from: AgentId,
  action: string,
  details: Record<string, unknown>,
  estimatedImpact: string,
  options?: string[],
  defaultOption?: string,
): AgentTask => ({
  id: `${from.toLowerCase()}_ceo_${Date.now()}`,
  from,
  to: 'Oracle', // Oracle manages the CEO approval queue
  taskType: 'ceo:approval_required',
  priority: 'urgent',
  payload: {
    action,
    details,
    estimatedImpact,
    proposedBy: from,
    options: options ?? ['Approve', 'Reject', 'Modify'],
    defaultIfNoResponse: defaultOption ?? 'Agents will proceed with conservative option',
  },
  requiresApproval: true,
  createdAt: new Date(),
});

// ── Protocol dispatcher (EventEmitter-based) ─────────────────────────────────

export class AgentProtocol extends EventEmitter {
  private taskQueue: AgentTask[] = [];
  private completedTasks: AgentTaskResult[] = [];

  /** Dispatch a task to a target agent */
  dispatch(task: AgentTask): void {
    this.taskQueue.push(task);
    this.emit(`task:${task.to.toLowerCase()}`, task);
    this.emit('task:dispatched', task);
    // Note: logging intentionally kept — protocol events are always worth tracing
    process.stdout.write(
      `[AgentProtocol] ${task.from} → ${task.to}: ${task.taskType} (id=${task.id})\n`,
    );
  }

  /** Mark a task as complete */
  complete(result: AgentTaskResult): void {
    this.completedTasks.push(result);
    this.taskQueue = this.taskQueue.filter(t => t.id !== result.taskId);
    this.emit('task:completed', result);
  }

  /** All tasks awaiting CEO approval */
  getPendingCEOApprovals(): AgentTask[] {
    return this.taskQueue.filter(t => t.requiresApproval);
  }

  /** Recent completed task history */
  getTaskHistory(limit = 50): AgentTaskResult[] {
    return this.completedTasks.slice(-limit);
  }

  /** Tasks pending for a specific agent */
  getAgentQueue(agentId: AgentId): AgentTask[] {
    return this.taskQueue.filter(t => t.to === agentId && !t.requiresApproval);
  }

  /** Summary stats for the daily brief */
  getSummary(): {
    totalDispatched: number;
    totalCompleted: number;
    pendingApprovals: number;
    avgDurationMs: number;
  } {
    const completed = this.completedTasks;
    const avgDuration =
      completed.length > 0
        ? completed.reduce((sum, t) => sum + t.duration, 0) / completed.length
        : 0;

    return {
      totalDispatched: this.taskQueue.length + completed.length,
      totalCompleted: completed.length,
      pendingApprovals: this.getPendingCEOApprovals().length,
      avgDurationMs: Math.round(avgDuration),
    };
  }
}

/** Singleton protocol instance — import this everywhere */
export const agentProtocol = new AgentProtocol();
