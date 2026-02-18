/**
 * User Onboarding Flow
 * Step-by-step guided onboarding with adaptive paths
 */

import type {
  EduGeniusUser,
  OnboardingStep,
  OnboardingProgress,
  ExamType,
  Subject,
  LearningStyle,
  StudyPace,
} from './types';
import type { UserRole } from '../auth/types';
import { userService } from './service';

// ============================================
// ONBOARDING CONFIGURATION
// ============================================

export interface OnboardingStepConfig {
  step: OnboardingStep;
  title: string;
  description: string;
  required: boolean;
  requiredFor: UserRole[];
  prerequisiteSteps: OnboardingStep[];
  estimatedMinutes: number;
  component: string; // Frontend component name
}

export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  {
    step: 'account_created',
    title: 'Account Created',
    description: 'Your account has been created successfully',
    required: true,
    requiredFor: ['student', 'parent', 'teacher', 'admin', 'ceo'],
    prerequisiteSteps: [],
    estimatedMinutes: 0,
    component: 'AccountCreated',
  },
  {
    step: 'email_verified',
    title: 'Verify Email',
    description: 'Confirm your email address to secure your account',
    required: true,
    requiredFor: ['student', 'parent', 'teacher', 'admin', 'ceo'],
    prerequisiteSteps: ['account_created'],
    estimatedMinutes: 2,
    component: 'EmailVerification',
  },
  {
    step: 'phone_verified',
    title: 'Verify Phone',
    description: 'Add your phone number for notifications and login',
    required: false,
    requiredFor: ['student', 'parent'],
    prerequisiteSteps: ['account_created'],
    estimatedMinutes: 2,
    component: 'PhoneVerification',
  },
  {
    step: 'role_selected',
    title: 'Select Your Role',
    description: 'Tell us how you\'ll be using EduGenius',
    required: true,
    requiredFor: ['student', 'parent', 'teacher'],
    prerequisiteSteps: ['account_created'],
    estimatedMinutes: 1,
    component: 'RoleSelector',
  },
  {
    step: 'exam_selected',
    title: 'Choose Your Exam',
    description: 'Select the exam you\'re preparing for',
    required: true,
    requiredFor: ['student'],
    prerequisiteSteps: ['role_selected'],
    estimatedMinutes: 1,
    component: 'ExamSelector',
  },
  {
    step: 'subjects_configured',
    title: 'Configure Subjects',
    description: 'Set up your subject preferences and priorities',
    required: true,
    requiredFor: ['student'],
    prerequisiteSteps: ['exam_selected'],
    estimatedMinutes: 2,
    component: 'SubjectConfig',
  },
  {
    step: 'learning_style_assessed',
    title: 'Learning Style Assessment',
    description: 'A quick quiz to understand how you learn best',
    required: false,
    requiredFor: ['student'],
    prerequisiteSteps: ['subjects_configured'],
    estimatedMinutes: 5,
    component: 'LearningStyleQuiz',
  },
  {
    step: 'channels_connected',
    title: 'Connect Channels',
    description: 'Connect WhatsApp or Telegram for seamless learning',
    required: false,
    requiredFor: ['student', 'parent'],
    prerequisiteSteps: ['role_selected'],
    estimatedMinutes: 2,
    component: 'ChannelConnect',
  },
  {
    step: 'diagnostic_completed',
    title: 'Diagnostic Test',
    description: 'Take a quick test to calibrate your starting level',
    required: false,
    requiredFor: ['student'],
    prerequisiteSteps: ['subjects_configured'],
    estimatedMinutes: 15,
    component: 'DiagnosticTest',
  },
  {
    step: 'study_plan_created',
    title: 'Create Study Plan',
    description: 'Let AI create a personalized study plan for you',
    required: false,
    requiredFor: ['student'],
    prerequisiteSteps: ['subjects_configured'],
    estimatedMinutes: 3,
    component: 'StudyPlanCreator',
  },
  {
    step: 'first_session_completed',
    title: 'First Learning Session',
    description: 'Complete your first AI tutoring session',
    required: false,
    requiredFor: ['student'],
    prerequisiteSteps: ['subjects_configured'],
    estimatedMinutes: 10,
    component: 'FirstSession',
  },
];

// ============================================
// EXAM CONFIGURATIONS
// ============================================

export interface ExamConfig {
  id: ExamType;
  name: string;
  fullName: string;
  subjects: Subject[];
  grades: number[];
  yearlyAttempts: number;
  examMonths: number[]; // 1-12
  description: string;
  icon: string;
  color: string;
}

export const EXAM_CONFIGS: ExamConfig[] = [
  {
    id: 'JEE_MAIN',
    name: 'JEE Main',
    fullName: 'Joint Entrance Examination Main',
    subjects: ['physics', 'chemistry', 'mathematics'],
    grades: [11, 12],
    yearlyAttempts: 2,
    examMonths: [1, 4],
    description: 'Entrance exam for NITs, IIITs, and other engineering colleges',
    icon: '🎯',
    color: '#3B82F6',
  },
  {
    id: 'JEE_ADVANCED',
    name: 'JEE Advanced',
    fullName: 'Joint Entrance Examination Advanced',
    subjects: ['physics', 'chemistry', 'mathematics'],
    grades: [11, 12],
    yearlyAttempts: 1,
    examMonths: [5],
    description: 'Entrance exam for IITs',
    icon: '🏆',
    color: '#8B5CF6',
  },
  {
    id: 'NEET',
    name: 'NEET',
    fullName: 'National Eligibility cum Entrance Test',
    subjects: ['physics', 'chemistry', 'biology'],
    grades: [11, 12],
    yearlyAttempts: 1,
    examMonths: [5],
    description: 'Entrance exam for medical colleges',
    icon: '🩺',
    color: '#10B981',
  },
  {
    id: 'CBSE_10',
    name: 'CBSE Class 10',
    fullName: 'CBSE Board Examinations - Class 10',
    subjects: ['mathematics', 'english', 'social_science', 'physics', 'chemistry', 'biology'],
    grades: [10],
    yearlyAttempts: 1,
    examMonths: [2, 3],
    description: 'CBSE board examinations for Class 10',
    icon: '📝',
    color: '#F59E0B',
  },
  {
    id: 'CBSE_12',
    name: 'CBSE Class 12',
    fullName: 'CBSE Board Examinations - Class 12',
    subjects: ['physics', 'chemistry', 'mathematics', 'biology', 'english'],
    grades: [12],
    yearlyAttempts: 1,
    examMonths: [2, 3],
    description: 'CBSE board examinations for Class 12',
    icon: '📚',
    color: '#EF4444',
  },
  {
    id: 'CAT',
    name: 'CAT',
    fullName: 'Common Admission Test',
    subjects: ['mathematics', 'english'],
    grades: [],
    yearlyAttempts: 1,
    examMonths: [11],
    description: 'Entrance exam for IIMs and top MBA colleges',
    icon: '💼',
    color: '#6366F1',
  },
  {
    id: 'UPSC',
    name: 'UPSC CSE',
    fullName: 'UPSC Civil Services Examination',
    subjects: ['social_science', 'english'],
    grades: [],
    yearlyAttempts: 1,
    examMonths: [5, 6],
    description: 'Civil Services Examination for IAS, IPS, IFS',
    icon: '🏛️',
    color: '#0EA5E9',
  },
  {
    id: 'GATE',
    name: 'GATE',
    fullName: 'Graduate Aptitude Test in Engineering',
    subjects: ['mathematics', 'physics', 'computer_science'],
    grades: [],
    yearlyAttempts: 1,
    examMonths: [2],
    description: 'Entrance exam for M.Tech and PSU jobs',
    icon: '⚙️',
    color: '#84CC16',
  },
];

// ============================================
// ONBOARDING FLOW MANAGER
// ============================================

export class OnboardingFlow {
  private userId: string;
  private user: EduGeniusUser | null = null;

  constructor(userId: string) {
    this.userId = userId;
  }

  async load(): Promise<void> {
    this.user = await userService.getUser(this.userId);
  }

  getRequiredSteps(): OnboardingStepConfig[] {
    if (!this.user) return [];

    return ONBOARDING_STEPS.filter(step => {
      if (!step.required) return false;
      return step.requiredFor.includes(this.user!.role);
    });
  }

  getOptionalSteps(): OnboardingStepConfig[] {
    if (!this.user) return [];

    return ONBOARDING_STEPS.filter(step => {
      if (step.required) return false;
      return step.requiredFor.includes(this.user!.role);
    });
  }

  getCurrentStep(): OnboardingStepConfig | null {
    if (!this.user) return null;

    const progress = this.user.onboarding;
    const allSteps = this.getRequiredSteps().concat(this.getOptionalSteps());

    for (const stepConfig of allSteps) {
      if (!progress.completedSteps.includes(stepConfig.step) &&
          !progress.skippedSteps.includes(stepConfig.step)) {
        // Check prerequisites
        const prereqsMet = stepConfig.prerequisiteSteps.every(
          prereq => progress.completedSteps.includes(prereq)
        );
        if (prereqsMet) {
          return stepConfig;
        }
      }
    }

    return null;
  }

  getNextSteps(count: number = 3): OnboardingStepConfig[] {
    if (!this.user) return [];

    const progress = this.user.onboarding;
    const allSteps = this.getRequiredSteps().concat(this.getOptionalSteps());
    const nextSteps: OnboardingStepConfig[] = [];

    for (const stepConfig of allSteps) {
      if (nextSteps.length >= count) break;
      
      if (!progress.completedSteps.includes(stepConfig.step) &&
          !progress.skippedSteps.includes(stepConfig.step)) {
        const prereqsMet = stepConfig.prerequisiteSteps.every(
          prereq => progress.completedSteps.includes(prereq)
        );
        if (prereqsMet) {
          nextSteps.push(stepConfig);
        }
      }
    }

    return nextSteps;
  }

  getProgress(): {
    completed: number;
    total: number;
    percent: number;
    estimatedMinutesRemaining: number;
  } {
    if (!this.user) {
      return { completed: 0, total: 0, percent: 0, estimatedMinutesRemaining: 0 };
    }

    const requiredSteps = this.getRequiredSteps();
    const completed = requiredSteps.filter(
      s => this.user!.onboarding.completedSteps.includes(s.step)
    ).length;
    const total = requiredSteps.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    const remainingSteps = requiredSteps.filter(
      s => !this.user!.onboarding.completedSteps.includes(s.step) &&
           !this.user!.onboarding.skippedSteps.includes(s.step)
    );
    const estimatedMinutesRemaining = remainingSteps.reduce(
      (sum, s) => sum + s.estimatedMinutes, 0
    );

    return { completed, total, percent, estimatedMinutesRemaining };
  }

  async completeStep(step: OnboardingStep): Promise<OnboardingProgress | null> {
    return userService.advanceOnboarding(this.userId, step);
  }

  async skipStep(step: OnboardingStep): Promise<OnboardingProgress | null> {
    return userService.skipOnboardingStep(this.userId, step);
  }

  isComplete(): boolean {
    if (!this.user) return false;
    return this.user.onboarding.completedAt !== undefined;
  }

  async selectRole(role: UserRole): Promise<void> {
    await userService.updateUser(this.userId, {} as any);
    // Role would be set via a dedicated method
    await this.completeStep('role_selected');
    await this.load(); // Refresh
  }

  async selectExam(
    examType: ExamType,
    examYear: number,
    subjects: Subject[]
  ): Promise<void> {
    await userService.setExamConfiguration(this.userId, {
      primaryExam: examType,
      primaryExamYear: examYear,
      subjects,
    });
    await this.completeStep('exam_selected');
    await this.completeStep('subjects_configured');
    await this.load();
  }

  async setLearningStyle(style: LearningStyle): Promise<void> {
    await userService.updateStudentProfile(this.userId, { learningStyle: style });
    await this.completeStep('learning_style_assessed');
    await this.load();
  }

  async setStudyPreferences(
    pace: StudyPace,
    dailyHours: number,
    preferredTime: 'morning' | 'afternoon' | 'evening' | 'night'
  ): Promise<void> {
    await userService.updateStudentProfile(this.userId, {
      studyPace: pace,
      dailyStudyHours: dailyHours,
    });
    await this.load();
  }
}

// ============================================
// LEARNING STYLE QUIZ
// ============================================

export interface LearningStyleQuestion {
  id: string;
  question: string;
  options: {
    text: string;
    style: LearningStyle;
  }[];
}

export const LEARNING_STYLE_QUESTIONS: LearningStyleQuestion[] = [
  {
    id: 'q1',
    question: 'When learning something new, I prefer to:',
    options: [
      { text: 'Watch a video or see diagrams', style: 'visual' },
      { text: 'Listen to an explanation', style: 'auditory' },
      { text: 'Read about it in detail', style: 'reading' },
      { text: 'Try it hands-on', style: 'kinesthetic' },
    ],
  },
  {
    id: 'q2',
    question: 'When I\'m stuck on a problem, I:',
    options: [
      { text: 'Draw it out or visualize it', style: 'visual' },
      { text: 'Talk through it out loud', style: 'auditory' },
      { text: 'Read the textbook again', style: 'reading' },
      { text: 'Work through similar examples', style: 'kinesthetic' },
    ],
  },
  {
    id: 'q3',
    question: 'I remember things best when I:',
    options: [
      { text: 'See pictures, charts, or graphs', style: 'visual' },
      { text: 'Hear them explained', style: 'auditory' },
      { text: 'Write them down', style: 'reading' },
      { text: 'Practice or do them myself', style: 'kinesthetic' },
    ],
  },
  {
    id: 'q4',
    question: 'In class, I learn best when the teacher:',
    options: [
      { text: 'Uses the whiteboard with diagrams', style: 'visual' },
      { text: 'Explains concepts verbally', style: 'auditory' },
      { text: 'Provides detailed notes', style: 'reading' },
      { text: 'Gives practical experiments', style: 'kinesthetic' },
    ],
  },
  {
    id: 'q5',
    question: 'When solving a Physics problem, I first:',
    options: [
      { text: 'Draw a diagram', style: 'visual' },
      { text: 'Recall the concept explanation', style: 'auditory' },
      { text: 'Read the problem multiple times', style: 'reading' },
      { text: 'Start calculating and adjust', style: 'kinesthetic' },
    ],
  },
];

export function determineLearningStyle(
  answers: Record<string, LearningStyle>
): LearningStyle {
  const counts: Record<LearningStyle, number> = {
    visual: 0,
    auditory: 0,
    reading: 0,
    kinesthetic: 0,
    mixed: 0,
  };

  for (const style of Object.values(answers)) {
    counts[style]++;
  }

  const maxCount = Math.max(...Object.values(counts).filter(c => c > 0));
  const topStyles = Object.entries(counts)
    .filter(([_, count]) => count === maxCount)
    .map(([style]) => style as LearningStyle);

  // If there's a clear winner or tie
  if (topStyles.length === 1) {
    return topStyles[0];
  } else {
    return 'mixed';
  }
}

// ============================================
// EXPORT
// ============================================

export function createOnboardingFlow(userId: string): OnboardingFlow {
  return new OnboardingFlow(userId);
}
