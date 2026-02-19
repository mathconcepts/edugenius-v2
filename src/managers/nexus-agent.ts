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
} from './types';
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
}

export const nexusAgent = new NexusAgent();
