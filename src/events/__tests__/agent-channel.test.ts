/**
 * AgentChannel Tests
 * Tests for agent-to-agent communication
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentChannel, getAgentChannel, resetAgentChannels } from '../agent-channel';
import { EventBus, resetEventBus } from '../event-bus';
import type { AgentId, EventType, TypedEvent } from '../types';

describe('AgentChannel', () => {
  let bus: EventBus;
  
  beforeEach(() => {
    resetEventBus();
    resetAgentChannels();
    bus = new EventBus();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Messaging', () => {
    it('should send events with source agent', async () => {
      const channel = new AgentChannel('scout' as AgentId, bus);
      const received: TypedEvent<EventType>[] = [];

      bus.subscribe('content.created', (event) => {
        received.push(event);
      });

      channel.send('content.created', {
        contentId: 'c1',
        contentType: 'article',
        title: 'Test Article',
        status: 'draft',
        createdBy: 'scout',
        createdAt: Date.now(),
      });

      await delay(50);

      expect(received).toHaveLength(1);
      expect(received[0].meta.source).toBe('scout');
    });

    it('should send to specific agent', async () => {
      const scoutChannel = new AgentChannel('scout' as AgentId, bus);
      const atlasChannel = new AgentChannel('atlas' as AgentId, bus);
      const sageChannel = new AgentChannel('sage' as AgentId, bus);

      const atlasReceived: TypedEvent<EventType>[] = [];
      const sageReceived: TypedEvent<EventType>[] = [];

      atlasChannel.on('content.created', (event) => {
        atlasReceived.push(event);
      });

      sageChannel.on('content.created', (event) => {
        sageReceived.push(event);
      });

      scoutChannel.sendTo('atlas' as AgentId, 'content.created', {
        contentId: 'c1',
        contentType: 'article',
        title: 'For Atlas',
        status: 'draft',
        createdBy: 'scout',
        createdAt: Date.now(),
      });

      await delay(50);

      expect(atlasReceived).toHaveLength(1);
      expect(sageReceived).toHaveLength(0);
    });

    it('should broadcast to all agents', async () => {
      const scoutChannel = new AgentChannel('scout' as AgentId, bus);
      const atlasChannel = new AgentChannel('atlas' as AgentId, bus);
      const sageChannel = new AgentChannel('sage' as AgentId, bus);

      const atlasReceived: TypedEvent<EventType>[] = [];
      const sageReceived: TypedEvent<EventType>[] = [];

      atlasChannel.on('system.agent.heartbeat', (event) => {
        atlasReceived.push(event);
      }, { receiveAll: true });

      sageChannel.on('system.agent.heartbeat', (event) => {
        sageReceived.push(event);
      }, { receiveAll: true });

      scoutChannel.broadcast('system.agent.heartbeat', {
        agentId: 'scout',
        status: 'healthy',
        activeSubAgents: [],
        currentTasks: 5,
        queuedTasks: 2,
        resourceUsage: { tokensUsed: 1000, tokenBudget: 10000, apiCallsLastHour: 10 },
        lastActivity: Date.now(),
      });

      await delay(50);

      expect(atlasReceived).toHaveLength(1);
      expect(sageReceived).toHaveLength(1);
    });
  });

  describe('Request/Reply Pattern', () => {
    it('should handle request/reply', async () => {
      const atlasChannel = new AgentChannel('atlas' as AgentId, bus);
      const sageChannel = new AgentChannel('sage' as AgentId, bus);

      // Sage handles content requests
      sageChannel.onRequest(
        'content.created',
        'content.updated',
        async (event) => {
          return {
            contentId: event.payload.contentId,
            changes: { reviewed: true },
            updatedBy: 'sage',
            updatedAt: Date.now(),
          };
        }
      );

      // Atlas sends request and waits for response
      const response = await atlasChannel.request(
        'sage' as AgentId,
        'content.created',
        {
          contentId: 'c1',
          contentType: 'article',
          title: 'Review This',
          status: 'draft',
          createdBy: 'atlas',
          createdAt: Date.now(),
        },
        'content.updated',
        { timeout: 5000 }
      );

      expect(response.type).toBe('content.updated');
      expect(response.payload.contentId).toBe('c1');
      expect(response.payload.changes).toEqual({ reviewed: true });
    });

    it('should timeout on no response', async () => {
      const atlasChannel = new AgentChannel('atlas' as AgentId, bus);

      await expect(
        atlasChannel.request(
          'sage' as AgentId,
          'content.created',
          {
            contentId: 'c1',
            contentType: 'article',
            title: 'No Reply',
            status: 'draft',
            createdBy: 'atlas',
            createdAt: Date.now(),
          },
          'content.updated',
          { timeout: 100 }
        )
      ).rejects.toThrow('Request timeout');
    });
  });

  describe('Event Listening', () => {
    it('should listen once', async () => {
      const channel = new AgentChannel('scout' as AgentId, bus);
      let count = 0;

      channel.once('content.created', () => {
        count++;
      });

      // Emit twice
      bus.publish('content.created', {
        contentId: 'c1',
        contentType: 'article',
        title: 'First',
        status: 'draft',
        createdBy: 'test',
        createdAt: Date.now(),
      }, { target: 'scout' as AgentId });

      await delay(50);

      bus.publish('content.created', {
        contentId: 'c2',
        contentType: 'article',
        title: 'Second',
        status: 'draft',
        createdBy: 'test',
        createdAt: Date.now(),
      }, { target: 'scout' as AgentId });

      await delay(50);

      expect(count).toBe(1);
    });

    it('should listen to multiple event types', async () => {
      const channel = new AgentChannel('scout' as AgentId, bus);
      const received: string[] = [];

      channel.onMany(
        ['content.created', 'content.updated'],
        (event) => {
          received.push(event.type);
        },
        { receiveAll: true }
      );

      bus.publish('content.created', {
        contentId: 'c1',
        contentType: 'article',
        title: 'Test',
        status: 'draft',
        createdBy: 'test',
        createdAt: Date.now(),
      });

      bus.publish('content.updated', {
        contentId: 'c1',
        changes: { title: 'Updated' },
        updatedBy: 'test',
        updatedAt: Date.now(),
      });

      await delay(50);

      expect(received).toContain('content.created');
      expect(received).toContain('content.updated');
    });

    it('should unsubscribe correctly', async () => {
      const channel = new AgentChannel('scout' as AgentId, bus);
      let count = 0;

      const unsubscribe = channel.on('content.created', () => {
        count++;
      }, { receiveAll: true });

      bus.publish('content.created', {
        contentId: 'c1',
        contentType: 'article',
        title: 'First',
        status: 'draft',
        createdBy: 'test',
        createdAt: Date.now(),
      });

      await delay(50);

      unsubscribe();

      bus.publish('content.created', {
        contentId: 'c2',
        contentType: 'article',
        title: 'Second',
        status: 'draft',
        createdBy: 'test',
        createdAt: Date.now(),
      });

      await delay(50);

      expect(count).toBe(1);
    });
  });

  describe('Agent Presence', () => {
    it('should send heartbeat', async () => {
      const channel = new AgentChannel('scout' as AgentId, bus);
      const received: TypedEvent<EventType>[] = [];

      bus.subscribe('system.agent.heartbeat', (event) => {
        received.push(event);
      });

      channel.sendHeartbeat('healthy', {
        activeSubAgents: ['scout:tracker', 'scout:analyzer'],
        currentTasks: 3,
        queuedTasks: 5,
        resourceUsage: {
          tokensUsed: 5000,
          tokenBudget: 30000,
          apiCallsLastHour: 25,
        },
      });

      await delay(50);

      expect(received).toHaveLength(1);
      expect(received[0].payload.agentId).toBe('scout');
      expect(received[0].payload.status).toBe('healthy');
      expect(received[0].payload.currentTasks).toBe(3);
    });

    it('should report errors', async () => {
      const channel = new AgentChannel('scout' as AgentId, bus);
      const received: TypedEvent<EventType>[] = [];

      bus.subscribe('system.agent.error', (event) => {
        received.push(event);
      });

      const error = new Error('API rate limit exceeded');
      channel.reportError(error, { endpoint: '/api/search', retryAfter: 60 });

      await delay(50);

      expect(received).toHaveLength(1);
      expect(received[0].payload.agentId).toBe('scout');
      expect(received[0].payload.message).toBe('API rate limit exceeded');
      expect(received[0].payload.context).toEqual({ endpoint: '/api/search', retryAfter: 60 });
    });
  });

  describe('Workflow Support', () => {
    it('should start workflow', async () => {
      const channel = new AgentChannel('jarvis' as AgentId, bus);
      const received: TypedEvent<EventType>[] = [];

      bus.subscribe('system.workflow.started', (event) => {
        received.push(event);
      });

      const workflowId = channel.startWorkflow(
        'content_creation',
        ['scout', 'atlas', 'sage'] as AgentId[],
        { topic: 'AI in Education' }
      );

      await delay(50);

      expect(received).toHaveLength(1);
      expect(received[0].payload.workflowId).toBe(workflowId);
      expect(received[0].payload.workflowType).toBe('content_creation');
      expect(received[0].payload.initiator).toBe('jarvis');
      expect(received[0].payload.participants).toEqual(['scout', 'atlas', 'sage']);
    });

    it('should report workflow step', async () => {
      const channel = new AgentChannel('scout' as AgentId, bus);
      const received: TypedEvent<EventType>[] = [];

      bus.subscribe('system.workflow.step', (event) => {
        received.push(event);
      });

      channel.reportWorkflowStep(
        'wf-123',
        'step-1',
        'research',
        'completed',
        { sources: 5, insights: 3 }
      );

      await delay(50);

      expect(received).toHaveLength(1);
      expect(received[0].payload.workflowId).toBe('wf-123');
      expect(received[0].payload.stepName).toBe('research');
      expect(received[0].payload.status).toBe('completed');
      expect(received[0].payload.agent).toBe('scout');
    });

    it('should complete workflow', async () => {
      const channel = new AgentChannel('jarvis' as AgentId, bus);
      const received: TypedEvent<EventType>[] = [];

      bus.subscribe('system.workflow.completed', (event) => {
        received.push(event);
      });

      channel.completeWorkflow(
        'wf-123',
        'content_creation',
        'completed',
        { articleId: 'art-456' },
        { duration: 300000, stepsCompleted: 5, stepsFailed: 0 }
      );

      await delay(50);

      expect(received).toHaveLength(1);
      expect(received[0].payload.workflowId).toBe('wf-123');
      expect(received[0].payload.status).toBe('completed');
      expect(received[0].payload.stepsCompleted).toBe(5);
    });
  });

  describe('Factory Function', () => {
    it('should return same channel for same agent', () => {
      const channel1 = getAgentChannel('scout' as AgentId);
      const channel2 = getAgentChannel('scout' as AgentId);

      expect(channel1).toBe(channel2);
    });

    it('should return different channels for different agents', () => {
      const scoutChannel = getAgentChannel('scout' as AgentId);
      const atlasChannel = getAgentChannel('atlas' as AgentId);

      expect(scoutChannel).not.toBe(atlasChannel);
      expect(scoutChannel.getAgentId()).toBe('scout');
      expect(atlasChannel.getAgentId()).toBe('atlas');
    });

    it('should reset channels', () => {
      const channel1 = getAgentChannel('scout' as AgentId);
      resetAgentChannels();
      const channel2 = getAgentChannel('scout' as AgentId);

      expect(channel1).not.toBe(channel2);
    });
  });
});

// Utility
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
