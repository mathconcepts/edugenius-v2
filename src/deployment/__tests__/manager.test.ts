/**
 * Deployment Manager Tests
 */

import { DeploymentManager } from '../manager';

describe('DeploymentManager', () => {
  let manager: DeploymentManager;

  beforeEach(() => {
    manager = new DeploymentManager();
  });

  describe('Deployment Creation', () => {
    it('should create a deployment', async () => {
      const deployment = await manager.createDeployment({
        examId: 'exam-1',
        examCode: 'JEE',
        examName: 'JEE Main',
        config: {
          content: { blogsEnabled: true, vlogsEnabled: true, socialEnabled: true, cadence: { questionsPerDay: 50, blogsPerWeek: 3, videosPerWeek: 2, practiceTestsPerMonth: 4, revisionsPerChapter: 3 } },
          tutoring: { enabled: true, modelsAllowed: ['gemini'], featuresEnabled: ['ai-tutoring'] },
          marketing: { enabled: true, channels: ['social'], budget: 10000 },
          features: ['ai-tutoring'],
        },
      });

      expect(deployment.examId).toBe('exam-1');
      expect(deployment.mode).toBe('pilot');
      expect(deployment.status).toBe('draft');
    });

    it('should list deployments', async () => {
      await manager.createDeployment({
        examId: 'list-1',
        examCode: 'NEET',
        examName: 'NEET UG',
        config: {
          content: { blogsEnabled: true, vlogsEnabled: false, socialEnabled: true, cadence: { questionsPerDay: 60, blogsPerWeek: 4, videosPerWeek: 3, practiceTestsPerMonth: 4, revisionsPerChapter: 3 } },
          tutoring: { enabled: true, modelsAllowed: [], featuresEnabled: [] },
          marketing: { enabled: false, channels: [], budget: 0 },
          features: [],
        },
      });

      const deployments = await manager.listDeployments();
      expect(deployments.length).toBeGreaterThan(0);
    });
  });

  describe('Pilot Management', () => {
    it('should start a pilot', async () => {
      const deployment = await manager.createDeployment({
        examId: 'pilot-1',
        examCode: 'CAT',
        examName: 'CAT',
        config: {
          content: { blogsEnabled: true, vlogsEnabled: true, socialEnabled: true, cadence: { questionsPerDay: 30, blogsPerWeek: 2, videosPerWeek: 1, practiceTestsPerMonth: 4, revisionsPerChapter: 2 } },
          tutoring: { enabled: true, modelsAllowed: [], featuresEnabled: [] },
          marketing: { enabled: true, channels: [], budget: 5000 },
          features: [],
        },
      });

      const started = await manager.startPilot(deployment.examId);
      expect(started?.status).toBe('pilot');
      expect(started?.pilotStartDate).toBeDefined();
    });

    it('should extend pilot duration', async () => {
      const deployment = await manager.createDeployment({
        examId: 'extend-1',
        examCode: 'UPSC',
        examName: 'UPSC',
        config: {
          content: { blogsEnabled: true, vlogsEnabled: false, socialEnabled: true, cadence: { questionsPerDay: 25, blogsPerWeek: 5, videosPerWeek: 2, practiceTestsPerMonth: 4, revisionsPerChapter: 4 } },
          tutoring: { enabled: true, modelsAllowed: [], featuresEnabled: [] },
          marketing: { enabled: true, channels: [], budget: 15000 },
          features: [],
        },
      });

      await manager.startPilot(deployment.examId);
      const extended = await manager.extendPilot(deployment.examId, 7);

      expect(extended?.state.pilotConfig?.durationDays).toBe(21); // 14 + 7
    });

    it('should check pilot status', async () => {
      const deployment = await manager.createDeployment({
        examId: 'check-1',
        examCode: 'TEST',
        examName: 'Test Exam',
        config: {
          content: { blogsEnabled: true, vlogsEnabled: true, socialEnabled: true, cadence: { questionsPerDay: 20, blogsPerWeek: 2, videosPerWeek: 1, practiceTestsPerMonth: 2, revisionsPerChapter: 2 } },
          tutoring: { enabled: true, modelsAllowed: [], featuresEnabled: [] },
          marketing: { enabled: false, channels: [], budget: 0 },
          features: [],
        },
      });

      await manager.startPilot(deployment.examId);
      const status = await manager.checkPilotStatus(deployment.examId);

      expect(status.canPromote).toBe(false); // Not enough time/users yet
      expect(status.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Feature Flags', () => {
    it('should list default feature flags', async () => {
      const flags = await manager.listFeatureFlags();
      
      expect(flags.length).toBeGreaterThan(0);
      expect(flags.some(f => f.id === 'ai-tutoring')).toBe(true);
    });

    it('should enable/disable features for deployment', async () => {
      const deployment = await manager.createDeployment({
        examId: 'feature-1',
        examCode: 'FEAT',
        examName: 'Feature Test',
        config: {
          content: { blogsEnabled: true, vlogsEnabled: true, socialEnabled: true, cadence: { questionsPerDay: 20, blogsPerWeek: 2, videosPerWeek: 1, practiceTestsPerMonth: 2, revisionsPerChapter: 2 } },
          tutoring: { enabled: true, modelsAllowed: [], featuresEnabled: [] },
          marketing: { enabled: false, channels: [], budget: 0 },
          features: ['ai-tutoring'],
        },
      });

      await manager.setFeatureEnabled(deployment.examId, 'ai-tutoring', false);
      const enabled = await manager.isFeatureEnabled(deployment.examId, 'ai-tutoring');

      expect(enabled).toBe(false);
    });

    it('should set feature rollout percentage', async () => {
      const deployment = await manager.createDeployment({
        examId: 'rollout-1',
        examCode: 'ROLL',
        examName: 'Rollout Test',
        config: {
          content: { blogsEnabled: true, vlogsEnabled: true, socialEnabled: true, cadence: { questionsPerDay: 20, blogsPerWeek: 2, videosPerWeek: 1, practiceTestsPerMonth: 2, revisionsPerChapter: 2 } },
          tutoring: { enabled: true, modelsAllowed: [], featuresEnabled: [] },
          marketing: { enabled: false, channels: [], budget: 0 },
          features: ['ai-tutoring'],
        },
      });

      await manager.setFeatureRollout(deployment.examId, 'ai-tutoring', 50);

      const dep = await manager.getDeployment(deployment.examId);
      const feature = dep?.state.features.get('ai-tutoring');
      expect(feature?.rolloutPercentage).toBe(50);
    });
  });

  describe('Audience Targeting', () => {
    it('should check if user is in pilot by signup source', async () => {
      const deployment = await manager.createDeployment({
        examId: 'audience-1',
        examCode: 'AUD',
        examName: 'Audience Test',
        config: {
          content: { blogsEnabled: true, vlogsEnabled: true, socialEnabled: true, cadence: { questionsPerDay: 20, blogsPerWeek: 2, videosPerWeek: 1, practiceTestsPerMonth: 2, revisionsPerChapter: 2 } },
          tutoring: { enabled: true, modelsAllowed: [], featuresEnabled: [] },
          marketing: { enabled: false, channels: [], budget: 0 },
          features: [],
        },
        pilotConfig: {
          audienceMethod: 'signup_source',
          audienceFilter: { sources: ['organic', 'referral'] },
          targetSize: 100,
          currentSize: 0,
          durationType: 'fixed',
          durationDays: 14,
          rollbackTriggers: [],
          successCriteria: [],
          status: 'active',
        },
      });

      await manager.startPilot(deployment.examId);

      const inPilot = await manager.isUserInPilot(deployment.examId, {
        id: 'user-1',
        signupSource: 'organic',
      });

      const notInPilot = await manager.isUserInPilot(deployment.examId, {
        id: 'user-2',
        signupSource: 'paid',
      });

      expect(inPilot).toBe(true);
      expect(notInPilot).toBe(false);
    });
  });

  describe('Metrics & Rollback', () => {
    it('should update deployment metrics', async () => {
      const deployment = await manager.createDeployment({
        examId: 'metrics-1',
        examCode: 'MET',
        examName: 'Metrics Test',
        config: {
          content: { blogsEnabled: true, vlogsEnabled: true, socialEnabled: true, cadence: { questionsPerDay: 20, blogsPerWeek: 2, videosPerWeek: 1, practiceTestsPerMonth: 2, revisionsPerChapter: 2 } },
          tutoring: { enabled: true, modelsAllowed: [], featuresEnabled: [] },
          marketing: { enabled: false, channels: [], budget: 0 },
          features: [],
        },
      });

      await manager.updateMetrics(deployment.examId, {
        totalUsers: 1000,
        activeUsers: 500,
        retentionRate: 0.75,
      });

      const updated = await manager.getDeployment(deployment.examId);
      expect(updated?.state.metrics.totalUsers).toBe(1000);
      expect(updated?.state.metrics.retentionRate).toBe(0.75);
    });

    it('should rollback deployment', async () => {
      const deployment = await manager.createDeployment({
        examId: 'rollback-1',
        examCode: 'RB',
        examName: 'Rollback Test',
        config: {
          content: { blogsEnabled: true, vlogsEnabled: true, socialEnabled: true, cadence: { questionsPerDay: 20, blogsPerWeek: 2, videosPerWeek: 1, practiceTestsPerMonth: 2, revisionsPerChapter: 2 } },
          tutoring: { enabled: true, modelsAllowed: [], featuresEnabled: [] },
          marketing: { enabled: false, channels: [], budget: 0 },
          features: ['ai-tutoring'],
        },
      });

      await manager.startPilot(deployment.examId);
      const rolledBack = await manager.rollback(deployment.examId, 'High error rate');

      expect(rolledBack?.status).toBe('paused');
      expect(rolledBack?.state.pilotConfig?.status).toBe('rolled_back');
    });
  });

  describe('Events', () => {
    it('should record deployment events', async () => {
      const deployment = await manager.createDeployment({
        examId: 'events-1',
        examCode: 'EVT',
        examName: 'Events Test',
        config: {
          content: { blogsEnabled: true, vlogsEnabled: true, socialEnabled: true, cadence: { questionsPerDay: 20, blogsPerWeek: 2, videosPerWeek: 1, practiceTestsPerMonth: 2, revisionsPerChapter: 2 } },
          tutoring: { enabled: true, modelsAllowed: [], featuresEnabled: [] },
          marketing: { enabled: false, channels: [], budget: 0 },
          features: [],
        },
      });

      await manager.startPilot(deployment.examId);
      const events = await manager.getEvents(deployment.examId);

      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'deployment.created')).toBe(true);
      expect(events.some(e => e.type === 'deployment.pilot_started')).toBe(true);
    });
  });
});
