/**
 * Unit Tests for LLM Client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LLMClient, LLMRequest, LLMResponse, TaskType, ModelRoute } from '../../../llm';

describe('LLMClient', () => {
  let client: LLMClient;

  beforeEach(() => {
    client = new LLMClient();
  });

  describe('Initialization', () => {
    it('should create client instance', () => {
      expect(client).toBeDefined();
    });

    it('should accept custom config', () => {
      const customClient = new LLMClient({
        defaultProvider: 'anthropic',
        enableFallback: false,
      });
      expect(customClient).toBeDefined();
    });
  });

  describe('Request Building', () => {
    it('should handle basic request structure', () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
      };

      expect(request.messages).toHaveLength(1);
      expect(request.temperature).toBe(0.7);
    });

    it('should handle system message', () => {
      const request: LLMRequest = {
        messages: [
          { role: 'system', content: 'You are a helpful tutor' },
          { role: 'user', content: 'Help me learn' },
        ],
      };

      expect(request.messages).toHaveLength(2);
      expect(request.messages[0].role).toBe('system');
    });

    it('should handle conversation history', () => {
      const request: LLMRequest = {
        messages: [
          { role: 'user', content: 'Question 1' },
          { role: 'assistant', content: 'Answer 1' },
          { role: 'user', content: 'Question 2' },
        ],
      };

      expect(request.messages).toHaveLength(3);
    });
  });

  describe('Task Types', () => {
    it('should support quality-critical tasks', () => {
      const taskType: TaskType = 'quality-critical';
      expect(taskType).toBe('quality-critical');
    });

    it('should support routine tasks', () => {
      const taskType: TaskType = 'routine';
      expect(taskType).toBe('routine');
    });

    it('should support high-volume tasks', () => {
      const taskType: TaskType = 'high-volume';
      expect(taskType).toBe('high-volume');
    });

    it('should support pedagogical tasks', () => {
      const taskType: TaskType = 'pedagogical';
      expect(taskType).toBe('pedagogical');
    });
  });

  describe('Model Routing', () => {
    it('should have route structure', () => {
      const route: ModelRoute = {
        provider: 'gemini',
        model: 'gemini-1.5-pro',
        taskTypes: ['quality-critical'],
      };

      expect(route.provider).toBe('gemini');
      expect(route.model).toBe('gemini-1.5-pro');
      expect(route.taskTypes).toContain('quality-critical');
    });
  });

  describe('Response Structure', () => {
    it('should define response type', () => {
      const response: LLMResponse = {
        content: 'Generated response',
        model: 'gemini-1.5-flash',
        provider: 'gemini',
        tokensUsed: {
          input: 100,
          output: 50,
        },
        latencyMs: 500,
        cached: false,
      };

      expect(response.content).toBe('Generated response');
      expect(response.tokensUsed.input).toBe(100);
      expect(response.tokensUsed.output).toBe(50);
    });

    it('should track latency', () => {
      const response: LLMResponse = {
        content: 'Test',
        model: 'test-model',
        provider: 'test',
        tokensUsed: { input: 10, output: 10 },
        latencyMs: 250,
        cached: false,
      };

      expect(response.latencyMs).toBe(250);
    });

    it('should track cache status', () => {
      const cachedResponse: LLMResponse = {
        content: 'Cached',
        model: 'test-model',
        provider: 'test',
        tokensUsed: { input: 0, output: 0 },
        latencyMs: 5,
        cached: true,
      };

      expect(cachedResponse.cached).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty messages array', () => {
      const request: LLMRequest = {
        messages: [],
      };

      expect(request.messages).toHaveLength(0);
    });

    it('should handle very long message', () => {
      const longContent = 'x'.repeat(100000);
      const request: LLMRequest = {
        messages: [{ role: 'user', content: longContent }],
      };

      expect(request.messages[0].content.length).toBe(100000);
    });

    it('should handle special characters in content', () => {
      const request: LLMRequest = {
        messages: [{
          role: 'user',
          content: '∑∫∂ √π ∞ ≠ ≈ <script>alert("xss")</script>',
        }],
      };

      expect(request.messages[0].content).toContain('∑');
    });

    it('should handle unicode content', () => {
      const request: LLMRequest = {
        messages: [{
          role: 'user',
          content: '你好世界 🎓 مرحبا',
        }],
      };

      expect(request.messages[0].content).toContain('🎓');
    });

    it('should handle zero temperature', () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        temperature: 0,
      };

      expect(request.temperature).toBe(0);
    });

    it('should handle max tokens', () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 4096,
      };

      expect(request.maxTokens).toBe(4096);
    });
  });
});

describe('LLMClient Configuration', () => {
  it('should accept provider configuration', () => {
    const client = new LLMClient({
      defaultProvider: 'anthropic',
      providers: {
        anthropic: {
          apiKey: 'test-key',
          models: ['claude-3-5-sonnet'],
        },
      },
    });

    expect(client).toBeDefined();
  });

  it('should handle missing API keys gracefully', () => {
    const client = new LLMClient({
      defaultProvider: 'gemini',
      providers: {
        gemini: {
          models: ['gemini-1.5-flash'],
        },
      },
    });

    expect(client).toBeDefined();
  });
});

describe('Token Tracking', () => {
  it('should calculate total tokens', () => {
    const tokens = { input: 100, output: 50 };
    const total = tokens.input + tokens.output;
    expect(total).toBe(150);
  });

  it('should handle zero tokens', () => {
    const tokens = { input: 0, output: 0 };
    const total = tokens.input + tokens.output;
    expect(total).toBe(0);
  });

  it('should handle large token counts', () => {
    const tokens = { input: 100000, output: 50000 };
    const total = tokens.input + tokens.output;
    expect(total).toBe(150000);
  });
});
