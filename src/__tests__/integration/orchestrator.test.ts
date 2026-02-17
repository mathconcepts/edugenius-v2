/**
 * Integration Tests for EduGenius Orchestrator
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { EduGeniusOrchestrator, getOrchestrator, resetOrchestrator } from '../../orchestrator';

describe('EduGenius Orchestrator', () => {
  let orchestrator: EduGeniusOrchestrator;

  beforeAll(async () => {
    orchestrator = getOrchestrator({
      enabledAgents: ['Scout', 'Atlas', 'Sage', 'Mentor', 'Herald', 'Forge', 'Oracle'],
    });
  });

  afterAll(async () => {
    await orchestrator.stop().catch(() => {});
    resetOrchestrator();
  });

  describe('Lifecycle', () => {
    it('should start successfully', async () => {
      await orchestrator.start();
      const status = orchestrator.getStatus();
      expect(status.status).toBe('running');
    });

    it('should have all agents running', () => {
      const status = orchestrator.getStatus();
      expect(status.agents.length).toBe(7);
      
      const agentIds = status.agents.map(a => a.id);
      expect(agentIds).toContain('Scout');
      expect(agentIds).toContain('Atlas');
      expect(agentIds).toContain('Sage');
      expect(agentIds).toContain('Mentor');
      expect(agentIds).toContain('Herald');
      expect(agentIds).toContain('Forge');
      expect(agentIds).toContain('Oracle');
    });

    it('should track uptime', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      const status = orchestrator.getStatus();
      expect(status.uptime).toBeGreaterThan(0);
    });
  });

  describe('Agent Access', () => {
    it('should get Scout agent', () => {
      const scout = orchestrator.getAgent('Scout');
      expect(scout).toBeDefined();
      expect(scout?.getConfig().id).toBe('Scout');
    });

    it('should get Atlas agent', () => {
      const atlas = orchestrator.getAgent('Atlas');
      expect(atlas).toBeDefined();
      expect(atlas?.getConfig().id).toBe('Atlas');
    });

    it('should get Sage agent', () => {
      const sage = orchestrator.getAgent('Sage');
      expect(sage).toBeDefined();
      expect(sage?.getConfig().id).toBe('Sage');
    });

    it('should get Mentor agent', () => {
      const mentor = orchestrator.getAgent('Mentor');
      expect(mentor).toBeDefined();
      expect(mentor?.getConfig().id).toBe('Mentor');
    });

    it('should get Herald agent', () => {
      const herald = orchestrator.getAgent('Herald');
      expect(herald).toBeDefined();
      expect(herald?.getConfig().id).toBe('Herald');
    });

    it('should get Forge agent', () => {
      const forge = orchestrator.getAgent('Forge');
      expect(forge).toBeDefined();
      expect(forge?.getConfig().id).toBe('Forge');
    });

    it('should get Oracle agent', () => {
      const oracle = orchestrator.getAgent('Oracle');
      expect(oracle).toBeDefined();
      expect(oracle?.getConfig().id).toBe('Oracle');
    });

    it('should return undefined for unknown agent', () => {
      const unknown = orchestrator.getAgent('Unknown' as any);
      expect(unknown).toBeUndefined();
    });
  });

  describe('Agent Actions', () => {
    it('should start a tutoring session', async () => {
      const sessionId = await orchestrator.startTutoringSession('test-student-1', 'algebra');
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
    });

    it('should check student engagement', async () => {
      const engagement = await orchestrator.checkStudentEngagement('test-student-1');
      expect(engagement).toBeDefined();
      expect(engagement.studentId).toBe('test-student-1');
      expect(typeof engagement.score).toBe('number');
      expect(typeof engagement.churnRisk).toBe('number');
    });

    it('should run health check', async () => {
      const health = await orchestrator.runHealthCheck();
      expect(health).toBeDefined();
      expect(health.success).toBe(true);
      expect(health.overall).toBeDefined();
      expect(Array.isArray(health.services)).toBe(true);
    });

    it('should get analytics report', async () => {
      const report = await orchestrator.getReport('daily');
      expect(report).toBeDefined();
      expect(report.type).toBe('daily');
      expect(Array.isArray(report.metrics)).toBe(true);
    });

    it('should get funnel analysis', async () => {
      const funnel = await orchestrator.getFunnelAnalysis();
      expect(funnel).toBeDefined();
      expect(funnel.success).toBe(true);
      expect(funnel.funnel).toBeDefined();
    });
  });

  describe('Event Bus', () => {
    it('should have event bus accessible', () => {
      const eventBus = orchestrator.getEventBus();
      expect(eventBus).toBeDefined();
    });

    it('should track events in metrics', () => {
      const status = orchestrator.getStatus();
      expect(status.metrics).toBeDefined();
      expect(typeof status.metrics.totalEvents).toBe('number');
    });
  });

  describe('Workflows', () => {
    it('should start a workflow', async () => {
      const instanceId = await orchestrator.startWorkflow('daily-ops', {});
      expect(instanceId).toBeDefined();
      expect(typeof instanceId).toBe('string');
    });

    it('should get workflow status', async () => {
      const instanceId = await orchestrator.startWorkflow('content-pipeline', {
        topic: 'Test Topic',
      });

      const status = await orchestrator.getWorkflowStatus(instanceId);
      // Status may be undefined if workflow completed quickly
      // Just verify no error thrown
    });
  });

  describe('Shutdown', () => {
    it('should stop gracefully', async () => {
      await orchestrator.stop();
      const status = orchestrator.getStatus();
      expect(status.status).toBe('stopped');
    });

    it('should restart successfully', async () => {
      await orchestrator.start();
      const status = orchestrator.getStatus();
      expect(status.status).toBe('running');
    });
  });
});

describe('Cross-Agent Communication', () => {
  let orchestrator: EduGeniusOrchestrator;

  beforeAll(async () => {
    orchestrator = getOrchestrator();
    await orchestrator.start();
  });

  afterAll(async () => {
    await orchestrator.stop();
    resetOrchestrator();
  });

  it('should route events between agents', async () => {
    const eventBus = orchestrator.getEventBus();
    let receivedEvent = false;

    // Subscribe to a cross-agent event
    eventBus.subscribe('herald.promote.requested', () => {
      receivedEvent = true;
    });

    // Emit content published (should trigger herald.promote.requested)
    eventBus.publish('atlas.content.published', {
      contentId: 'test-content-1',
      contentType: 'lesson',
    });

    // Wait for event propagation
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(receivedEvent).toBe(true);
  });

  it('should handle mentor churn alerts', async () => {
    const eventBus = orchestrator.getEventBus();
    let reengageRequested = false;

    eventBus.subscribe('herald.reengage.requested', () => {
      reengageRequested = true;
    });

    // Emit churn alert
    eventBus.publish('mentor.engagement.alert', {
      studentId: 'test-student-2',
      alertType: 'churn_risk',
      score: 0.85,
      urgency: 'critical',
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(reengageRequested).toBe(true);
  });
});
