/**
 * EduGenius Feedback Service
 * Core ticket lifecycle: create, classify, L1, quality-check, escalate, resolve
 */

import { EventEmitter } from 'events';
import { classifyTicket, scoreComplaintQuality, getL1ConfidenceThreshold } from './classifier';
import type {
  FeedbackTicket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  AuditEntry,
  L1Response,
  L2Response,
  Resolution,
  SLAConfig,
  TicketStats,
  CreateTicketInput,
  SearchTicketsFilter,
  L1QualityCheckResult,
} from './types';

// ============================================================
// SLA CONFIGURATION
// ============================================================

export const SLA_CONFIG: Record<TicketPriority, SLAConfig> = {
  critical: {
    priority: 'critical',
    l1MaxMinutes: 15,
    l2MaxMinutes: 60,
    autoEscalateAfterMinutes: 10,
  },
  high: {
    priority: 'high',
    l1MaxMinutes: 60,
    l2MaxMinutes: 240,
    autoEscalateAfterMinutes: 45,
  },
  medium: {
    priority: 'medium',
    l1MaxMinutes: 240,
    l2MaxMinutes: 1440,
    autoEscalateAfterMinutes: 180,
  },
  low: {
    priority: 'low',
    l1MaxMinutes: 1440,
    l2MaxMinutes: 4320,
    autoEscalateAfterMinutes: 1200,
  },
};

// ============================================================
// TICKET ID GENERATOR
// ============================================================

let ticketCounter = 1;

function generateTicketId(): string {
  const year = new Date().getFullYear();
  const seq = String(ticketCounter++).padStart(6, '0');
  return `TKT-${year}-${seq}`;
}

function generateAuditId(): string {
  return `aud_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
}

// ============================================================
// FEEDBACK SERVICE
// ============================================================

export class FeedbackService {
  private tickets: Map<string, FeedbackTicket> = new Map();
  private events: EventEmitter = new EventEmitter();

  // --------------------------------------------------------
  // CREATE TICKET
  // --------------------------------------------------------

  async createTicket(
    userId: string,
    input: CreateTicketInput
  ): Promise<FeedbackTicket> {
    const now = new Date();

    // Auto-classify if category not provided
    const classification = input.category
      ? { category: input.category, priority: 'medium' as TicketPriority, tags: [], subcategory: undefined }
      : classifyTicket(input.title, input.description);

    const quality = scoreComplaintQuality(input.title, input.description);

    // Override priority upward if urgency detected
    let priority = (classification as any).priority ?? 'medium';
    if (quality.urgency === 'urgent' && priority !== 'critical') priority = 'high';

    const sla = SLA_CONFIG[priority as TicketPriority];
    const l1DueAt = new Date(now.getTime() + sla.l1MaxMinutes * 60 * 1000);

    const ticket: FeedbackTicket = {
      id: generateTicketId(),
      userId,
      examId: input.examId,
      subject: input.subject,
      type: input.type,
      category: (input.category ?? (classification as any).category) as TicketCategory,
      subcategory: input.subcategory ?? (classification as any).subcategory,
      title: input.title,
      description: input.description,
      attachments: input.attachments ?? [],
      metadata: {
        page: input.metadata?.page ?? 'unknown',
        sessionId: input.metadata?.sessionId,
        agentId: input.metadata?.agentId,
        questionId: input.metadata?.questionId,
        chatMessageId: input.metadata?.chatMessageId,
        browserInfo: input.metadata?.browserInfo,
        timestamp: now,
      },
      priority: priority as TicketPriority,
      quality,
      tags: (classification as any).tags ?? [],
      sla: {
        l1DeadlineMinutes: sla.l1MaxMinutes,
        l2DeadlineMinutes: sla.l2MaxMinutes,
        l1DueAt,
        breached: false,
      },
      auditTrail: [],
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };

    // First audit entry
    this.addAuditEntry(ticket, {
      actor: 'system',
      actorId: 'system',
      actorName: 'EduGenius System',
      action: 'ticket_created',
      details: `Ticket created. Category: ${ticket.category}. Priority: ${ticket.priority}. Quality score: ${quality.score}/100.`,
      newStatus: 'open',
    });

    this.tickets.set(ticket.id, ticket);
    this.events.emit('ticket:created', ticket);

    // Auto-submit to L1 processing
    setTimeout(() => this.submitToL1(ticket.id), 1000);

    return ticket;
  }

  // --------------------------------------------------------
  // L1 PROCESSING
  // --------------------------------------------------------

  async submitToL1(ticketId: string): Promise<void> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket || ticket.status !== 'open') return;

    ticket.status = 'l1_processing';
    ticket.updatedAt = new Date();

    this.addAuditEntry(ticket, {
      actor: 'system',
      actorId: 'system',
      actorName: 'EduGenius System',
      action: 'l1_submitted',
      details: `Ticket routed to L1 AI agent for category: ${ticket.category}`,
      previousStatus: 'open',
      newStatus: 'l1_processing',
    });

    this.events.emit('ticket:l1_submitted', ticket);
  }

  async recordL1Response(
    ticketId: string,
    response: Omit<L1Response, 'qualityCheckPassed' | 'qualityCheckDetails'>
  ): Promise<{ escalate: boolean; reason?: string }> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) throw new Error(`Ticket ${ticketId} not found`);

    const qualityCheck = this.checkL1Quality(ticket, response);

    const fullResponse: L1Response = {
      ...response,
      completedAt: new Date(),
      qualityCheckPassed: qualityCheck.passed,
      qualityCheckDetails: qualityCheck.reason,
    };

    ticket.l1Response = fullResponse;
    ticket.updatedAt = new Date();

    if (qualityCheck.passed && response.resolutionType !== 'escalated') {
      // L1 resolved successfully
      ticket.status = 'l1_resolved';

      this.addAuditEntry(ticket, {
        actor: 'ai_l1',
        actorId: response.agentId,
        actorName: `${response.agentId.charAt(0).toUpperCase() + response.agentId.slice(1)} Agent`,
        action: 'l1_resolved',
        details: `L1 resolved. Confidence: ${response.confidenceScore}%. Quality check passed: ${qualityCheck.reason}`,
        previousStatus: 'l1_processing',
        newStatus: 'l1_resolved',
      });

      this.events.emit('ticket:l1_resolved', ticket);
      return { escalate: false };
    } else {
      // Escalate to L2
      const reason = response.escalationReason ?? qualityCheck.reason;
      await this.escalateToL2(ticketId, reason);
      return { escalate: true, reason };
    }
  }

  // --------------------------------------------------------
  // L1 QUALITY CHECK
  // --------------------------------------------------------

  checkL1Quality(
    ticket: FeedbackTicket,
    l1Response: Omit<L1Response, 'qualityCheckPassed' | 'qualityCheckDetails'>
  ): L1QualityCheckResult {
    const threshold = getL1ConfidenceThreshold(ticket.priority);

    // Payment issues always need human review
    if (ticket.category === 'payment_issue' && l1Response.confidenceScore < 95) {
      return {
        passed: false,
        reason: 'Payment issues require human verification regardless of confidence',
        confidenceThresholdRequired: 95,
        confidenceAchieved: l1Response.confidenceScore,
      };
    }

    if (l1Response.resolutionType === 'escalated') {
      return {
        passed: false,
        reason: l1Response.escalationReason ?? 'Agent chose to escalate',
        confidenceThresholdRequired: threshold,
        confidenceAchieved: l1Response.confidenceScore,
      };
    }

    if (l1Response.confidenceScore < threshold) {
      return {
        passed: false,
        reason: `Confidence ${l1Response.confidenceScore}% below required ${threshold}% for ${ticket.priority} priority`,
        confidenceThresholdRequired: threshold,
        confidenceAchieved: l1Response.confidenceScore,
      };
    }

    // Check response length proportionality
    const descWords = ticket.description.split(' ').length;
    const respWords = l1Response.response.split(' ').length;
    if (descWords > 50 && respWords < 30) {
      return {
        passed: false,
        reason: 'Response too brief for complex complaint — needs more detail',
        confidenceThresholdRequired: threshold,
        confidenceAchieved: l1Response.confidenceScore,
      };
    }

    return {
      passed: true,
      reason: `Confidence ${l1Response.confidenceScore}% meets threshold ${threshold}%. Response adequate.`,
      confidenceThresholdRequired: threshold,
      confidenceAchieved: l1Response.confidenceScore,
    };
  }

  // --------------------------------------------------------
  // L2 ESCALATION
  // --------------------------------------------------------

  async escalateToL2(ticketId: string, reason: string): Promise<void> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) throw new Error(`Ticket ${ticketId} not found`);

    const now = new Date();
    const sla = SLA_CONFIG[ticket.priority];
    const l2DueAt = new Date(now.getTime() + sla.l2MaxMinutes * 60 * 1000);

    ticket.status = 'l2_escalated';
    ticket.sla.l2DueAt = l2DueAt;
    ticket.updatedAt = now;

    this.addAuditEntry(ticket, {
      actor: 'system',
      actorId: 'system',
      actorName: 'EduGenius System',
      action: 'l2_escalated',
      details: `Escalated to human (L2). Reason: ${reason}. L2 SLA: ${sla.l2MaxMinutes} minutes.`,
      previousStatus: 'l1_processing',
      newStatus: 'l2_escalated',
      metadata: { escalationReason: reason, l2DueAt },
    });

    this.events.emit('ticket:l2_escalated', ticket);
  }

  // --------------------------------------------------------
  // USER ACTIONS
  // --------------------------------------------------------

  async markUserSatisfied(ticketId: string, userId: string): Promise<void> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket || ticket.userId !== userId) throw new Error('Ticket not found');

    const now = new Date();
    ticket.status = 'resolved';
    ticket.resolvedAt = now;
    ticket.updatedAt = now;
    ticket.resolution = {
      summary: 'User confirmed satisfied with L1 resolution',
      resolvedBy: 'ai',
      resolutionType: 'user_confirmed',
      knowledgeBaseUpdated: false,
    };

    this.addAuditEntry(ticket, {
      actor: 'user',
      actorId: userId,
      actorName: 'User',
      action: 'user_satisfied',
      details: 'User confirmed the L1 resolution resolved their issue.',
      previousStatus: 'l1_resolved',
      newStatus: 'resolved',
    });

    this.events.emit('ticket:resolved', ticket);
  }

  async userEscalateToL2(ticketId: string, userId: string, reason: string): Promise<void> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket || ticket.userId !== userId) throw new Error('Ticket not found');

    this.addAuditEntry(ticket, {
      actor: 'user',
      actorId: userId,
      actorName: 'User',
      action: 'user_escalated',
      details: `User not satisfied with L1 response. Reason: ${reason}`,
      previousStatus: ticket.status,
      newStatus: 'l2_escalated',
    });

    await this.escalateToL2(ticketId, `User not satisfied: ${reason}`);
  }

  async recordSatisfactionRating(
    ticketId: string,
    userId: string,
    rating: number,
    comment?: string
  ): Promise<void> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket || ticket.userId !== userId) throw new Error('Ticket not found');

    ticket.satisfactionRating = Math.min(5, Math.max(1, rating));
    ticket.satisfactionComment = comment;
    ticket.updatedAt = new Date();

    this.addAuditEntry(ticket, {
      actor: 'user',
      actorId: userId,
      actorName: 'User',
      action: 'satisfaction_rated',
      details: `User rated resolution ${rating}/5. Comment: ${comment ?? 'none'}`,
      metadata: { rating, comment },
    });

    this.events.emit('ticket:rated', { ticket, rating, comment });
  }

  // --------------------------------------------------------
  // HUMAN (L2) ACTIONS
  // --------------------------------------------------------

  async assignToHuman(ticketId: string, humanId: string, humanName: string): Promise<void> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) throw new Error(`Ticket ${ticketId} not found`);

    ticket.status = 'l2_processing';
    ticket.l2Response = {
      assignedTo: humanId,
      assignedAt: new Date(),
      resolution: 'resolved',
    };
    ticket.updatedAt = new Date();

    this.addAuditEntry(ticket, {
      actor: 'human_agent',
      actorId: humanId,
      actorName: humanName,
      action: 'l2_assigned',
      details: `Ticket assigned to ${humanName} for human resolution.`,
      previousStatus: 'l2_escalated',
      newStatus: 'l2_processing',
    });

    this.events.emit('ticket:l2_assigned', { ticket, humanId, humanName });
  }

  async recordL2Response(
    ticketId: string,
    humanId: string,
    humanName: string,
    response: string,
    resolution: L2Response['resolution'],
    internalNote?: string,
    actionTaken?: string
  ): Promise<void> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) throw new Error(`Ticket ${ticketId} not found`);

    const now = new Date();

    ticket.l2Response = {
      ...(ticket.l2Response ?? {}),
      assignedTo: humanId,
      respondedAt: now,
      response,
      internalNote,
      actionTaken,
      resolution,
      closedBy: humanId,
    };

    const newStatus: TicketStatus = resolution === 'resolved' ? 'resolved' : 'closed';
    ticket.status = newStatus;
    ticket.resolvedAt = now;
    ticket.updatedAt = now;
    ticket.resolution = {
      summary: response,
      resolvedBy: 'human',
      resolutionType: resolution,
      preventionAction: actionTaken,
      knowledgeBaseUpdated: false,
    };

    this.addAuditEntry(ticket, {
      actor: 'human_agent',
      actorId: humanId,
      actorName: humanName,
      action: 'l2_resolved',
      details: `Human resolved. Resolution: ${resolution}. ${internalNote ? 'Internal note added.' : ''}`,
      previousStatus: 'l2_processing',
      newStatus,
      metadata: { resolution, actionTaken },
    });

    this.events.emit('ticket:resolved', ticket);
  }

  // --------------------------------------------------------
  // AUDIT
  // --------------------------------------------------------

  private addAuditEntry(
    ticket: FeedbackTicket,
    entry: Omit<AuditEntry, 'id' | 'ticketId' | 'timestamp'>
  ): void {
    const auditEntry: AuditEntry = {
      id: generateAuditId(),
      ticketId: ticket.id,
      timestamp: new Date(),
      ...entry,
    };
    ticket.auditTrail.push(auditEntry);
  }

  // --------------------------------------------------------
  // SLA
  // --------------------------------------------------------

  async checkSLABreaches(): Promise<void> {
    const now = new Date();

    for (const ticket of this.tickets.values()) {
      if (['resolved', 'closed', 'rejected'].includes(ticket.status)) continue;

      const isL1Stage = ['open', 'l1_processing', 'l1_resolved'].includes(ticket.status);
      const isL2Stage = ['l2_escalated', 'l2_processing'].includes(ticket.status);

      if (isL1Stage && now > ticket.sla.l1DueAt && !ticket.sla.breached) {
        ticket.sla.breached = true;
        ticket.sla.breachedAt = now;

        this.addAuditEntry(ticket, {
          actor: 'system',
          actorId: 'system',
          actorName: 'SLA Monitor',
          action: 'sla_breached',
          details: `L1 SLA breached. Was due at ${ticket.sla.l1DueAt.toISOString()}. Auto-escalating to L2.`,
          metadata: { stage: 'l1', dueAt: ticket.sla.l1DueAt },
        });

        await this.escalateToL2(ticket.id, 'L1 SLA breach — auto-escalated');
        this.events.emit('ticket:sla_breached', { ticket, stage: 'l1' });
      }

      if (isL2Stage && ticket.sla.l2DueAt && now > ticket.sla.l2DueAt) {
        if (!ticket.sla.breached) {
          ticket.sla.breached = true;
          ticket.sla.breachedAt = now;
        }

        this.addAuditEntry(ticket, {
          actor: 'system',
          actorId: 'system',
          actorName: 'SLA Monitor',
          action: 'l2_sla_breached',
          details: `L2 SLA breached. Alerting human team.`,
        });

        this.events.emit('ticket:l2_sla_breached', ticket);
      }
    }
  }

  // --------------------------------------------------------
  // QUERY
  // --------------------------------------------------------

  async getTicket(ticketId: string): Promise<FeedbackTicket | null> {
    return this.tickets.get(ticketId) ?? null;
  }

  async getUserTickets(userId: string): Promise<FeedbackTicket[]> {
    return Array.from(this.tickets.values())
      .filter((t) => t.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getPendingL2Tickets(): Promise<FeedbackTicket[]> {
    return Array.from(this.tickets.values())
      .filter((t) => t.status === 'l2_escalated' || t.status === 'l2_processing')
      .sort((a, b) => {
        // Sort by SLA urgency: breached first, then by time remaining
        if (a.sla.breached && !b.sla.breached) return -1;
        if (!a.sla.breached && b.sla.breached) return 1;
        const aRemaining = (a.sla.l2DueAt?.getTime() ?? Infinity) - Date.now();
        const bRemaining = (b.sla.l2DueAt?.getTime() ?? Infinity) - Date.now();
        return aRemaining - bRemaining;
      });
  }

  async searchTickets(filters: SearchTicketsFilter): Promise<FeedbackTicket[]> {
    let results = Array.from(this.tickets.values());

    if (filters.status) results = results.filter((t) => t.status === filters.status);
    if (filters.priority) results = results.filter((t) => t.priority === filters.priority);
    if (filters.category) results = results.filter((t) => t.category === filters.category);
    if (filters.userId) results = results.filter((t) => t.userId === filters.userId);
    if (filters.slaBreached !== undefined) results = results.filter((t) => t.sla.breached === filters.slaBreached);
    if (filters.createdAfter) results = results.filter((t) => t.createdAt >= filters.createdAfter!);
    if (filters.createdBefore) results = results.filter((t) => t.createdAt <= filters.createdBefore!);
    if (filters.query) {
      const q = filters.query.toLowerCase();
      results = results.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q)
      );
    }

    results = results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 50;
    return results.slice(offset, offset + limit);
  }

  async getTicketStats(): Promise<TicketStats> {
    const all = Array.from(this.tickets.values());
    const resolved = all.filter((t) => ['resolved', 'closed'].includes(t.status));
    const l1Resolved = resolved.filter((t) => t.resolution?.resolvedBy === 'ai');
    const escalated = all.filter((t) => t.l2Response !== undefined || t.status.startsWith('l2'));
    const rated = all.filter((t) => t.satisfactionRating !== undefined);

    const byStatus = {} as Record<string, number>;
    const byPriority = {} as Record<string, number>;
    const byCategory = {} as Record<string, number>;

    for (const t of all) {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
      byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
    }

    const avgRating =
      rated.length > 0
        ? rated.reduce((sum, t) => sum + (t.satisfactionRating ?? 0), 0) / rated.length
        : 0;

    const slaBreached = all.filter((t) => t.sla.breached).length;

    return {
      total: all.length,
      byStatus: byStatus as any,
      byPriority: byPriority as any,
      byCategory: byCategory as any,
      avgResolutionMinutes: { l1: 0, l2: 0, overall: 0 }, // calculated from timestamps in production
      slaCompliancePercent: all.length > 0 ? ((all.length - slaBreached) / all.length) * 100 : 100,
      avgSatisfactionRating: avgRating,
      l1AutoResolutionRate: resolved.length > 0 ? (l1Resolved.length / resolved.length) * 100 : 0,
      escalationRate: all.length > 0 ? (escalated.length / all.length) * 100 : 0,
    };
  }

  // --------------------------------------------------------
  // EVENTS
  // --------------------------------------------------------

  on(event: string, handler: (...args: any[]) => void): void {
    this.events.on(event, handler);
  }
}

export const feedbackService = new FeedbackService();
export default feedbackService;
