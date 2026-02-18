/**
 * EduGenius Event Bus - Type Definitions
 * Typed events for inter-agent communication
 */

// ============================================================================
// Core Event Types
// ============================================================================

export type AgentId = 
  | 'Jarvis' 
  | 'Scout' 
  | 'Atlas' 
  | 'Sage' 
  | 'Mentor' 
  | 'Herald' 
  | 'Forge' 
  | 'Oracle';

export type SubAgentId = string; // e.g., 'Scout.TrendSpotter', 'Atlas.Curator'

export type EventPriority = 'low' | 'normal' | 'high' | 'critical';

export type EventStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface EventMetadata {
  id: string;
  timestamp: number;
  source: AgentId | SubAgentId;
  target?: AgentId | SubAgentId | 'broadcast';
  priority: EventPriority;
  correlationId?: string;  // For tracking related events
  causationId?: string;    // ID of event that caused this one
  ttlMs?: number;          // Time-to-live in milliseconds
  retryCount?: number;
  maxRetries?: number;
}

export interface BaseEvent<T extends string = string, P = unknown> {
  type: T;
  payload: P;
  meta: EventMetadata;
}

// ============================================================================
// Domain Events
// ============================================================================

// --- Market Intelligence (Scout) ---
export interface TrendDetectedPayload {
  trendId: string;
  topic: string;
  source: 'google_trends' | 'reddit' | 'twitter' | 'news' | 'youtube';
  score: number;
  keywords: string[];
  relatedTopics: string[];
  velocity: 'rising' | 'stable' | 'declining';
  detectedAt: number;
}

export interface CompetitorUpdatePayload {
  competitorId: string;
  name: string;
  updateType: 'pricing' | 'feature' | 'content' | 'marketing' | 'funding';
  changes: Record<string, unknown>;
  impact: 'low' | 'medium' | 'high';
  recommendedAction?: string;
}

export interface ExamUpdatePayload {
  examId: string;
  examName: string;
  updateType: 'syllabus' | 'dates' | 'pattern' | 'eligibility' | 'news';
  changes: Record<string, unknown>;
  source: string;
  effectiveDate?: string;
}

// --- Content (Atlas) ---
export interface ContentRequestPayload {
  requestId: string;
  contentType: 'lesson' | 'quiz' | 'practice' | 'summary' | 'blog' | 'social';
  topic: string;
  targetAudience: string;
  exam?: string;
  grade?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  language: string;
  deadline?: number;
  priority: EventPriority;
}

export interface ContentCreatedPayload {
  contentId: string;
  requestId: string;
  contentType: string;
  title: string;
  status: 'draft' | 'review' | 'published';
  wordCount: number;
  mediaAssets: string[];
  seoScore?: number;
  readabilityScore?: number;
  createdBy: SubAgentId;
}

export interface ContentPublishedPayload {
  contentId: string;
  contentType: string;
  title: string;
  url: string;
  channels: string[];
  publishedAt: number;
}

// --- Tutoring (Sage) ---
export interface StudentSessionPayload {
  sessionId: string;
  studentId: string;
  topic: string;
  channel: 'web' | 'whatsapp' | 'telegram' | 'app';
  startedAt: number;
  currentState: 'active' | 'waiting' | 'ended';
}

export interface TutorRequestPayload {
  sessionId: string;
  studentId: string;
  question: string;
  subject: string;
  topic: string;
  attachments?: string[];
  previousContext?: string[];
}

export interface TutorResponsePayload {
  sessionId: string;
  studentId: string;
  response: string;
  responseType: 'explanation' | 'hint' | 'question' | 'encouragement' | 'solution';
  visualAids?: string[];
  followUpQuestions?: string[];
  masteryUpdate?: {
    topic: string;
    before: number;
    after: number;
  };
}

export interface StudentProgressPayload {
  studentId: string;
  subject: string;
  topic: string;
  masteryLevel: number;
  questionsAttempted: number;
  questionsCorrect: number;
  timeSpent: number;
  streakDays: number;
  badges?: string[];
}

// --- Engagement (Mentor) ---
export interface EngagementAlertPayload {
  studentId: string;
  alertType: 'churn_risk' | 'struggling' | 'inactive' | 'milestone';
  score: number;
  factors: Record<string, number>;
  recommendedAction: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface NudgeRequestPayload {
  studentId: string;
  nudgeType: 'reminder' | 'encouragement' | 'challenge' | 'celebration' | 'help';
  channel: 'push' | 'email' | 'whatsapp' | 'sms' | 'in_app';
  content: string;
  scheduledFor?: number;
}

export interface NudgeSentPayload {
  nudgeId: string;
  studentId: string;
  nudgeType: string;
  channel: string;
  sentAt: number;
  delivered: boolean;
}

// --- Marketing (Herald) ---
export interface CampaignRequestPayload {
  campaignId: string;
  campaignType: 'launch' | 'promotion' | 'engagement' | 'retention' | 'referral';
  targetAudience: string[];
  channels: string[];
  budget?: number;
  startDate: number;
  endDate?: number;
}

export interface CampaignLaunchedPayload {
  campaignId: string;
  campaignType: string;
  assets: {
    type: string;
    url: string;
    channel: string;
  }[];
  launchedAt: number;
}

export interface LeadCapturedPayload {
  leadId: string;
  source: string;
  campaign?: string;
  email?: string;
  phone?: string;
  interests: string[];
  capturedAt: number;
}

// --- Deployment (Forge) ---
export interface DeployRequestPayload {
  deployId: string;
  component: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  changes: string[];
  requestedBy: AgentId;
}

export interface DeployStatusPayload {
  deployId: string;
  component: string;
  status: 'pending' | 'building' | 'testing' | 'deploying' | 'completed' | 'failed' | 'rolled_back';
  progress: number;
  logs?: string[];
  error?: string;
}

export interface ContentSyncPayload {
  syncId: string;
  contentIds: string[];
  syncType: 'cdn' | 'database' | 'search_index' | 'cache';
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  itemsProcessed: number;
  itemsTotal: number;
}

// --- Analytics (Oracle) ---
export interface MetricUpdatePayload {
  metricId: string;
  metricName: string;
  value: number;
  previousValue?: number;
  changePercent?: number;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  dimensions?: Record<string, string>;
  timestamp: number;
}

export interface AnomalyDetectedPayload {
  anomalyId: string;
  metricName: string;
  expectedValue: number;
  actualValue: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  possibleCauses: string[];
  recommendedActions: string[];
}

export interface ReportGeneratedPayload {
  reportId: string;
  reportType: 'daily' | 'weekly' | 'monthly' | 'custom';
  title: string;
  summary: string;
  metrics: Record<string, number>;
  insights: string[];
  url: string;
  generatedAt: number;
}

// ============================================================================
// System Events
// ============================================================================

export interface AgentHeartbeatPayload {
  agentId: AgentId;
  status: 'healthy' | 'degraded' | 'unhealthy';
  activeSubAgents: SubAgentId[];
  currentTasks: number;
  queuedTasks: number;
  resourceUsage: {
    tokensUsed: number;
    tokenBudget: number;
    apiCallsLastHour: number;
  };
  lastActivity: number;
}

export interface AgentErrorPayload {
  agentId: AgentId | SubAgentId;
  errorType: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  recoverable: boolean;
  timestamp: number;
}

export interface WorkflowStartedPayload {
  workflowId: string;
  workflowType: string;
  initiator: AgentId;
  participants: AgentId[];
  input: Record<string, unknown>;
  startedAt: number;
}

export interface WorkflowStepPayload {
  workflowId: string;
  stepId: string;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  agent: AgentId;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  duration?: number;
  error?: string;
}

export interface WorkflowCompletedPayload {
  workflowId: string;
  workflowType: string;
  status: 'completed' | 'failed' | 'cancelled';
  result?: Record<string, unknown>;
  duration: number;
  stepsCompleted: number;
  stepsFailed: number;
}

// ============================================================================
// Event Type Map
// ============================================================================

export interface EventTypeMap {
  // Scout events
  'scout.trend.detected': TrendDetectedPayload;
  'scout.competitor.updated': CompetitorUpdatePayload;
  'scout.exam.updated': ExamUpdatePayload;

  // Atlas events
  'atlas.content.requested': ContentRequestPayload;
  'atlas.content.created': ContentCreatedPayload;
  'atlas.content.published': ContentPublishedPayload;

  // Sage events
  'sage.session.started': StudentSessionPayload;
  'sage.session.ended': StudentSessionPayload;
  'sage.tutor.request': TutorRequestPayload;
  'sage.tutor.response': TutorResponsePayload;
  'sage.progress.updated': StudentProgressPayload;

  // Mentor events
  'mentor.engagement.alert': EngagementAlertPayload;
  'mentor.nudge.requested': NudgeRequestPayload;
  'mentor.nudge.sent': NudgeSentPayload;

  // Herald events
  'herald.campaign.requested': CampaignRequestPayload;
  'herald.campaign.launched': CampaignLaunchedPayload;
  'herald.lead.captured': LeadCapturedPayload;

  // Forge events
  'forge.deploy.requested': DeployRequestPayload;
  'forge.deploy.status': DeployStatusPayload;
  'forge.content.synced': ContentSyncPayload;

  // Oracle events
  'oracle.metric.updated': MetricUpdatePayload;
  'oracle.anomaly.detected': AnomalyDetectedPayload;
  'oracle.report.generated': ReportGeneratedPayload;

  // System events
  'system.agent.heartbeat': AgentHeartbeatPayload;
  'system.agent.error': AgentErrorPayload;
  'system.workflow.started': WorkflowStartedPayload;
  'system.workflow.step': WorkflowStepPayload;
  'system.workflow.completed': WorkflowCompletedPayload;

  // Additional agent events
  'atlas.content.viewed': Record<string, unknown>;
  'forge.build.completed': Record<string, unknown>;
  'forge.deploy.completed': Record<string, unknown>;
  'forge.evaluate.rollback': Record<string, unknown>;
  'forge.rollback.executed': Record<string, unknown>;
  'herald.promote.requested': Record<string, unknown>;
  'herald.reengage.requested': Record<string, unknown>;
  'mentor.progress.update': Record<string, unknown>;
  'oracle.track.deployment': Record<string, unknown>;
  'scout.opportunity.found': Record<string, unknown>;
  'workflow.started': Record<string, unknown>;
  'workflow.completed': Record<string, unknown>;
  'workflow.failed': Record<string, unknown>;
  [key: `${string}.analytics.event`]: Record<string, unknown>;
}

export type EventType = keyof EventTypeMap;

export type TypedEvent<T extends EventType> = BaseEvent<T, EventTypeMap[T]>;

// ============================================================================
// Event Handler Types
// ============================================================================

export type EventHandler<T extends EventType> = (
  event: TypedEvent<T>
) => void | Promise<void>;

export interface EventSubscription {
  id: string;
  eventType: EventType | EventType[] | '*';
  handler: EventHandler<any>;
  filter?: EventFilter;
  options?: SubscriptionOptions;
}

export interface EventFilter {
  source?: AgentId | AgentId[];
  target?: AgentId | AgentId[];
  priority?: EventPriority | EventPriority[];
  correlationId?: string;
}

export interface SubscriptionOptions {
  once?: boolean;
  priority?: number;  // Handler execution priority
  timeout?: number;   // Handler timeout in ms
  retries?: number;   // Number of retries on failure
}

// ============================================================================
// Event Bus Configuration
// ============================================================================

export interface EventBusConfig {
  maxQueueSize: number;
  defaultTTL: number;
  retryConfig: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
  deadLetterQueue: boolean;
  persistence: {
    enabled: boolean;
    adapter: 'memory' | 'redis' | 'postgres';
  };
  metrics: {
    enabled: boolean;
    sampleRate: number;
  };
}

export const defaultEventBusConfig: EventBusConfig = {
  maxQueueSize: 10000,
  defaultTTL: 300000, // 5 minutes
  retryConfig: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
  deadLetterQueue: true,
  persistence: {
    enabled: false,
    adapter: 'memory',
  },
  metrics: {
    enabled: true,
    sampleRate: 1.0,
  },
};
