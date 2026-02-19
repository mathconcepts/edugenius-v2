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

// ─── Customer Lifecycle Phases ────────────────────────────────────────────────

export type LifecyclePhase =
  | 'acquisition'   // Pre-signup: lead capture → nurture → trial/invite
  | 'onboarding'    // Post-signup: activation → first value → exam config complete
  | 'delivery'      // Active learning: cadence, progress, live-session prep
  | 'retention'     // Engagement: re-activation, milestone, upsell, referral
  | 'support';      // Tickets: L2 resolution, content fixes, complaints

// Owning agent per phase (for routing decisions)
export const LIFECYCLE_AGENT_OWNER: Record<LifecyclePhase, string> = {
  acquisition: 'herald',   // Herald (Marketing / Growth) owns lead → trial funnel
  onboarding:  'mentor',   // Mentor (Engagement Coach) owns first-value activation
  delivery:    'sage',     // Sage (Tutor) owns learning cadence + live-session prep
  retention:   'mentor',   // Mentor owns re-engagement, upsell, referral nudges
  support:     'nexus',    // Nexus (Manager) owns L2 ticket resolution
};

export type OutreachType =
  // ── ACQUISITION (Herald-led) ──────────────────────────────────────────────
  | 'lead_welcome'             // First touch after lead form submission
  | 'lead_nurture_exam_tip'    // Value-add tip email/WA for target exam
  | 'trial_invite'             // Invite lead to start free trial / limited access
  | 'trial_expiry_nudge'       // Trial ending soon → convert to paid
  | 'referral_invite'          // Existing user refers a friend
  | 'paid_ad_follow_up'        // Post-ad-click personalised follow-up
  // ── ONBOARDING (Mentor-led) ───────────────────────────────────────────────
  | 'welcome_call'             // Post-signup welcome (human manager or Mentor)
  | 'onboarding_step_nudge'    // Stuck on onboarding step (profile, exam config)
  | 'first_session_invite'     // "Start your first study session" prompt
  | 'setup_incomplete_reminder'// Exam/subject not configured yet
  | 'parent_intro'             // Introduce platform to parent (if student < 18)
  | 'teacher_intro'            // Welcome teacher to their cohort
  // ── DELIVERY (Sage-led, Nexus monitors) ──────────────────────────────────
  | 'daily_study_reminder'     // Daily streak / session reminder
  | 'exam_countdown_nudge'     // Exam approaching — accelerate prep
  | 'live_session_prep'        // Prep brief before scheduled live class
  | 'mock_test_invite'         // Time to take mock test
  | 'topic_completion_nudge'   // Incomplete topic lingering
  | 'content_update_notice'    // Syllabus/content was updated
  | 'milestone_celebration'    // 🎉 Streak/score milestone hit
  | 'low_score_intervention'   // Score dropped below threshold
  // ── RETENTION (Mentor + Nexus) ────────────────────────────────────────────
  | 'proactive_checkin'        // Scheduled manager check-in
  | 'at_risk_alert'            // Disengagement signals detected
  | 'churn_rescue'             // Inactive > N days or plan expiring
  | 'subscription_expiry_warn' // Plan about to expire
  | 'upsell_plan_upgrade'      // Feature gate hit → upgrade nudge
  | 'referral_program_nudge'   // Happy user → refer-a-friend prompt
  // ── SUPPORT (Nexus / Manager) ─────────────────────────────────────────────
  | 'ticket_response'          // Reply to a feedback/complaint
  | 'feedback_followup'        // Follow-up after ticket closed
  | 'bulk_announcement';       // Exam-scoped broadcast (date change, etc.)

// Which lifecycle phase does each outreach type belong to?
export const OUTREACH_LIFECYCLE: Record<OutreachType, LifecyclePhase> = {
  lead_welcome:              'acquisition',
  lead_nurture_exam_tip:     'acquisition',
  trial_invite:              'acquisition',
  trial_expiry_nudge:        'acquisition',
  referral_invite:           'acquisition',
  paid_ad_follow_up:         'acquisition',
  welcome_call:              'onboarding',
  onboarding_step_nudge:     'onboarding',
  first_session_invite:      'onboarding',
  setup_incomplete_reminder: 'onboarding',
  parent_intro:              'onboarding',
  teacher_intro:             'onboarding',
  daily_study_reminder:      'delivery',
  exam_countdown_nudge:      'delivery',
  live_session_prep:         'delivery',
  mock_test_invite:          'delivery',
  topic_completion_nudge:    'delivery',
  content_update_notice:     'delivery',
  milestone_celebration:     'delivery',
  low_score_intervention:    'delivery',
  proactive_checkin:         'retention',
  at_risk_alert:             'retention',
  churn_rescue:              'retention',
  subscription_expiry_warn:  'retention',
  upsell_plan_upgrade:       'retention',
  referral_program_nudge:    'retention',
  ticket_response:           'support',
  feedback_followup:         'support',
  bulk_announcement:         'support',
};

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

// ─── Lead (Acquisition) ───────────────────────────────────────────────────────

export type LeadStatus =
  | 'new'          // Just captured (form / ad click / referral)
  | 'contacted'    // First outreach sent
  | 'nurturing'    // In drip sequence
  | 'trial'        // On free trial
  | 'converted'    // Paid signup completed
  | 'lost';        // No response after N touches

export type LeadSource =
  | 'organic_search' | 'paid_ad' | 'referral' | 'social_organic'
  | 'whatsapp_link' | 'telegram_bot' | 'blog_cta' | 'direct';

export interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  telegramId?: string;
  targetExam: string;            // Which exam they're preparing for
  grade?: number;
  source: LeadSource;
  utmCampaign?: string;
  utmMedium?: string;
  status: LeadStatus;
  touchCount: number;            // Number of outreach messages sent
  lastTouchAt?: Date;
  trialStartAt?: Date;
  trialEndsAt?: Date;
  convertedAt?: Date;
  assignedManagerId?: string;    // For high-touch leads
  preferredLanguage?: string;
  parentName?: string;
  parentPhone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadOutreach {
  id: string;
  leadId: string;
  type: OutreachType;
  channel: OutreachChannel;
  message: string;
  subject?: string;
  sentAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  repliedAt?: Date;
  outcome?: 'opened' | 'clicked' | 'replied' | 'converted' | 'bounced' | 'opted_out';
  triggeredBy: 'herald' | 'nexus' | 'manual';
  sequenceStep?: number;         // Which step in the drip sequence
}

// ─── Outreach Settings (Lifecycle-aware) ─────────────────────────────────────

export interface LifecycleOutreachRule {
  phase: LifecyclePhase;
  triggerEvent: string;          // e.g. 'lead:captured', 'user:signed_up', 'score:dropped'
  delayHours: number;            // hours after trigger to send
  outreachType: OutreachType;
  preferredChannel: OutreachChannel;
  fallbackChannel?: OutreachChannel;
  enabled: boolean;
  templateKey: string;           // message template identifier
  ownerAgent: string;            // which agent sends it
}

export const DEFAULT_LIFECYCLE_RULES: LifecycleOutreachRule[] = [
  // ── ACQUISITION ──────────────────────────────────────────────────────────
  { phase: 'acquisition', triggerEvent: 'lead:captured',         delayHours: 0,    outreachType: 'lead_welcome',              preferredChannel: 'whatsapp', fallbackChannel: 'email',    enabled: true, templateKey: 'lead_welcome_wa',           ownerAgent: 'herald' },
  { phase: 'acquisition', triggerEvent: 'lead:captured',         delayHours: 24,   outreachType: 'lead_nurture_exam_tip',     preferredChannel: 'email',    fallbackChannel: 'whatsapp', enabled: true, templateKey: 'lead_nurture_tip_d1',       ownerAgent: 'herald' },
  { phase: 'acquisition', triggerEvent: 'lead:captured',         delayHours: 72,   outreachType: 'trial_invite',              preferredChannel: 'whatsapp', fallbackChannel: 'email',    enabled: true, templateKey: 'trial_invite_wa',           ownerAgent: 'herald' },
  { phase: 'acquisition', triggerEvent: 'lead:trial_started',    delayHours: -48,  outreachType: 'trial_expiry_nudge',        preferredChannel: 'whatsapp', fallbackChannel: 'email',    enabled: true, templateKey: 'trial_expiry_nudge',        ownerAgent: 'herald' },
  { phase: 'acquisition', triggerEvent: 'user:referral_given',   delayHours: 0,    outreachType: 'referral_invite',           preferredChannel: 'whatsapp', fallbackChannel: 'email',    enabled: true, templateKey: 'referral_invite',           ownerAgent: 'herald' },
  // ── ONBOARDING ───────────────────────────────────────────────────────────
  { phase: 'onboarding',  triggerEvent: 'user:signed_up',        delayHours: 0,    outreachType: 'welcome_call',              preferredChannel: 'whatsapp', fallbackChannel: 'email',    enabled: true, templateKey: 'welcome_new_student',       ownerAgent: 'mentor' },
  { phase: 'onboarding',  triggerEvent: 'user:signed_up',        delayHours: 2,    outreachType: 'first_session_invite',      preferredChannel: 'in_app',   fallbackChannel: 'whatsapp', enabled: true, templateKey: 'first_session_cta',         ownerAgent: 'mentor' },
  { phase: 'onboarding',  triggerEvent: 'onboarding:step_stuck', delayHours: 6,    outreachType: 'onboarding_step_nudge',     preferredChannel: 'in_app',   fallbackChannel: 'whatsapp', enabled: true, templateKey: 'onboarding_nudge',          ownerAgent: 'mentor' },
  { phase: 'onboarding',  triggerEvent: 'onboarding:incomplete', delayHours: 24,   outreachType: 'setup_incomplete_reminder', preferredChannel: 'email',    fallbackChannel: 'whatsapp', enabled: true, templateKey: 'setup_reminder_d1',         ownerAgent: 'mentor' },
  { phase: 'onboarding',  triggerEvent: 'user:parent_linked',    delayHours: 0,    outreachType: 'parent_intro',              preferredChannel: 'whatsapp', fallbackChannel: 'email',    enabled: true, templateKey: 'parent_welcome',            ownerAgent: 'mentor' },
  { phase: 'onboarding',  triggerEvent: 'teacher:cohort_assigned',delayHours: 0,   outreachType: 'teacher_intro',             preferredChannel: 'email',    fallbackChannel: 'whatsapp', enabled: true, templateKey: 'teacher_cohort_welcome',    ownerAgent: 'mentor' },
  // ── DELIVERY ──────────────────────────────────────────────────────────────
  { phase: 'delivery',    triggerEvent: 'cron:daily_9am',        delayHours: 0,    outreachType: 'daily_study_reminder',      preferredChannel: 'in_app',   fallbackChannel: 'whatsapp', enabled: true, templateKey: 'daily_streak_reminder',     ownerAgent: 'sage'   },
  { phase: 'delivery',    triggerEvent: 'exam:days_remaining_30',delayHours: 0,    outreachType: 'exam_countdown_nudge',      preferredChannel: 'whatsapp', fallbackChannel: 'email',    enabled: true, templateKey: 'exam_countdown_30d',        ownerAgent: 'sage'   },
  { phase: 'delivery',    triggerEvent: 'exam:days_remaining_7', delayHours: 0,    outreachType: 'exam_countdown_nudge',      preferredChannel: 'whatsapp', fallbackChannel: 'sms',      enabled: true, templateKey: 'exam_countdown_7d',         ownerAgent: 'sage'   },
  { phase: 'delivery',    triggerEvent: 'session:scheduled',     delayHours: -1,   outreachType: 'live_session_prep',         preferredChannel: 'whatsapp', fallbackChannel: 'in_app',   enabled: true, templateKey: 'live_session_prep_brief',   ownerAgent: 'sage'   },
  { phase: 'delivery',    triggerEvent: 'cron:weekly_mock',      delayHours: 0,    outreachType: 'mock_test_invite',          preferredChannel: 'in_app',   fallbackChannel: 'whatsapp', enabled: true, templateKey: 'mock_test_invite_weekly',   ownerAgent: 'sage'   },
  { phase: 'delivery',    triggerEvent: 'content:syllabus_updated',delayHours: 0,  outreachType: 'content_update_notice',     preferredChannel: 'in_app',   fallbackChannel: 'email',    enabled: true, templateKey: 'content_updated_notice',   ownerAgent: 'atlas'  },
  { phase: 'delivery',    triggerEvent: 'student:milestone_hit', delayHours: 0,    outreachType: 'milestone_celebration',     preferredChannel: 'in_app',   fallbackChannel: 'whatsapp', enabled: true, templateKey: 'milestone_celebration',     ownerAgent: 'mentor' },
  { phase: 'delivery',    triggerEvent: 'score:dropped_below_40',delayHours: 2,    outreachType: 'low_score_intervention',    preferredChannel: 'whatsapp', fallbackChannel: 'email',    enabled: true, templateKey: 'low_score_help_offer',      ownerAgent: 'nexus'  },
  // ── RETENTION ─────────────────────────────────────────────────────────────
  { phase: 'retention',   triggerEvent: 'student:inactive_3d',  delayHours: 0,    outreachType: 'proactive_checkin',         preferredChannel: 'whatsapp', fallbackChannel: 'in_app',   enabled: true, templateKey: 'checkin_3d_inactive',       ownerAgent: 'nexus'  },
  { phase: 'retention',   triggerEvent: 'student:inactive_7d',  delayHours: 0,    outreachType: 'at_risk_alert',             preferredChannel: 'whatsapp', fallbackChannel: 'email',    enabled: true, templateKey: 'at_risk_7d',                ownerAgent: 'nexus'  },
  { phase: 'retention',   triggerEvent: 'student:inactive_14d', delayHours: 0,    outreachType: 'churn_rescue',              preferredChannel: 'whatsapp', fallbackChannel: 'sms',      enabled: true, templateKey: 'churn_rescue_14d',          ownerAgent: 'nexus'  },
  { phase: 'retention',   triggerEvent: 'subscription:expiring_7d',delayHours: 0, outreachType: 'subscription_expiry_warn',  preferredChannel: 'whatsapp', fallbackChannel: 'email',    enabled: true, templateKey: 'sub_expiry_7d',             ownerAgent: 'nexus'  },
  { phase: 'retention',   triggerEvent: 'user:feature_gate_hit', delayHours: 1,   outreachType: 'upsell_plan_upgrade',       preferredChannel: 'in_app',   fallbackChannel: 'email',    enabled: true, templateKey: 'upsell_upgrade_prompt',     ownerAgent: 'herald' },
  { phase: 'retention',   triggerEvent: 'student:csat_above_4.5',delayHours: 24,  outreachType: 'referral_program_nudge',    preferredChannel: 'in_app',   fallbackChannel: 'whatsapp', enabled: true, templateKey: 'referral_happy_user',       ownerAgent: 'herald' },
  // ── SUPPORT ───────────────────────────────────────────────────────────────
  { phase: 'support',     triggerEvent: 'ticket:resolved',       delayHours: 24,   outreachType: 'feedback_followup',         preferredChannel: 'whatsapp', fallbackChannel: 'email',    enabled: true, templateKey: 'ticket_followup_24h',       ownerAgent: 'nexus'  },
];

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
  // Lifecycle-aware settings
  lifecycleRulesEnabled: boolean;              // Enable rule-based lifecycle outreach
  customRules: LifecycleOutreachRule[];        // Overrides/additions to DEFAULT_LIFECYCLE_RULES
  acquisitionEnabled: boolean;                 // Herald handles leads
  onboardingEnabled: boolean;                  // Mentor handles activation
  deliveryNudgesEnabled: boolean;              // Sage handles learning cadence
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
