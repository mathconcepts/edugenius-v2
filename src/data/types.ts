/**
 * EduGenius Data Layer - Core Types
 * Entity definitions for the EdTech platform
 */

// ============================================================================
// Base Types
// ============================================================================

export type UUID = string;
export type Timestamp = number;
export type ISODateString = string;

export interface BaseEntity {
  id: UUID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;  // Optimistic locking
}

export interface SoftDeletable {
  deletedAt?: Timestamp;
  isDeleted: boolean;
}

export interface Auditable {
  createdBy: UUID;
  updatedBy?: UUID;
}

// ============================================================================
// User Entities
// ============================================================================

export type UserRole = 'owner' | 'admin' | 'teacher' | 'student' | 'parent';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';
export type SubscriptionTier = 'free' | 'basic' | 'premium' | 'enterprise';

export interface User extends BaseEntity, SoftDeletable {
  email: string;
  phone?: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string;
  preferences: UserPreferences;
  metadata: Record<string, unknown>;
}

export interface UserPreferences {
  language: string;
  timezone: string;
  theme: 'light' | 'dark' | 'system';
  notifications: NotificationPreferences;
  accessibility: AccessibilityPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  whatsapp: boolean;
  sms: boolean;
  digest: 'none' | 'daily' | 'weekly';
}

export interface AccessibilityPreferences {
  fontSize: 'small' | 'medium' | 'large';
  highContrast: boolean;
  reducedMotion: boolean;
  screenReader: boolean;
}

// ============================================================================
// Student Entity
// ============================================================================

export interface Student extends BaseEntity {
  userId: UUID;
  grade: string;
  school?: string;
  board?: string;  // CBSE, ICSE, State Board, etc.
  exams: StudentExam[];
  subscription: StudentSubscription;
  progress: StudentProgress;
  engagement: StudentEngagement;
  parentIds: UUID[];
}

export interface StudentExam {
  examId: UUID;
  enrolledAt: Timestamp;
  targetScore?: number;
  status: 'preparing' | 'active' | 'completed' | 'dropped';
}

export interface StudentSubscription {
  tier: SubscriptionTier;
  startedAt: Timestamp;
  expiresAt?: Timestamp;
  features: string[];
  limits: {
    dailyChats: number;
    monthlyContent: number;
    premiumFeatures: string[];
  };
}

export interface StudentProgress {
  subjects: Record<string, SubjectProgress>;
  overallMastery: number;  // 0-100
  streakDays: number;
  totalStudyMinutes: number;
  lastActiveAt: Timestamp;
}

export interface SubjectProgress {
  subjectId: UUID;
  masteryLevel: number;  // 0-100
  topicsCompleted: number;
  topicsTotal: number;
  lastStudiedAt: Timestamp;
  weakAreas: string[];
  strongAreas: string[];
}

export interface StudentEngagement {
  churnRisk: number;  // 0-1
  engagementScore: number;  // 0-100
  lastSessionAt: Timestamp;
  sessionsThisWeek: number;
  averageSessionMinutes: number;
  badges: Badge[];
  achievements: Achievement[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: Timestamp;
}

export interface Achievement {
  id: string;
  type: 'streak' | 'mastery' | 'completion' | 'social' | 'special';
  name: string;
  progress: number;
  target: number;
  completedAt?: Timestamp;
}

// ============================================================================
// Content Entities
// ============================================================================

export type ContentType = 
  | 'lesson' 
  | 'quiz' 
  | 'practice' 
  | 'summary' 
  | 'video' 
  | 'infographic'
  | 'blog'
  | 'social';

export type ContentStatus = 
  | 'draft' 
  | 'review' 
  | 'approved' 
  | 'published' 
  | 'archived';

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'expert';

export interface Content extends BaseEntity, SoftDeletable, Auditable {
  type: ContentType;
  status: ContentStatus;
  title: string;
  slug: string;
  description?: string;
  body: ContentBody;
  metadata: ContentMetadata;
  seo: SEOMetadata;
  targeting: ContentTargeting;
  analytics: ContentAnalytics;
  embedding?: number[];  // Vector embedding for search
}

export interface ContentBody {
  format: 'markdown' | 'html' | 'json' | 'blocks';
  content: string;
  sections?: ContentSection[];
  mediaAssets: MediaAsset[];
}

export interface ContentSection {
  id: string;
  type: 'text' | 'image' | 'video' | 'quiz' | 'code' | 'math' | 'interactive';
  title?: string;
  content: string;
  order: number;
}

export interface MediaAsset {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'interactive';
  url: string;
  cdnUrl?: string;
  mimeType: string;
  size: number;
  dimensions?: { width: number; height: number };
  duration?: number;  // For video/audio
  alt?: string;
  caption?: string;
}

export interface ContentMetadata {
  subject: string;
  topics: string[];
  subtopics: string[];
  difficulty: DifficultyLevel;
  estimatedMinutes: number;
  language: string;
  board?: string;
  grade?: string;
  examIds: UUID[];
  prerequisites: UUID[];
  relatedContent: UUID[];
  tags: string[];
  version: number;
}

export interface SEOMetadata {
  metaTitle?: string;
  metaDescription?: string;
  keywords: string[];
  canonicalUrl?: string;
  ogImage?: string;
  structuredData?: Record<string, unknown>;
}

export interface ContentTargeting {
  audiences: string[];
  grades: string[];
  boards: string[];
  exams: UUID[];
  geoTargets?: string[];
  schedulePublishAt?: Timestamp;
  scheduleUnpublishAt?: Timestamp;
}

export interface ContentAnalytics {
  views: number;
  uniqueViews: number;
  completions: number;
  averageTimeSpent: number;
  rating: number;
  ratingCount: number;
  shares: number;
  bookmarks: number;
}

// ============================================================================
// Exam Entities
// ============================================================================

export type ExamCategory = 
  | 'entrance' 
  | 'competitive' 
  | 'board' 
  | 'certification' 
  | 'olympiad';

export interface Exam extends BaseEntity, SoftDeletable {
  name: string;
  slug: string;
  shortName: string;
  category: ExamCategory;
  description: string;
  conductedBy: string;
  website?: string;
  syllabus: ExamSyllabus;
  schedule: ExamSchedule;
  eligibility: ExamEligibility;
  pattern: ExamPattern;
  metadata: ExamMetadata;
  isActive: boolean;
}

export interface ExamSyllabus {
  subjects: ExamSubject[];
  lastUpdated: Timestamp;
  sourceUrl?: string;
  version: string;
}

export interface ExamSubject {
  id: UUID;
  name: string;
  weightage: number;  // Percentage
  topics: ExamTopic[];
}

export interface ExamTopic {
  id: UUID;
  name: string;
  subtopics: string[];
  importance: 'low' | 'medium' | 'high' | 'critical';
  estimatedHours: number;
}

export interface ExamSchedule {
  registrationStart?: ISODateString;
  registrationEnd?: ISODateString;
  examDate?: ISODateString;
  examDates?: ISODateString[];  // For multi-day exams
  resultDate?: ISODateString;
  frequency: 'annual' | 'biannual' | 'quarterly' | 'monthly' | 'on-demand';
}

export interface ExamEligibility {
  minAge?: number;
  maxAge?: number;
  minEducation?: string;
  boards?: string[];
  nationality?: string[];
  otherCriteria?: string[];
}

export interface ExamPattern {
  totalMarks: number;
  passingMarks?: number;
  duration: number;  // Minutes
  sections: ExamPatternSection[];
  negativeMarking?: {
    enabled: boolean;
    ratio: number;  // e.g., 0.25 for -1/4
  };
  mode: 'online' | 'offline' | 'hybrid';
}

export interface ExamPatternSection {
  name: string;
  subject?: string;
  totalQuestions: number;
  attemptRequired: number;
  marksPerQuestion: number;
  questionTypes: ('mcq' | 'numerical' | 'descriptive' | 'matching')[];
}

export interface ExamMetadata {
  competitors: string[];
  averageCutoff?: number;
  totalSeats?: number;
  applicantsLastYear?: number;
  difficulty: DifficultyLevel;
  popularity: number;  // 1-10
  tags: string[];
}

// ============================================================================
// Session Entities
// ============================================================================

export type SessionType = 'chat' | 'quiz' | 'practice' | 'lesson' | 'assessment';
export type SessionChannel = 'web' | 'app' | 'whatsapp' | 'telegram';

export interface TutoringSession extends BaseEntity {
  studentId: UUID;
  type: SessionType;
  channel: SessionChannel;
  subject?: string;
  topic?: string;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  messages: SessionMessage[];
  context: SessionContext;
  metrics: SessionMetrics;
  endedAt?: Timestamp;
}

export interface SessionMessage {
  id: string;
  role: 'student' | 'tutor' | 'system';
  content: string;
  attachments?: MediaAsset[];
  timestamp: Timestamp;
  metadata?: {
    model?: string;
    tokens?: number;
    latencyMs?: number;
    confidence?: number;
  };
}

export interface SessionContext {
  previousTopics: string[];
  currentMastery: number;
  learningStyle?: 'visual' | 'auditory' | 'reading' | 'kinesthetic';
  emotionalState?: 'confident' | 'neutral' | 'frustrated' | 'confused';
  preferences: {
    hintLevel: 'minimal' | 'moderate' | 'detailed';
    pace: 'slow' | 'normal' | 'fast';
    language: string;
  };
}

export interface SessionMetrics {
  duration: number;  // Seconds
  messageCount: number;
  questionsAsked: number;
  questionsAnswered: number;
  hintsUsed: number;
  correctAnswers: number;
  masteryChange: number;
  engagementScore: number;
}

// ============================================================================
// Analytics Entities
// ============================================================================

export interface AnalyticsEvent extends BaseEntity {
  eventType: string;
  userId?: UUID;
  studentId?: UUID;
  sessionId?: UUID;
  contentId?: UUID;
  properties: Record<string, unknown>;
  context: EventContext;
}

export interface EventContext {
  channel: string;
  platform: string;
  deviceType: string;
  browser?: string;
  os?: string;
  ip?: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  referrer?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
}

export interface DailyMetrics extends BaseEntity {
  date: ISODateString;
  scope: 'global' | 'exam' | 'subject' | 'content';
  scopeId?: UUID;
  metrics: {
    activeUsers: number;
    newUsers: number;
    sessions: number;
    avgSessionDuration: number;
    contentViews: number;
    contentCompletions: number;
    questionsAnswered: number;
    correctAnswerRate: number;
    churnRate: number;
    nps?: number;
    revenue?: number;
  };
}

// ============================================================================
// Agent State
// ============================================================================

export interface AgentState extends BaseEntity {
  agentId: string;
  status: 'active' | 'idle' | 'blocked' | 'offline';
  currentTask?: {
    taskId: string;
    type: string;
    startedAt: Timestamp;
    progress: number;
  };
  budget: {
    dailyLimit: number;
    used: number;
    lastResetAt: Timestamp;
  };
  metrics: {
    tasksCompleted: number;
    tasksToday: number;
    avgLatencyMs: number;
    errorRate: number;
    lastActivityAt: Timestamp;
  };
  config: Record<string, unknown>;
}

// ============================================================================
// Query Types
// ============================================================================

export interface PaginationParams {
  page: number;
  limit: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface SortParams {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FilterOperator {
  eq?: unknown;
  ne?: unknown;
  gt?: unknown;
  gte?: unknown;
  lt?: unknown;
  lte?: unknown;
  in?: unknown[];
  notIn?: unknown[];
  contains?: string;
  startsWith?: string;
  endsWith?: string;
  isNull?: boolean;
}

export type FilterParams<T> = {
  [K in keyof T]?: FilterOperator | T[K];
};

export interface QueryParams<T> {
  filters?: FilterParams<T>;
  sort?: SortParams[];
  pagination?: PaginationParams;
  include?: string[];  // Relations to include
  select?: (keyof T)[];  // Fields to select
}
