// @ts-nocheck
/**
 * OpenAI Adapter for EduGenius LLM Layer
 * Supports GPT-4, GPT-4-turbo, GPT-3.5-turbo, and embedding models
 */

import { BaseAdapter } from './base';
import {
  LLMRequest,
  LLMResponse,
  EmbedRequest,
  EmbedResponse,
  ProviderConfig,
  ModelCapabilities,
  LLMError,
  StreamChunk,
} from '../types';

export class OpenAIAdapter extends BaseAdapter {
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    return this.withRetry(async () => {
      const startTime = Date.now();

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(this.buildRequestBody(request)),
      });

      if (!response.ok) {
        throw await this.handleError(response);
      }

      const data = await response.json();
      const latencyMs = Date.now() - startTime;

      return this.parseResponse(data, request.model, latencyMs);
    });
  }

  async *stream(request: LLMRequest): AsyncGenerator<StreamChunk> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        ...this.buildRequestBody(request),
        stream: true,
      }),
    });

    if (!response.ok) {
      throw await this.handleError(response);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let totalTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              yield { type: 'done', totalTokens };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;

              if (delta?.content) {
                totalTokens += this.estimateTokens(delta.content);
                yield {
                  type: 'content',
                  content: delta.content,
                  tokenCount: this.estimateTokens(delta.content),
                };
              }

              if (delta?.function_call) {
                yield {
                  type: 'function_call',
                  functionName: delta.function_call.name,
                  arguments: delta.function_call.arguments,
                };
              }

              if (delta?.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  yield {
                    type: 'tool_call',
                    toolCallId: toolCall.id,
                    functionName: toolCall.function?.name,
                    arguments: toolCall.function?.arguments,
                  };
                }
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async embed(request: EmbedRequest): Promise<EmbedResponse> {
    return this.withRetry(async () => {
      const startTime = Date.now();

      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: request.model || 'text-embedding-3-small',
          input: request.texts,
          dimensions: request.dimensions,
        }),
      });

      if (!response.ok) {
        throw await this.handleError(response);
      }

      const data = await response.json();
      const latencyMs = Date.now() - startTime;

      return {
        embeddings: data.data.map((item: { embedding: number[] }) => item.embedding),
        model: data.model,
        usage: {
          totalTokens: data.usage?.total_tokens || 0,
        },
        latencyMs,
      };
    });
  }

  getCapabilities(model: string): ModelCapabilities {
    const capabilities: Record<string, ModelCapabilities> = {
      'gpt-4o': {
        maxTokens: 128000,
        supportsStreaming: true,
        supportsFunctionCalling: true,
        supportsVision: true,
        supportsJson: true,
        costPer1kInput: 0.005,
        costPer1kOutput: 0.015,
      },
      'gpt-4o-mini': {
        maxTokens: 128000,
        supportsStreaming: true,
        supportsFunctionCalling: true,
        supportsVision: true,
        supportsJson: true,
        costPer1kInput: 0.00015,
        costPer1kOutput: 0.0006,
      },
      'gpt-4-turbo': {
        maxTokens: 128000,
        supportsStreaming: true,
        supportsFunctionCalling: true,
        supportsVision: true,
        supportsJson: true,
        costPer1kInput: 0.01,
        costPer1kOutput: 0.03,
      },
      'gpt-4': {
        maxTokens: 8192,
        supportsStreaming: true,
        supportsFunctionCalling: true,
        supportsVision: false,
        supportsJson: true,
        costPer1kInput: 0.03,
        costPer1kOutput: 0.06,
      },
      'gpt-3.5-turbo': {
        maxTokens: 16385,
        supportsStreaming: true,
        supportsFunctionCalling: true,
        supportsVision: false,
        supportsJson: true,
        costPer1kInput: 0.0005,
        costPer1kOutput: 0.0015,
      },
      'text-embedding-3-large': {
        maxTokens: 8191,
        supportsStreaming: false,
        supportsFunctionCalling: false,
        supportsVision: false,
        supportsJson: false,
        costPer1kInput: 0.00013,
        costPer1kOutput: 0,
      },
      'text-embedding-3-small': {
        maxTokens: 8191,
        supportsStreaming: false,
        supportsFunctionCalling: false,
        supportsVision: false,
        supportsJson: false,
        costPer1kInput: 0.00002,
        costPer1kOutput: 0,
      },
    };

    // Match model prefix for versioned models (e.g., gpt-4o-2024-08-06)
    const baseModel = Object.keys(capabilities).find(
      (key) => model === key || model.startsWith(`${key}-`)
    );

    return (
      capabilities[baseModel || model] || {
        maxTokens: 4096,
        supportsStreaming: true,
        supportsFunctionCalling: true,
        supportsVision: false,
        supportsJson: true,
        costPer1kInput: 0.01,
        costPer1kOutput: 0.03,
      }
    );
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
      ...(this.config.organizationId && {
        'OpenAI-Organization': this.config.organizationId,
      }),
    };
  }

  private buildRequestBody(request: LLMRequest): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: request.model,
      messages: this.formatMessages(request),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
    };

    if (request.topP !== undefined) body.top_p = request.topP;
    if (request.stopSequences) body.stop = request.stopSequences;
    if (request.presencePenalty !== undefined) body.presence_penalty = request.presencePenalty;
    if (request.frequencyPenalty !== undefined) body.frequency_penalty = request.frequencyPenalty;
    if (request.seed !== undefined) body.seed = request.seed;
    if (request.jsonMode) body.response_format = { type: 'json_object' };

    // Function calling
    if (request.functions && request.functions.length > 0) {
      body.tools = request.functions.map((fn) => ({
        type: 'function',
        function: {
          name: fn.name,
          description: fn.description,
          parameters: fn.parameters,
        },
      }));

      if (request.functionCall) {
        if (request.functionCall === 'auto' || request.functionCall === 'none') {
          body.tool_choice = request.functionCall;
        } else {
          body.tool_choice = {
            type: 'function',
            function: { name: request.functionCall },
          };
        }
      }
    }

    return body;
  }

  private formatMessages(
    request: LLMRequest
  ): Array<{ role: string; content: string | object[]; name?: string }> {
    const messages: Array<{ role: string; content: string | object[]; name?: string }> = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    for (const msg of request.messages) {
      if (msg.role === 'user' && msg.images && msg.images.length > 0) {
        // Vision message
        const content: object[] = [{ type: 'text', text: msg.content }];
        for (const img of msg.images) {
          content.push({
            type: 'image_url',
            image_url: {
              url: img.url || `data:${img.mimeType};base64,${img.base64}`,
              detail: img.detail || 'auto',
            },
          });
        }
        messages.push({ role: msg.role, content });
      } else {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    return messages;
  }

  private parseResponse(data: Record<string, unknown>, model: string, latencyMs: number): LLMResponse {
    const choice = (data.choices as Array<Record<string, unknown>>)?.[0];
    const message = choice?.message as Record<string, unknown>;
    const usage = data.usage as Record<string, number>;

    const response: LLMResponse = {
      content: (message?.content as string) || '',
      model: (data.model as string) || model,
      usage: {
        inputTokens: usage?.prompt_tokens || 0,
        outputTokens: usage?.completion_tokens || 0,
        totalTokens: usage?.total_tokens || 0,
      },
      finishReason: this.mapFinishReason(choice?.finish_reason as string),
      latencyMs,
    };

    // Parse tool calls
    const toolCalls = message?.tool_calls as Array<Record<string, unknown>>;
    if (toolCalls && toolCalls.length > 0) {
      response.functionCalls = toolCalls.map((tc) => {
        const fn = tc.function as Record<string, string>;
        return {
          id: tc.id as string,
          name: fn?.name || '',
          arguments: fn?.arguments ? JSON.parse(fn.arguments) : {},
        };
      });
    }

    return response;
  }

  private mapFinishReason(reason?: string): LLMResponse['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool_calls':
      case 'function_call':
        return 'function_call';
      case 'content_filter':
        return 'safety';
      default:
        return 'stop';
    }
  }

  private async handleError(response: Response): Promise<LLMError> {
    let errorData: Record<string, unknown> = {};
    try {
      errorData = await response.json();
    } catch {
      // Ignore JSON parse errors
    }

    const error = errorData.error as Record<string, unknown>;
    const message = (error?.message as string) || `HTTP ${response.status}`;
    const code = error?.code as string;

    let errorType: LLMError['type'] = 'api_error';
    let retryable = false;
    let retryAfterMs: number | undefined;

    switch (response.status) {
      case 401:
        errorType = 'authentication';
        break;
      case 429:
        errorType = 'rate_limit';
        retryable = true;
        const retryAfter = response.headers.get('retry-after');
        retryAfterMs = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
        break;
      case 500:
      case 502:
      case 503:
        errorType = 'api_error';
        retryable = true;
        retryAfterMs = 5000;
        break;
    }

    if (code === 'context_length_exceeded') {
      errorType = 'context_length';
    } else if (code === 'content_policy_violation') {
      errorType = 'safety';
    } else if (code === 'insufficient_quota') {
      errorType = 'quota_exceeded';
    }

    return {
      type: errorType,
      message,
      provider: 'openai',
      statusCode: response.status,
      retryable,
      retryAfterMs,
    };
  }

  private estimateTokens(text: string): number {
    // Rough approximation: ~4 chars per token for English
    return Math.ceil(text.length / 4);
  }
}
