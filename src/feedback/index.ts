/**
 * EduGenius Feedback & Complaint Handling System
 * Public API exports
 */

// Types
export type {
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TicketType,
  ActorType,
  ResolutionOutcome,
  L1ResolutionType,
  ComplaintQuality,
  TicketSLA,
  SLAConfig,
  AuditEntry,
  L1Response,
  L2Response,
  Resolution,
  TicketMetadata,
  FeedbackTicket,
  CreateTicketInput,
  SearchTicketsFilter,
  TicketStats,
  SLAHealthReport,
  L1QualityCheckResult,
} from './types';

// Service
export { FeedbackService, feedbackService, SLA_CONFIGS, onFeedbackEvent } from './service';

// Classifier
export { classifyTicket, scoreComplaintQuality, getL1ConfidenceThreshold } from './classifier';

// L1 Agents
export {
  resolveWithL1,
  sageFeedbackHandler,
  mentorFeedbackHandler,
  forgeFeedbackHandler,
  paymentFeedbackHandler,
} from './l1-agents';

// SLA Monitor
export { SLAMonitor, slaMonitor } from './sla-monitor';
export type { SLAWarning, SLABreachReport } from './sla-monitor';

// Agent Hooks
export { initFeedbackAgentHooks, pushStatsToOracle } from './agent-hooks';

// Routes
export { feedbackRouter, adminFeedbackRouter, registerFeedbackRoutes } from './routes';
