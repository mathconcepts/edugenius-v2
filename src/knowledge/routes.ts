// @ts-nocheck
/**
 * Exam Insights API Routes
 */

import type { Request, Response, Router } from 'express';
import { examInsightsService, EXAM_BEST_PRACTICES } from './exam-insights';
import { sageInsightHooks, mentorInsightHooks, atlasInsightHooks, heraldInsightHooks } from './agent-hooks';
import type { ExamType, Subject, DifficultyLevel } from '../users/types';

export const insightRoutes = {
  // ============================================
  // BEST PRACTICES
  // ============================================

  async getBestPractices(req: Request, res: Response): Promise<void> {
    try {
      const { examId } = req.params;
      const practices = EXAM_BEST_PRACTICES[examId as ExamType];
      
      if (!practices) {
        res.status(404).json({ error: 'Exam not found' });
        return;
      }

      res.json(practices);
    } catch (error) {
      console.error('Error getting best practices:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getAllBestPractices(_req: Request, res: Response): Promise<void> {
    try {
      res.json(EXAM_BEST_PRACTICES);
    } catch (error) {
      console.error('Error getting all best practices:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // ============================================
  // INSIGHTS
  // ============================================

  async getInsights(req: Request, res: Response): Promise<void> {
    try {
      const { examId } = req.params;
      const { category, phase, audience, limit } = req.query;

      const insights = await examInsightsService.getInsightsForExam(
        examId as ExamType,
        {
          category: category as any,
          phase: phase as any,
          targetAudience: audience as any,
          limit: limit ? parseInt(limit as string) : undefined,
        }
      );

      res.json(insights);
    } catch (error) {
      console.error('Error getting insights:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getPersonalizedInsights(req: Request, res: Response): Promise<void> {
    try {
      const { userId, examId } = req.params;
      const { level, daysToExam, weakSubjects, strongSubjects } = req.body;

      const insights = await examInsightsService.getPersonalizedInsights(
        userId,
        examId as ExamType,
        {
          currentLevel: level as DifficultyLevel,
          daysToExam: parseInt(daysToExam) || 90,
          weakSubjects: weakSubjects as Subject[],
          strongSubjects: strongSubjects as Subject[],
        }
      );

      res.json(insights);
    } catch (error) {
      console.error('Error getting personalized insights:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async markInsightHelpful(req: Request, res: Response): Promise<void> {
    try {
      const { insightId } = req.params;
      const { userId } = req.body;

      await examInsightsService.markInsightHelpful(insightId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking insight helpful:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async trackInsightView(req: Request, res: Response): Promise<void> {
    try {
      const { insightId } = req.params;
      const { userId } = req.body;

      await examInsightsService.trackInsightView(insightId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error tracking insight view:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // ============================================
  // LESSONS LEARNED
  // ============================================

  async getLessons(req: Request, res: Response): Promise<void> {
    try {
      const { examId } = req.params;
      const { subject, phase, impact, limit } = req.query;

      const lessons = await examInsightsService.getLessonsForExam(
        examId as ExamType,
        {
          subject: subject as Subject,
          phase: phase as any,
          impactLevel: impact as any,
          limit: limit ? parseInt(limit as string) : undefined,
        }
      );

      res.json(lessons);
    } catch (error) {
      console.error('Error getting lessons:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async addLesson(req: Request, res: Response): Promise<void> {
    try {
      const lesson = await examInsightsService.addLessonLearned(req.body);
      res.status(201).json(lesson);
    } catch (error) {
      console.error('Error adding lesson:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // ============================================
  // TOPPER STORIES
  // ============================================

  async getTopperStories(req: Request, res: Response): Promise<void> {
    try {
      const { examId } = req.params;
      const { year, limit } = req.query;

      const stories = await examInsightsService.getTopperStories(
        examId as ExamType,
        {
          year: year ? parseInt(year as string) : undefined,
          limit: limit ? parseInt(limit as string) : undefined,
        }
      );

      res.json(stories);
    } catch (error) {
      console.error('Error getting topper stories:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async addTopperStory(req: Request, res: Response): Promise<void> {
    try {
      const story = await examInsightsService.addTopperStory(req.body);
      res.status(201).json(story);
    } catch (error) {
      console.error('Error adding topper story:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // ============================================
  // AGENT-SPECIFIC ENDPOINTS
  // ============================================

  // Sage: Teaching context
  async getTeachingContext(req: Request, res: Response): Promise<void> {
    try {
      const { examId, subject, topic, level } = req.query;

      const context = await sageInsightHooks.getTeachingContext(
        examId as ExamType,
        subject as Subject,
        topic as string,
        level as any
      );

      res.json(context);
    } catch (error) {
      console.error('Error getting teaching context:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Sage: Exam context prompt
  async getExamContextPrompt(req: Request, res: Response): Promise<void> {
    try {
      const { examId } = req.params;
      const context = sageInsightHooks.buildExamContext(examId as ExamType);
      res.json({ context });
    } catch (error) {
      console.error('Error getting exam context:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Sage: Phase guidance
  async getPhaseGuidance(req: Request, res: Response): Promise<void> {
    try {
      const { examId } = req.params;
      const { daysToExam } = req.query;

      const guidance = sageInsightHooks.getPhaseGuidance(
        examId as ExamType,
        parseInt(daysToExam as string) || 90
      );

      res.json({ guidance });
    } catch (error) {
      console.error('Error getting phase guidance:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Mentor: Daily insight
  async getDailyInsight(req: Request, res: Response): Promise<void> {
    try {
      const { examId } = req.params;
      const { daysToExam } = req.query;

      const insight = await mentorInsightHooks.getDailyInsight(
        examId as ExamType,
        parseInt(daysToExam as string) || 90
      );

      res.json(insight);
    } catch (error) {
      console.error('Error getting daily insight:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Mentor: Motivational message
  async getMotivationalMessage(req: Request, res: Response): Promise<void> {
    try {
      const { examId } = req.params;
      const { studentName, daysToExam, progress } = req.query;

      const message = await mentorInsightHooks.getMotivationalMessage(
        examId as ExamType,
        studentName as string,
        parseInt(daysToExam as string) || 90,
        progress as any
      );

      res.json({ message });
    } catch (error) {
      console.error('Error getting motivational message:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Atlas: Content guidelines
  async getContentGuidelines(req: Request, res: Response): Promise<void> {
    try {
      const { examId } = req.params;
      const guidelines = atlasInsightHooks.getContentGuidelines(examId as ExamType);
      res.json(guidelines);
    } catch (error) {
      console.error('Error getting content guidelines:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Herald: Blog ideas
  async getBlogIdeas(req: Request, res: Response): Promise<void> {
    try {
      const { examId } = req.params;
      const ideas = heraldInsightHooks.getBlogContentIdeas(examId as ExamType);
      res.json(ideas);
    } catch (error) {
      console.error('Error getting blog ideas:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Herald: Social post ideas
  async getSocialPostIdeas(req: Request, res: Response): Promise<void> {
    try {
      const { examId } = req.params;
      const ideas = heraldInsightHooks.getSocialPostIdeas(examId as ExamType);
      res.json(ideas);
    } catch (error) {
      console.error('Error getting social post ideas:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};

// ============================================
// ROUTER SETUP
// ============================================

export function setupInsightRoutes(router: Router): void {
  // Best practices
  router.get('/best-practices', insightRoutes.getAllBestPractices);
  router.get('/best-practices/:examId', insightRoutes.getBestPractices);

  // Insights
  router.get('/exams/:examId/insights', insightRoutes.getInsights);
  router.post('/users/:userId/exams/:examId/insights', insightRoutes.getPersonalizedInsights);
  router.post('/insights/:insightId/helpful', insightRoutes.markInsightHelpful);
  router.post('/insights/:insightId/view', insightRoutes.trackInsightView);

  // Lessons
  router.get('/exams/:examId/lessons', insightRoutes.getLessons);
  router.post('/lessons', insightRoutes.addLesson);

  // Topper stories
  router.get('/exams/:examId/toppers', insightRoutes.getTopperStories);
  router.post('/toppers', insightRoutes.addTopperStory);

  // Agent endpoints
  router.get('/sage/teaching-context', insightRoutes.getTeachingContext);
  router.get('/sage/exam-context/:examId', insightRoutes.getExamContextPrompt);
  router.get('/sage/phase-guidance/:examId', insightRoutes.getPhaseGuidance);
  router.get('/mentor/daily-insight/:examId', insightRoutes.getDailyInsight);
  router.get('/mentor/motivation/:examId', insightRoutes.getMotivationalMessage);
  router.get('/atlas/content-guidelines/:examId', insightRoutes.getContentGuidelines);
  router.get('/herald/blog-ideas/:examId', insightRoutes.getBlogIdeas);
  router.get('/herald/social-posts/:examId', insightRoutes.getSocialPostIdeas);
}
