/**
 * Nexus Agent — Manager Orchestrator
 *
 * Nexus is the AI backbone for all Manager-role workflows:
 *
 * Sub-agents:
 *  1. Ticket Router        — Routes L2 tickets to correct exam-scoped manager
 *  2. At-Risk Detector     — Identifies disengaged students, triggers proactive outreach
 *  3. Outreach Composer    — Drafts personalised outreach messages per channel
 *  4. Update Dispatcher    — Routes content/deployment update triggers to Atlas/Forge
 *  5. Resolution Suggester — Suggests resolutions based on ticket history + knowledge base
 *  6. CSAT Monitor         — Tracks satisfaction scores, alerts on drops
 *  7. Broadcast Planner    — Plans exam-scoped announcements (exam date changes, etc.)
 *  8. Churn Rescue         — Detects subscription churn risk, triggers manager intervention
 *  9. Escalation Guard     — Catches tickets about to breach SLA, nudges manager
 * 10. Knowledge Updater    — Updates KB from resolved tickets to improve L1 auto-resolution
 */

import { EventEmitter } from 'events';
import type {
  OutreachType, OutreachChannel, UpdateTriggerType,
  LifecyclePhase, Lead, LeadOutreach, LifecycleOutreachRule,
} from './types';
import { DEFAULT_LIFECYCLE_RULES } from './types';
import type { ExamType } from '../users/types';
import { managerService } from './service';

export interface NexusTaskResult {
  subAgent: string;
  action: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  success: boolean;
  message?: string;
}

// ─── Sub-agent definitions (metadata) ────────────────────────────────────────

export const NEXUS_SUB_AGENTS = [
  {
    id: 'ticket-router',
    name: 'Ticket Router',
    emoji: '🎯',
    description: 'Routes L2-escalated tickets to the correct exam-scoped manager using load balancing and CSAT scoring.',
    triggers: ['ticket:l2_escalated', 'nexus:route_ticket'],
    inputs: ['ticketId', 'examId', 'priority', 'category'],
    outputs: ['ManagerTicketAssignment'],
    impactedAgents: ['Manager Dashboard', 'Forge (SLA Monitor)', 'Oracle (Routing Analytics)'],
  },
  {
    id: 'at-risk-detector',
    name: 'At-Risk Detector',
    emoji: '⚠️',
    description: 'Scans student activity logs every 6h. Flags students inactive > threshold days, declining scores, or near exam with low mock-test scores.',
    triggers: ['cron:6h', 'student:inactive_detected', 'score:dropped'],
    inputs: ['studentId', 'examId', 'inactiveDays', 'recentScore'],
    outputs: ['at_risk_alert → manager', 'proactive_outreach → Outreach Composer'],
    impactedAgents: ['Mentor (Streak Coach)', 'Oracle (Retention Analytics)', 'Manager Outreach'],
  },
  {
    id: 'outreach-composer',
    name: 'Outreach Composer',
    emoji: '✉️',
    description: 'Drafts personalised outreach messages for each OutreachType × channel combination. Localises for Hindi/Hinglish if preferred language is set.',
    triggers: ['nexus:outreach_requested', 'at-risk-detector:alert'],
    inputs: ['studentId', 'outreachType', 'channel', 'studentProfile', 'examId'],
    outputs: ['OutreachMessage → WhatsApp/Email/Telegram/In-App/SMS'],
    impactedAgents: ['WhatsApp Handler', 'Telegram Handler', 'SendGrid/Resend', 'Mentor (Reminder)'],
  },
  {
    id: 'update-dispatcher',
    name: 'Update Dispatcher',
    emoji: '🚀',
    description: 'Translates manager update triggers into agent tasks. Content fixes → Atlas. Deploy changes → Forge. Prompt updates → Sage. Pricing → Herald.',
    triggers: ['update:triggered', 'update:approved'],
    inputs: ['ManagerUpdateTrigger'],
    outputs: ['Atlas task | Forge deploy | Sage prompt patch | Herald pricing update'],
    impactedAgents: ['Atlas (Content Factory)', 'Forge (Deployment)', 'Sage (Tutor Prompt)', 'Herald (Pricing)'],
  },
  {
    id: 'resolution-suggester',
    name: 'Resolution Suggester',
    emoji: '💡',
    description: 'When manager opens a ticket, queries knowledge base + similar past tickets to suggest a resolution draft.',
    triggers: ['ticket:assigned_to_manager', 'manager:ticket_opened'],
    inputs: ['ticketId', 'category', 'examId', 'description'],
    outputs: ['resolution_suggestion → Manager Dashboard'],
    impactedAgents: ['Sage (Knowledge Base)', 'Atlas (Content Checker)', 'Manager Dashboard'],
  },
  {
    id: 'csat-monitor',
    name: 'CSAT Monitor',
    emoji: '📈',
    description: 'Tracks per-manager CSAT scores. Alerts admin if any manager drops below threshold (< 3.5/5). Sends weekly CSAT digest to CEO/Admin.',
    triggers: ['ticket:manager_resolved', 'cron:weekly'],
    inputs: ['managerId', 'satisfactionRating', 'ticketId'],
    outputs: ['csat_alert → admin | weekly_digest → CEO'],
    impactedAgents: ['Oracle (CSAT Analytics)', 'Admin Dashboard', 'Herald (Report)'],
  },
  {
    id: 'broadcast-planner',
    name: 'Broadcast Planner',
    emoji: '📢',
    description: 'Plans and schedules exam-scoped announcements (exam date change, new syllabus, result release). Delivers via all connected channels of affected students.',
    triggers: ['manager:broadcast_requested', 'nexus:exam_announcement'],
    inputs: ['examId', 'messageText', 'channels', 'scheduleAt'],
    outputs: ['bulk outreach → all students in exam scope'],
    impactedAgents: ['WhatsApp Handler', 'Telegram Handler', 'Herald (Email)', 'Push Notifier'],
  },
  {
    id: 'churn-rescue',
    name: 'Churn Rescue',
    emoji: '🔄',
    description: 'Detects students whose subscription expires in ≤7 days and who have been inactive. Triggers personalised retention outreach with plan benefits reminder.',
    triggers: ['subscription:expiring_soon', 'cron:daily'],
    inputs: ['studentId', 'planExpiresAt', 'lastActiveAt', 'examId'],
    outputs: ['retention_outreach → Outreach Composer → manager_approval'],
    impactedAgents: ['Herald (Subscription Manager)', 'Mentor (Re-engagement)', 'Oracle (Churn Analytics)'],
  },
  {
    id: 'escalation-guard',
    name: 'Escalation Guard',
    emoji: '🚨',
    description: 'Monitors open manager tickets every 15min. Sends urgent Telegram/WhatsApp nudge to manager when ticket is within 30min of SLA breach.',
    triggers: ['cron:15min', 'ticket:sla_warning'],
    inputs: ['managerId', 'ticketId', 'dueAt'],
    outputs: ['sla_nudge → manager_channels', 'auto_escalate → admin if still unresolved'],
    impactedAgents: ['Manager WhatsApp/Telegram', 'Admin Dashboard', 'Oracle (SLA Tracking)'],
  },
  {
    id: 'knowledge-updater',
    name: 'Knowledge Updater',
    emoji: '📚',
    description: 'After a manager resolves a ticket, extracts the resolution pattern and adds it to the L1 knowledge base so similar future tickets are auto-resolved.',
    triggers: ['ticket:manager_resolved'],
    inputs: ['ticketId', 'category', 'examId', 'resolution', 'internalNote'],
    outputs: ['KB entry → Atlas', 'L1 confidence improvement'],
    impactedAgents: ['Atlas (Quality Checker)', 'Sage (Doubt Resolver)', 'L1 Auto-Resolution'],
  },
  // ── LIFECYCLE AGENTS (Acquisition → Onboarding → Delivery) ───────────────
  {
    id: 'lead-nurture-engine',
    name: 'Lead Nurture Engine',
    emoji: '🌱',
    description: 'Manages the full acquisition funnel: captures leads from all sources (ad clicks, form submissions, referrals, WhatsApp links), runs them through a personalised multi-touch drip sequence, and hands off converted users to the Onboarding Activator. Coordinates with Herald for campaign messaging.',
    triggers: ['lead:captured', 'lead:contacted', 'lead:trial_started', 'cron:daily_lead_followup'],
    inputs: ['leadId', 'source', 'targetExam', 'touchCount', 'status'],
    outputs: ['drip outreach via Herald → WhatsApp/Email', 'trial_invite', 'converted → onboarding'],
    impactedAgents: ['Herald (Campaign Manager)', 'Manager Dashboard', 'Oracle (Funnel Analytics)'],
    lifecyclePhase: 'acquisition' as LifecyclePhase,
  },
  {
    id: 'onboarding-activator',
    name: 'Onboarding Activator',
    emoji: '🚀',
    description: 'Drives new users from signup to first-value. Tracks onboarding step completion, sends nudges for blocked steps (exam not configured, profile incomplete), triggers first study session invite, and introduces parents/teachers. Coordinates with Mentor for personalised activation.',
    triggers: ['user:signed_up', 'onboarding:step_stuck', 'onboarding:incomplete', 'user:parent_linked', 'teacher:cohort_assigned'],
    inputs: ['userId', 'onboardingStep', 'completedSteps', 'examId', 'userType'],
    outputs: ['step nudge → in-app/WhatsApp', 'first_session_invite', 'parent_intro', 'teacher_intro'],
    impactedAgents: ['Mentor (Engagement Coach)', 'Sage (First Tutoring Session)', 'Manager Dashboard'],
    lifecyclePhase: 'onboarding' as LifecyclePhase,
  },
  {
    id: 'delivery-cadence-manager',
    name: 'Delivery Cadence Manager',
    emoji: '📅',
    description: 'Maintains active learning momentum for enrolled students. Sends daily study reminders, exam countdown nudges, live-session prep briefs, weekly mock test invites, and topic completion nudges. Escalates to Nexus when score drops or session attendance falls. Coordinates with Sage for content-aware messaging.',
    triggers: ['cron:daily_9am', 'exam:days_remaining_30', 'exam:days_remaining_7', 'session:scheduled', 'cron:weekly_mock', 'student:topic_incomplete_3d'],
    inputs: ['studentId', 'examId', 'daysToExam', 'sessionScheduledAt', 'topicsPending'],
    outputs: ['daily_reminder', 'exam_countdown', 'live_session_prep', 'mock_test_invite', 'topic_nudge'],
    impactedAgents: ['Sage (Tutor)', 'Mentor (Streak Coach)', 'Atlas (Content)', 'Oracle (Attendance Analytics)'],
    lifecyclePhase: 'delivery' as LifecyclePhase,
  },
  {
    id: 'lifecycle-rule-engine',
    name: 'Lifecycle Rule Engine',
    emoji: '⚙️',
    description: 'The master coordinator across all lifecycle phases. Evaluates incoming events against DEFAULT_LIFECYCLE_RULES + custom rules, determines the right outreach type, channel, timing, and owner agent, then dispatches to the correct sub-agent (Herald/Mentor/Sage/Nexus). Prevents duplicate outreach and respects quiet hours.',
    triggers: ['*:lifecycle_event'],
    inputs: ['event', 'userId or leadId', 'metadata'],
    outputs: ['dispatched outreach → correct agent', 'dedup check', 'quiet hours enforcement'],
    impactedAgents: ['All agents', 'Manager Dashboard (Outreach Log)'],
    lifecyclePhase: undefined,
  },
] as const;

// ─── Nexus Agent ──────────────────────────────────────────────────────────────

export class NexusAgent extends EventEmitter {
  private log: NexusTaskResult[] = [];

  constructor() {
    super();
    this.registerListeners();
  }

  private registerListeners() {
    // Ticket Router
    this.on('nexus:route_ticket', async (payload) => {
      try {
        const assignment = await managerService.routeTicket(
          payload.ticketId, payload.examId, payload.priority, payload.category,
        );
        this.record('ticket-router', 'route_ticket', payload, true,
          assignment ? `Routed to manager ${assignment.managerId}` : 'No eligible manager found');
        if (assignment) this.emit('nexus:ticket_routed', assignment);
      } catch (err: any) {
        this.record('ticket-router', 'route_ticket', payload, false, err.message);
      }
    });

    // At-Risk detection result → trigger outreach
    this.on('nexus:at_risk_detected', async (payload: { managerId: string; studentId: string; reason: string; examId: ExamType }) => {
      const mgr = await managerService.getManager(payload.managerId);
      if (!mgr) return;
      mgr.metrics.atRiskStudentsIntervened++;

      // Select best channel for this student
      const channel = this.selectChannel(mgr.outreachSettings.preferredChannels, payload.studentId);
      this.emit('nexus:outreach_requested', {
        managerId: payload.managerId,
        studentId: payload.studentId,
        type: 'at_risk_alert' as OutreachType,
        channel,
        examId: payload.examId,
      });
      this.record('at-risk-detector', 'detected', payload, true, `Outreach queued via ${channel}`);
    });

    // Update approved → dispatch to atlas/forge
    this.on('nexus:update_approved', async (trigger) => {
      const agentMap: Record<string, string> = {
        content_fix: 'atlas',
        syllabus_update: 'atlas',
        agent_prompt_update: 'sage',
        exam_date_change: 'atlas',
        difficulty_recalibrate: 'sage',
        feature_flag_toggle: 'forge',
        batch_reassign: 'forge',
        pricing_update: 'herald',
      };
      const agent = agentMap[trigger.type] ?? 'forge';
      this.emit(`nexus:task_for_${agent}`, { trigger });
      this.record('update-dispatcher', 'dispatch', trigger, true, `Dispatched to ${agent}`);
    });

    // Ticket resolved → update KB
    this.on('nexus:ticket_resolved', (payload) => {
      this.emit('nexus:kb_update_requested', payload);
      this.record('knowledge-updater', 'kb_update', payload, true, 'KB update queued');
    });

    // ── LIFECYCLE RULE ENGINE ────────────────────────────────────────────────
    // All lifecycle events flow through here first
    this.on('nexus:lifecycle_event', (payload: { event: string; id: string; type: 'lead' | 'user'; metadata: Record<string, unknown> }) => {
      const matchingRules = DEFAULT_LIFECYCLE_RULES.filter(r => r.triggerEvent === payload.event && r.enabled);
      for (const rule of matchingRules) {
        const dispatchAt = rule.delayHours >= 0
          ? new Date(Date.now() + rule.delayHours * 3600000)
          : new Date(Date.now()); // negative = immediate (for relative events like trial expiry)
        this.emit(`nexus:lifecycle_dispatch`, {
          rule,
          id: payload.id,
          type: payload.type,
          metadata: payload.metadata,
          dispatchAt,
        });
        this.record('lifecycle-rule-engine', 'dispatch', { rule: rule.templateKey, event: payload.event }, true,
          `Dispatched ${rule.outreachType} via ${rule.ownerAgent} at +${rule.delayHours}h`);
      }
    });

    // ── ACQUISITION: Lead Nurture Engine ─────────────────────────────────────
    this.on('nexus:lead_captured', (lead: { id: string; source: string; targetExam: string; phone?: string; email?: string }) => {
      // Trigger acquisition drip via Herald
      this.emit('nexus:lifecycle_event', { event: 'lead:captured', id: lead.id, type: 'lead', metadata: lead });
      this.record('lead-nurture-engine', 'lead_captured', lead, true,
        `Acquisition drip started for lead ${lead.id} (${lead.source} → ${lead.targetExam})`);
    });

    this.on('nexus:lead_trial_started', (lead: { id: string; trialEndsAt: string }) => {
      this.emit('nexus:lifecycle_event', { event: 'lead:trial_started', id: lead.id, type: 'lead', metadata: lead });
      this.record('lead-nurture-engine', 'trial_started', lead, true, `Trial expiry nudge scheduled`);
    });

    this.on('nexus:lead_converted', (payload: { leadId: string; userId: string; examId: string }) => {
      // Lead → User: hand off to Onboarding Activator
      this.emit('nexus:lifecycle_event', { event: 'user:signed_up', id: payload.userId, type: 'user', metadata: payload });
      this.record('lead-nurture-engine', 'lead_converted', payload, true,
        `Lead ${payload.leadId} converted → user ${payload.userId}. Onboarding activated.`);
    });

    this.on('nexus:referral_given', (payload: { referrerId: string; referredPhone?: string; referredEmail?: string; examId: string }) => {
      this.emit('nexus:lifecycle_event', { event: 'user:referral_given', id: payload.referrerId, type: 'user', metadata: payload });
      // Also start a new lead capture for the referred contact
      if (payload.referredPhone || payload.referredEmail) {
        const newLead = { id: `lead_ref_${Date.now()}`, source: 'referral', targetExam: payload.examId, phone: payload.referredPhone, email: payload.referredEmail };
        this.emit('nexus:lead_captured', newLead);
      }
      this.record('lead-nurture-engine', 'referral_triggered', payload, true, 'Referral invite + new lead created');
    });

    // ── ONBOARDING: Onboarding Activator ─────────────────────────────────────
    this.on('nexus:user_signed_up', (payload: { userId: string; examId?: string; userType: 'student' | 'teacher' | 'parent' }) => {
      this.emit('nexus:lifecycle_event', { event: 'user:signed_up', id: payload.userId, type: 'user', metadata: payload });
      this.record('onboarding-activator', 'user_signed_up', payload, true,
        `Welcome + first session invite queued for ${payload.userType} ${payload.userId}`);
    });

    this.on('nexus:onboarding_step_stuck', (payload: { userId: string; step: string; stuckHours: number }) => {
      if (payload.stuckHours >= 6) {
        this.emit('nexus:lifecycle_event', { event: 'onboarding:step_stuck', id: payload.userId, type: 'user', metadata: payload });
        this.record('onboarding-activator', 'step_nudge', payload, true,
          `Nudge sent for stuck onboarding step: ${payload.step}`);
      }
    });

    this.on('nexus:parent_linked', (payload: { userId: string; parentPhone?: string; parentEmail?: string }) => {
      this.emit('nexus:lifecycle_event', { event: 'user:parent_linked', id: payload.userId, type: 'user', metadata: payload });
      this.record('onboarding-activator', 'parent_linked', payload, true, 'Parent intro outreach queued');
    });

    this.on('nexus:teacher_cohort_assigned', (payload: { teacherId: string; cohortId: string; examId: string }) => {
      this.emit('nexus:lifecycle_event', { event: 'teacher:cohort_assigned', id: payload.teacherId, type: 'user', metadata: payload });
      this.record('onboarding-activator', 'teacher_intro', payload, true, 'Teacher cohort welcome queued');
    });

    // ── DELIVERY: Cadence Manager ─────────────────────────────────────────────
    this.on('nexus:exam_countdown', (payload: { studentId: string; examId: string; daysRemaining: number }) => {
      const event = payload.daysRemaining <= 7  ? 'exam:days_remaining_7'
                  : payload.daysRemaining <= 30 ? 'exam:days_remaining_30'
                  : null;
      if (event) {
        this.emit('nexus:lifecycle_event', { event, id: payload.studentId, type: 'user', metadata: payload });
        this.record('delivery-cadence-manager', 'exam_countdown', payload, true,
          `Exam countdown nudge (${payload.daysRemaining}d) queued for ${payload.studentId}`);
      }
    });

    this.on('nexus:session_scheduled', (payload: { studentId: string; sessionAt: string; examId: string }) => {
      this.emit('nexus:lifecycle_event', { event: 'session:scheduled', id: payload.studentId, type: 'user', metadata: payload });
      this.record('delivery-cadence-manager', 'session_prep', payload, true, 'Live session prep brief scheduled -1h');
    });

    this.on('nexus:milestone_hit', (payload: { studentId: string; milestone: string; examId: string }) => {
      this.emit('nexus:lifecycle_event', { event: 'student:milestone_hit', id: payload.studentId, type: 'user', metadata: payload });
      this.record('delivery-cadence-manager', 'milestone_celebration', payload, true,
        `Milestone celebration: ${payload.milestone}`);
    });

    // ── RETENTION: upsell + referral ─────────────────────────────────────────
    this.on('nexus:feature_gate_hit', (payload: { userId: string; featureKey: string; currentPlan: string }) => {
      this.emit('nexus:lifecycle_event', { event: 'user:feature_gate_hit', id: payload.userId, type: 'user', metadata: payload });
      this.record('lifecycle-rule-engine', 'upsell_triggered', payload, true,
        `Upsell nudge for ${payload.featureKey} (plan: ${payload.currentPlan})`);
    });

    this.on('nexus:high_csat', (payload: { userId: string; csat: number }) => {
      if (payload.csat >= 4.5) {
        this.emit('nexus:lifecycle_event', { event: 'student:csat_above_4.5', id: payload.userId, type: 'user', metadata: payload });
        this.record('lifecycle-rule-engine', 'referral_triggered', payload, true,
          `Happy user → referral prompt queued (CSAT ${payload.csat})`);
      }
    });
  }

  private selectChannel(preferred: OutreachChannel[], _studentId: string): OutreachChannel {
    // In production: check which channels student has verified
    return preferred[0] ?? 'email';
  }

  private record(subAgent: string, action: string, payload: any, success: boolean, message?: string) {
    this.log.push({ subAgent, action, payload, timestamp: new Date(), success, message });
    if (this.log.length > 1000) this.log.shift();
  }

  getLog(limit = 50) {
    return this.log.slice(-limit);
  }

  getSubAgents() {
    return NEXUS_SUB_AGENTS;
  }

  // ── Public lifecycle API ─────────────────────────────────────────────────

  /** Call when a new lead is captured from any source */
  captureLead(lead: { id: string; source: string; targetExam: string; phone?: string; email?: string }) {
    this.emit('nexus:lead_captured', lead);
  }

  /** Call when a lead starts a free trial */
  leadStartedTrial(leadId: string, trialEndsAt: Date) {
    this.emit('nexus:lead_trial_started', { id: leadId, trialEndsAt: trialEndsAt.toISOString() });
  }

  /** Call when a lead converts to a paid/registered user */
  leadConverted(leadId: string, userId: string, examId: string) {
    this.emit('nexus:lead_converted', { leadId, userId, examId });
  }

  /** Call when a user completes signup */
  userSignedUp(userId: string, examId: string | undefined, userType: 'student' | 'teacher' | 'parent') {
    this.emit('nexus:user_signed_up', { userId, examId, userType });
  }

  /** Call when user is stuck on an onboarding step */
  onboardingStepStuck(userId: string, step: string, stuckHours: number) {
    this.emit('nexus:onboarding_step_stuck', { userId, step, stuckHours });
  }

  /** Call when a session is scheduled for a student */
  sessionScheduled(studentId: string, sessionAt: Date, examId: string) {
    this.emit('nexus:session_scheduled', { studentId, sessionAt: sessionAt.toISOString(), examId });
  }

  /** Call when exam countdown milestone reached */
  examCountdown(studentId: string, examId: string, daysRemaining: number) {
    this.emit('nexus:exam_countdown', { studentId, examId, daysRemaining });
  }

  /** Call when student hits a learning milestone */
  milestoneHit(studentId: string, milestone: string, examId: string) {
    this.emit('nexus:milestone_hit', { studentId, milestone, examId });
  }

  /** Call when a user hits a feature gate */
  featureGateHit(userId: string, featureKey: string, currentPlan: string) {
    this.emit('nexus:feature_gate_hit', { userId, featureKey, currentPlan });
  }

  /** Call when a user submits a high CSAT rating */
  csatReceived(userId: string, csat: number) {
    this.emit('nexus:high_csat', { userId, csat });
  }

  /** Call when a referral is triggered by a user */
  referralTriggered(referrerId: string, referredPhone?: string, referredEmail?: string, examId?: string) {
    this.emit('nexus:referral_given', { referrerId, referredPhone, referredEmail, examId: examId ?? '' });
  }

  /** Get active lifecycle rules */
  getLifecycleRules() {
    return DEFAULT_LIFECYCLE_RULES;
  }

  /** Get rules grouped by lifecycle phase */
  getLifecycleRulesByPhase() {
    const phases = ['acquisition', 'onboarding', 'delivery', 'retention', 'support'] as const;
    return Object.fromEntries(
      phases.map(phase => [phase, DEFAULT_LIFECYCLE_RULES.filter(r => r.phase === phase)])
    ) as Record<string, typeof DEFAULT_LIFECYCLE_RULES[number][]>;
  }
}

export const nexusAgent = new NexusAgent();
