/**
 * Services Index
 * 
 * Central export for all EduGenius services
 */

// Personalization
export { PersonalizationEngine, default as personalizationEngine } from './personalizationEngine';
export type { 
  LearningMode, 
  ResponseConfig, 
  StudentContext, 
  ExamTip 
} from '@/types/personalization';

// Teaching Strategy
export { TeachingStrategyService, default as teachingStrategy } from './teachingStrategy';

// Marketing Integration
export { MarketingIntegration, default as marketingIntegration } from './marketingIntegration';
export { BlogPromptModifiers, default as blogPromptModifiers } from './blogPromptModifiers';

// Persona Content Bridge — StudentPersonaEngine → Atlas → Herald
export {
  getCohortInsights,
  getAtlasTopicQueue,
  getHeraldContentCalendar,
  generateContentOpportunities,
  generateOutreachTriggers,
  aggregatePersonasToCohort,
  pushCohortInsights,
} from './personaContentBridge';
export type {
  CohortInsight,
  ContentOpportunity,
  OutreachTrigger,
} from './personaContentBridge';

// Persona Batch Service — batch content generation pipeline
export {
  expandBatchSpec,
  scrapeContextForRequests,
  runPersonaBatch,
  buildMCQBatchSpec,
  buildFullCoverageBatchSpec,
  summariseBatchResult,
} from './personaBatchService';
export type {
  BatchMode,
  PersonaBatchSpec,
  PersonaBatchExpansion,
  PersonaBatchRequest,
  PersonaBatchOutput,
  PersonaBatchResult,
  PersonaBatchProgress,
} from './personaBatchService';

// Template Registry — exam × topic × style × objective overrides
export {
  TEMPLATE_REGISTRY,
  REGISTRY_SIZE,
  topicSlug,
  buildLookupKeys,
  resolveTemplate,
} from './templateRegistry';
export type { TemplateOverride } from './templateRegistry';

// Content Persona Engine — prompt rendering
export {
  renderPrompt,
  inferPersonaContext,
  buildLearningStyleDirective,
  buildObjectiveDirective,
  buildCognitiveTierDirective,
  buildExamContextDirective,
  buildChannelDirective,
  buildFormatDirective,
  LEARNING_STYLE_LABELS,
  OBJECTIVE_LABELS,
  COGNITIVE_TIER_LABELS,
  FORMAT_LABELS,
} from './contentPersonaEngine';
export type {
  LearningStyle,
  LearningObjective,
  CognitiveTier,
  ContentPersonaFormat,
  PersonaContext,
  PersonaPromptTemplate,
  RenderedPrompt,
} from './contentPersonaEngine';

// Exam Lifecycle Orchestrator — CEO approves once, all 7 agents auto-run bidirectionally
export {
  triggerExamApproval,
  processAgentInbox,
  getExamLifecycleState,
  getAllLifecycles,
} from './examOrchestrator';
export type {
  ExamLifecycleState,
  ExamLifecyclePhase,
  AgentLifecycleStatus,
  AgentInboxResult,
  SignalLogEntry,
  // Note: AgentId is the canonical export from './agentWorkflows' (includes 'prism')
} from './examOrchestrator';

// ── Signal Bus — all emitters + inbox processors ─────────────────────────────
export {
  // Lifecycle emitters
  emitExamApproved,
  emitContentReady,
  emitContentVerified,
  emitExamDeployed,
  emitPerformanceInsight,
  emitStudentEnrolled,
  // Learning signal emitters
  emitContentGap,
  emitStrugglePattern,
  emitMasteryAchieved,
  emitFrustrationAlert,
  emitChurnRisk,
  emitBreakthrough,
  // Hyper-personalisation emitters
  emitFormatRequest,
  emitSROverdue,
  emitBehavioralSnapshot,
  emitFormatSuccess,
  // Interaction recorder
  recordSageInteraction,
  // Gap-fill bidirectional emitters
  emitTrendSignal,
  emitKeywordOpportunity,
  emitDeployMetrics,
  emitStudentStruggling,
  emitEngagementGap,
  emitCampaignPerformance,
  emitCampaignResult,
  emitContentPublished,
  // Prism journey-intelligence
  emitFunnelInsight,
  // Inbox processors
  processAtlasInbox,
  processSageInbox,
  processMentorInbox,
  processOracleInbox,
  processScoutInbox,
  processHeraldInbox,
  processForgeInbox,
  processPrismInbox,
  // Cohort alert
  checkCohortAlert,
} from './signalBus';

// ── Agent Workflows ───────────────────────────────────────────────────────────
export {
  WORKFLOWS,
  AGENT_META,
  runWorkflow,
  isPrismAgent,
} from './agentWorkflows';
export type {
  AgentId,
  AgentMeta,
  AgentWorkflow,
  WorkflowStep,
  WorkflowStepState,
  StepStatus,
} from './agentWorkflows';

// ── LLM Service ───────────────────────────────────────────────────────────────
export {
  callLLM,
  isLLMConfigured,
  getActiveProvider,
  WOLFRAM_APP_ID,
} from './llmService';
export type {
  LLMRequest,
  LLMMessage,
  LLMResponse,
} from './llmService';

// ── Knowledge Router ──────────────────────────────────────────────────────────
export {
  resolveKnowledge,
  resolveKnowledgeForUser,
  registerSource,
  removeSource,
  toggleSource,
  loadSources,
  logQuery,
  loadQueryLog,
  getQueryLogStats,
  getUnembeddedQueries,
  markQueryEmbedded,
} from './knowledgeRouter';
export type {
  KnowledgeSourceType,
  KnowledgeSourceConfig,
  KnowledgeResult,
  RouterQuery,
  QueryLogEntry,
} from './knowledgeRouter';

// ── Content Orchestrator ──────────────────────────────────────────────────────
export {
  orchestrateContent,
  orchestrateBatch,
  getOrchestratorConfig,
  updateOrchestratorConfig,
  getOrchestrationLog,
} from './contentOrchestratorService';
export type {
  ContentOrchestrationRequest,
  ContentOrchestrationResult,
  BatchOrchestrationRequest,
  OrchestratorConfig,
  VideoScript,
  ThumbnailBrief,
  InfographicSpec,
} from './contentOrchestratorService';

// ── Growth Orchestrator ───────────────────────────────────────────────────────
export { growthOrchestrator } from './growthOrchestrator';
export type { GrowthTrigger, GrowthCycleStatus, GrowthStrategy, PagePriorityItem, ContentFreshnessAlert } from './growthOrchestrator';

// ── Sage Persona Prompts ──────────────────────────────────────────────────────
export {
  buildSageSystemPrompt,
  buildPersonaSystemPrompt,
  runInputGuardRail,
  runOutputGuardRail,
} from './sagePersonaPrompts';
export type {
  SagePersonaConfig,
} from './sagePersonaPrompts';

// ── Growth Layer (additional services) ───────────────────────────────────────
export { websiteSeoService } from './websiteSeoService';
export type { PageType, PageMeta, SitemapEntry, SeoScore, KeywordSet, SchemaMarkup, SchemaType, ExamPageContext, BlogPostContext, PageContext } from './websiteSeoService';

export { landingPageEngine } from './landingPageEngine';
export type { SectionType, ContentSection, LandingPageConfig, ExamCalendarEntry } from './landingPageEngine';

export { acquisitionFunnelService } from './acquisitionFunnelService';
export type { FunnelStage, FunnelEventType, AttributionSource, FunnelEvent, FunnelMetrics, DropoffPoint, FunnelInsight } from './acquisitionFunnelService';

// Type re-exports for convenience
export * from '@/types/personalization';
export * from '@/types/teaching';
export * from '@/types/notebook';
