// @ts-nocheck
/**
 * Ollama Adapter for EduGenius LLM Layer
 * Supports local LLM inference via Ollama server
 * Models: Llama, Mistral, CodeLlama, Phi, etc.
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

export class OllamaAdapter extends BaseAdapter {
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    return this.withRetry(async () => {
      const startTime = Date.now();

      // Use chat endpoint for conversation format
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.buildChatRequest(request)),
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
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...this.buildChatRequest(request),
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
          if (!line.trim()) continue;

          try {
            const parsed = JSON.parse(line);

            if (parsed.message?.content) {
              const tokenCount = this.estimateTokens(parsed.message.content);
              totalTokens += tokenCount;
              yield {
                type: 'content',
                content: parsed.message.content,
                tokenCount,
              };
            }

            if (parsed.done) {
              yield {
                type: 'done',
                totalTokens: parsed.eval_count || totalTokens,
                metadata: {
                  promptTokens: parsed.prompt_eval_count,
                  evalDuration: parsed.eval_duration,
                  loadDuration: parsed.load_duration,
                },
              };
              return;
            }
          } catch {
            // Skip malformed JSON
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
      const embeddings: number[][] = [];

      // Ollama processes one text at a time
      for (const text of request.texts) {
        const response = await fetch(`${this.baseUrl}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: request.model || 'nomic-embed-text',
            prompt: text,
          }),
        });

        if (!response.ok) {
          throw await this.handleError(response);
        }

        const data = await response.json();
        embeddings.push(data.embedding);
      }

      const latencyMs = Date.now() - startTime;

      return {
        embeddings,
        model: request.model || 'nomic-embed-text',
        usage: {
          totalTokens: request.texts.reduce((sum, t) => sum + this.estimateTokens(t), 0),
        },
        latencyMs,
      };
    });
  }

  getCapabilities(model: string): ModelCapabilities {
    // Ollama models are local, so cost is effectively 0
    // Context windows vary by model
    const capabilities: Record<string, Partial<ModelCapabilities>> = {
      'llama3.2': {
        maxTokens: 128000,
        supportsVision: true, // 11B and 90B vision variants
      },
      'llama3.1': {
        maxTokens: 128000,
        supportsVision: false,
      },
      'llama3': {
        maxTokens: 8192,
        supportsVision: false,
      },
      'llama2': {
        maxTokens: 4096,
        supportsVision: false,
      },
      'mistral': {
        maxTokens: 32768,
        supportsVision: false,
      },
      'mixtral': {
        maxTokens: 32768,
        supportsVision: false,
      },
      'codellama': {
        maxTokens: 16384,
        supportsVision: false,
      },
      'phi3': {
        maxTokens: 128000,
        supportsVision: false,
      },
      'phi': {
        maxTokens: 2048,
        supportsVision: false,
      },
      'gemma2': {
        maxTokens: 8192,
        supportsVision: false,
      },
      'gemma': {
        maxTokens: 8192,
        supportsVision: false,
      },
      'qwen2.5': {
        maxTokens: 32768,
        supportsVision: false,
      },
      'qwen2': {
        maxTokens: 32768,
        supportsVision: false,
      },
      'deepseek-coder': {
        maxTokens: 16384,
        supportsVision: false,
      },
      'nomic-embed-text': {
        maxTokens: 8192,
        supportsVision: false,
      },
      'mxbai-embed-large': {
        maxTokens: 512,
        supportsVision: false,
      },
    };

    // Find matching model (handles variants like llama3:70b, mistral:latest)
    const baseModel = model.split(':')[0].toLowerCase();
    const matched = Object.entries(capabilities).find(
      ([key]) => baseModel === key || baseModel.startsWith(key)
    );

    const defaults: ModelCapabilities = {
      maxTokens: 4096,
      supportsStreaming: true,
      supportsFunctionCalling: false, // Ollama has limited tool support
      supportsVision: false,
      supportsJson: true,
      costPer1kInput: 0, // Local inference
      costPer1kOutput: 0,
    };

    return {
      ...defaults,
      ...(matched?.[1] || {}),
    };
  }

  /**
   * List available models on the Ollama server
   */
  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) {
      throw await this.handleError(response);
    }

    const data = await response.json();
    return data.models?.map((m: { name: string }) => m.name) || [];
  }

  /**
   * Pull a model from the Ollama registry
   */
  async pullModel(model: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: false }),
    });

    if (!response.ok) {
      throw await this.handleError(response);
    }
  }

  /**
   * Check if Ollama server is running
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  private buildChatRequest(request: LLMRequest): Record<string, unknown> {
    const messages = this.formatMessages(request);

    const body: Record<string, unknown> = {
      model: request.model,
      messages,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens || -1, // -1 for no limit
      },
    };

    // Additional options
    const options = body.options as Record<string, unknown>;
    if (request.topP !== undefined) options.top_p = request.topP;
    if (request.topK !== undefined) options.top_k = request.topK;
    if (request.seed !== undefined) options.seed = request.seed;
    if (request.stopSequences) options.stop = request.stopSequences;
    if (request.repeatPenalty !== undefined) options.repeat_penalty = request.repeatPenalty;

    // JSON mode
    if (request.jsonMode) {
      body.format = 'json';
    }

    return body;
  }

  private formatMessages(
    request: LLMRequest
  ): Array<{ role: string; content: string; images?: string[] }> {
    const messages: Array<{ role: string; content: string; images?: string[] }> = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    for (const msg of request.messages) {
      const formatted: { role: string; content: string; images?: string[] } = {
        role: msg.role,
        content: msg.content,
      };

      // Handle images for vision models
      if (msg.images && msg.images.length > 0) {
        formatted.images = msg.images.map((img) => {
          if (img.base64) return img.base64;
          if (img.url) {
            // For URLs, we'd need to fetch and convert to base64
            // For now, just pass the URL (Ollama may not support this)
            return img.url;
          }
          return '';
        });
      }

      messages.push(formatted);
    }

    return messages;
  }

  private parseResponse(
    data: Record<string, unknown>,
    model: string,
    latencyMs: number
  ): LLMResponse {
    const message = data.message as Record<string, string>;

    return {
      content: message?.content || '',
      model: (data.model as string) || model,
      usage: {
        inputTokens: (data.prompt_eval_count as number) || 0,
        outputTokens: (data.eval_count as number) || 0,
        totalTokens:
          ((data.prompt_eval_count as number) || 0) + ((data.eval_count as number) || 0),
      },
      finishReason: (data.done_reason as string) === 'length' ? 'length' : 'stop',
      latencyMs,
      metadata: {
        loadDuration: data.load_duration,
        promptEvalDuration: data.prompt_eval_duration,
        evalDuration: data.eval_duration,
        totalDuration: data.total_duration,
      },
    };
  }

  private async handleError(response: Response): Promise<LLMError> {
    let errorData: Record<string, unknown> = {};
    try {
      errorData = await response.json();
    } catch {
      // Ignore JSON parse errors
    }

    const message = (errorData.error as string) || `HTTP ${response.status}`;

    let errorType: LLMError['type'] = 'api_error';
    let retryable = false;
    let retryAfterMs: number | undefined;

    switch (response.status) {
      case 404:
        // Model not found
        errorType = 'invalid_request';
        break;
      case 500:
      case 502:
      case 503:
        errorType = 'api_error';
        retryable = true;
        retryAfterMs = 5000;
        break;
    }

    // Check for specific error messages
    if (message.includes('model') && message.includes('not found')) {
      errorType = 'invalid_request';
    } else if (message.includes('context length')) {
      errorType = 'context_length';
    }

    return {
      type: errorType,
      message,
      provider: 'ollama',
      statusCode: response.status,
      retryable,
      retryAfterMs,
    };
  }

  private estimateTokens(text: string): number {
    // Rough approximation: ~4 chars per token
    return Math.ceil(text.length / 4);
  }
}
