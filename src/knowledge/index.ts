/**
 * Knowledge Module
 * Exam insights, best practices, and lessons learned
 */

export {
  ExamInsightsService,
  examInsightsService,
  EXAM_BEST_PRACTICES,
} from './exam-insights';

export type {
  ExamInsight,
  LessonLearned,
  TopperStory,
  InsightCategory,
  InsightSource,
} from './exam-insights';

// Agent hooks
export {
  sageInsightHooks,
  mentorInsightHooks,
  atlasInsightHooks,
  heraldInsightHooks,
  oracleInsightHooks,
  scoutInsightHooks,
  registerInsightHooks,
} from './agent-hooks';

// Routes
export { insightRoutes, setupInsightRoutes } from './routes';
