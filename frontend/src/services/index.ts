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

// Type re-exports for convenience
export * from '@/types/personalization';
export * from '@/types/teaching';
export * from '@/types/notebook';
