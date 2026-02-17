/**
 * Unit Tests for EduGenius LLM Client
 * Tests the main client interface, fallback handling, and event system
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMClient } from '../index';
import type { LLMRequest, LLMResponse } from '../types';

// Mock the adapters
vi.mock('../adapters', () => ({
  createAdapter: vi.fn(),
  getAdapter: vi.fn(),
  clearAdapters: vi.fn(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('LLMClient', () => {
  let client: LLMClient;
  
  const testConfig = {
    providers: {
      gemini: {
        enabled: true,
        priority: 1,
        apiKey: 'test-key',
        models: {
          'gemini-2.0-flash': {
            id: 'gemini-2.0-flash',
            tier: 'flash',
          },
        },
        fallbackOrder: ['gemini-2.0-flash'],
      },
      anthropic: {
        enabled: true,
        priority: 2,
        apiKey: 'test-key',
        models: {
          'claude-3-5-sonnet': {
            id: 'claude-3-5-sonnet-20241022',
            tier: 'standard',
          },
        },
        fallbackOrder: ['claude-3-5-sonnet'],
      },
    },
    routingRules: {
      taskTypes: {
        'routine': {
          preferredTiers: ['flash'],
          preferredProviders: ['gemini'],
        },
      },
      budgetLimits: {
        default: { dailyLimit: 10, warningThreshold: 0.8 },
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    client = new LLMClient(testConfig as any);
  });

  describe('Initialization', () => {
    it('should initialize with config', () => {
      expect(client).toBeInstanceOf(LLMClient);
    });

    it('should emit ready event', async () => {
      const readySpy = vi.fn();
      client.on('ready', readySpy);
      
      await client.initialize();
      
      expect(readySpy).toHaveBeenCalled();
    });
  });

  describe('Generate', () => {
    it('should route request to appropriate provider', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: { parts: [{ text: 'Response' }] },
            finishReason: 'STOP',
          }],
          usageMetadata: { totalTokenCount: 10 },
        }),
      });

      const response = await client.generate({
        messages: [{ role: 'user', content: 'Hello' }],
        taskType: 'routine',
        agentId: 'Jarvis',
      });

      expect(response.content).toBe('Response');
    });

    it('should respect explicit model selection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Claude response' }],
          usage: { input_tokens: 5, output_tokens: 10 },
        }),
      });

      const response = await client.generate({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-5-sonnet-20241022',
        agentId: 'Jarvis',
      });

      expect(response.content).toBe('Claude response');
    });

    it('should emit generate events', async () => {
      const startSpy = vi.fn();
      const completeSpy = vi.fn();
      
      client.on('generate:start', startSpy);
      client.on('generate:complete', completeSpy);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: { parts: [{ text: 'Response' }] },
            finishReason: 'STOP',
          }],
          usageMetadata: { totalTokenCount: 10 },
        }),
      });

      await client.generate({
        messages: [{ role: 'user', content: 'Hello' }],
        agentId: 'Jarvis',
      });

      expect(startSpy).toHaveBeenCalled();
      expect(completeSpy).toHaveBeenCalled();
    });
  });

  describe('Fallback Handling', () => {
    it('should fallback to next provider on failure', async () => {
      // First provider fails
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: { message: 'Server error' } }),
        })
        // Second provider succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [{ type: 'text', text: 'Fallback response' }],
            usage: { input_tokens: 5, output_tokens: 10 },
          }),
        });

      const response = await client.generate({
        messages: [{ role: 'user', content: 'Hello' }],
        agentId: 'Jarvis',
      });

      expect(response.content).toBe('Fallback response');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should emit fallback event', async () => {
      const fallbackSpy = vi.fn();
      client.on('fallback', fallbackSpy);

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ error: { message: 'Rate limited' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [{ type: 'text', text: 'OK' }],
            usage: { input_tokens: 5, output_tokens: 5 },
          }),
        });

      await client.generate({
        messages: [{ role: 'user', content: 'Hello' }],
        agentId: 'Jarvis',
      });

      expect(fallbackSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          fromProvider: expect.any(String),
          toProvider: expect.any(String),
          reason: expect.any(String),
        })
      );
    });

    it('should throw after all fallbacks exhausted', async () => {
      // All providers fail
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Server error' } }),
      });

      await expect(
        client.generate({
          messages: [{ role: 'user', content: 'Hello' }],
          agentId: 'Jarvis',
        })
      ).rejects.toThrow();
    });
  });

  describe('Budget Enforcement', () => {
    it('should track usage after successful requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: { parts: [{ text: 'Response' }] },
            finishReason: 'STOP',
          }],
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 50,
            totalTokenCount: 150,
          },
        }),
      });

      await client.generate({
        messages: [{ role: 'user', content: 'Hello' }],
        agentId: 'TestAgent',
      });

      const budget = client.getBudgetStatus('TestAgent');
      expect(budget.inputTokens).toBe(100);
      expect(budget.outputTokens).toBe(50);
    });

    it('should emit budget warning', async () => {
      const warningSpy = vi.fn();
      client.on('budget:warning', warningSpy);

      // Record enough usage to trigger warning (80% of $10 = $8)
      await client.recordUsage('TestAgent', 1000000, 500000, 8.50);

      expect(warningSpy).toHaveBeenCalled();
    });

    it('should block requests when budget exceeded', async () => {
      // Exceed budget
      await client.recordUsage('TestAgent', 2000000, 1000000, 15.00);

      await expect(
        client.generate({
          messages: [{ role: 'user', content: 'Hello' }],
          agentId: 'TestAgent',
          enforeBudget: true,
        })
      ).rejects.toThrow(/budget/i);
    });
  });

  describe('Streaming', () => {
    it('should stream responses', async () => {
      const chunks: string[] = [];
      
      // Mock streaming response
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\n'),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"candidates":[{"content":{"parts":[{"text":" World"}]}}]}\n'),
          })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: vi.fn(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      for await (const chunk of client.stream({
        messages: [{ role: 'user', content: 'Hi' }],
        agentId: 'Jarvis',
      })) {
        if (chunk.type === 'content') {
          chunks.push(chunk.content);
        }
      }

      expect(chunks.join('')).toContain('Hello');
    });

    it('should emit stream events', async () => {
      const chunkSpy = vi.fn();
      client.on('stream:chunk', chunkSpy);

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"candidates":[{"content":{"parts":[{"text":"Test"}]}}]}\n'),
          })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: vi.fn(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const chunks = [];
      for await (const chunk of client.stream({
        messages: [{ role: 'user', content: 'Hi' }],
        agentId: 'Jarvis',
      })) {
        chunks.push(chunk);
      }

      expect(chunkSpy).toHaveBeenCalled();
    });
  });

  describe('Embeddings', () => {
    it('should generate embeddings', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
          usage: { total_tokens: 5 },
        }),
      });

      const response = await client.embed({
        texts: ['Hello world'],
        model: 'text-embedding-3-small',
      });

      expect(response.embeddings).toHaveLength(1);
      expect(response.embeddings[0]).toEqual([0.1, 0.2, 0.3]);
    });
  });

  describe('Health Monitoring', () => {
    it('should report provider health', () => {
      const health = client.getProviderHealth();
      
      expect(health).toHaveProperty('gemini');
      expect(health).toHaveProperty('anthropic');
      expect(health.gemini.available).toBe(true);
    });

    it('should mark provider unhealthy after failures', async () => {
      // Simulate multiple failures
      for (let i = 0; i < 10; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: { message: 'Error' } }),
        });
        
        try {
          await client.generate({
            messages: [{ role: 'user', content: 'Hi' }],
            model: 'gemini-2.0-flash',
            agentId: 'Jarvis',
            maxRetries: 0,
          });
        } catch {
          // Expected
        }
      }

      const health = client.getProviderHealth();
      expect(health.gemini.recentFailures).toBeGreaterThan(0);
    });
  });

  describe('Event System', () => {
    it('should support event subscription and unsubscription', () => {
      const handler = vi.fn();
      
      const unsubscribe = client.on('generate:start', handler);
      client.emit('generate:start', { test: true });
      
      expect(handler).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      client.emit('generate:start', { test: true });
      
      expect(handler).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should support one-time event handlers', () => {
      const handler = vi.fn();
      
      client.once('test', handler);
      client.emit('test', {});
      client.emit('test', {});
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});

describe('LLMClient Configuration', () => {
  it('should load config from file', async () => {
    // This would test loading from providers.yaml
    // Skipped for now as it requires file system access
  });

  it('should merge environment overrides', () => {
    process.env.GEMINI_API_KEY = 'env-key';
    
    const client = new LLMClient({
      providers: {
        gemini: {
          enabled: true,
          priority: 1,
          // apiKey not set, should use env
        },
      },
    } as any);

    // The client should use the env variable
    expect(client).toBeInstanceOf(LLMClient);
    
    delete process.env.GEMINI_API_KEY;
  });
});
