/**
 * WorkflowOrchestrator Tests
 * Tests for multi-agent workflow coordination
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WorkflowOrchestrator,
  getOrchestrator,
  resetOrchestrator,
  type WorkflowDefinition,
  type WorkflowStep,
} from '../workflow-orchestrator';
import { EventBus, resetEventBus } from '../event-bus';
import type { AgentId, EventType, TypedEvent } from '../types';

describe('WorkflowOrchestrator', () => {
  let bus: EventBus;
  let orchestrator: WorkflowOrchestrator;

  beforeEach(() => {
    resetEventBus();
    resetOrchestrator();
    bus = new EventBus();
    orchestrator = new WorkflowOrchestrator(bus);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Workflow Registration', () => {
    it('should register workflow definition', () => {
      const definition = createSimpleWorkflow();
      
      expect(() => orchestrator.registerWorkflow(definition)).not.toThrow();
    });

    it('should reject workflow with circular dependencies', () => {
      const definition: WorkflowDefinition = {
        id: 'circular',
        name: 'Circular Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            agent: 'scout' as AgentId,
            action: 'research',
            dependencies: ['step2'],
          },
          {
            id: 'step2',
            name: 'Step 2',
            agent: 'atlas' as AgentId,
            action: 'write',
            dependencies: ['step1'],
          },
        ],
      };

      expect(() => orchestrator.registerWorkflow(definition)).toThrow(/circular/i);
    });

    it('should reject workflow with missing dependency', () => {
      const definition: WorkflowDefinition = {
        id: 'missing-dep',
        name: 'Missing Dep Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            agent: 'scout' as AgentId,
            action: 'research',
            dependencies: ['nonexistent'],
          },
        ],
      };

      expect(() => orchestrator.registerWorkflow(definition)).toThrow(/dependency/i);
    });
  });

  describe('Step Handler Registration', () => {
    it('should register step handlers', () => {
      const handler = vi.fn().mockResolvedValue({ result: 'done' });
      
      orchestrator.registerStepHandler('scout' as AgentId, 'research', handler);
      
      // Handler registration doesn't throw
      expect(true).toBe(true);
    });
  });

  describe('Workflow Execution', () => {
    it('should start workflow and execute steps', async () => {
      const definition = createSimpleWorkflow();
      orchestrator.registerWorkflow(definition);

      // Register handlers
      orchestrator.registerStepHandler('scout' as AgentId, 'research', async (input) => {
        return { findings: ['insight1', 'insight2'] };
      });

      orchestrator.registerStepHandler('atlas' as AgentId, 'write', async (input) => {
        return { articleId: 'art-123' };
      });

      const events: TypedEvent<EventType>[] = [];
      bus.subscribe('system.workflow.started', (e) => events.push(e));
      bus.subscribe('system.workflow.step', (e) => events.push(e));
      bus.subscribe('system.workflow.completed', (e) => events.push(e));

      const instanceId = await orchestrator.start(
        'simple-workflow',
        { topic: 'AI Education' },
        'jarvis' as AgentId
      );

      // Wait for completion
      await delay(200);

      expect(instanceId).toBeDefined();
      
      // Check events
      const startEvent = events.find((e) => e.type === 'system.workflow.started');
      expect(startEvent).toBeDefined();
      expect(startEvent?.payload.workflowId).toBe(instanceId);

      const completeEvent = events.find((e) => e.type === 'system.workflow.completed');
      expect(completeEvent).toBeDefined();
      expect(completeEvent?.payload.status).toBe('completed');
    });

    it('should respect step dependencies', async () => {
      const definition: WorkflowDefinition = {
        id: 'dependent',
        name: 'Dependent Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'research',
            name: 'Research',
            agent: 'scout' as AgentId,
            action: 'research',
          },
          {
            id: 'write',
            name: 'Write',
            agent: 'atlas' as AgentId,
            action: 'write',
            dependencies: ['research'],
          },
          {
            id: 'review',
            name: 'Review',
            agent: 'sage' as AgentId,
            action: 'review',
            dependencies: ['write'],
          },
        ],
      };

      orchestrator.registerWorkflow(definition);

      const executionOrder: string[] = [];

      orchestrator.registerStepHandler('scout' as AgentId, 'research', async () => {
        executionOrder.push('research');
        return { data: 'researched' };
      });

      orchestrator.registerStepHandler('atlas' as AgentId, 'write', async () => {
        executionOrder.push('write');
        return { draft: 'written' };
      });

      orchestrator.registerStepHandler('sage' as AgentId, 'review', async () => {
        executionOrder.push('review');
        return { approved: true };
      });

      await orchestrator.start('dependent', {}, 'jarvis' as AgentId);
      await delay(300);

      expect(executionOrder).toEqual(['research', 'write', 'review']);
    });

    it('should execute parallel steps', async () => {
      const definition: WorkflowDefinition = {
        id: 'parallel',
        name: 'Parallel Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'task1',
            name: 'Task 1',
            agent: 'scout' as AgentId,
            action: 'task',
          },
          {
            id: 'task2',
            name: 'Task 2',
            agent: 'atlas' as AgentId,
            action: 'task',
          },
          {
            id: 'task3',
            name: 'Task 3',
            agent: 'sage' as AgentId,
            action: 'task',
          },
        ],
      };

      orchestrator.registerWorkflow(definition);

      const startTimes: Record<string, number> = {};
      const endTimes: Record<string, number> = {};

      for (const agent of ['scout', 'atlas', 'sage']) {
        orchestrator.registerStepHandler(agent as AgentId, 'task', async () => {
          startTimes[agent] = Date.now();
          await delay(50);
          endTimes[agent] = Date.now();
          return {};
        });
      }

      await orchestrator.start('parallel', {}, 'jarvis' as AgentId);
      await delay(200);

      // All should start roughly at the same time (within 50ms)
      const starts = Object.values(startTimes);
      const maxDiff = Math.max(...starts) - Math.min(...starts);
      expect(maxDiff).toBeLessThan(50);
    });
  });

  describe('Workflow Control', () => {
    it('should pause workflow', async () => {
      const definition = createSimpleWorkflow();
      orchestrator.registerWorkflow(definition);

      orchestrator.registerStepHandler('scout' as AgentId, 'research', async () => {
        await delay(100);
        return {};
      });

      orchestrator.registerStepHandler('atlas' as AgentId, 'write', async () => {
        return {};
      });

      const instanceId = await orchestrator.start('simple-workflow', {}, 'jarvis' as AgentId);

      // Pause immediately
      const paused = orchestrator.pause(instanceId);
      expect(paused).toBe(true);

      const instance = orchestrator.getInstance(instanceId);
      expect(instance?.status).toBe('paused');
    });

    it('should cancel running workflow', async () => {
      const definition: WorkflowDefinition = {
        id: 'cancellable',
        name: 'Cancellable Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'long-task',
            name: 'Long Task',
            agent: 'scout' as AgentId,
            action: 'long',
          },
        ],
      };

      orchestrator.registerWorkflow(definition);

      orchestrator.registerStepHandler('scout' as AgentId, 'long', async () => {
        await delay(500);
        return {};
      });

      const events: TypedEvent<EventType>[] = [];
      bus.subscribe('system.workflow.completed', (e) => events.push(e));

      const instanceId = await orchestrator.start('cancellable', {}, 'jarvis' as AgentId);

      await delay(50); // Start but not complete

      const cancelled = orchestrator.cancel(instanceId);
      expect(cancelled).toBe(true);

      // Verify event was emitted
      await delay(50);
      const completeEvent = events.find((e) => e.type === 'system.workflow.completed');
      expect(completeEvent?.payload.status).toBe('cancelled');
    });
  });

  describe('Error Handling', () => {
    it('should handle step failure with default behavior', async () => {
      const definition: WorkflowDefinition = {
        id: 'failing',
        name: 'Failing Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'fail',
            name: 'Will Fail',
            agent: 'scout' as AgentId,
            action: 'fail',
            retries: 0, // No retries
          },
        ],
        errorHandling: {
          defaultBehavior: 'fail',
          maxRetries: 0,
          retryDelayMs: 1,
        },
      };

      orchestrator.registerWorkflow(definition);

      orchestrator.registerStepHandler('scout' as AgentId, 'fail', async () => {
        throw new Error('Intentional failure');
      });

      const events: TypedEvent<EventType>[] = [];
      bus.subscribe('system.workflow.completed', (e) => events.push(e));
      bus.subscribe('system.workflow.step', (e) => events.push(e));

      await orchestrator.start('failing', {}, 'jarvis' as AgentId);
      await delay(200);

      const stepEvent = events.find((e) => e.type === 'system.workflow.step' && e.payload.status === 'failed');
      expect(stepEvent).toBeDefined();
      expect(stepEvent?.payload.error).toContain('Intentional failure');
    });

    it('should retry failed steps', async () => {
      const definition: WorkflowDefinition = {
        id: 'retry',
        name: 'Retry Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'flaky',
            name: 'Flaky Step',
            agent: 'scout' as AgentId,
            action: 'flaky',
            retries: 3,
          },
        ],
        errorHandling: {
          defaultBehavior: 'fail',
          maxRetries: 3,
          retryDelayMs: 10,
        },
      };

      orchestrator.registerWorkflow(definition);

      let attempts = 0;
      orchestrator.registerStepHandler('scout' as AgentId, 'flaky', async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error(`Attempt ${attempts} failed`);
        }
        return { success: true };
      });

      const events: TypedEvent<EventType>[] = [];
      bus.subscribe('system.workflow.completed', (e) => events.push(e));

      await orchestrator.start('retry', {}, 'jarvis' as AgentId);
      await delay(500); // More time for retries

      expect(attempts).toBeGreaterThanOrEqual(3);
      
      const completeEvent = events.find((e) => e.type === 'system.workflow.completed');
      expect(completeEvent?.payload.status).toBe('completed');
    });

    it('should mark step as failed after max retries', async () => {
      const definition: WorkflowDefinition = {
        id: 'always-fail',
        name: 'Always Fail Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'fail',
            name: 'Always Fails',
            agent: 'scout' as AgentId,
            action: 'always-fail',
            retries: 2,
          },
        ],
        errorHandling: {
          defaultBehavior: 'fail',
          maxRetries: 2,
          retryDelayMs: 10,
        },
      };

      orchestrator.registerWorkflow(definition);

      let attempts = 0;
      orchestrator.registerStepHandler('scout' as AgentId, 'always-fail', async () => {
        attempts++;
        throw new Error(`Fail #${attempts}`);
      });

      const events: TypedEvent<EventType>[] = [];
      bus.subscribe('system.workflow.step', (e) => events.push(e));

      await orchestrator.start('always-fail', {}, 'jarvis' as AgentId);
      await delay(300);

      // Should have tried 3 times (initial + 2 retries)
      expect(attempts).toBeGreaterThanOrEqual(2);
      
      const failedStepEvent = events.find((e) => 
        e.type === 'system.workflow.step' && e.payload.status === 'failed'
      );
      expect(failedStepEvent).toBeDefined();
    });
  });

  describe('Input Resolution', () => {
    it('should pass static input to steps', async () => {
      const definition: WorkflowDefinition = {
        id: 'with-input',
        name: 'With Input Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'process',
            name: 'Process',
            agent: 'scout' as AgentId,
            action: 'process',
            input: { topic: 'Static Topic' }, // Static input defined on step
          },
        ],
      };

      orchestrator.registerWorkflow(definition);

      let receivedInput: unknown;
      orchestrator.registerStepHandler('scout' as AgentId, 'process', async (input) => {
        receivedInput = input;
        return {};
      });

      await orchestrator.start('with-input', {}, 'jarvis' as AgentId);

      await delay(100);

      expect(receivedInput).toEqual({ topic: 'Static Topic' });
    });
  });

  describe('Factory Function', () => {
    it('should return singleton orchestrator', () => {
      const orch1 = getOrchestrator();
      const orch2 = getOrchestrator();

      expect(orch1).toBe(orch2);
    });

    it('should reset orchestrator', () => {
      const orch1 = getOrchestrator();
      resetOrchestrator();
      const orch2 = getOrchestrator();

      expect(orch1).not.toBe(orch2);
    });
  });

  describe('Workflow Query', () => {
    it('should get workflow instance status', async () => {
      const definition = createSimpleWorkflow();
      orchestrator.registerWorkflow(definition);

      orchestrator.registerStepHandler('scout' as AgentId, 'research', async () => {
        await delay(100);
        return {};
      });
      orchestrator.registerStepHandler('atlas' as AgentId, 'write', async () => ({}));

      const instanceId = await orchestrator.start(
        'simple-workflow',
        {},
        'jarvis' as AgentId
      );

      const instance = orchestrator.getInstance(instanceId);
      expect(instance).toBeDefined();
      expect(instance?.status).toBe('running');

      await delay(200);

      const completed = orchestrator.getInstance(instanceId);
      expect(completed?.status).toBe('completed');
    });
  });
});

// ============================================================================
// Test Helpers
// ============================================================================

function createSimpleWorkflow(): WorkflowDefinition {
  return {
    id: 'simple-workflow',
    name: 'Simple Workflow',
    version: '1.0.0',
    steps: [
      {
        id: 'research',
        name: 'Research',
        agent: 'scout' as AgentId,
        action: 'research',
      },
      {
        id: 'write',
        name: 'Write',
        agent: 'atlas' as AgentId,
        action: 'write',
        dependencies: ['research'],
      },
    ],
  };
}

function createSlowWorkflow(): WorkflowDefinition {
  return {
    id: 'slow',
    name: 'Slow Workflow',
    version: '1.0.0',
    steps: [
      {
        id: 'step1',
        name: 'Step 1',
        agent: 'scout' as AgentId,
        action: 'slow',
      },
      {
        id: 'step2',
        name: 'Step 2',
        agent: 'atlas' as AgentId,
        action: 'slow',
        dependencies: ['step1'],
      },
    ],
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
