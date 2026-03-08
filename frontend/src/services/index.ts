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
  AgentId,
} from './examOrchestrator';

// Signal Bus — Exam Lifecycle Emitters
export {
  emitExamApproved,
  emitContentReady,
  emitContentVerified,
  emitExamDeployed,
  emitPerformanceInsight,
  emitStudentEnrolled,
} from './signalBus';

// Type re-exports for convenience
export * from '@/types/personalization';
export * from '@/types/teaching';
export * from '@/types/notebook';
