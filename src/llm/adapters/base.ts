/**
 * EduGenius LLM Abstraction Layer - Base Adapter
 * Abstract base class with shared functionality for all providers
 */

import type {
  LLMAdapter,
  ProviderId,
  GenerateRequest,
  GenerateResponse,
  StreamChunk,
  EmbedRequest,
  EmbedResponse,
  ProviderHealth,
  ModelConfig,
} from '../types';

export abstract class BaseLLMAdapter implements LLMAdapter {
  abstract readonly providerId: ProviderId;
  
  protected apiKey: string;
  protected baseUrl: string;
  protected models: Record<string, ModelConfig>;
  protected defaultModel: string;
  
  // Health tracking
  protected lastHealthCheck: Date = new Date(0);
  protected healthStatus: ProviderHealth;
  protected consecutiveFailures = 0;
  protected errorCount = 0;
  protected requestCount = 0;
  
  constructor(config: {
    apiKey: string;
    baseUrl: string;
    models: Record<string, ModelConfig>;
    defaultModel: string;
  }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this.models = config.models;
    this.defaultModel = config.defaultModel;
    
    this.healthStatus = {
      provider: (this as any).providerId ?? 'unknown',
      healthy: true,
      latencyMs: 0,
      lastCheck: new Date(),
      errorRate: 0,
      consecutiveFailures: 0,
    };
  }
  
  // Abstract methods - each provider implements
  abstract generate(request: GenerateRequest): Promise<GenerateResponse>;
  abstract generateStream(request: GenerateRequest): AsyncGenerator<StreamChunk>;
  abstract embed(request: EmbedRequest): Promise<EmbedResponse>;
  
  // Shared health check logic
  async checkHealth(): Promise<ProviderHealth> {
    const start = Date.now();
    
    try {
      // Simple health check - try to generate with minimal tokens
      await this.generate({
        messages: [{ role: 'user', content: 'Hi' }],
        maxTokens: 5,
      });
      
      this.consecutiveFailures = 0;
      this.healthStatus = {
        provider: this.providerId,
        healthy: true,
        latencyMs: Date.now() - start,
        lastCheck: new Date(),
        errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
        consecutiveFailures: 0,
      };
    } catch (error) {
      this.consecutiveFailures++;
      this.healthStatus = {
        provider: this.providerId,
        healthy: this.consecutiveFailures < 3,
        latencyMs: Date.now() - start,
        lastCheck: new Date(),
        errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
        consecutiveFailures: this.consecutiveFailures,
      };
    }
    
    return this.healthStatus;
  }
  
  // Token counting (approximate - providers may override)
  countTokens(text: string): number {
    // Rough approximation: ~4 chars per token for English
    return Math.ceil(text.length / 4);
  }
  
  // Calculate cost from token usage
  protected calculateCost(inputTokens: number, outputTokens: number, model: string): number {
    const modelConfig = this.models[model] || this.models[this.defaultModel];
    if (!modelConfig) return 0;
    
    const inputCost = (inputTokens / 1000) * modelConfig.costPer1kInput;
    const outputCost = (outputTokens / 1000) * modelConfig.costPer1kOutput;
    
    return inputCost + outputCost;
  }
  
  // Retry with exponential backoff
  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 1000
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.requestCount++;
        return await fn();
      } catch (error) {
        this.errorCount++;
        lastError = error as Error;
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }
        
        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }
  
  // Check if error should not be retried
  protected isNonRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('invalid api key') ||
        message.includes('unauthorized') ||
        message.includes('forbidden') ||
        message.includes('content_filter')
      );
    }
    return false;
  }
  
  // Sleep utility
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Format messages for API call (providers may override)
  protected formatMessages(messages: GenerateRequest['messages']): unknown {
    return messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
  }
  
  // Get model ID for API call
  protected getModelId(taskType?: string): string {
    // Can be overridden to select model based on task type
    return this.models[this.defaultModel]?.id || this.defaultModel;
  }
}
