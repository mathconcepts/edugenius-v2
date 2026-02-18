/**
 * EduGenius Feedback REST API Routes
 *
 * User endpoints:
 *   POST   /api/feedback                         → submit ticket
 *   GET    /api/feedback/:ticketId                → get ticket + audit trail
 *   GET    /api/users/:userId/feedback            → user's tickets
 *   POST   /api/feedback/:ticketId/satisfy        → user marks satisfied
 *   POST   /api/feedback/:ticketId/escalate       → user escalates to L2
 *   POST   /api/feedback/:ticketId/rating         → post-resolution rating
 *
 * Admin endpoints:
 *   GET    /api/admin/feedback                    → search all tickets
 *   GET    /api/admin/feedback/pending-l2         → awaiting human review
 *   GET    /api/admin/feedback/stats              → analytics
 *   GET    /api/admin/feedback/sla-health         → SLA health dashboard
 *   POST   /api/admin/feedback/:ticketId/assign   → assign to human agent
 *   POST   /api/admin/feedback/:ticketId/respond  → human responds
 *   POST   /api/admin/feedback/:ticketId/close    → human closes
 *   GET    /api/admin/feedback/:ticketId/audit    → full audit trail
 */

import { Router, Request, Response, NextFunction } from 'express';
import { feedbackService } from './service';
import { slaMonitor } from './sla-monitor';
import type {
  CreateTicketInput,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  SearchTicketsFilter,
  L2Response,
} from './types';

export const feedbackRouter = Router();
export const adminFeedbackRouter = Router();

// ============================================================================
// Helpers
// ============================================================================

function ok(res: Response, data: unknown): void {
  res.json({ success: true, data });
}

function fail(res: Response, status: number, message: string): void {
  res.status(status).json({ success: false, error: message });
}

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// ============================================================================
// USER ENDPOINTS
// ============================================================================

/**
 * POST /api/feedback
 * Submit a new feedback ticket.
 */
feedbackRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const userId: string = (req as any).user?.id ?? req.body.userId ?? 'anonymous';
    const input: CreateTicketInput = {
      type: req.body.type ?? 'feedback',
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      subcategory: req.body.subcategory,
      examId: req.body.examId,
      subject: req.body.subject,
      attachments: req.body.attachments,
      metadata: {
        page: req.body.metadata?.page ?? req.headers.referer ?? 'unknown',
        sessionId: req.body.metadata?.sessionId,
        agentId: req.body.metadata?.agentId,
        questionId: req.body.metadata?.questionId,
        chatMessageId: req.body.metadata?.chatMessageId,
        browserInfo: req.headers['user-agent'],
        timestamp: new Date(),
      },
    };

    if (!input.title || !input.description) {
      return fail(res, 400, 'title and description are required.');
    }

    if (input.title.length > 200) {
      return fail(res, 400, 'title must be 200 characters or fewer.');
    }

    if (input.description.length < 10) {
      return fail(res, 400, 'description must be at least 10 characters.');
    }

    const ticket = await feedbackService.createTicket(userId, input);
    res.status(201).json({ success: true, data: ticket });
  })
);

/**
 * GET /api/feedback/:ticketId
 * Get a ticket with its full audit trail.
 */
feedbackRouter.get(
  '/:ticketId',
  asyncHandler(async (req, res) => {
    const ticket = feedbackService.getTicket(req.params.ticketId);
    if (!ticket) return fail(res, 404, 'Ticket not found.');
    ok(res, ticket);
  })
);

/**
 * GET /api/users/:userId/feedback
 * Get all tickets submitted by a user.
 */
feedbackRouter.get(
  '/users/:userId',
  asyncHandler(async (req, res) => {
    const tickets = feedbackService.getUserTickets(req.params.userId);
    ok(res, { tickets, total: tickets.length });
  })
);

/**
 * POST /api/feedback/:ticketId/satisfy
 * User marks themselves satisfied with the resolution → closes ticket.
 */
feedbackRouter.post(
  '/:ticketId/satisfy',
  asyncHandler(async (req, res) => {
    const userId: string = (req as any).user?.id ?? req.body.userId ?? 'anonymous';
    const ticket = feedbackService.getTicket(req.params.ticketId);
    if (!ticket) return fail(res, 404, 'Ticket not found.');

    if (ticket.status !== 'l1_resolved' && ticket.status !== 'resolved') {
      return fail(res, 400, 'Ticket must be in a resolved state to mark as satisfied.');
    }

    await feedbackService.markUserSatisfied(req.params.ticketId, userId);
    ok(res, { message: 'Ticket closed. Thank you for your feedback!' });
  })
);

/**
 * POST /api/feedback/:ticketId/escalate
 * User manually escalates to L2 (even from resolved state).
 */
feedbackRouter.post(
  '/:ticketId/escalate',
  asyncHandler(async (req, res) => {
    const userId: string = (req as any).user?.id ?? req.body.userId ?? 'anonymous';
    const { reason } = req.body;

    if (!reason) return fail(res, 400, 'Please provide a reason for escalation.');

    const ticket = feedbackService.getTicket(req.params.ticketId);
    if (!ticket) return fail(res, 404, 'Ticket not found.');

    if (ticket.status === 'closed' || ticket.status === 'rejected') {
      return fail(res, 400, 'Cannot escalate a closed or rejected ticket.');
    }

    await feedbackService.userEscalateToL2(req.params.ticketId, userId, reason);
    ok(res, {
      message: 'Your ticket has been escalated to a human specialist. We will respond within our SLA.',
      ticketId: ticket.id,
    });
  })
);

/**
 * POST /api/feedback/:ticketId/rating
 * Submit a post-resolution satisfaction rating (1–5 stars).
 */
feedbackRouter.post(
  '/:ticketId/rating',
  asyncHandler(async (req, res) => {
    const userId: string = (req as any).user?.id ?? req.body.userId ?? 'anonymous';
    const { rating, comment } = req.body;

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return fail(res, 400, 'rating must be a number between 1 and 5.');
    }

    const ticket = feedbackService.getTicket(req.params.ticketId);
    if (!ticket) return fail(res, 404, 'Ticket not found.');

    const resolvedStatuses: TicketStatus[] = ['l1_resolved', 'resolved', 'closed'];
    if (!resolvedStatuses.includes(ticket.status)) {
      return fail(res, 400, 'Ratings can only be submitted for resolved tickets.');
    }

    await feedbackService.recordSatisfactionRating(req.params.ticketId, userId, rating, comment);
    ok(res, { message: 'Thank you for your rating! Your feedback helps us improve.' });
  })
);

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/feedback
 * Search and filter all tickets (admin).
 */
adminFeedbackRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filters: SearchTicketsFilter = {
      status: req.query.status as TicketStatus | undefined,
      priority: req.query.priority as TicketPriority | undefined,
      category: req.query.category as TicketCategory | undefined,
      userId: req.query.userId as string | undefined,
      assignedTo: req.query.assignedTo as string | undefined,
      slaBreached: req.query.slaBreached === 'true' ? true : req.query.slaBreached === 'false' ? false : undefined,
      query: req.query.q as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      createdAfter: req.query.createdAfter ? new Date(req.query.createdAfter as string) : undefined,
      createdBefore: req.query.createdBefore ? new Date(req.query.createdBefore as string) : undefined,
    };

    const result = feedbackService.searchTickets(filters);
    ok(res, result);
  })
);

/**
 * GET /api/admin/feedback/pending-l2
 * Get all tickets awaiting human review, sorted by SLA urgency.
 */
adminFeedbackRouter.get(
  '/pending-l2',
  asyncHandler(async (_req, res) => {
    const tickets = feedbackService.getPendingL2Tickets();
    ok(res, { tickets, total: tickets.length });
  })
);

/**
 * GET /api/admin/feedback/stats
 * Ticket analytics for Oracle and admin dashboard.
 */
adminFeedbackRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const stats = feedbackService.getTicketStats();
    ok(res, stats);
  })
);

/**
 * GET /api/admin/feedback/sla-health
 * SLA health dashboard data.
 */
adminFeedbackRouter.get(
  '/sla-health',
  asyncHandler(async (_req, res) => {
    const health = await slaMonitor.getSLAHealth();
    ok(res, health);
  })
);

/**
 * GET /api/admin/feedback/:ticketId/audit
 * Full audit trail for a ticket (admin view).
 */
adminFeedbackRouter.get(
  '/:ticketId/audit',
  asyncHandler(async (req, res) => {
    const ticket = feedbackService.getTicket(req.params.ticketId);
    if (!ticket) return fail(res, 404, 'Ticket not found.');
    ok(res, {
      ticketId: ticket.id,
      auditTrail: ticket.auditTrail,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      qualityScore: ticket.quality.score,
      sla: ticket.sla,
    });
  })
);

/**
 * POST /api/admin/feedback/:ticketId/assign
 * Assign a ticket to a specific human agent.
 */
adminFeedbackRouter.post(
  '/:ticketId/assign',
  asyncHandler(async (req, res) => {
    const { agentId, agentName } = req.body;
    if (!agentId || !agentName) return fail(res, 400, 'agentId and agentName are required.');

    const ticket = feedbackService.getTicket(req.params.ticketId);
    if (!ticket) return fail(res, 404, 'Ticket not found.');

    if (ticket.status !== 'l2_escalated' && ticket.status !== 'l2_processing') {
      return fail(res, 400, 'Only L2 escalated tickets can be assigned.');
    }

    await feedbackService.assignL2Ticket(req.params.ticketId, agentId, agentName);
    ok(res, { message: `Ticket assigned to ${agentName}.` });
  })
);

/**
 * POST /api/admin/feedback/:ticketId/respond
 * Human agent submits their response (does not close).
 */
adminFeedbackRouter.post(
  '/:ticketId/respond',
  asyncHandler(async (req, res) => {
    const humanId: string = (req as any).user?.id ?? req.body.humanId ?? 'admin';
    const humanName: string = (req as any).user?.name ?? req.body.humanName ?? 'Admin';
    const { response, internalNote } = req.body;

    if (!response) return fail(res, 400, 'response text is required.');

    const ticket = feedbackService.getTicket(req.params.ticketId);
    if (!ticket) return fail(res, 404, 'Ticket not found.');

    // Log the internal note and response as an audit entry (not a full close)
    feedbackService.addAuditEntry(req.params.ticketId, {
      actor: 'human_agent',
      actorId: humanId,
      actorName: humanName,
      action: 'human_response_added',
      details: `Human agent "${humanName}" added response. Internal note: ${internalNote ?? 'none'}`,
    });

    ok(res, { message: 'Response recorded. Use the close endpoint to finalize.' });
  })
);

/**
 * POST /api/admin/feedback/:ticketId/close
 * Human closes the ticket with a final resolution.
 */
adminFeedbackRouter.post(
  '/:ticketId/close',
  asyncHandler(async (req, res) => {
    const humanId: string = (req as any).user?.id ?? req.body.humanId ?? 'admin';
    const humanName: string = (req as any).user?.name ?? req.body.humanName ?? 'Admin';
    const { response, resolution, internalNote, actionTaken } = req.body;

    if (!response) return fail(res, 400, 'response is required.');
    if (!resolution) return fail(res, 400, 'resolution is required (resolved | rejected | duplicate | wont_fix).');

    const validResolutions: L2Response['resolution'][] = ['resolved', 'rejected', 'duplicate', 'wont_fix'];
    if (!validResolutions.includes(resolution)) {
      return fail(res, 400, `resolution must be one of: ${validResolutions.join(', ')}`);
    }

    const ticket = feedbackService.getTicket(req.params.ticketId);
    if (!ticket) return fail(res, 404, 'Ticket not found.');

    await feedbackService.recordL2Response(
      req.params.ticketId,
      humanId,
      humanName,
      response,
      resolution,
      internalNote,
      actionTaken
    );

    ok(res, { message: `Ticket ${req.params.ticketId} closed as "${resolution}".` });
  })
);

// ============================================================================
// Route Registration Helper
// ============================================================================

/**
 * Register feedback routes on an Express app.
 * Usage: registerFeedbackRoutes(app)
 */
export function registerFeedbackRoutes(app: { use: (path: string, router: Router) => void }): void {
  app.use('/api/feedback', feedbackRouter);
  app.use('/api/admin/feedback', adminFeedbackRouter);

  // Register /api/users/:userId/feedback on the user-scoped path
  feedbackRouter.get('/users/:userId', asyncHandler(async (req, res) => {
    const tickets = feedbackService.getUserTickets(req.params.userId);
    ok(res, { tickets, total: tickets.length });
  }));
}
