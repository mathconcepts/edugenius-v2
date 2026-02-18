/**
 * EduGenius Feedback Agent Hooks
 * Connects feedback events to all impacted agents:
 *   Oracle  → Pattern analysis, SLA monitoring, satisfaction tracking
 *   Herald  → Content gap detection, feature backlog
 *   Atlas   → Content creation for reported gaps
 *   Scout   → Emerging complaint trend monitoring
 *   Forge   → Bug reports, auto-fix pipeline, SLA breach alerts
 *   Mentor  → Resolution notifications to users
 *   Sage    → Knowledge base updates from content error resolutions
 */

import type { FeedbackTicket, TicketStats } from './types';
import { onFeedbackEvent, feedbackService } from './service';
import { slaMonitor, type SLAWarning, type SLABreachReport } from './sla-monitor';

// ============================================================================
// Event Bus Integration (lightweight stub — replaces with real EventBus)
// ============================================================================

interface AgentEvent {
  agent: string;
  subAgent?: string;
  type: string;
  payload: Record<string, unknown>;
  priority: 'low' | 'normal' | 'high' | 'critical';
  correlationId?: string;
}

// In a production setup, this would call getEventBus().publish(...)
function dispatchToAgent(event: AgentEvent): void {
  console.log(`[AgentHook] → ${event.agent}${event.subAgent ? '.' + event.subAgent : ''}: ${event.type}`, {
    priority: event.priority,
    payload: event.payload,
  });
  // TODO: getEventBus().publish(event)
}

// ============================================================================
// Oracle Hooks
// ============================================================================

/**
 * Oracle.ComplaintPatternAnalyzer — groups similar complaints, detects systemic issues
 */
function hookOracle(): void {
  onFeedbackEvent(async (event) => {
    switch (event.type) {
      case 'ticket.created': {
        const { ticket } = event;
        dispatchToAgent({
          agent: 'Oracle',
          subAgent: 'complaint-pattern-analyzer',
          type: 'FEEDBACK_TICKET_CREATED',
          payload: {
            ticketId: ticket.id,
            category: ticket.category,
            priority: ticket.priority,
            qualityScore: ticket.quality.score,
            sentiment: ticket.quality.sentiment,
            urgency: ticket.quality.urgency,
            tags: ticket.tags,
            examId: ticket.examId,
            subject: ticket.subject,
          },
          priority: ticket.priority === 'critical' ? 'critical' : 'normal',
          correlationId: ticket.id,
        });
        break;
      }

      case 'ticket.l1_resolved':
      case 'ticket.l2_resolved': {
        const { ticket } = event;
        dispatchToAgent({
          agent: 'Oracle',
          subAgent: 'resolution-tracker',
          type: 'FEEDBACK_TICKET_RESOLVED',
          payload: {
            ticketId: ticket.id,
            category: ticket.category,
            resolvedBy: ticket.resolution?.resolvedBy,
            resolutionType: ticket.resolution?.resolutionType,
            l1ConfidenceScore: ticket.l1Response?.confidenceScore,
            timeToResolutionMinutes: ticket.resolvedAt
              ? Math.round((ticket.resolvedAt.getTime() - ticket.createdAt.getTime()) / 60_000)
              : null,
            slaBreached: ticket.sla.breached,
          },
          priority: 'normal',
          correlationId: ticket.id,
        });
        break;
      }

      case 'ticket.satisfaction_rated': {
        const { ticket } = event;
        dispatchToAgent({
          agent: 'Oracle',
          subAgent: 'satisfaction-tracker',
          type: 'FEEDBACK_SATISFACTION_RECORDED',
          payload: {
            ticketId: ticket.id,
            userId: ticket.userId,
            rating: ticket.satisfactionRating,
            comment: ticket.satisfactionComment,
            category: ticket.category,
            resolvedBy: ticket.resolution?.resolvedBy,
            examId: ticket.examId,
          },
          priority: 'low',
          correlationId: ticket.id,
        });
        break;
      }

      case 'ticket.sla_breached': {
        const { ticket } = event;
        dispatchToAgent({
          agent: 'Oracle',
          subAgent: 'sla-breach-monitor',
          type: 'FEEDBACK_SLA_BREACHED',
          payload: {
            ticketId: ticket.id,
            priority: ticket.priority,
            category: ticket.category,
            breachedAt: ticket.sla.breachedAt,
            currentStatus: ticket.status,
          },
          priority: 'high',
          correlationId: ticket.id,
        });
        break;
      }
    }
  });

  // Periodic stats push to Oracle (every 30 min in production)
  // In dev: triggered on demand
}

// ============================================================================
// Herald Hooks
// ============================================================================

/**
 * Herald — content gap detection, feature backlog
 */
function hookHerald(): void {
  onFeedbackEvent(async (event) => {
    if (event.type !== 'ticket.created') return;
    const { ticket } = event;

    if (ticket.category === 'content_missing') {
      dispatchToAgent({
        agent: 'Herald',
        subAgent: 'content-gap-reporter',
        type: 'CONTENT_GAP_REPORTED',
        payload: {
          ticketId: ticket.id,
          title: ticket.title,
          description: ticket.description,
          subject: ticket.subject,
          examId: ticket.examId,
          tags: ticket.tags,
          priority: ticket.priority,
          requestedBy: ticket.userId,
        },
        priority: ticket.priority === 'high' || ticket.priority === 'critical' ? 'high' : 'normal',
        correlationId: ticket.id,
      });
    }

    if (ticket.category === 'feature_request') {
      dispatchToAgent({
        agent: 'Herald',
        subAgent: 'product-backlog-manager',
        type: 'FEATURE_REQUEST_LOGGED',
        payload: {
          ticketId: ticket.id,
          title: ticket.title,
          description: ticket.description,
          requestedBy: ticket.userId,
          qualityScore: ticket.quality.score,
          isActionable: ticket.quality.isActionable,
          tags: ticket.tags,
        },
        priority: 'low',
        correlationId: ticket.id,
      });
    }
  });
}

// ============================================================================
// Atlas Hooks
// ============================================================================

/**
 * Atlas — generate content for reported gaps
 */
function hookAtlas(): void {
  onFeedbackEvent(async (event) => {
    if (event.type !== 'ticket.created') return;
    const { ticket } = event;

    if (ticket.category === 'content_missing' && ticket.priority !== 'low') {
      dispatchToAgent({
        agent: 'Atlas',
        subAgent: 'content-creator',
        type: 'CONTENT_CREATION_REQUESTED',
        payload: {
          ticketId: ticket.id,
          title: `Create content for: ${ticket.title}`,
          subject: ticket.subject,
          examId: ticket.examId,
          description: ticket.description,
          priority: ticket.priority,
          tags: ticket.tags,
          source: 'user_feedback',
        },
        priority: ticket.priority === 'high' ? 'high' : 'normal',
        correlationId: ticket.id,
      });
    }

    // When content errors are confirmed and resolved, Atlas updates content
    if (event.type === 'ticket.l2_resolved') {
      const resolvedTicket = (event as { type: string; ticket: FeedbackTicket }).ticket;
      if (resolvedTicket.category === 'content_error' && resolvedTicket.l2Response?.resolution === 'resolved') {
        dispatchToAgent({
          agent: 'Atlas',
          subAgent: 'content-updater',
          type: 'CONTENT_UPDATE_REQUESTED',
          payload: {
            ticketId: resolvedTicket.id,
            errorDescription: resolvedTicket.description,
            correction: resolvedTicket.l2Response.response,
            subject: resolvedTicket.subject,
            examId: resolvedTicket.examId,
          },
          priority: 'high',
          correlationId: resolvedTicket.id,
        });
      }
    }
  });

  // Also listen for content_missing resolutions
  onFeedbackEvent(async (event) => {
    if (event.type !== 'ticket.l2_resolved') return;
    const { ticket } = event;
    if (ticket.category !== 'content_error') return;

    if (ticket.l2Response?.resolution === 'resolved') {
      dispatchToAgent({
        agent: 'Atlas',
        subAgent: 'content-updater',
        type: 'CONTENT_ERROR_CORRECTED',
        payload: {
          ticketId: ticket.id,
          originalReport: ticket.description,
          correctionSummary: ticket.resolution?.summary,
          preventionAction: ticket.resolution?.preventionAction,
        },
        priority: 'normal',
        correlationId: ticket.id,
      });
    }
  });
}

// ============================================================================
// Scout Hooks
// ============================================================================

/**
 * Scout — monitor for emerging complaint patterns, trending issues
 */
function hookScout(): void {
  onFeedbackEvent(async (event) => {
    if (event.type !== 'ticket.created') return;
    const { ticket } = event;

    // Scout watches for high-volume complaint patterns
    dispatchToAgent({
      agent: 'Scout',
      subAgent: 'complaint-trend-detector',
      type: 'COMPLAINT_SIGNAL',
      payload: {
        ticketId: ticket.id,
        category: ticket.category,
        priority: ticket.priority,
        sentiment: ticket.quality.sentiment,
        tags: ticket.tags,
        examId: ticket.examId,
        subject: ticket.subject,
        createdAt: ticket.createdAt,
      },
      priority: ticket.priority === 'critical' ? 'high' : 'low',
      correlationId: ticket.id,
    });
  });

  // SLA breach trends
  slaMonitor.onBreach((breaches) => {
    if (breaches.length >= 3) {
      dispatchToAgent({
        agent: 'Scout',
        subAgent: 'sla-trend-watcher',
        type: 'SLA_BREACH_CLUSTER',
        payload: {
          breachCount: breaches.length,
          breaches: breaches.map((b) => ({
            ticketId: b.ticketId,
            priority: b.priority,
            stage: b.stage,
            minutesOverdue: b.minutesOverdue,
          })),
          detectedAt: new Date(),
        },
        priority: 'high',
      });
    }
  });
}

// ============================================================================
// Forge Hooks
// ============================================================================

/**
 * Forge — bug reports, auto-fix pipeline, SLA breach paging
 */
function hookForge(): void {
  onFeedbackEvent(async (event) => {
    if (event.type !== 'ticket.created') return;
    const { ticket } = event;

    if (ticket.category === 'technical_bug') {
      dispatchToAgent({
        agent: 'Forge',
        subAgent: 'bug-triager',
        type: 'BUG_REPORT_CREATED',
        payload: {
          ticketId: ticket.id,
          title: ticket.title,
          description: ticket.description,
          priority: ticket.priority,
          metadata: ticket.metadata,
          tags: ticket.tags,
          autoFixEligible: ticket.quality.hasReproSteps && ticket.quality.isActionable,
        },
        priority: ticket.priority === 'critical' || ticket.priority === 'high' ? 'high' : 'normal',
        correlationId: ticket.id,
      });
    }

    if (ticket.category === 'performance') {
      dispatchToAgent({
        agent: 'Forge',
        subAgent: 'performance-monitor',
        type: 'PERFORMANCE_COMPLAINT',
        payload: {
          ticketId: ticket.id,
          description: ticket.description,
          metadata: ticket.metadata,
          priority: ticket.priority,
        },
        priority: 'normal',
        correlationId: ticket.id,
      });
    }
  });

  // SLA breach → page on-call
  slaMonitor.onBreach((breaches) => {
    const criticalBreaches = breaches.filter((b) => b.priority === 'critical' || b.priority === 'high');
    if (criticalBreaches.length > 0) {
      dispatchToAgent({
        agent: 'Forge',
        subAgent: 'on-call-pager',
        type: 'SLA_BREACH_PAGE',
        payload: {
          breaches: criticalBreaches,
          severity: criticalBreaches.some((b) => b.priority === 'critical') ? 'critical' : 'high',
          message: `${criticalBreaches.length} high-priority ticket(s) have breached SLA. Immediate response required.`,
          timestamp: new Date(),
        },
        priority: 'critical',
      });
    }
  });
}

// ============================================================================
// Mentor Hooks
// ============================================================================

/**
 * Mentor — send resolution notifications to users via their preferred channel
 */
function hookMentor(): void {
  onFeedbackEvent(async (event) => {
    switch (event.type) {
      case 'ticket.l1_resolved': {
        const { ticket } = event;
        dispatchToAgent({
          agent: 'Mentor',
          subAgent: 'notification-sender',
          type: 'SEND_RESOLUTION_NOTIFICATION',
          payload: {
            userId: ticket.userId,
            ticketId: ticket.id,
            ticketTitle: ticket.title,
            resolvedBy: 'ai',
            resolutionSummary: ticket.l1Response?.response.slice(0, 200),
            channel: 'in_app', // Mentor picks best channel from user prefs
            ctaText: 'View Resolution & Rate Us',
            ctaUrl: `/feedback/${ticket.id}`,
          },
          priority: 'normal',
          correlationId: ticket.id,
        });
        break;
      }

      case 'ticket.l2_resolved': {
        const { ticket } = event;
        dispatchToAgent({
          agent: 'Mentor',
          subAgent: 'notification-sender',
          type: 'SEND_RESOLUTION_NOTIFICATION',
          payload: {
            userId: ticket.userId,
            ticketId: ticket.id,
            ticketTitle: ticket.title,
            resolvedBy: 'human',
            resolutionSummary: ticket.l2Response?.response?.slice(0, 200),
            channel: 'email_and_in_app',
            ctaText: 'View Resolution & Share Feedback',
            ctaUrl: `/feedback/${ticket.id}`,
          },
          priority: 'high',
          correlationId: ticket.id,
        });
        break;
      }

      case 'ticket.l2_escalated': {
        const { ticket } = event;
        dispatchToAgent({
          agent: 'Mentor',
          subAgent: 'notification-sender',
          type: 'SEND_ESCALATION_NOTIFICATION',
          payload: {
            userId: ticket.userId,
            ticketId: ticket.id,
            ticketTitle: ticket.title,
            message: 'Your ticket has been escalated to our specialist team. We will respond within the promised timeframe.',
            channel: 'in_app',
          },
          priority: 'normal',
          correlationId: ticket.id,
        });
        break;
      }
    }
  });
}

// ============================================================================
// Sage Hooks
// ============================================================================

/**
 * Sage — update knowledge base when content errors are corrected
 */
function hookSage(): void {
  onFeedbackEvent(async (event) => {
    if (event.type !== 'ticket.l2_resolved') return;
    const { ticket } = event;

    if (
      (ticket.category === 'content_error' || ticket.category === 'ai_behavior' || ticket.category === 'exam_content') &&
      ticket.l2Response?.resolution === 'resolved'
    ) {
      dispatchToAgent({
        agent: 'Sage',
        subAgent: 'knowledge-updater',
        type: 'KNOWLEDGE_BASE_UPDATE',
        payload: {
          ticketId: ticket.id,
          errorType: ticket.category,
          subject: ticket.subject,
          examId: ticket.examId,
          errorDescription: ticket.description,
          correction: ticket.resolution?.summary,
          preventionNote: ticket.resolution?.preventionAction,
          tags: ticket.tags,
          updateKnowledgeBase: true,
        },
        priority: 'normal',
        correlationId: ticket.id,
      });
    }
  });
}

// ============================================================================
// SLA Warning Hooks
// ============================================================================

function hookSLAWarnings(): void {
  slaMonitor.onWarning((warnings: SLAWarning[]) => {
    // Warn Forge's on-call for critical/high tickets
    const urgentWarnings = warnings.filter((w) => w.priority === 'critical' || w.priority === 'high');
    if (urgentWarnings.length > 0) {
      dispatchToAgent({
        agent: 'Forge',
        subAgent: 'sla-alerter',
        type: 'SLA_WARNING',
        payload: {
          warnings: urgentWarnings,
          message: `${urgentWarnings.length} ticket(s) approaching SLA breach.`,
        },
        priority: 'high',
      });
    }

    // Warn Oracle for analytics
    dispatchToAgent({
      agent: 'Oracle',
      subAgent: 'sla-breach-monitor',
      type: 'SLA_WARNING_BATCH',
      payload: {
        warningCount: warnings.length,
        warnings,
        timestamp: new Date(),
      },
      priority: 'normal',
    });
  });
}

// ============================================================================
// Analytics Dispatcher (periodic, for Oracle)
// ============================================================================

export async function pushStatsToOracle(): Promise<void> {
  const stats: TicketStats = feedbackService.getTicketStats();
  dispatchToAgent({
    agent: 'Oracle',
    subAgent: 'feedback-analytics',
    type: 'FEEDBACK_STATS_UPDATE',
    payload: {
      stats,
      generatedAt: new Date(),
    },
    priority: 'low',
  });
}

// ============================================================================
// Initialization
// ============================================================================

export function initFeedbackAgentHooks(): void {
  hookOracle();
  hookHerald();
  hookAtlas();
  hookScout();
  hookForge();
  hookMentor();
  hookSage();
  hookSLAWarnings();

  console.log('[FeedbackAgentHooks] All agent hooks registered.');
}
