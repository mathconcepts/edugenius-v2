/**
 * Unit Tests for EduGenius LLM Adapters
 * Tests adapter initialization, request formatting, and response parsing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiAdapter } from '../adapters/gemini';
import { AnthropicAdapter } from '../adapters/anthropic';
import { OpenAIAdapter } from '../adapters/openai';
import { OllamaAdapter } from '../adapters/ollama';
import { createAdapter, getAdapter, clearAdapters } from '../adapters';
import type { LLMRequest, ProviderConfig } from '../types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test configurations
const geminiConfig: ProviderConfig = {
  apiKey: 'test-gemini-key',
  baseUrl: 'https://generativelanguage.googleapis.com',
  models: {
    'gemini-2.0-flash': {
      id: 'gemini-2.0-flash',
      contextWindow: 1000000,
      maxOutput: 8192,
      costPer1kInput: 0.000075,
      costPer1kOutput: 0.0003,
      tier: 'flash',
    },
  },
  defaultModel: 'gemini-2.0-flash',
};

const anthropicConfig: ProviderConfig = {
  apiKey: 'test-anthropic-key',
  baseUrl: 'https://api.anthropic.com',
  models: {
    'claude-3-5-sonnet': {
      id: 'claude-3-5-sonnet-20241022',
      contextWindow: 200000,
      maxOutput: 8192,
      costPer1kInput: 0.003,
      costPer1kOutput: 0.015,
      tier: 'standard',
    },
  },
  defaultModel: 'claude-3-5-sonnet',
};

const openaiConfig: ProviderConfig = {
  apiKey: 'test-openai-key',
  baseUrl: 'https://api.openai.com',
  models: {
    'gpt-4o': {
      id: 'gpt-4o',
      contextWindow: 128000,
      maxOutput: 4096,
      costPer1kInput: 0.005,
      costPer1kOutput: 0.015,
      tier: 'standard',
    },
  },
  defaultModel: 'gpt-4o',
};

const ollamaConfig: ProviderConfig = {
  apiKey: '',
  baseUrl: 'http://localhost:11434',
  models: {
    'llama3': {
      id: 'llama3:8b',
      contextWindow: 8192,
      maxOutput: 4096,
      costPer1kInput: 0,
      costPer1kOutput: 0,
      tier: 'local',
    },
  },
  defaultModel: 'llama3',
};

const testRequest: LLMRequest = {
  model: 'test-model',
  messages: [
    { role: 'user', content: 'Hello, how are you?' },
  ],
  systemPrompt: 'You are a helpful assistant.',
  temperature: 0.7,
  maxTokens: 1000,
};

describe('Adapter Factory', () => {
  beforeEach(() => {
    clearAdapters();
    mockFetch.mockReset();
  });

  it('should create Gemini adapter', () => {
    const adapter = createAdapter('gemini', geminiConfig as any, 'test-key');
    expect(adapter).toBeInstanceOf(GeminiAdapter);
  });

  it('should create Anthropic adapter', () => {
    const adapter = createAdapter('anthropic', anthropicConfig as any, 'test-key');
    expect(adapter).toBeInstanceOf(AnthropicAdapter);
  });

  it('should create OpenAI adapter', () => {
    const adapter = createAdapter('openai', openaiConfig as any, 'test-key');
    expect(adapter).toBeInstanceOf(OpenAIAdapter);
  });

  it('should create Ollama adapter', () => {
    const adapter = createAdapter('ollama', ollamaConfig as any);
    expect(adapter).toBeInstanceOf(OllamaAdapter);
  });

  it('should cache adapters', () => {
    const adapter1 = getAdapter('gemini', geminiConfig as any, 'test-key');
    const adapter2 = getAdapter('gemini', geminiConfig as any, 'test-key');
    expect(adapter1).toBe(adapter2);
  });

  it('should clear cached adapters', () => {
    const adapter1 = getAdapter('gemini', geminiConfig as any, 'test-key');
    clearAdapters();
    const adapter2 = getAdapter('gemini', geminiConfig as any, 'test-key');
    expect(adapter1).not.toBe(adapter2);
  });
});

describe('GeminiAdapter', () => {
  let adapter: GeminiAdapter;

  beforeEach(() => {
    adapter = new GeminiAdapter(geminiConfig);
    mockFetch.mockReset();
  });

  it('should get model capabilities', () => {
    const caps = adapter.getCapabilities('gemini-2.0-flash');
    expect(caps.maxTokens).toBe(1000000);
    expect(caps.supportsStreaming).toBe(true);
    expect(caps.supportsFunctionCalling).toBe(true);
  });

  it('should make generate request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: 'Hello! I am doing well.' }] },
          finishReason: 'STOP',
        }],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 8,
          totalTokenCount: 18,
        },
      }),
    });

    const response = await adapter.generate({
      ...testRequest,
      model: 'gemini-2.0-flash',
    });

    expect(response.content).toBe('Hello! I am doing well.');
    expect(response.usage.totalTokens).toBe(18);
    expect(response.finishReason).toBe('stop');
  });

  it('should handle API errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({
        error: { message: 'Rate limit exceeded', code: 429 },
      }),
    });

    await expect(adapter.generate({
      ...testRequest,
      model: 'gemini-2.0-flash',
    })).rejects.toMatchObject({
      type: 'rate_limit',
      retryable: true,
    });
  });
});

describe('AnthropicAdapter', () => {
  let adapter: AnthropicAdapter;

  beforeEach(() => {
    adapter = new AnthropicAdapter(anthropicConfig);
    mockFetch.mockReset();
  });

  it('should get model capabilities', () => {
    const caps = adapter.getCapabilities('claude-3-5-sonnet');
    expect(caps.maxTokens).toBe(200000);
    expect(caps.supportsStreaming).toBe(true);
    expect(caps.supportsVision).toBe(true);
  });

  it('should make generate request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'Hello! I am Claude.' }],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 12,
          output_tokens: 6,
        },
      }),
    });

    const response = await adapter.generate({
      ...testRequest,
      model: 'claude-3-5-sonnet-20241022',
    });

    expect(response.content).toBe('Hello! I am Claude.');
    expect(response.usage.inputTokens).toBe(12);
    expect(response.usage.outputTokens).toBe(6);
    expect(response.finishReason).toBe('stop');
  });

  it('should handle tool use response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          { type: 'text', text: 'Let me search for that.' },
          {
            type: 'tool_use',
            id: 'tool_123',
            name: 'search',
            input: { query: 'weather' },
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'tool_use',
        usage: { input_tokens: 20, output_tokens: 30 },
      }),
    });

    const response = await adapter.generate({
      ...testRequest,
      model: 'claude-3-5-sonnet-20241022',
    });

    expect(response.functionCalls).toHaveLength(1);
    expect(response.functionCalls![0].name).toBe('search');
    expect(response.finishReason).toBe('function_call');
  });
});

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;

  beforeEach(() => {
    adapter = new OpenAIAdapter(openaiConfig);
    mockFetch.mockReset();
  });

  it('should get model capabilities', () => {
    const caps = adapter.getCapabilities('gpt-4o');
    expect(caps.maxTokens).toBe(128000);
    expect(caps.supportsStreaming).toBe(true);
    expect(caps.supportsVision).toBe(true);
    expect(caps.supportsFunctionCalling).toBe(true);
  });

  it('should make generate request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: { role: 'assistant', content: 'Hello! I am GPT.' },
          finish_reason: 'stop',
        }],
        model: 'gpt-4o',
        usage: {
          prompt_tokens: 15,
          completion_tokens: 7,
          total_tokens: 22,
        },
      }),
    });

    const response = await adapter.generate({
      ...testRequest,
      model: 'gpt-4o',
    });

    expect(response.content).toBe('Hello! I am GPT.');
    expect(response.usage.totalTokens).toBe(22);
    expect(response.finishReason).toBe('stop');
  });

  it('should handle tool calls', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location": "London"}',
              },
            }],
          },
          finish_reason: 'tool_calls',
        }],
        model: 'gpt-4o',
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
      }),
    });

    const response = await adapter.generate({
      ...testRequest,
      model: 'gpt-4o',
      functions: [{
        name: 'get_weather',
        description: 'Get weather for a location',
        parameters: { type: 'object', properties: { location: { type: 'string' } } },
      }],
    });

    expect(response.functionCalls).toHaveLength(1);
    expect(response.functionCalls![0].name).toBe('get_weather');
    expect(response.functionCalls![0].arguments).toEqual({ location: 'London' });
    expect(response.finishReason).toBe('function_call');
  });
});

describe('OllamaAdapter', () => {
  let adapter: OllamaAdapter;

  beforeEach(() => {
    adapter = new OllamaAdapter(ollamaConfig);
    mockFetch.mockReset();
  });

  it('should get model capabilities', () => {
    const caps = adapter.getCapabilities('llama3');
    expect(caps.maxTokens).toBe(8192);
    expect(caps.supportsStreaming).toBe(true);
    expect(caps.costPer1kInput).toBe(0); // Local inference is free
  });

  it('should make generate request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        model: 'llama3:8b',
        message: { role: 'assistant', content: 'Hello! I am Llama.' },
        done: true,
        prompt_eval_count: 12,
        eval_count: 8,
        total_duration: 500000000,
      }),
    });

    const response = await adapter.generate({
      ...testRequest,
      model: 'llama3:8b',
    });

    expect(response.content).toBe('Hello! I am Llama.');
    expect(response.usage.inputTokens).toBe(12);
    expect(response.usage.outputTokens).toBe(8);
  });

  it('should list models', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [
          { name: 'llama3:8b' },
          { name: 'mistral:7b' },
          { name: 'codellama:13b' },
        ],
      }),
    });

    const models = await adapter.listModels();
    expect(models).toEqual(['llama3:8b', 'mistral:7b', 'codellama:13b']);
  });

  it('should check health', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const healthy = await adapter.healthCheck();
    expect(healthy).toBe(true);

    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
    const unhealthy = await adapter.healthCheck();
    expect(unhealthy).toBe(false);
  });
});

describe('Embedding Support', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should embed with OpenAI', async () => {
    const adapter = new OpenAIAdapter(openaiConfig);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { embedding: [0.1, 0.2, 0.3] },
          { embedding: [0.4, 0.5, 0.6] },
        ],
        model: 'text-embedding-3-small',
        usage: { total_tokens: 10 },
      }),
    });

    const response = await adapter.embed({
      texts: ['Hello', 'World'],
      model: 'text-embedding-3-small',
    });

    expect(response.embeddings).toHaveLength(2);
    expect(response.embeddings[0]).toEqual([0.1, 0.2, 0.3]);
    expect(response.usage.totalTokens).toBe(10);
  });

  it('should embed with Ollama', async () => {
    const adapter = new OllamaAdapter(ollamaConfig);
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: [0.1, 0.2, 0.3] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: [0.4, 0.5, 0.6] }),
      });

    const response = await adapter.embed({
      texts: ['Hello', 'World'],
      model: 'nomic-embed-text',
    });

    expect(response.embeddings).toHaveLength(2);
    expect(response.model).toBe('nomic-embed-text');
  });
});

describe('Error Handling', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should handle rate limits with retry-after', async () => {
    const adapter = new OpenAIAdapter(openaiConfig);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Map([['retry-after', '60']]),
      json: async () => ({
        error: { message: 'Rate limit exceeded', code: 'rate_limit_exceeded' },
      }),
    });

    await expect(adapter.generate({
      ...testRequest,
      model: 'gpt-4o',
    })).rejects.toMatchObject({
      type: 'rate_limit',
      retryable: true,
    });
  });

  it('should handle context length errors', async () => {
    const adapter = new OpenAIAdapter(openaiConfig);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Map(),
      json: async () => ({
        error: {
          message: 'This model maximum context length is 128000 tokens',
          code: 'context_length_exceeded',
        },
      }),
    });

    await expect(adapter.generate({
      ...testRequest,
      model: 'gpt-4o',
    })).rejects.toMatchObject({
      type: 'context_length',
    });
  });

  it('should handle authentication errors', async () => {
    const adapter = new AnthropicAdapter(anthropicConfig);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: { message: 'Invalid API key' },
      }),
    });

    await expect(adapter.generate({
      ...testRequest,
      model: 'claude-3-5-sonnet',
    })).rejects.toMatchObject({
      type: 'authentication',
      retryable: false,
    });
  });
});
