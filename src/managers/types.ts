/**
 * Manager Role — Types
 *
 * Manager is an exam-scoped human L2 resolver. Assigned by Admin/CEO.
 * Each manager owns one or more exams and sees only those students/tickets.
 */

import type { ExamType, Subject } from '../users/types';
import type { TicketCategory, TicketPriority } from '../feedback/types';

// ─── Core ─────────────────────────────────────────────────────────────────────

export type ManagerStatus = 'active' | 'on_leave' | 'suspended';

export type OutreachChannel = 'email' | 'whatsapp' | 'telegram' | 'in_app' | 'sms';

export type OutreachType =
  | 'ticket_response'          // Reply to a feedback/complaint
  | 'proactive_checkin'        // Scheduled student check-in
  | 'at_risk_alert'            // Student showing disengagement signals
  | 'milestone_celebration'    // Student hit a milestone
  | 'exam_countdown_nudge'     // Exam approaching reminder
  | 'low_score_intervention'   // Score dropped below threshold
  | 'content_update_notice'    // Syllabus/content was updated
  | 'subscription_expiry_warn' // Plan about to expire
  | 'feedback_followup'        // Follow-up after ticket closed
  | 'welcome_call'             // Onboarding welcome for new students
  | 'churn_rescue'             // Student inactive > N days
  | 'bulk_announcement';       // Exam-scoped broadcast

export type UpdateTriggerType =
  | 'content_fix'              // Fix erroneous content
  | 'syllabus_update'          // Syllabus change in exam
  | 'difficulty_recalibrate'   // Adjust difficulty for exam
  | 'agent_prompt_update'      // Update AI tutor prompt for exam
  | 'exam_date_change'         // Exam date updated
  | 'feature_flag_toggle'      // Enable/disable feature for exam
  | 'batch_reassign'           // Move students to new batch
  | 'pricing_update';          // Plan price change for exam

// ─── Manager Profile ──────────────────────────────────────────────────────────

export interface ManagerExamScope {
  examId: ExamType;
  subjects: Subject[];         // empty = all subjects for this exam
  batchIds: string[];          // empty = all batches for this exam
  canCreateContent: boolean;
  canModifyPricing: boolean;
  canTriggerUpdates: boolean;
  canBroadcast: boolean;
  studentLimit?: number;       // max students this manager is responsible for
  assignedAt: Date;
  assignedBy: string;          // admin/ceo user ID
}

export interface ManagerOutreachSettings {
  preferredChannels: OutreachChannel[];
  dailyOutreachLimit: number;    // max outreach messages per day
  quietHoursStart: string;       // HH:MM
  quietHoursEnd: string;
  autoFollowUpDays: number;      // days after ticket close to auto-followup
  proactiveCheckinEnabled: boolean;
  checkinFrequencyDays: number;
  atRiskThresholdDays: number;   // inactive days before at-risk alert
  lowScoreThreshold: number;     // 0–100 score below which to intervene
}

export interface ManagerPerformanceMetrics {
  ticketsAssigned: number;
  ticketsResolved: number;
  avgResolutionMinutes: number;
  slaBreaches: number;
  csat: number;                  // 0–5 customer satisfaction
  proactiveOutreachSent: number;
  atRiskStudentsIntervened: number;
  contentUpdatesTriggered: number;
  escalationRate: number;
  reopenRate: number;
}

export interface Manager {
  id: string;
  userId: string;               // links to EduGeniusUser
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  status: ManagerStatus;

  // Exam access (admin-assigned)
  examScopes: ManagerExamScope[];

  // Outreach configuration
  outreachSettings: ManagerOutreachSettings;

  // Performance
  metrics: ManagerPerformanceMetrics;

  // Nexus agent session (AI assistant)
  nexusSessionId?: string;

  createdAt: Date;
  updatedAt: Date;
  lastActiveAt?: Date;
  createdBy: string;            // admin/ceo user ID
}

// ─── Ticket Assignment ────────────────────────────────────────────────────────

export interface ManagerTicketAssignment {
  ticketId: string;
  managerId: string;
  examId: ExamType;
  assignedAt: Date;
  assignedBy: 'auto' | string;  // 'auto' = Nexus routing, else admin ID
  priority: TicketPriority;
  category: TicketCategory;
  dueAt: Date;
  resolvedAt?: Date;
  resolution?: string;
  internalNote?: string;
  updateTriggered?: UpdateTriggerType;
  satisfactionRating?: number;  // 1–5
}

// ─── Outreach ─────────────────────────────────────────────────────────────────

export interface ManagerOutreach {
  id: string;
  managerId: string;
  studentId: string;
  examId: ExamType;
  type: OutreachType;
  channel: OutreachChannel;
  message: string;
  subject?: string;             // for email
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  repliedAt?: Date;
  outcome?: 'engaged' | 'no_response' | 'bounced' | 'opted_out';
  triggeredBy: 'agent' | 'manual' | 'rule';
  relatedTicketId?: string;
}

// ─── Update Trigger ───────────────────────────────────────────────────────────

export interface ManagerUpdateTrigger {
  id: string;
  managerId: string;
  examId: ExamType;
  type: UpdateTriggerType;
  description: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'in_progress' | 'deployed' | 'rejected';
  approvedBy?: string;
  deployedAt?: Date;
  affectedStudentCount: number;
  relatedTicketIds: string[];
  agentTaskId?: string;         // Atlas/Forge task ID
  createdAt: Date;
  updatedAt: Date;
}

// ─── Student View ─────────────────────────────────────────────────────────────

export interface ManagerStudentView {
  studentId: string;
  displayName: string;
  email: string;
  phone?: string;
  whatsappId?: string;
  telegramId?: string;
  examId: ExamType;
  grade: number;
  planName: string;
  planExpiresAt?: Date;
  // Health signals
  lastActiveAt?: Date;
  inactiveDays: number;
  currentStreak: number;
  recentScore?: number;
  scoretrend: 'improving' | 'stable' | 'declining' | 'unknown';
  ticketCount: number;
  openTickets: number;
  isAtRisk: boolean;
  riskReason?: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export interface CreateManagerRequest {
  userId: string;
  examScopes: Omit<ManagerExamScope, 'assignedAt' | 'assignedBy'>[];
  outreachSettings?: Partial<ManagerOutreachSettings>;
}

export interface UpdateManagerScopeRequest {
  managerId: string;
  examScopes: Omit<ManagerExamScope, 'assignedAt' | 'assignedBy'>[];
}

export interface SendOutreachRequest {
  managerId: string;
  studentIds: string[];
  type: OutreachType;
  channel: OutreachChannel;
  message: string;
  subject?: string;
  scheduleAt?: Date;
}

export interface TriggerUpdateRequest {
  managerId: string;
  examId: ExamType;
  type: UpdateTriggerType;
  description: string;
  urgency: ManagerUpdateTrigger['urgency'];
  relatedTicketIds?: string[];
}

export interface ManagerSearchFilters {
  examId?: ExamType;
  status?: ManagerStatus;
  hasOpenTickets?: boolean;
  sortBy?: 'csat' | 'tickets' | 'lastActive';
  limit?: number;
  offset?: number;
}
