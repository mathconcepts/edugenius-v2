/**
 * Exam Administration System
 * Admin-controlled exam availability and configuration
 */

import { EventEmitter } from 'events';
import type { ExamType, Subject } from './types';

// ============================================
// EXAM ADMIN TYPES
// ============================================

export interface ExamAdminConfig {
  examId: ExamType;
  
  // Availability
  enabled: boolean;
  availableFrom?: Date;
  availableTo?: Date;
  
  // Access Control
  requiresApproval: boolean;
  autoApproveRoles: ('student' | 'parent' | 'teacher')[];
  maxStudentsPerBatch?: number;
  currentEnrollment: number;
  
  // Content Control
  enabledSubjects: Subject[];
  enabledGrades: number[];
  enabledYears: number[]; // Which exam years are open for enrollment
  
  // Feature Flags
  features: {
    aiTutor: boolean;
    practiceTests: boolean;
    mockExams: boolean;
    liveClasses: boolean;
    studyMaterial: boolean;
    parentReports: boolean;
  };
  
  // Pricing
  pricingTier: 'free' | 'basic' | 'premium' | 'enterprise';
  trialDays: number;
  
  // Content Delivery
  contentVersion: string;
  syllabusYear: number;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
}

export interface ExamEnrollmentRequest {
  userId: string;
  examId: ExamType;
  requestedYear: number;
  requestedSubjects: Subject[];
  requestedGrade?: number;
  reason?: string;
  parentConsent?: boolean;
}

export interface ExamEnrollment {
  id: string;
  userId: string;
  examId: ExamType;
  
  // Status
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
  
  // Configuration
  year: number;
  subjects: Subject[];
  grade?: number;
  
  // Access
  accessLevel: 'trial' | 'basic' | 'full';
  expiresAt?: Date;
  
  // Tracking
  requestedAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
  rejectedAt?: Date;
  rejectedBy?: string;
  rejectionReason?: string;
}

// ============================================
// DEFAULT EXAM CONFIGURATIONS
// ============================================

export const DEFAULT_EXAM_CONFIGS: Record<ExamType, Partial<ExamAdminConfig>> = {
  JEE_MAIN: {
    enabled: true,
    requiresApproval: false,
    autoApproveRoles: ['student'],
    enabledSubjects: ['physics', 'chemistry', 'mathematics'],
    enabledGrades: [11, 12],
    enabledYears: [2025, 2026, 2027],
    features: {
      aiTutor: true,
      practiceTests: true,
      mockExams: true,
      liveClasses: false,
      studyMaterial: true,
      parentReports: true,
    },
    pricingTier: 'basic',
    trialDays: 7,
    syllabusYear: 2024,
  },
  JEE_ADVANCED: {
    enabled: true,
    requiresApproval: true, // Requires JEE Main enrollment first
    autoApproveRoles: [],
    enabledSubjects: ['physics', 'chemistry', 'mathematics'],
    enabledGrades: [11, 12],
    enabledYears: [2025, 2026, 2027],
    features: {
      aiTutor: true,
      practiceTests: true,
      mockExams: true,
      liveClasses: false,
      studyMaterial: true,
      parentReports: true,
    },
    pricingTier: 'premium',
    trialDays: 3,
    syllabusYear: 2024,
  },
  NEET: {
    enabled: true,
    requiresApproval: false,
    autoApproveRoles: ['student'],
    enabledSubjects: ['physics', 'chemistry', 'biology'],
    enabledGrades: [11, 12],
    enabledYears: [2025, 2026, 2027],
    features: {
      aiTutor: true,
      practiceTests: true,
      mockExams: true,
      liveClasses: false,
      studyMaterial: true,
      parentReports: true,
    },
    pricingTier: 'basic',
    trialDays: 7,
    syllabusYear: 2024,
  },
  CBSE_10: {
    enabled: true,
    requiresApproval: false,
    autoApproveRoles: ['student', 'parent'],
    enabledSubjects: ['mathematics', 'english', 'social_science', 'physics', 'chemistry', 'biology'],
    enabledGrades: [10],
    enabledYears: [2025, 2026],
    features: {
      aiTutor: true,
      practiceTests: true,
      mockExams: true,
      liveClasses: false,
      studyMaterial: true,
      parentReports: true,
    },
    pricingTier: 'free',
    trialDays: 14,
    syllabusYear: 2024,
  },
  CBSE_12: {
    enabled: true,
    requiresApproval: false,
    autoApproveRoles: ['student'],
    enabledSubjects: ['physics', 'chemistry', 'mathematics', 'biology', 'english'],
    enabledGrades: [12],
    enabledYears: [2025, 2026],
    features: {
      aiTutor: true,
      practiceTests: true,
      mockExams: true,
      liveClasses: false,
      studyMaterial: true,
      parentReports: true,
    },
    pricingTier: 'basic',
    trialDays: 7,
    syllabusYear: 2024,
  },
  CAT: {
    enabled: false, // Disabled until content is ready
    requiresApproval: true,
    autoApproveRoles: [],
    enabledSubjects: ['mathematics', 'english'],
    enabledGrades: [],
    enabledYears: [2025, 2026],
    features: {
      aiTutor: false,
      practiceTests: true,
      mockExams: false,
      liveClasses: false,
      studyMaterial: true,
      parentReports: false,
    },
    pricingTier: 'premium',
    trialDays: 3,
    syllabusYear: 2024,
  },
  UPSC: {
    enabled: false, // Disabled until content is ready
    requiresApproval: true,
    autoApproveRoles: [],
    enabledSubjects: ['social_science', 'english'],
    enabledGrades: [],
    enabledYears: [2025, 2026],
    features: {
      aiTutor: false,
      practiceTests: true,
      mockExams: false,
      liveClasses: false,
      studyMaterial: true,
      parentReports: false,
    },
    pricingTier: 'enterprise',
    trialDays: 7,
    syllabusYear: 2024,
  },
  GATE: {
    enabled: false, // Disabled until content is ready
    requiresApproval: true,
    autoApproveRoles: [],
    enabledSubjects: ['mathematics', 'physics', 'computer_science'],
    enabledGrades: [],
    enabledYears: [2025, 2026],
    features: {
      aiTutor: false,
      practiceTests: true,
      mockExams: false,
      liveClasses: false,
      studyMaterial: true,
      parentReports: false,
    },
    pricingTier: 'premium',
    trialDays: 3,
    syllabusYear: 2024,
  },

  ICSE_10: {
    enabled: true,
    requiresApproval: false,
    autoApproveRoles: ['student'],
    enabledSubjects: ['mathematics', 'physics', 'chemistry', 'biology', 'english', 'social_science'],
    enabledGrades: [10],
    enabledYears: [2025, 2026],
    features: {
      aiTutor: true,
      practiceTests: true,
      mockExams: true,
      liveClasses: false,
      studyMaterial: true,
      parentReports: true,
    },
    pricingTier: 'basic',
    trialDays: 7,
    syllabusYear: 2024,
  },

  ISC_12: {
    enabled: true,
    requiresApproval: false,
    autoApproveRoles: ['student'],
    enabledSubjects: ['mathematics', 'physics', 'chemistry', 'biology', 'english', 'computer_science'],
    enabledGrades: [12],
    enabledYears: [2025, 2026],
    features: {
      aiTutor: true,
      practiceTests: true,
      mockExams: true,
      liveClasses: false,
      studyMaterial: true,
      parentReports: true,
    },
    pricingTier: 'basic',
    trialDays: 7,
    syllabusYear: 2024,
  },

  STATE_BOARDS: {
    enabled: false, // Admin must enable per state
    requiresApproval: false,
    autoApproveRoles: ['student'],
    enabledSubjects: ['mathematics', 'physics', 'chemistry', 'biology', 'english', 'social_science'],
    enabledGrades: [10, 12],
    enabledYears: [2025, 2026],
    features: {
      aiTutor: false,
      practiceTests: true,
      mockExams: false,
      liveClasses: false,
      studyMaterial: true,
      parentReports: true,
    },
    pricingTier: 'basic',
    trialDays: 7,
    syllabusYear: 2024,
  },

  OTHER: {
    enabled: false,
    requiresApproval: true,
    autoApproveRoles: [],
    enabledSubjects: ['mathematics', 'english'],
    enabledGrades: [],
    enabledYears: [2025, 2026],
    features: {
      aiTutor: false,
      practiceTests: true,
      mockExams: false,
      liveClasses: false,
      studyMaterial: false,
      parentReports: false,
    },
    pricingTier: 'basic',
    trialDays: 3,
    syllabusYear: 2024,
  },
};

// ============================================
// EXAM ADMIN SERVICE
// ============================================

export class ExamAdminService {
  private configs: Map<ExamType, ExamAdminConfig> = new Map();
  private enrollments: Map<string, ExamEnrollment> = new Map();
  private events: EventEmitter = new EventEmitter();

  constructor() {
    this.initializeDefaults();
  }

  private initializeDefaults(): void {
    for (const [examId, defaults] of Object.entries(DEFAULT_EXAM_CONFIGS)) {
      const config: ExamAdminConfig = {
        examId: examId as ExamType,
        enabled: defaults.enabled ?? false,
        requiresApproval: defaults.requiresApproval ?? true,
        autoApproveRoles: defaults.autoApproveRoles ?? [],
        currentEnrollment: 0,
        enabledSubjects: defaults.enabledSubjects ?? [],
        enabledGrades: defaults.enabledGrades ?? [],
        enabledYears: defaults.enabledYears ?? [],
        features: defaults.features ?? {
          aiTutor: false,
          practiceTests: false,
          mockExams: false,
          liveClasses: false,
          studyMaterial: false,
          parentReports: false,
        },
        pricingTier: defaults.pricingTier ?? 'basic',
        trialDays: defaults.trialDays ?? 7,
        contentVersion: '1.0.0',
        syllabusYear: defaults.syllabusYear ?? new Date().getFullYear(),
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedBy: 'system',
      };
      this.configs.set(examId as ExamType, config);
    }
  }

  // ============================================
  // ADMIN OPERATIONS
  // ============================================

  async getExamConfig(examId: ExamType): Promise<ExamAdminConfig | null> {
    return this.configs.get(examId) || null;
  }

  async getAllExamConfigs(): Promise<ExamAdminConfig[]> {
    return Array.from(this.configs.values());
  }

  async getEnabledExams(): Promise<ExamAdminConfig[]> {
    return Array.from(this.configs.values()).filter(c => c.enabled);
  }

  async updateExamConfig(
    examId: ExamType,
    updates: Partial<ExamAdminConfig>,
    adminId: string
  ): Promise<ExamAdminConfig> {
    const existing = this.configs.get(examId);
    if (!existing) {
      throw new Error(`Exam ${examId} not found`);
    }

    const updated: ExamAdminConfig = {
      ...existing,
      ...updates,
      examId, // Cannot change examId
      updatedAt: new Date(),
      updatedBy: adminId,
    };

    this.configs.set(examId, updated);

    this.events.emit('exam:config:updated', { examId, updates, adminId });

    return updated;
  }

  async enableExam(examId: ExamType, adminId: string): Promise<void> {
    await this.updateExamConfig(examId, { enabled: true }, adminId);
    this.events.emit('exam:enabled', { examId, adminId });
  }

  async disableExam(examId: ExamType, adminId: string): Promise<void> {
    await this.updateExamConfig(examId, { enabled: false }, adminId);
    this.events.emit('exam:disabled', { examId, adminId });
  }

  async setEnabledSubjects(
    examId: ExamType,
    subjects: Subject[],
    adminId: string
  ): Promise<void> {
    await this.updateExamConfig(examId, { enabledSubjects: subjects }, adminId);
  }

  async setEnabledYears(
    examId: ExamType,
    years: number[],
    adminId: string
  ): Promise<void> {
    await this.updateExamConfig(examId, { enabledYears: years }, adminId);
  }

  // ============================================
  // ENROLLMENT OPERATIONS
  // ============================================

  async requestEnrollment(request: ExamEnrollmentRequest): Promise<ExamEnrollment> {
    const config = this.configs.get(request.examId);
    if (!config) {
      throw new Error(`Exam ${request.examId} not found`);
    }

    if (!config.enabled) {
      throw new Error(`Exam ${request.examId} is not currently available`);
    }

    // Check if year is enabled
    if (!config.enabledYears.includes(request.requestedYear)) {
      throw new Error(`Year ${request.requestedYear} is not available for ${request.examId}`);
    }

    // Check if subjects are enabled
    const invalidSubjects = request.requestedSubjects.filter(
      s => !config.enabledSubjects.includes(s)
    );
    if (invalidSubjects.length > 0) {
      throw new Error(`Subjects not available: ${invalidSubjects.join(', ')}`);
    }

    // Check grade if required
    if (config.enabledGrades.length > 0 && request.requestedGrade) {
      if (!config.enabledGrades.includes(request.requestedGrade)) {
        throw new Error(`Grade ${request.requestedGrade} is not available for ${request.examId}`);
      }
    }

    // Check enrollment limits
    if (config.maxStudentsPerBatch && config.currentEnrollment >= config.maxStudentsPerBatch) {
      throw new Error(`Enrollment limit reached for ${request.examId}`);
    }

    const enrollment: ExamEnrollment = {
      id: `enroll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: request.userId,
      examId: request.examId,
      status: config.requiresApproval ? 'pending' : 'approved',
      year: request.requestedYear,
      subjects: request.requestedSubjects,
      grade: request.requestedGrade,
      accessLevel: 'trial',
      requestedAt: new Date(),
    };

    // Auto-approve if configured
    if (!config.requiresApproval) {
      enrollment.status = 'approved';
      enrollment.approvedAt = new Date();
      enrollment.approvedBy = 'system';
      enrollment.expiresAt = new Date(Date.now() + config.trialDays * 24 * 60 * 60 * 1000);
      
      // Update enrollment count
      config.currentEnrollment++;
    }

    this.enrollments.set(enrollment.id, enrollment);

    this.events.emit('enrollment:requested', enrollment);
    
    if (enrollment.status === 'approved') {
      this.events.emit('enrollment:approved', enrollment);
    }

    return enrollment;
  }

  async approveEnrollment(
    enrollmentId: string,
    adminId: string,
    accessLevel: 'trial' | 'basic' | 'full' = 'trial',
    expiresInDays?: number
  ): Promise<ExamEnrollment> {
    const enrollment = this.enrollments.get(enrollmentId);
    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    if (enrollment.status !== 'pending') {
      throw new Error(`Cannot approve enrollment with status ${enrollment.status}`);
    }

    const config = this.configs.get(enrollment.examId);
    
    enrollment.status = 'approved';
    enrollment.approvedAt = new Date();
    enrollment.approvedBy = adminId;
    enrollment.accessLevel = accessLevel;
    
    if (expiresInDays) {
      enrollment.expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    } else if (config) {
      enrollment.expiresAt = new Date(Date.now() + config.trialDays * 24 * 60 * 60 * 1000);
    }

    // Update enrollment count
    if (config) {
      config.currentEnrollment++;
    }

    this.events.emit('enrollment:approved', enrollment);

    return enrollment;
  }

  async rejectEnrollment(
    enrollmentId: string,
    adminId: string,
    reason: string
  ): Promise<ExamEnrollment> {
    const enrollment = this.enrollments.get(enrollmentId);
    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    enrollment.status = 'rejected';
    enrollment.rejectedAt = new Date();
    enrollment.rejectedBy = adminId;
    enrollment.rejectionReason = reason;

    this.events.emit('enrollment:rejected', enrollment);

    return enrollment;
  }

  async getUserEnrollments(userId: string): Promise<ExamEnrollment[]> {
    return Array.from(this.enrollments.values()).filter(
      e => e.userId === userId
    );
  }

  async getUserActiveEnrollments(userId: string): Promise<ExamEnrollment[]> {
    const now = new Date();
    return Array.from(this.enrollments.values()).filter(
      e => e.userId === userId && 
           e.status === 'approved' && 
           (!e.expiresAt || e.expiresAt > now)
    );
  }

  async hasExamAccess(userId: string, examId: ExamType): Promise<boolean> {
    const enrollments = await this.getUserActiveEnrollments(userId);
    return enrollments.some(e => e.examId === examId);
  }

  async getExamAccessDetails(userId: string, examId: ExamType): Promise<ExamEnrollment | null> {
    const enrollments = await this.getUserActiveEnrollments(userId);
    return enrollments.find(e => e.examId === examId) || null;
  }

  async getPendingEnrollments(): Promise<ExamEnrollment[]> {
    return Array.from(this.enrollments.values()).filter(
      e => e.status === 'pending'
    );
  }

  // ============================================
  // CONTENT ACCESS CONTROL
  // ============================================

  async canAccessSubject(
    userId: string,
    examId: ExamType,
    subject: Subject
  ): Promise<boolean> {
    const enrollment = await this.getExamAccessDetails(userId, examId);
    if (!enrollment) return false;
    return enrollment.subjects.includes(subject);
  }

  async canAccessFeature(
    userId: string,
    examId: ExamType,
    feature: keyof ExamAdminConfig['features']
  ): Promise<boolean> {
    const enrollment = await this.getExamAccessDetails(userId, examId);
    if (!enrollment) return false;

    const config = this.configs.get(examId);
    if (!config) return false;

    // Check if feature is enabled for this exam
    if (!config.features[feature]) return false;

    // Check access level requirements
    if (feature === 'mockExams' && enrollment.accessLevel === 'trial') {
      return false; // Mock exams require at least basic access
    }

    if (feature === 'liveClasses' && enrollment.accessLevel !== 'full') {
      return false; // Live classes require full access
    }

    return true;
  }

  async getAccessibleExamsForUser(userId: string): Promise<{
    exam: ExamAdminConfig;
    enrollment: ExamEnrollment;
  }[]> {
    const enrollments = await this.getUserActiveEnrollments(userId);
    const result: { exam: ExamAdminConfig; enrollment: ExamEnrollment }[] = [];

    for (const enrollment of enrollments) {
      const config = this.configs.get(enrollment.examId);
      if (config && config.enabled) {
        result.push({ exam: config, enrollment });
      }
    }

    return result;
  }

  // Event subscription
  on(event: string, handler: (...args: any[]) => void): void {
    this.events.on(event, handler);
  }
}

// Singleton
export const examAdminService = new ExamAdminService();
export default examAdminService;
