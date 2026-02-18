/**
 * User Management API Routes
 * RESTful endpoints for user operations
 */

import type { Request, Response, Router } from 'express';
import { userService } from './service';
import { verificationService } from './verification';
import { createOnboardingFlow, EXAM_CONFIGS, LEARNING_STYLE_QUESTIONS } from './onboarding';
import { examAdminService, type ExamAdminConfig } from './exam-admin';
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UpdateStudentProfileRequest,
  UserSearchFilters,
  VerificationChannel,
  ExamType,
  Subject,
} from './types';

// ============================================
// ROUTE DEFINITIONS
// ============================================

export const userRoutes = {
  // ============================================
  // USER CRUD
  // ============================================

  async createUser(req: Request, res: Response): Promise<void> {
    try {
      const request: CreateUserRequest = req.body;
      
      // Validation
      if (!request.email || !request.firstName || !request.lastName || !request.role) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      // Check existing
      const existing = await userService.getUserByEmail(request.email);
      if (existing) {
        res.status(409).json({ error: 'User with this email already exists' });
        return;
      }

      const user = await userService.createUser(request);
      res.status(201).json(user);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const user = await userService.getUser(userId);
      
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json(user);
    } catch (error) {
      console.error('Error getting user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const updates: UpdateUserRequest = req.body;

      const user = await userService.updateUser(userId, updates);
      
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json(user);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      const success = await userService.deleteUser(userId, reason);
      
      if (!success) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      const filters: UserSearchFilters = {
        query: req.query.q as string,
        role: req.query.role as any,
        exam: req.query.exam as any,
        grade: req.query.grade ? parseInt(req.query.grade as string) : undefined,
        onboardingComplete: req.query.onboarded === 'true' ? true : 
                           req.query.onboarded === 'false' ? false : undefined,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const result = await userService.searchUsers(filters);
      res.json(result);
    } catch (error) {
      console.error('Error searching users:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // ============================================
  // STUDENT PROFILE
  // ============================================

  async updateStudentProfile(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const updates: UpdateStudentProfileRequest = req.body;

      const profile = await userService.updateStudentProfile(userId, updates);
      
      if (!profile) {
        res.status(404).json({ error: 'User not found or not a student' });
        return;
      }

      res.json(profile);
    } catch (error) {
      console.error('Error updating student profile:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async setExamConfiguration(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { primaryExam, primaryExamYear, secondaryExams, subjects, targetScore } = req.body;

      const profile = await userService.setExamConfiguration(userId, {
        primaryExam,
        primaryExamYear,
        secondaryExams,
        subjects,
        targetScore,
      });

      if (!profile) {
        res.status(404).json({ error: 'User not found or not a student' });
        return;
      }

      res.json(profile);
    } catch (error) {
      console.error('Error setting exam configuration:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // ============================================
  // VERIFICATION
  // ============================================

  async sendVerification(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { channel, identifier } = req.body as { 
        channel: VerificationChannel; 
        identifier: string;
      };

      if (!channel || !identifier) {
        res.status(400).json({ error: 'Channel and identifier required' });
        return;
      }

      const result = await verificationService.sendVerification(
        userId,
        channel,
        identifier,
        { ipAddress: req.ip, userAgent: req.headers['user-agent'] }
      );

      if (!result.success) {
        res.status(429).json({ error: result.error, expiresAt: result.expiresAt });
        return;
      }

      res.json({ success: true, expiresAt: result.expiresAt });
    } catch (error) {
      console.error('Error sending verification:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async confirmVerification(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { channel, code } = req.body as { 
        channel: VerificationChannel; 
        code: string;
      };

      if (!channel || !code) {
        res.status(400).json({ error: 'Channel and code required' });
        return;
      }

      // Verify in verification service
      const verifyResult = await verificationService.verifyCode(userId, channel, code);
      
      if (!verifyResult.success) {
        res.status(400).json({ error: verifyResult.error });
        return;
      }

      // Also confirm in user service to update user flags
      const userResult = await userService.confirmChannelVerification(userId, channel, code);

      res.json({ success: true, ...userResult });
    } catch (error) {
      console.error('Error confirming verification:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getTelegramLink(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const link = verificationService.generateTelegramDeepLink(userId);
      res.json({ link });
    } catch (error) {
      console.error('Error generating Telegram link:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async connectWhatsApp(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { phone, whatsappId } = req.body;

      const success = await userService.connectWhatsApp(userId, phone, whatsappId);
      
      if (!success) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error connecting WhatsApp:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // ============================================
  // ONBOARDING
  // ============================================

  async getOnboardingProgress(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const flow = createOnboardingFlow(userId);
      await flow.load();

      const progress = flow.getProgress();
      const currentStep = flow.getCurrentStep();
      const nextSteps = flow.getNextSteps(3);

      res.json({
        progress,
        currentStep,
        nextSteps,
        isComplete: flow.isComplete(),
      });
    } catch (error) {
      console.error('Error getting onboarding progress:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async completeOnboardingStep(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { step } = req.body;

      const flow = createOnboardingFlow(userId);
      const result = await flow.completeStep(step);

      if (!result) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Error completing onboarding step:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async skipOnboardingStep(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { step } = req.body;

      const flow = createOnboardingFlow(userId);
      const result = await flow.skipStep(step);

      if (!result) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Error skipping onboarding step:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // ============================================
  // SETTINGS
  // ============================================

  async updateNotificationSettings(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const settings = req.body;

      const result = await userService.updateNotificationSettings(userId, settings);
      
      if (!result) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Error updating notification settings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async updatePrivacySettings(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const settings = req.body;

      const result = await userService.updatePrivacySettings(userId, settings);
      
      if (!result) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // ============================================
  // STATIC DATA
  // ============================================

  async getExamConfigs(_req: Request, res: Response): Promise<void> {
    res.json(EXAM_CONFIGS);
  },

  async getLearningStyleQuiz(_req: Request, res: Response): Promise<void> {
    res.json(LEARNING_STYLE_QUESTIONS);
  },

  // ============================================
  // EXAM ADMIN ROUTES
  // ============================================

  async getEnabledExams(_req: Request, res: Response): Promise<void> {
    try {
      const exams = await examAdminService.getEnabledExams();
      res.json(exams);
    } catch (error) {
      console.error('Error getting enabled exams:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getAllExamConfigs(_req: Request, res: Response): Promise<void> {
    try {
      const configs = await examAdminService.getAllExamConfigs();
      res.json(configs);
    } catch (error) {
      console.error('Error getting exam configs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getExamAdminConfig(req: Request, res: Response): Promise<void> {
    try {
      const { examId } = req.params;
      const config = await examAdminService.getExamConfig(examId as ExamType);
      
      if (!config) {
        res.status(404).json({ error: 'Exam not found' });
        return;
      }

      res.json(config);
    } catch (error) {
      console.error('Error getting exam config:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async updateExamAdminConfig(req: Request, res: Response): Promise<void> {
    try {
      const { examId } = req.params;
      const updates = req.body;
      const adminId = req.headers['x-admin-id'] as string || 'admin';

      const config = await examAdminService.updateExamConfig(
        examId as ExamType,
        updates,
        adminId
      );

      res.json(config);
    } catch (error) {
      console.error('Error updating exam config:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async enableExam(req: Request, res: Response): Promise<void> {
    try {
      const { examId } = req.params;
      const adminId = req.headers['x-admin-id'] as string || 'admin';

      await examAdminService.enableExam(examId as ExamType, adminId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error enabling exam:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async disableExam(req: Request, res: Response): Promise<void> {
    try {
      const { examId } = req.params;
      const adminId = req.headers['x-admin-id'] as string || 'admin';

      await examAdminService.disableExam(examId as ExamType, adminId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error disabling exam:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async setExamSubjects(req: Request, res: Response): Promise<void> {
    try {
      const { examId } = req.params;
      const { subjects } = req.body as { subjects: Subject[] };
      const adminId = req.headers['x-admin-id'] as string || 'admin';

      await examAdminService.setEnabledSubjects(examId as ExamType, subjects, adminId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error setting exam subjects:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async setExamYears(req: Request, res: Response): Promise<void> {
    try {
      const { examId } = req.params;
      const { years } = req.body as { years: number[] };
      const adminId = req.headers['x-admin-id'] as string || 'admin';

      await examAdminService.setEnabledYears(examId as ExamType, years, adminId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error setting exam years:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // ============================================
  // ENROLLMENT ROUTES
  // ============================================

  async requestEnrollment(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { examId, year, subjects, grade } = req.body;

      const enrollment = await examAdminService.requestEnrollment({
        userId,
        examId,
        requestedYear: year,
        requestedSubjects: subjects,
        requestedGrade: grade,
      });

      res.status(201).json(enrollment);
    } catch (error) {
      console.error('Error requesting enrollment:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to request enrollment' });
    }
  },

  async getUserEnrollments(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const enrollments = await examAdminService.getUserEnrollments(userId);
      res.json(enrollments);
    } catch (error) {
      console.error('Error getting user enrollments:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getUserActiveEnrollments(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const enrollments = await examAdminService.getUserActiveEnrollments(userId);
      res.json(enrollments);
    } catch (error) {
      console.error('Error getting active enrollments:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async checkExamAccess(req: Request, res: Response): Promise<void> {
    try {
      const { userId, examId } = req.params;
      const hasAccess = await examAdminService.hasExamAccess(userId, examId as ExamType);
      const details = await examAdminService.getExamAccessDetails(userId, examId as ExamType);
      res.json({ hasAccess, enrollment: details });
    } catch (error) {
      console.error('Error checking exam access:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getPendingEnrollments(_req: Request, res: Response): Promise<void> {
    try {
      const enrollments = await examAdminService.getPendingEnrollments();
      res.json(enrollments);
    } catch (error) {
      console.error('Error getting pending enrollments:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async approveEnrollment(req: Request, res: Response): Promise<void> {
    try {
      const { enrollmentId } = req.params;
      const { accessLevel, expiresInDays } = req.body;
      const adminId = req.headers['x-admin-id'] as string || 'admin';

      const enrollment = await examAdminService.approveEnrollment(
        enrollmentId,
        adminId,
        accessLevel || 'trial',
        expiresInDays
      );

      res.json(enrollment);
    } catch (error) {
      console.error('Error approving enrollment:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to approve enrollment' });
    }
  },

  async rejectEnrollment(req: Request, res: Response): Promise<void> {
    try {
      const { enrollmentId } = req.params;
      const { reason } = req.body;
      const adminId = req.headers['x-admin-id'] as string || 'admin';

      const enrollment = await examAdminService.rejectEnrollment(
        enrollmentId,
        adminId,
        reason || 'No reason provided'
      );

      res.json(enrollment);
    } catch (error) {
      console.error('Error rejecting enrollment:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to reject enrollment' });
    }
  },

  // ============================================
  // ACTIVITY LOGS
  // ============================================

  async getActivityLogs(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { limit, offset, category } = req.query;

      const logs = await userService.getActivityLogs(userId, {
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
        category: category as string,
      });

      res.json(logs);
    } catch (error) {
      console.error('Error getting activity logs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // ============================================
  // ADMIN BULK OPERATIONS
  // ============================================

  async bulkAction(req: Request, res: Response): Promise<void> {
    try {
      const { action, userIds, reason, notificationMessage } = req.body;

      if (!action || !userIds || !Array.isArray(userIds)) {
        res.status(400).json({ error: 'Action and userIds required' });
        return;
      }

      const result = await userService.bulkAction({
        action,
        userIds,
        reason,
        notificationMessage,
      });

      res.json(result);
    } catch (error) {
      console.error('Error performing bulk action:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};

// ============================================
// ROUTER SETUP
// ============================================

export function setupUserRoutes(router: Router): void {
  // Users CRUD
  router.post('/users', userRoutes.createUser);
  router.get('/users', userRoutes.searchUsers);
  router.get('/users/:userId', userRoutes.getUser);
  router.patch('/users/:userId', userRoutes.updateUser);
  router.delete('/users/:userId', userRoutes.deleteUser);

  // Student profile
  router.patch('/users/:userId/student-profile', userRoutes.updateStudentProfile);
  router.post('/users/:userId/exam-config', userRoutes.setExamConfiguration);

  // Verification
  router.post('/users/:userId/verify/send', userRoutes.sendVerification);
  router.post('/users/:userId/verify/confirm', userRoutes.confirmVerification);
  router.get('/users/:userId/telegram-link', userRoutes.getTelegramLink);
  router.post('/users/:userId/connect/whatsapp', userRoutes.connectWhatsApp);

  // Onboarding
  router.get('/users/:userId/onboarding', userRoutes.getOnboardingProgress);
  router.post('/users/:userId/onboarding/complete', userRoutes.completeOnboardingStep);
  router.post('/users/:userId/onboarding/skip', userRoutes.skipOnboardingStep);

  // Settings
  router.patch('/users/:userId/settings/notifications', userRoutes.updateNotificationSettings);
  router.patch('/users/:userId/settings/privacy', userRoutes.updatePrivacySettings);

  // Activity
  router.get('/users/:userId/activity', userRoutes.getActivityLogs);

  // Admin bulk operations
  router.post('/users/bulk', userRoutes.bulkAction);

  // Static data
  router.get('/config/exams', userRoutes.getExamConfigs);
  router.get('/config/learning-style-quiz', userRoutes.getLearningStyleQuiz);

  // ==========================================
  // EXAM ADMIN ROUTES (Admin only)
  // ==========================================
  
  // Get enabled exams (for students/users)
  router.get('/exams/enabled', userRoutes.getEnabledExams);
  
  // Admin exam management
  router.get('/admin/exams', userRoutes.getAllExamConfigs);
  router.get('/admin/exams/:examId', userRoutes.getExamAdminConfig);
  router.patch('/admin/exams/:examId', userRoutes.updateExamAdminConfig);
  router.post('/admin/exams/:examId/enable', userRoutes.enableExam);
  router.post('/admin/exams/:examId/disable', userRoutes.disableExam);
  router.put('/admin/exams/:examId/subjects', userRoutes.setExamSubjects);
  router.put('/admin/exams/:examId/years', userRoutes.setExamYears);

  // ==========================================
  // ENROLLMENT ROUTES
  // ==========================================
  
  // User enrollment
  router.post('/users/:userId/enrollments', userRoutes.requestEnrollment);
  router.get('/users/:userId/enrollments', userRoutes.getUserEnrollments);
  router.get('/users/:userId/enrollments/active', userRoutes.getUserActiveEnrollments);
  router.get('/users/:userId/access/:examId', userRoutes.checkExamAccess);
  
  // Admin enrollment management
  router.get('/admin/enrollments/pending', userRoutes.getPendingEnrollments);
  router.post('/admin/enrollments/:enrollmentId/approve', userRoutes.approveEnrollment);
  router.post('/admin/enrollments/:enrollmentId/reject', userRoutes.rejectEnrollment);
}
