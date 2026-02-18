/**
 * User Management Types
 * Complete user lifecycle: registration, onboarding, exam config, preferences
 */

import type { UserRole, AuthProvider } from '../auth/types';

// ============================================
// EXAM & EDUCATION TYPES
// ============================================

export type ExamType = 
  | 'JEE_MAIN'
  | 'JEE_ADVANCED'
  | 'NEET'
  | 'CBSE_10'
  | 'CBSE_12'
  | 'ICSE_10'
  | 'ISC_12'
  | 'CAT'
  | 'UPSC'
  | 'GATE'
  | 'STATE_BOARDS'
  | 'OTHER';

export type Subject = 
  | 'physics'
  | 'chemistry'
  | 'mathematics'
  | 'biology'
  | 'english'
  | 'social_science'
  | 'computer_science'
  | 'economics'
  | 'accounts'
  | 'business_studies';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type LearningStyle = 'visual' | 'auditory' | 'reading' | 'kinesthetic' | 'mixed';

export type StudyPace = 'relaxed' | 'moderate' | 'intensive' | 'crash';

// ============================================
// USER PROFILE EXTENSIONS
// ============================================

export interface StudentProfile {
  // Education
  grade: number; // 6-12, or year for college
  board?: 'CBSE' | 'ICSE' | 'STATE' | 'IB' | 'OTHER';
  school?: string;
  city?: string;
  state?: string;
  
  // Primary exam target
  primaryExam: ExamType;
  primaryExamYear: number; // e.g., 2026
  primaryExamAttempt: number; // 1st, 2nd, 3rd attempt
  
  // Secondary exams
  secondaryExams: ExamType[];
  
  // Subject preferences
  subjects: SubjectPreference[];
  strongSubjects: Subject[];
  weakSubjects: Subject[];
  
  // Learning preferences
  learningStyle: LearningStyle;
  preferredLanguage: 'en' | 'hi' | 'hinglish' | 'regional';
  studyPace: StudyPace;
  dailyStudyHours: number;
  preferredStudyTime: 'morning' | 'afternoon' | 'evening' | 'night';
  
  // Goals
  targetScore?: number; // percentile or marks
  targetRank?: number;
  dreamColleges?: string[];
  
  // Calibration
  currentLevel: DifficultyLevel;
  diagnosticScore?: number;
  calibratedAt?: Date;
  
  // Parent link
  parentId?: string;
  parentNotifications: boolean;
}

export interface SubjectPreference {
  subject: Subject;
  enabled: boolean;
  priority: number; // 1 = highest
  currentLevel: DifficultyLevel;
  targetLevel: DifficultyLevel;
  weeklyHours: number;
}

export interface ParentProfile {
  // Children
  childrenIds: string[];
  
  // Notification preferences
  dailyDigest: boolean;
  weeklyReport: boolean;
  alertOnMissedSessions: boolean;
  alertOnLowScores: boolean;
  alertThreshold: number; // Score below which to alert
  
  // Communication
  preferredChannel: 'email' | 'whatsapp' | 'sms' | 'app';
  quietHoursStart?: string; // HH:MM
  quietHoursEnd?: string;
}

export interface TeacherProfile {
  // Teaching info
  subjects: Subject[];
  grades: number[];
  institution?: string;
  yearsExperience: number;
  
  // Student management
  studentIds: string[];
  maxStudents: number;
  
  // Content creation
  canCreateContent: boolean;
  contentReviewRequired: boolean;
}

// ============================================
// CHANNEL VERIFICATION
// ============================================

export type VerificationChannel = 'email' | 'phone_sms' | 'whatsapp' | 'telegram';

export type VerificationStatus = 'pending' | 'sent' | 'verified' | 'failed' | 'expired';

export interface ChannelVerification {
  channel: VerificationChannel;
  identifier: string; // email or phone number
  status: VerificationStatus;
  code?: string; // OTP
  codeExpiresAt?: Date;
  attempts: number;
  maxAttempts: number;
  verifiedAt?: Date;
  lastSentAt?: Date;
  telegramChatId?: string;
  whatsappId?: string;
}

// ============================================
// ONBOARDING
// ============================================

export type OnboardingStep = 
  | 'account_created'
  | 'email_verified'
  | 'phone_verified'
  | 'role_selected'
  | 'exam_selected'
  | 'subjects_configured'
  | 'learning_style_assessed'
  | 'channels_connected'
  | 'diagnostic_completed'
  | 'study_plan_created'
  | 'first_session_completed';

export interface OnboardingProgress {
  userId: string;
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  skippedSteps: OnboardingStep[];
  
  // Step data
  roleSelectedAt?: Date;
  examSelectedAt?: Date;
  diagnosticScore?: number;
  diagnosticCompletedAt?: Date;
  firstSessionAt?: Date;
  
  // Completion
  completedAt?: Date;
  completionPercent: number;
  
  // Timestamps
  startedAt: Date;
  lastActivityAt: Date;
}

// ============================================
// USER SETTINGS
// ============================================

export interface NotificationSettings {
  // Channels
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  telegramEnabled: boolean;
  
  // Types
  studyReminders: boolean;
  dailyGoals: boolean;
  weeklyReport: boolean;
  examAlerts: boolean;
  newContent: boolean;
  achievements: boolean;
  marketing: boolean;
  
  // Timing
  quietHoursEnabled: boolean;
  quietHoursStart: string; // HH:MM
  quietHoursEnd: string;
  timezone: string;
  
  // Frequency
  reminderFrequency: 'none' | 'once' | 'twice' | 'thrice';
  digestFrequency: 'daily' | 'weekly' | 'never';
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'friends' | 'private';
  showOnLeaderboard: boolean;
  showStreak: boolean;
  showProgress: boolean;
  allowDataForImprovement: boolean;
  allowPersonalization: boolean;
}

export interface AccessibilitySettings {
  fontSize: 'small' | 'medium' | 'large' | 'xl';
  highContrast: boolean;
  reduceMotion: boolean;
  screenReader: boolean;
  dyslexiaFont: boolean;
}

// ============================================
// COMPLETE USER ENTITY
// ============================================

export interface EduGeniusUser {
  // Core identity (from auth)
  id: string;
  email: string;
  phone?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  
  // Profile
  firstName: string;
  lastName: string;
  displayName: string;
  avatar?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  
  // Role
  role: UserRole;
  
  // Role-specific profiles
  studentProfile?: StudentProfile;
  parentProfile?: ParentProfile;
  teacherProfile?: TeacherProfile;
  
  // Channel verifications
  channelVerifications: ChannelVerification[];
  
  // Onboarding
  onboarding: OnboardingProgress;
  
  // Settings
  notificationSettings: NotificationSettings;
  privacySettings: PrivacySettings;
  accessibilitySettings: AccessibilitySettings;
  
  // Subscription
  subscriptionId?: string;
  planId: string;
  planName: string;
  planExpiresAt?: Date;
  
  // Gamification
  points: number;
  level: number;
  streak: number;
  longestStreak: number;
  badges: string[];
  
  // Activity
  totalStudyMinutes: number;
  questionsAnswered: number;
  sessionsCompleted: number;
  lastActiveAt: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// API REQUESTS/RESPONSES
// ============================================

export interface CreateUserRequest {
  // Required
  email: string;
  password?: string; // Optional for OAuth
  firstName: string;
  lastName: string;
  role: UserRole;
  
  // Optional
  phone?: string;
  provider?: AuthProvider;
  providerId?: string;
  inviteCode?: string;
  referralCode?: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatar?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
}

export interface UpdateStudentProfileRequest {
  grade?: number;
  board?: string;
  school?: string;
  primaryExam?: ExamType;
  primaryExamYear?: number;
  subjects?: SubjectPreference[];
  learningStyle?: LearningStyle;
  studyPace?: StudyPace;
  dailyStudyHours?: number;
  targetScore?: number;
}

export interface VerifyChannelRequest {
  channel: VerificationChannel;
  identifier: string; // email or phone
}

export interface ConfirmVerificationRequest {
  channel: VerificationChannel;
  identifier: string;
  code: string;
}

export interface ConnectTelegramRequest {
  telegramUserId: string;
  telegramUsername?: string;
  telegramChatId: string;
}

export interface ConnectWhatsAppRequest {
  phone: string;
  whatsappId: string;
}

// ============================================
// SEARCH & FILTERS
// ============================================

export interface UserSearchFilters {
  query?: string;
  role?: UserRole;
  status?: 'active' | 'inactive' | 'suspended';
  exam?: ExamType;
  grade?: number;
  subscriptionPlan?: string;
  onboardingComplete?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  lastActiveAfter?: Date;
  sortBy?: 'createdAt' | 'lastActiveAt' | 'name' | 'points';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface UserSearchResult {
  users: EduGeniusUser[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ============================================
// ADMIN OPERATIONS
// ============================================

export interface BulkUserAction {
  action: 'activate' | 'suspend' | 'delete' | 'reset_password' | 'send_notification';
  userIds: string[];
  reason?: string;
  notificationMessage?: string;
}

export interface UserActivityLog {
  id: string;
  userId: string;
  action: string;
  category: 'auth' | 'learning' | 'settings' | 'subscription' | 'admin';
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}
