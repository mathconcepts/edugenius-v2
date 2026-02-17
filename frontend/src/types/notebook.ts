/**
 * Notebook Types - Comprehensive learning tracking system
 * Captures all practice, chat interactions, and learning progress
 */

// ============================================
// PRACTICE PROBLEMS & EXERCISES
// ============================================

export type ProblemSource = 
  | 'ai_tutor'        // From Sage AI tutoring sessions
  | 'practice'        // Self-initiated practice
  | 'assessment'      // From quizzes/tests
  | 'chatbot'         // From WhatsApp/Telegram/Web chat
  | 'recommended'     // AI-recommended problems
  | 'revision'        // Revision session problems
  | 'challenge'       // Daily/weekly challenges
  | 'peer';           // Shared by peers

export type ProblemDifficulty = 'easy' | 'medium' | 'hard' | 'olympiad';

export type ProblemStatus = 
  | 'attempted'       // Tried but not completed
  | 'solved'          // Correctly solved
  | 'incorrect'       // Attempted but wrong
  | 'skipped'         // Skipped without attempt
  | 'needs_review'    // Marked for review
  | 'mastered';       // Consistently correct

export interface PracticeProblem {
  id: string;
  question: string;
  questionLatex?: string;       // LaTeX version for math
  questionImage?: string;       // Image attachment
  subject: string;
  topic: string;
  subtopic?: string;
  difficulty: ProblemDifficulty;
  source: ProblemSource;
  sourceId?: string;            // Reference to chat session, assessment, etc.
  channelSource?: 'whatsapp' | 'telegram' | 'web' | 'app';
  
  // Solution tracking
  studentAnswer?: string;
  correctAnswer: string;
  solutionSteps?: string[];
  aiExplanation?: string;
  
  // Status & timestamps
  status: ProblemStatus;
  attemptCount: number;
  firstAttemptedAt: Date;
  lastAttemptedAt: Date;
  solvedAt?: Date;
  timeSpentSeconds: number;
  
  // Learning context
  hintsUsed: number;
  hintsAvailable: string[];
  relatedConcepts: string[];
  similarProblems: string[];    // IDs of similar problems
  
  // Spaced repetition
  nextReviewDate?: Date;
  easeFactor: number;           // SM-2 algorithm factor
  interval: number;             // Days until next review
  
  // Tags & organization
  tags: string[];
  isStarred: boolean;
  notes?: string;               // Student's personal notes
}

// ============================================
// CHAT INTERACTIONS
// ============================================

export interface ChatInteraction {
  id: string;
  sessionId: string;
  channel: 'whatsapp' | 'telegram' | 'web' | 'app' | 'google_meet';
  agentType: 'sage' | 'mentor' | 'atlas';
  
  // Content
  userMessage: string;
  aiResponse: string;
  
  // Classification
  interactionType: 'question' | 'clarification' | 'practice' | 'explanation' | 'motivation' | 'general';
  subject?: string;
  topic?: string;
  
  // Extracted problems (if any)
  extractedProblems: string[];  // Problem IDs
  
  // Metadata
  timestamp: Date;
  responseTimeMs: number;
  wasHelpful?: boolean;         // Student feedback
  followUpAsked: boolean;
}

// ============================================
// TOPIC MASTERY TRACKING
// ============================================

export type TopicStatus = 
  | 'not_started'
  | 'in_progress'
  | 'needs_practice'
  | 'pending_revision'
  | 'revised'
  | 'mastered';

export interface TopicProgress {
  id: string;
  subject: string;
  topic: string;
  subtopics: SubtopicProgress[];
  
  // Progress metrics
  status: TopicStatus;
  progressPercent: number;
  
  // Problem tracking
  totalProblems: number;
  solvedProblems: number;
  correctProblems: number;
  incorrectProblems: number;
  skippedProblems: number;
  
  // Time tracking
  timeSpentMinutes: number;
  lastStudiedAt?: Date;
  firstStudiedAt?: Date;
  
  // Spaced repetition
  nextRevisionDate?: Date;
  revisionCount: number;
  lastRevisionAt?: Date;
  
  // Confidence & mastery
  confidenceScore: number;      // 0-100
  masteryScore: number;         // 0-100 based on performance
  weakAreas: string[];          // Subtopics needing work
  
  // Related content
  relatedTopics: string[];
  prerequisites: string[];
  isPrerequisiteMet: boolean;
}

export interface SubtopicProgress {
  id: string;
  name: string;
  status: TopicStatus;
  progressPercent: number;
  problemsSolved: number;
  totalProblems: number;
  masteryScore: number;
}

// ============================================
// LEARNING PLANS
// ============================================

export type PlanType = 'daily' | 'weekly' | 'exam_prep' | 'remedial' | 'challenge';

export interface LearningPlan {
  id: string;
  name: string;
  type: PlanType;
  
  // Schedule
  startDate: Date;
  endDate: Date;
  dailyTargetMinutes: number;
  
  // Goals
  goals: LearningGoal[];
  
  // Content
  scheduledTopics: ScheduledTopic[];
  assignedProblems: string[];   // Problem IDs
  
  // Progress
  progressPercent: number;
  daysCompleted: number;
  totalDays: number;
  streakDays: number;
  
  // AI recommendations
  aiGenerated: boolean;
  adaptedAt?: Date;             // Last time AI adapted the plan
  
  // Status
  isActive: boolean;
  completedAt?: Date;
}

export interface LearningGoal {
  id: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string;                 // 'problems', 'topics', 'hours', 'accuracy%'
  deadline: Date;
  isCompleted: boolean;
}

export interface ScheduledTopic {
  id: string;
  topicId: string;
  topicName: string;
  subject: string;
  scheduledDate: Date;
  estimatedMinutes: number;
  actualMinutes?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'rescheduled';
  problems: string[];           // Problem IDs for this session
}

// ============================================
// NOTEBOOK ENTRIES (Personal Notes)
// ============================================

export type NotebookEntryType = 
  | 'equation'
  | 'text'
  | 'drawing'
  | 'ai_response'
  | 'formula'
  | 'concept_map'
  | 'summary'
  | 'question'
  | 'media'
  | 'voice_note';

export interface NotebookEntry {
  id: string;
  type: NotebookEntryType;
  content: string;
  latex?: string;
  mediaUrl?: string;
  timestamp: Date;
  
  // Context
  subject?: string;
  topic?: string;
  relatedProblemId?: string;
  
  // AI processing
  aiProcessed: boolean;
  aiSummary?: string;
  extractedFormulas?: string[];
  extractedConcepts?: string[];
  
  // Organization
  tags: string[];
  isStarred: boolean;
  color?: string;
}

// ============================================
// REVISION & SPACED REPETITION
// ============================================

export interface RevisionSession {
  id: string;
  startedAt: Date;
  completedAt?: Date;
  
  // Content
  problemIds: string[];
  completedProblemIds: string[];
  
  // Performance
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  
  // Topics covered
  topicsCovered: string[];
  
  // Type
  sessionType: 'spaced_repetition' | 'weak_areas' | 'full_revision' | 'quick_review';
}

export interface RevisionSchedule {
  problemId: string;
  nextReviewDate: Date;
  interval: number;
  easeFactor: number;
  repetitions: number;
  lastReviewGrade: number;      // 0-5 (SM-2 grade)
}

// ============================================
// ANALYTICS & INSIGHTS
// ============================================

export interface NotebookAnalytics {
  // Overall stats
  totalProblems: number;
  totalSolved: number;
  totalTimeMinutes: number;
  overallAccuracy: number;
  currentStreak: number;
  longestStreak: number;
  
  // By difficulty
  byDifficulty: Record<ProblemDifficulty, {
    total: number;
    solved: number;
    accuracy: number;
    avgTimeSeconds: number;
  }>;
  
  // By subject
  bySubject: Record<string, {
    total: number;
    solved: number;
    accuracy: number;
    masteryScore: number;
  }>;
  
  // Time distribution
  timeByDay: Record<string, number>;        // ISO date -> minutes
  timeBySubject: Record<string, number>;
  
  // Weak & strong areas
  weakTopics: string[];
  strongTopics: string[];
  
  // Recommendations
  focusAreas: string[];
  nextSteps: string[];
}

// ============================================
// ACHIEVEMENTS & GAMIFICATION
// ============================================

export interface NotebookAchievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'consistency' | 'mastery' | 'speed' | 'challenge' | 'exploration';
  
  // Progress
  isUnlocked: boolean;
  unlockedAt?: Date;
  progress: number;
  target: number;
  
  // Reward
  xpReward: number;
  badgeId?: string;
}

// ============================================
// FILTER & SEARCH
// ============================================

export interface NotebookFilters {
  subjects?: string[];
  topics?: string[];
  difficulty?: ProblemDifficulty[];
  status?: ProblemStatus[];
  source?: ProblemSource[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  isStarred?: boolean;
  needsReview?: boolean;
  searchQuery?: string;
}

export interface NotebookSortOptions {
  field: 'timestamp' | 'difficulty' | 'status' | 'topic' | 'timeSpent';
  direction: 'asc' | 'desc';
}
