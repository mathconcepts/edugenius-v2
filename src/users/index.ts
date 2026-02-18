/**
 * User Management Module
 * Complete user lifecycle: auth, onboarding, verification, settings
 */

// Types
export * from './types';

// Services
export { UserService, userService } from './service';
export { VerificationService, verificationService, VERIFICATION_DEPENDENCIES } from './verification';
export { ExamAdminService, examAdminService, DEFAULT_EXAM_CONFIGS } from './exam-admin';
export type { ExamAdminConfig, ExamEnrollment, ExamEnrollmentRequest } from './exam-admin';

// Onboarding
export {
  OnboardingFlow,
  createOnboardingFlow,
  ONBOARDING_STEPS,
  EXAM_CONFIGS,
  LEARNING_STYLE_QUESTIONS,
  determineLearningStyle,
} from './onboarding';
export type { OnboardingStepConfig, ExamConfig, LearningStyleQuestion } from './onboarding';

// Routes
export { userRoutes, setupUserRoutes } from './routes';

// Agent Hooks
export {
  registerAgentHooks,
  USER_EVENT_DEPENDENCIES,
  sageHooks,
  mentorHooks,
  oracleHooks,
  heraldHooks,
  atlasHooks,
  forgeHooks,
  examAdminHooks,
} from './agent-hooks';

// Re-export commonly used types
export type {
  EduGeniusUser,
  StudentProfile,
  ParentProfile,
  TeacherProfile,
  OnboardingProgress,
  OnboardingStep,
  ChannelVerification,
  VerificationChannel,
  ExamType,
  Subject,
  LearningStyle,
  StudyPace,
  DifficultyLevel,
  NotificationSettings,
  PrivacySettings,
  UserSearchFilters,
  UserSearchResult,
} from './types';
