/**
 * User Management API Routes
 * RESTful endpoints for user operations
 */

import type { Request, Response, Router } from 'express';
import { userService } from './service';
import { verificationService } from './verification';
import { createOnboardingFlow, EXAM_CONFIGS, LEARNING_STYLE_QUESTIONS } from './onboarding';
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UpdateStudentProfileRequest,
  UserSearchFilters,
  VerificationChannel,
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

  // Admin
  router.post('/users/bulk', userRoutes.bulkAction);

  // Static data
  router.get('/config/exams', userRoutes.getExamConfigs);
  router.get('/config/learning-style-quiz', userRoutes.getLearningStyleQuiz);
}
