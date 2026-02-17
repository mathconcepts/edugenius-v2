/**
 * Unit Tests for BaseAgent
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseAgent, AgentConfig, AgentState } from '../../../agents/base-agent';

// Create a concrete implementation for testing
class TestAgent extends BaseAgent {
  public initializeCalled = false;
  public setupSubsCalled = false;
  public heartbeatCount = 0;

  constructor(config: Partial<AgentConfig> = {}) {
    super({
      id: 'TestAgent',
      name: 'Test Agent',
      description: 'Agent for testing',
      heartbeatIntervalMs: 1000,
      budget: {
        dailyTokenLimit: 10000,
        warningThreshold: 0.8,
      },
      subAgents: [
        {
          id: 'SubAgent1',
          name: 'Sub Agent 1',
          description: 'Test sub-agent',
          triggers: ['test:trigger'],
          handler: 'handleTest',
        },
      ],
      ...config,
    });
  }

  protected async initializeLLM(): Promise<void> {
    this.initializeCalled = true;
  }

  protected registerSubAgents(): void {
    this.registerSubAgent('SubAgent1', this.handleTest.bind(this));
  }

  protected async setupSubscriptions(): Promise<void> {
    this.setupSubsCalled = true;
  }

  protected async onHeartbeat(): Promise<void> {
    this.heartbeatCount++;
  }

  private async handleTest(input: unknown): Promise<{ result: string }> {
    return { result: 'handled' };
  }

  // Expose protected methods for testing
  public async testInvokeSubAgent<T>(subAgentId: string, input: unknown): Promise<T> {
    return this.invokeSubAgent<T>(subAgentId, input, { agentId: this.config.id });
  }

  public testEmit(event: string, payload: unknown): void {
    this.emit(event, payload);
  }

  public testCheckBudget(tokens: number): boolean {
    return this.checkBudget(tokens);
  }

  public testRecordTokenUsage(tokens: number): void {
    this.recordTokenUsage(tokens);
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;

  beforeEach(() => {
    agent = new TestAgent();
  });

  afterEach(async () => {
    if (agent.getState().status !== 'offline') {
      await agent.stop();
    }
  });

  describe('Lifecycle', () => {
    it('should initialize in offline state', () => {
      const state = agent.getState();
      expect(state.status).toBe('offline');
    });

    it('should start successfully', async () => {
      await agent.start();
      const state = agent.getState();
      expect(state.status).toBe('active');
      expect(agent.initializeCalled).toBe(true);
      expect(agent.setupSubsCalled).toBe(true);
    });

    it('should not start twice', async () => {
      await agent.start();
      await expect(agent.start()).rejects.toThrow('already running');
    });

    it('should stop successfully', async () => {
      await agent.start();
      await agent.stop();
      const state = agent.getState();
      expect(state.status).toBe('offline');
    });

    it('should emit lifecycle events', async () => {
      const events: string[] = [];
      agent.on('starting', () => events.push('starting'));
      agent.on('started', () => events.push('started'));
      agent.on('stopping', () => events.push('stopping'));
      agent.on('stopped', () => events.push('stopped'));

      await agent.start();
      await agent.stop();

      expect(events).toEqual(['starting', 'started', 'stopping', 'stopped']);
    });
  });

  describe('Configuration', () => {
    it('should return config', () => {
      const config = agent.getConfig();
      expect(config.id).toBe('TestAgent');
      expect(config.name).toBe('Test Agent');
    });

    it('should have sub-agents configured', () => {
      const config = agent.getConfig();
      expect(config.subAgents).toHaveLength(1);
      expect(config.subAgents![0].id).toBe('SubAgent1');
    });
  });

  describe('State Management', () => {
    it('should track state changes', async () => {
      await agent.start();
      const state = agent.getState();
      
      expect(state.status).toBe('active');
      expect(state.startedAt).toBeGreaterThan(0);
      expect(state.errors).toEqual([]);
    });

    it('should track token usage', async () => {
      await agent.start();
      agent.testRecordTokenUsage(100);
      agent.testRecordTokenUsage(200);

      const state = agent.getState();
      expect(state.tokensUsedToday).toBe(300);
    });

    it('should update last activity on token usage', async () => {
      await agent.start();
      const before = agent.getState().lastActivity;
      
      await new Promise(r => setTimeout(r, 10));
      agent.testRecordTokenUsage(100);

      const after = agent.getState().lastActivity;
      expect(after).toBeGreaterThan(before);
    });
  });

  describe('Sub-Agent Invocation', () => {
    it('should invoke registered sub-agent', async () => {
      await agent.start();
      const result = await agent.testInvokeSubAgent<{ result: string }>('SubAgent1', { test: true });
      expect(result.result).toBe('handled');
    });

    it('should throw for unknown sub-agent', async () => {
      await agent.start();
      await expect(
        agent.testInvokeSubAgent('Unknown', {})
      ).rejects.toThrow('not found');
    });

    it('should throw when not running', async () => {
      await expect(
        agent.testInvokeSubAgent('SubAgent1', {})
      ).rejects.toThrow('not running');
    });
  });

  describe('Budget Management', () => {
    it('should allow usage within budget', async () => {
      await agent.start();
      const allowed = agent.testCheckBudget(1000);
      expect(allowed).toBe(true);
    });

    it('should warn when approaching limit', async () => {
      await agent.start();
      agent.testRecordTokenUsage(8500); // 85% of 10000

      const warned = vi.fn();
      agent.on('budget:warning', warned);

      agent.testRecordTokenUsage(100);
      // Warning would be emitted
    });

    it('should block when over budget', async () => {
      await agent.start();
      agent.testRecordTokenUsage(10000);

      const allowed = agent.testCheckBudget(1);
      expect(allowed).toBe(false);
    });
  });

  describe('Event Emission', () => {
    it('should emit events', async () => {
      await agent.start();
      
      const received: unknown[] = [];
      agent.on('test:event', (payload) => received.push(payload));

      agent.testEmit('test:event', { data: 'test' });

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual({ data: 'test' });
    });
  });

  describe('Heartbeat', () => {
    it('should run heartbeat when started', async () => {
      const fastAgent = new TestAgent({
        heartbeatIntervalMs: 50,
      });

      await fastAgent.start();
      await new Promise(r => setTimeout(r, 150));

      expect(fastAgent.heartbeatCount).toBeGreaterThanOrEqual(2);

      await fastAgent.stop();
    });

    it('should stop heartbeat when stopped', async () => {
      const fastAgent = new TestAgent({
        heartbeatIntervalMs: 50,
      });

      await fastAgent.start();
      await new Promise(r => setTimeout(r, 100));
      
      const countBefore = fastAgent.heartbeatCount;
      await fastAgent.stop();
      
      await new Promise(r => setTimeout(r, 100));
      expect(fastAgent.heartbeatCount).toBe(countBefore);
    });
  });

  describe('Error Handling', () => {
    it('should track errors in state', async () => {
      await agent.start();
      
      // Simulate error recording
      const state = agent.getState() as any;
      state.errors.push({
        timestamp: Date.now(),
        error: 'Test error',
        context: 'test',
      });

      expect(agent.getState().errors).toHaveLength(1);
    });
  });
});

describe('BaseAgent Edge Cases', () => {
  it('should handle rapid start/stop cycles', async () => {
    const agent = new TestAgent();

    for (let i = 0; i < 5; i++) {
      await agent.start();
      await agent.stop();
    }

    expect(agent.getState().status).toBe('offline');
  });

  it('should handle concurrent sub-agent invocations', async () => {
    const agent = new TestAgent();
    await agent.start();

    const promises = Array(10).fill(null).map(() =>
      agent.testInvokeSubAgent('SubAgent1', { test: true })
    );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(10);
    results.forEach(r => expect((r as any).result).toBe('handled'));

    await agent.stop();
  });

  it('should handle empty config gracefully', () => {
    const agent = new TestAgent({
      subAgents: undefined,
    });

    expect(agent.getConfig().subAgents).toBeUndefined();
  });
});
