// @ts-nocheck
/**
 * EduGenius LLM Abstraction Layer - Main Entry Point
 * Provider-agnostic LLM client with intelligent routing and fallbacks
 */

import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { EventEmitter } from 'events';

import type {
  LLMConfig,
  ProviderId,
  GenerateRequest,
  GenerateResponse,
  StreamChunk,
  EmbedRequest,
  EmbedResponse,
  LLMEvent,
  BudgetStatus,
  TokenUsage,
} from './types';
import { ModelRouter } from './router/model-router';
import { getAdapter } from './adapters';

export class LLMClient extends EventEmitter {
  private config: LLMConfig;
  private router: ModelRouter;
  private budgetTracker: Map<string, { spent: number; limit: number }> = new Map();
  
  constructor(configPath: string) {
    super();
    
    // Load and parse config
    const configFile = readFileSync(configPath, 'utf-8');
    this.config = this.parseConfig(parseYaml(configFile));
    
    // Initialize router
    this.router = new ModelRouter(this.config);
    
    // Initialize budget tracking
    for (const [agentId, limit] of Object.entries(this.config.budget.perAgentLimits)) {
      this.budgetTracker.set(agentId, { spent: 0, limit });
    }
  }
  
  /**
   * Generate a response (with automatic routing and fallback)
   */
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const correlationId = request.metadata?.correlationId || this.generateId();
    
    // Check budget
    if (request.agentId) {
      const budgetStatus = this.getBudgetStatus(request.agentId);
      if (budgetStatus.budgetExhausted) {
        throw new Error(`Budget exhausted for agent ${request.agentId}`);
      }
    }
    
    // Get routing decision
    const route = this.router.route(request.taskType, request.agentId);
    
    this.emit('llm_event', {
      type: 'generation_started',
      correlationId,
      provider: route.provider,
      agentId: request.agentId,
    } as LLMEvent);
    
    // Try primary route
    let lastError: Error | undefined;
    const triedProviders: ProviderId[] = [];
    
    for (let attempt = 0; attempt < this.config.fallback.maxRetries; attempt++) {
      const currentProvider = attempt === 0 
        ? route.provider 
        : this.getNextFallback(triedProviders);
      
      if (!currentProvider) break;
      triedProviders.push(currentProvider);
      
      try {
        const adapter = this.router.getAdapter(currentProvider);
        if (!adapter) continue;
        
        const response = await adapter.generate(request);
        
        // Track usage
        this.trackUsage(request.agentId, response.usage);
        
        this.emit('llm_event', {
          type: 'generation_completed',
          correlationId,
          usage: response.usage,
          latencyMs: response.latencyMs,
        } as LLMEvent);
        
        return response;
        
      } catch (error) {
        lastError = error as Error;
        
        this.emit('llm_event', {
          type: 'generation_failed',
          correlationId,
          error: lastError.message,
          provider: currentProvider,
        } as LLMEvent);
        
        // Emit fallback event if we're retrying
        if (attempt < this.config.fallback.maxRetries - 1) {
          const nextProvider = this.getNextFallback(triedProviders);
          if (nextProvider) {
            this.emit('llm_event', {
              type: 'fallback_triggered',
              from: currentProvider,
              to: nextProvider,
              reason: lastError.message,
            } as LLMEvent);
          }
        }
        
        // Wait before retry
        await this.sleep(this.config.fallback.retryDelayMs * Math.pow(2, attempt));
      }
    }
    
    throw lastError || new Error('All providers failed');
  }
  
  /**
   * Generate a streaming response
   */
  async *generateStream(request: GenerateRequest): AsyncGenerator<StreamChunk> {
    const route = this.router.route(request.taskType, request.agentId);
    const adapter = this.router.getAdapter(route.provider);
    
    if (!adapter) {
      throw new Error(`No adapter available for provider: ${route.provider}`);
    }
    
    let totalUsage: TokenUsage | undefined;
    
    for await (const chunk of adapter.generateStream(request)) {
      if (chunk.usage) {
        totalUsage = chunk.usage;
      }
      yield chunk;
    }
    
    // Track usage after streaming completes
    if (totalUsage && request.agentId) {
      this.trackUsage(request.agentId, totalUsage);
    }
  }
  
  /**
   * Generate embeddings
   */
  async embed(request: EmbedRequest): Promise<EmbedResponse> {
    // Try providers with embedding support
    const embeddingProviders: ProviderId[] = ['gemini', 'openai'];
    
    for (const providerId of embeddingProviders) {
      const adapter = this.router.getAdapter(providerId);
      if (!adapter) continue;
      
      try {
        return await adapter.embed(request);
      } catch {
        // Try next provider
      }
    }
    
    throw new Error('No embedding providers available');
  }
  
  /**
   * Get budget status for an agent
   */
  getBudgetStatus(agentId: string): BudgetStatus {
    const tracker = this.budgetTracker.get(agentId) || {
      spent: 0,
      limit: this.config.budget.dailyLimitUsd,
    };
    
    const percentUsed = tracker.spent / tracker.limit;
    
    return {
      agentId,
      dailySpentUsd: tracker.spent,
      dailyLimitUsd: tracker.limit,
      remainingUsd: Math.max(0, tracker.limit - tracker.spent),
      warningTriggered: percentUsed >= this.config.budget.warningThreshold,
      budgetExhausted: tracker.spent >= tracker.limit,
    };
  }
  
  /**
   * Track token usage and costs
   */
  private trackUsage(agentId: string | undefined, usage: TokenUsage): void {
    if (!agentId) return;
    
    const tracker = this.budgetTracker.get(agentId) || {
      spent: 0,
      limit: this.config.budget.dailyLimitUsd,
    };
    
    tracker.spent += usage.estimatedCostUsd;
    this.budgetTracker.set(agentId, tracker);
    
    // Check for warnings
    const status = this.getBudgetStatus(agentId);
    
    if (status.warningTriggered && !status.budgetExhausted) {
      this.emit('llm_event', {
        type: 'budget_warning',
        agentId,
        percentUsed: tracker.spent / tracker.limit,
      } as LLMEvent);
    }
    
    if (status.budgetExhausted) {
      this.emit('llm_event', {
        type: 'budget_exhausted',
        agentId,
      } as LLMEvent);
    }
  }
  
  /**
   * Get next fallback provider
   */
  private getNextFallback(triedProviders: ProviderId[]): ProviderId | null {
    const healthyProviders = this.router.getHealthyProviders();
    const available = healthyProviders.filter(p => !triedProviders.includes(p));
    return available[0] || null;
  }
  
  /**
   * Reset daily budgets (call at midnight)
   */
  resetDailyBudgets(): void {
    for (const [agentId, tracker] of this.budgetTracker.entries()) {
      tracker.spent = 0;
      this.budgetTracker.set(agentId, tracker);
    }
  }
  
  /**
   * Check health of all providers
   */
  async checkHealth(): Promise<void> {
    await this.router.checkAllHealth();
  }
  
  /**
   * Parse raw config to typed config
   */
  private parseConfig(raw: Record<string, unknown>): LLMConfig {
    // Type coercion with defaults
    return raw as unknown as LLMConfig;
  }
  
  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
  
  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Re-export types
export * from './types';
export { ModelRouter } from './router/model-router';
export { createAdapter, getAdapter } from './adapters';
