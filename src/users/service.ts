/**
 * User Management Service
 * Complete user lifecycle management
 */

import { EventEmitter } from 'events';
import type {
  EduGeniusUser,
  StudentProfile,
  ParentProfile,
  TeacherProfile,
  OnboardingProgress,
  OnboardingStep,
  ChannelVerification,
  VerificationChannel,
  NotificationSettings,
  PrivacySettings,
  AccessibilitySettings,
  CreateUserRequest,
  UpdateUserRequest,
  UpdateStudentProfileRequest,
  UserSearchFilters,
  UserSearchResult,
  BulkUserAction,
  UserActivityLog,
  ExamType,
  Subject,
} from './types';
import type { UserRole } from '../auth/types';

// ============================================
// USER SERVICE
// ============================================

export class UserService {
  private users: Map<string, EduGeniusUser> = new Map();
  private activityLogs: UserActivityLog[] = [];
  private events: EventEmitter = new EventEmitter();

  // ============================================
  // USER CRUD
  // ============================================

  async createUser(request: CreateUserRequest): Promise<EduGeniusUser> {
    const userId = this.generateId();
    
    const user: EduGeniusUser = {
      id: userId,
      email: request.email.toLowerCase(),
      phone: request.phone,
      emailVerified: false,
      phoneVerified: false,
      
      firstName: request.firstName,
      lastName: request.lastName,
      displayName: `${request.firstName} ${request.lastName}`,
      
      role: request.role,
      
      // Initialize role-specific profiles
      studentProfile: request.role === 'student' ? this.createDefaultStudentProfile() : undefined,
      parentProfile: request.role === 'parent' ? this.createDefaultParentProfile() : undefined,
      teacherProfile: request.role === 'teacher' ? this.createDefaultTeacherProfile() : undefined,
      
      channelVerifications: [],
      
      onboarding: {
        userId,
        currentStep: 'account_created',
        completedSteps: ['account_created'],
        skippedSteps: [],
        completionPercent: 10,
        startedAt: new Date(),
        lastActivityAt: new Date(),
      },
      
      notificationSettings: this.createDefaultNotificationSettings(),
      privacySettings: this.createDefaultPrivacySettings(),
      accessibilitySettings: this.createDefaultAccessibilitySettings(),
      
      planId: 'free',
      planName: 'Free Plan',
      
      points: 0,
      level: 1,
      streak: 0,
      longestStreak: 0,
      badges: [],
      
      totalStudyMinutes: 0,
      questionsAnswered: 0,
      sessionsCompleted: 0,
      lastActiveAt: new Date(),
      
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(userId, user);
    this.logActivity(userId, 'user_created', 'auth', { role: request.role });
    this.events.emit('user:created', user);

    return user;
  }

  async getUser(userId: string): Promise<EduGeniusUser | null> {
    return this.users.get(userId) || null;
  }

  async getUserByEmail(email: string): Promise<EduGeniusUser | null> {
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return user;
      }
    }
    return null;
  }

  async getUserByPhone(phone: string): Promise<EduGeniusUser | null> {
    const normalizedPhone = this.normalizePhone(phone);
    for (const user of this.users.values()) {
      if (user.phone && this.normalizePhone(user.phone) === normalizedPhone) {
        return user;
      }
    }
    return null;
  }

  async updateUser(userId: string, updates: UpdateUserRequest): Promise<EduGeniusUser | null> {
    const user = this.users.get(userId);
    if (!user) return null;

    const updatedUser: EduGeniusUser = {
      ...user,
      ...updates,
      displayName: updates.displayName || `${updates.firstName || user.firstName} ${updates.lastName || user.lastName}`,
      updatedAt: new Date(),
    };

    this.users.set(userId, updatedUser);
    this.logActivity(userId, 'user_updated', 'settings', { fields: Object.keys(updates) });
    this.events.emit('user:updated', updatedUser);

    return updatedUser;
  }

  async deleteUser(userId: string, reason?: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;

    this.logActivity(userId, 'user_deleted', 'admin', { reason });
    this.users.delete(userId);
    this.events.emit('user:deleted', { userId, reason });

    return true;
  }

  async searchUsers(filters: UserSearchFilters): Promise<UserSearchResult> {
    let results = Array.from(this.users.values());

    // Apply filters
    if (filters.query) {
      const query = filters.query.toLowerCase();
      results = results.filter(u => 
        u.email.includes(query) ||
        u.firstName.toLowerCase().includes(query) ||
        u.lastName.toLowerCase().includes(query) ||
        u.displayName.toLowerCase().includes(query)
      );
    }

    if (filters.role) {
      results = results.filter(u => u.role === filters.role);
    }

    if (filters.exam && filters.role === 'student') {
      results = results.filter(u => u.studentProfile?.primaryExam === filters.exam);
    }

    if (filters.grade && filters.role === 'student') {
      results = results.filter(u => u.studentProfile?.grade === filters.grade);
    }

    if (filters.onboardingComplete !== undefined) {
      results = results.filter(u => 
        filters.onboardingComplete 
          ? u.onboarding.completedAt !== undefined
          : u.onboarding.completedAt === undefined
      );
    }

    // Sort
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';
    results.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortBy) {
        case 'name':
          aVal = a.displayName;
          bVal = b.displayName;
          break;
        case 'lastActiveAt':
          aVal = a.lastActiveAt;
          bVal = b.lastActiveAt;
          break;
        case 'points':
          aVal = a.points;
          bVal = b.points;
          break;
        default:
          aVal = a.createdAt;
          bVal = b.createdAt;
      }
      return sortOrder === 'asc' 
        ? (aVal > bVal ? 1 : -1)
        : (aVal < bVal ? 1 : -1);
    });

    const total = results.length;
    const offset = filters.offset || 0;
    const limit = filters.limit || 20;
    results = results.slice(offset, offset + limit);

    return {
      users: results,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  // ============================================
  // STUDENT PROFILE
  // ============================================

  async updateStudentProfile(
    userId: string, 
    updates: UpdateStudentProfileRequest
  ): Promise<StudentProfile | null> {
    const user = this.users.get(userId);
    if (!user || user.role !== 'student') return null;

    const updatedProfile: StudentProfile = {
      ...user.studentProfile!,
      ...updates,
    };

    user.studentProfile = updatedProfile;
    user.updatedAt = new Date();
    this.users.set(userId, user);

    this.logActivity(userId, 'student_profile_updated', 'settings', { fields: Object.keys(updates) });
    this.events.emit('user:profile:updated', { userId, profile: updatedProfile });

    // Trigger agent adaptations
    if (updates.primaryExam || updates.subjects) {
      this.events.emit('user:exam:changed', { userId, exam: updatedProfile.primaryExam });
    }

    return updatedProfile;
  }

  async setExamConfiguration(
    userId: string,
    config: {
      primaryExam: ExamType;
      primaryExamYear: number;
      secondaryExams?: ExamType[];
      subjects: Subject[];
      targetScore?: number;
    }
  ): Promise<StudentProfile | null> {
    const user = this.users.get(userId);
    if (!user || user.role !== 'student') return null;

    const subjectPrefs = config.subjects.map((subject, index) => ({
      subject,
      enabled: true,
      priority: index + 1,
      currentLevel: 'beginner' as const,
      targetLevel: 'advanced' as const,
      weeklyHours: 5,
    }));

    return this.updateStudentProfile(userId, {
      primaryExam: config.primaryExam,
      primaryExamYear: config.primaryExamYear,
      subjects: subjectPrefs,
      targetScore: config.targetScore,
    });
  }

  // ============================================
  // CHANNEL VERIFICATION
  // ============================================

  async initiateChannelVerification(
    userId: string,
    channel: VerificationChannel,
    identifier: string
  ): Promise<ChannelVerification> {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');

    const code = this.generateOTP();
    const verification: ChannelVerification = {
      channel,
      identifier,
      status: 'pending',
      code,
      codeExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      attempts: 0,
      maxAttempts: 3,
      lastSentAt: new Date(),
    };

    // Update user's channel verifications
    const existingIndex = user.channelVerifications.findIndex(
      v => v.channel === channel
    );
    if (existingIndex >= 0) {
      user.channelVerifications[existingIndex] = verification;
    } else {
      user.channelVerifications.push(verification);
    }
    this.users.set(userId, user);

    // Emit event to send verification code
    this.events.emit('verification:send', {
      userId,
      channel,
      identifier,
      code,
    });

    this.logActivity(userId, 'verification_initiated', 'auth', { channel });
    
    // Return without code for security
    return { ...verification, code: undefined };
  }

  async confirmChannelVerification(
    userId: string,
    channel: VerificationChannel,
    code: string
  ): Promise<{ success: boolean; error?: string }> {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: 'User not found' };

    const verification = user.channelVerifications.find(v => v.channel === channel);
    if (!verification) return { success: false, error: 'No pending verification' };

    if (verification.status === 'verified') {
      return { success: true };
    }

    if (verification.attempts >= verification.maxAttempts) {
      verification.status = 'failed';
      this.users.set(userId, user);
      return { success: false, error: 'Max attempts exceeded' };
    }

    if (verification.codeExpiresAt && new Date() > verification.codeExpiresAt) {
      verification.status = 'expired';
      this.users.set(userId, user);
      return { success: false, error: 'Code expired' };
    }

    verification.attempts++;

    if (verification.code !== code) {
      this.users.set(userId, user);
      return { success: false, error: 'Invalid code' };
    }

    // Success!
    verification.status = 'verified';
    verification.verifiedAt = new Date();
    verification.code = undefined;

    // Update user verified flags
    if (channel === 'email') {
      user.emailVerified = true;
      this.advanceOnboarding(userId, 'email_verified');
    } else if (channel === 'phone_sms' || channel === 'whatsapp') {
      user.phoneVerified = true;
      this.advanceOnboarding(userId, 'phone_verified');
    }

    this.users.set(userId, user);
    this.logActivity(userId, 'verification_confirmed', 'auth', { channel });
    this.events.emit('verification:confirmed', { userId, channel });

    return { success: true };
  }

  async connectTelegram(
    userId: string,
    telegramUserId: string,
    telegramChatId: string,
    telegramUsername?: string
  ): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;

    const verification: ChannelVerification = {
      channel: 'telegram',
      identifier: telegramUsername || telegramUserId,
      status: 'verified',
      attempts: 0,
      maxAttempts: 3,
      verifiedAt: new Date(),
      telegramChatId,
    };

    const existingIndex = user.channelVerifications.findIndex(
      v => v.channel === 'telegram'
    );
    if (existingIndex >= 0) {
      user.channelVerifications[existingIndex] = verification;
    } else {
      user.channelVerifications.push(verification);
    }

    this.users.set(userId, user);
    this.advanceOnboarding(userId, 'channels_connected');
    this.events.emit('channel:connected', { userId, channel: 'telegram', chatId: telegramChatId });

    return true;
  }

  async connectWhatsApp(
    userId: string,
    phone: string,
    whatsappId: string
  ): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;

    user.phone = phone;
    
    const verification: ChannelVerification = {
      channel: 'whatsapp',
      identifier: phone,
      status: 'verified',
      attempts: 0,
      maxAttempts: 3,
      verifiedAt: new Date(),
      whatsappId,
    };

    const existingIndex = user.channelVerifications.findIndex(
      v => v.channel === 'whatsapp'
    );
    if (existingIndex >= 0) {
      user.channelVerifications[existingIndex] = verification;
    } else {
      user.channelVerifications.push(verification);
    }

    this.users.set(userId, user);
    this.advanceOnboarding(userId, 'channels_connected');
    this.events.emit('channel:connected', { userId, channel: 'whatsapp', whatsappId });

    return true;
  }

  // ============================================
  // ONBOARDING
  // ============================================

  async getOnboardingProgress(userId: string): Promise<OnboardingProgress | null> {
    const user = this.users.get(userId);
    return user?.onboarding || null;
  }

  async advanceOnboarding(userId: string, step: OnboardingStep): Promise<OnboardingProgress | null> {
    const user = this.users.get(userId);
    if (!user) return null;

    const onboarding = user.onboarding;
    
    if (!onboarding.completedSteps.includes(step)) {
      onboarding.completedSteps.push(step);
    }

    onboarding.currentStep = step;
    onboarding.lastActivityAt = new Date();
    onboarding.completionPercent = this.calculateOnboardingPercent(onboarding.completedSteps);

    // Check if onboarding is complete
    const requiredSteps: OnboardingStep[] = [
      'account_created',
      'email_verified',
      'role_selected',
      'exam_selected',
      'subjects_configured',
    ];
    
    const allRequired = requiredSteps.every(s => onboarding.completedSteps.includes(s));
    if (allRequired && !onboarding.completedAt) {
      onboarding.completedAt = new Date();
      this.events.emit('onboarding:completed', { userId });
    }

    this.users.set(userId, user);
    this.events.emit('onboarding:step:completed', { userId, step });

    return onboarding;
  }

  async skipOnboardingStep(userId: string, step: OnboardingStep): Promise<OnboardingProgress | null> {
    const user = this.users.get(userId);
    if (!user) return null;

    if (!user.onboarding.skippedSteps.includes(step)) {
      user.onboarding.skippedSteps.push(step);
    }

    this.users.set(userId, user);
    return user.onboarding;
  }

  // ============================================
  // SETTINGS
  // ============================================

  async updateNotificationSettings(
    userId: string,
    settings: Partial<NotificationSettings>
  ): Promise<NotificationSettings | null> {
    const user = this.users.get(userId);
    if (!user) return null;

    user.notificationSettings = { ...user.notificationSettings, ...settings };
    user.updatedAt = new Date();
    this.users.set(userId, user);

    this.logActivity(userId, 'notification_settings_updated', 'settings');
    return user.notificationSettings;
  }

  async updatePrivacySettings(
    userId: string,
    settings: Partial<PrivacySettings>
  ): Promise<PrivacySettings | null> {
    const user = this.users.get(userId);
    if (!user) return null;

    user.privacySettings = { ...user.privacySettings, ...settings };
    user.updatedAt = new Date();
    this.users.set(userId, user);

    this.logActivity(userId, 'privacy_settings_updated', 'settings');
    return user.privacySettings;
  }

  // ============================================
  // ADMIN OPERATIONS
  // ============================================

  async bulkAction(action: BulkUserAction): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const userId of action.userIds) {
      try {
        switch (action.action) {
          case 'suspend':
            await this.suspendUser(userId, action.reason);
            break;
          case 'activate':
            await this.activateUser(userId);
            break;
          case 'delete':
            await this.deleteUser(userId, action.reason);
            break;
          case 'send_notification':
            this.events.emit('notification:send', { userId, message: action.notificationMessage });
            break;
        }
        success++;
      } catch {
        failed++;
      }
    }

    return { success, failed };
  }

  async suspendUser(userId: string, reason?: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;

    // Add suspended flag (would be in status field)
    this.logActivity(userId, 'user_suspended', 'admin', { reason });
    this.events.emit('user:suspended', { userId, reason });
    return true;
  }

  async activateUser(userId: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;

    this.logActivity(userId, 'user_activated', 'admin');
    this.events.emit('user:activated', { userId });
    return true;
  }

  async getActivityLogs(
    userId: string,
    options?: { limit?: number; offset?: number; category?: string }
  ): Promise<UserActivityLog[]> {
    let logs = this.activityLogs.filter(l => l.userId === userId);
    
    if (options?.category) {
      logs = logs.filter(l => l.category === options.category);
    }

    logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = options?.offset || 0;
    const limit = options?.limit || 50;
    return logs.slice(offset, offset + limit);
  }

  // ============================================
  // HELPERS
  // ============================================

  private generateId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  private calculateOnboardingPercent(completedSteps: OnboardingStep[]): number {
    const totalSteps = 11; // All possible steps
    return Math.round((completedSteps.length / totalSteps) * 100);
  }

  private logActivity(
    userId: string,
    action: string,
    category: 'auth' | 'learning' | 'settings' | 'subscription' | 'admin',
    metadata?: Record<string, unknown>
  ): void {
    this.activityLogs.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      action,
      category,
      metadata,
      createdAt: new Date(),
    });
  }

  private createDefaultStudentProfile(): StudentProfile {
    return {
      grade: 11,
      primaryExam: 'JEE_MAIN',
      primaryExamYear: new Date().getFullYear() + 1,
      primaryExamAttempt: 1,
      secondaryExams: [],
      subjects: [],
      strongSubjects: [],
      weakSubjects: [],
      learningStyle: 'mixed',
      preferredLanguage: 'en',
      studyPace: 'moderate',
      dailyStudyHours: 4,
      preferredStudyTime: 'evening',
      currentLevel: 'intermediate',
      parentNotifications: false,
    };
  }

  private createDefaultParentProfile(): ParentProfile {
    return {
      childrenIds: [],
      dailyDigest: true,
      weeklyReport: true,
      alertOnMissedSessions: true,
      alertOnLowScores: true,
      alertThreshold: 50,
      preferredChannel: 'whatsapp',
    };
  }

  private createDefaultTeacherProfile(): TeacherProfile {
    return {
      subjects: [],
      grades: [],
      yearsExperience: 0,
      studentIds: [],
      maxStudents: 50,
      canCreateContent: true,
      contentReviewRequired: true,
    };
  }

  private createDefaultNotificationSettings(): NotificationSettings {
    return {
      emailEnabled: true,
      pushEnabled: true,
      smsEnabled: false,
      whatsappEnabled: true,
      telegramEnabled: false,
      studyReminders: true,
      dailyGoals: true,
      weeklyReport: true,
      examAlerts: true,
      newContent: true,
      achievements: true,
      marketing: false,
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      timezone: 'Asia/Kolkata',
      reminderFrequency: 'twice',
      digestFrequency: 'daily',
    };
  }

  private createDefaultPrivacySettings(): PrivacySettings {
    return {
      profileVisibility: 'private',
      showOnLeaderboard: true,
      showStreak: true,
      showProgress: true,
      allowDataForImprovement: true,
      allowPersonalization: true,
    };
  }

  private createDefaultAccessibilitySettings(): AccessibilitySettings {
    return {
      fontSize: 'medium',
      highContrast: false,
      reduceMotion: false,
      screenReader: false,
      dyslexiaFont: false,
    };
  }

  // Event subscription
  on(event: string, handler: (...args: any[]) => void): void {
    this.events.on(event, handler);
  }
}

// Singleton instance
export const userService = new UserService();
export default userService;
