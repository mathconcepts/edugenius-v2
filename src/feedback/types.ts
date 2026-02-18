/**
 * EduGenius Feedback & Complaint Handling System
 * Complete TypeScript types for tickets, auditing, SLA, and resolution
 */

import type { ExamType, Subject } from '../users/types';

// ============================================================================
// Core Enums & Unions
// ============================================================================

export type TicketStatus =
  | 'open'
  | 'l1_processing'
  | 'l1_resolved'
  | 'l2_escalated'
  | 'l2_processing'
  | 'resolved'
  | 'closed'
  | 'rejected';

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export type TicketCategory =
  | 'content_error'      // Wrong answer, incorrect explanation
  | 'content_missing'    // Missing topics, incomplete coverage
  | 'ai_behavior'        // AI giving bad/unhelpful responses
  | 'technical_bug'      // App crash, feature not working
  | 'payment_issue'      // Billing, refund, subscription
  | 'access_denied'      // Can't access content/exam
  | 'feature_request'    // New feature suggestion
  | 'general_feedback'   // General praise or comment
  | 'account_issue'      // Profile, login, settings
  | 'exam_content'       // Exam-specific content complaint
  | 'performance'        // App slow, loading issues
  | 'other';

export type TicketType =
  | 'feedback'
  | 'complaint'
  | 'bug_report'
  | 'feature_request';

export type ActorType = 'user' | 'ai_l1' | 'system' | 'human_agent';

export type ResolutionOutcome = 'resolved' | 'rejected' | 'duplicate' | 'wont_fix';

export type L1ResolutionType =
  | 'auto_resolved'
  | 'workaround_provided'
  | 'information_provided'
  | 'escalated';

// ============================================================================
// Quality Scoring
// ============================================================================

export interface ComplaintQuality {
  /** 0–100 composite quality score */
  score: number;
  /** Names specific topic / chapter / question */
  hasSpecificDetails: boolean;
  /** Describes "when I do X, Y happens" */
  hasReproSteps: boolean;
  /** Describes what should have happened */
  hasExpectedBehavior: boolean;
  /** Describes what actually happened */
  hasActualBehavior: boolean;
  sentiment: 'positive' | 'neutral' | 'frustrated' | 'angry';
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  /** Can someone actually take action on this? */
  isActionable: boolean;
}

// ============================================================================
// SLA
// ============================================================================

export interface TicketSLA {
  /** Minutes allowed for L1 AI resolution */
  l1DeadlineMinutes: number;
  /** Minutes allowed for L2 human resolution */
  l2DeadlineMinutes: number;
  /** Absolute deadline for L1 */
  l1DueAt: Date;
  /** Absolute deadline for L2 (set when escalated) */
  l2DueAt?: Date;
  /** Has any SLA deadline been breached? */
  breached: boolean;
  breachedAt?: Date;
}

export interface SLAConfig {
  priority: TicketPriority;
  l1MaxMinutes: number;
  l2MaxMinutes: number;
  autoEscalateAfterMinutes: number;
}

// ============================================================================
// Audit Trail
// ============================================================================

export interface AuditEntry {
  id: string;
  ticketId: string;
  timestamp: Date;
  actor: ActorType;
  /** userId, agentId, or 'system' */
  actorId: string;
  actorName: string;
  action: string;
  details: string;
  previousStatus?: TicketStatus;
  newStatus?: TicketStatus;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// L1 / L2 Responses
// ============================================================================

export interface L1Response {
  /** sage | mentor | forge | herald */
  agentId: string;
  attemptedAt: Date;
  completedAt?: Date;
  response: string;
  /** 0–100 — how confident the AI is in its resolution */
  confidenceScore: number;
  resolutionType: L1ResolutionType;
  escalationReason?: string;
  qualityCheckPassed: boolean;
  qualityCheckDetails: string;
}

export interface L2Response {
  /** Human agent ID */
  assignedTo?: string;
  assignedAt?: Date;
  respondedAt?: Date;
  response?: string;
  internalNote?: string;
  actionTaken?: string;
  resolution: ResolutionOutcome;
  closedBy?: string;
}

export interface Resolution {
  summary: string;
  resolvedBy: 'ai' | 'human';
  resolutionType: string;
  /** Action taken to prevent recurrence (for systemic issues) */
  preventionAction?: string;
  knowledgeBaseUpdated: boolean;
}

// ============================================================================
// Metadata captured automatically at submission time
// ============================================================================

export interface TicketMetadata {
  page: string;
  sessionId?: string;
  agentId?: string;
  questionId?: string;
  chatMessageId?: string;
  browserInfo?: string;
  timestamp: Date;
}

// ============================================================================
// Full Ticket
// ============================================================================

export interface FeedbackTicket {
  /** Human-readable: TKT-2026-000001 */
  id: string;
  userId: string;
  examId?: ExamType;
  subject?: Subject;

  // Submission
  type: TicketType;
  category: TicketCategory;
  subcategory?: string;
  title: string;
  description: string;
  attachments?: string[];
  metadata?: TicketMetadata;

  // Classification (auto-set on creation)
  priority: TicketPriority;
  quality: ComplaintQuality;
  tags: string[];

  // SLA (clock starts at creation)
  sla: TicketSLA;

  // Audit trail (append-only)
  auditTrail: AuditEntry[];

  // Resolution
  status: TicketStatus;
  l1Response?: L1Response;
  l2Response?: L2Response;
  resolution?: Resolution;

  /** 1–5 stars collected after resolution */
  satisfactionRating?: number;
  satisfactionComment?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  closedAt?: Date;
}

// ============================================================================
// Input DTOs
// ============================================================================

export interface CreateTicketInput {
  type: TicketType;
  title: string;
  description: string;
  category?: TicketCategory;
  subcategory?: string;
  examId?: ExamType;
  subject?: Subject;
  attachments?: string[];
  metadata?: Partial<TicketMetadata>;
}

export interface SearchTicketsFilter {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  userId?: string;
  assignedTo?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  slaBreached?: boolean;
  query?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Analytics
// ============================================================================

export interface TicketStats {
  total: number;
  byStatus: Record<TicketStatus, number>;
  byPriority: Record<TicketPriority, number>;
  byCategory: Record<TicketCategory, number>;
  avgResolutionMinutes: {
    l1: number;
    l2: number;
    overall: number;
  };
  slaCompliancePercent: number;
  avgSatisfactionRating: number;
  l1AutoResolutionRate: number;
  escalationRate: number;
}

export interface SLAHealthReport {
  healthy: number;
  warning: number;
  breached: number;
  breachRate: number;
  avgTimeToL1ResolutionMinutes: number;
  avgTimeToL2ResolutionMinutes: number;
  ticketsAtRisk: Array<{
    ticketId: string;
    priority: TicketPriority;
    minutesRemaining: number;
    stage: 'l1' | 'l2';
  }>;
}

export interface L1QualityCheckResult {
  passed: boolean;
  reason: string;
  confidenceThresholdRequired: number;
  confidenceAchieved: number;
}
