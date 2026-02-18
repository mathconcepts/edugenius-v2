// @ts-nocheck
/**
 * EduGenius LLM Abstraction Layer - Model Router
 * Intelligent routing based on task type, budget, and provider health
 */

import type {
  ProviderId,
  TaskType,
  ModelTier,
  LLMConfig,
  ProviderHealth,
  BudgetStatus,
  LLMAdapter,
} from '../types';
import { getAdapter } from '../adapters';

interface RoutingDecision {
  provider: ProviderId;
  model: string;
  reason: string;
}

interface RouterState {
  providerHealth: Map<ProviderId, ProviderHealth>;
  budgetStatus: Map<string, BudgetStatus>;
  requestCounts: Map<ProviderId, number>;
}

export class ModelRouter {
  private config: LLMConfig;
  private state: RouterState;
  private adapters: Map<ProviderId, LLMAdapter> = new Map();
  
  constructor(config: LLMConfig) {
    this.config = config;
    this.state = {
      providerHealth: new Map(),
      budgetStatus: new Map(),
      requestCounts: new Map(),
    };
    
    // Initialize adapters for enabled providers
    for (const [providerId, providerConfig] of Object.entries(config.providers)) {
      if (providerConfig.enabled) {
        try {
          const adapter = getAdapter(providerId as ProviderId, providerConfig);
          this.adapters.set(providerId as ProviderId, adapter);
          
          // Initialize health as healthy
          this.state.providerHealth.set(providerId as ProviderId, {
            provider: providerId as ProviderId,
            healthy: true,
            latencyMs: 0,
            lastCheck: new Date(),
            errorRate: 0,
            consecutiveFailures: 0,
          });
        } catch {
          // Provider initialization failed - mark as unhealthy
          this.state.providerHealth.set(providerId as ProviderId, {
            provider: providerId as ProviderId,
            healthy: false,
            latencyMs: 0,
            lastCheck: new Date(),
            errorRate: 1,
            consecutiveFailures: 1,
          });
        }
      }
    }
  }
  
  /**
   * Route a request to the best provider/model
   */
  route(taskType?: TaskType, agentId?: string): RoutingDecision {
    // Check budget first
    if (agentId) {
      const budget = this.state.budgetStatus.get(agentId);
      if (budget?.budgetExhausted) {
        return this.getEconomyRoute('Budget exhausted for agent');
      }
    }
    
    // Determine required tier based on task type
    const requiredTier = this.getTierForTask(taskType);
    
    // Try primary providers first
    for (const level of this.config.fallback.degradationLevels) {
      for (const providerId of level.providers) {
        const health = this.state.providerHealth.get(providerId);
        const providerConfig = this.config.providers[providerId];
        
        if (!health?.healthy || !providerConfig?.enabled) continue;
        
        // Find a model that matches the required tier
        const model = this.selectModelForTier(providerId, requiredTier);
        if (model) {
          return {
            provider: providerId,
            model: model.id,
            reason: `Selected ${providerId}/${model.id} for ${taskType || 'general'} task (tier: ${requiredTier})`,
          };
        }
      }
    }
    
    // All providers failed - try economy mode
    return this.getEconomyRoute('No healthy providers available');
  }
  
  /**
   * Get economy route for budget/fallback scenarios
   */
  private getEconomyRoute(reason: string): RoutingDecision {
    // Try local models first
    const ollama = this.config.providers.ollama;
    if (ollama?.enabled) {
      const ollamaHealth = this.state.providerHealth.get('ollama');
      if (ollamaHealth?.healthy) {
        const model = Object.values(ollama.models)[0];
        return {
          provider: 'ollama',
          model: model?.id || 'llama3.2',
          reason: `Economy mode: ${reason}`,
        };
      }
    }
    
    // Fall back to cheapest cloud model
    const cheapestRoute = this.findCheapestModel();
    if (cheapestRoute) {
      return {
        ...cheapestRoute,
        reason: `Economy mode: ${reason}`,
      };
    }
    
    // Last resort - return default
    return {
      provider: this.config.defaultProvider,
      model: Object.values(this.config.providers[this.config.defaultProvider]?.models || {})[0]?.id || 'gemini-2.0-flash',
      reason: `Fallback to default: ${reason}`,
    };
  }
  
  /**
   * Find the cheapest available model
   */
  private findCheapestModel(): RoutingDecision | null {
    let cheapest: { provider: ProviderId; model: string; cost: number } | null = null;
    
    for (const [providerId, providerConfig] of Object.entries(this.config.providers)) {
      if (!providerConfig.enabled) continue;
      
      const health = this.state.providerHealth.get(providerId as ProviderId);
      if (!health?.healthy) continue;
      
      for (const [modelName, modelConfig] of Object.entries(providerConfig.models)) {
        const avgCost = (modelConfig.costPer1kInput + modelConfig.costPer1kOutput) / 2;
        if (!cheapest || avgCost < cheapest.cost) {
          cheapest = {
            provider: providerId as ProviderId,
            model: modelConfig.id,
            cost: avgCost,
          };
        }
      }
    }
    
    return cheapest ? { provider: cheapest.provider, model: cheapest.model, reason: '' } : null;
  }
  
  /**
   * Get required tier for a task type
   */
  private getTierForTask(taskType?: TaskType): ModelTier {
    if (!taskType) return 'routine';
    
    for (const [tier, tasks] of Object.entries(this.config.taskRouting)) {
      if (tasks.includes(taskType)) {
        return tier as ModelTier;
      }
    }
    
    return 'routine';
  }
  
  /**
   * Select a model for a specific tier from a provider
   */
  private selectModelForTier(providerId: ProviderId, tier: ModelTier) {
    const providerConfig = this.config.providers[providerId];
    if (!providerConfig) return null;
    
    // First try exact tier match
    for (const [_, modelConfig] of Object.entries(providerConfig.models)) {
      if (modelConfig.tier === tier) {
        return modelConfig;
      }
    }
    
    // Fall back to any available model
    const models = Object.values(providerConfig.models);
    return models[0] || null;
  }
  
  /**
   * Update provider health status
   */
  updateHealth(providerId: ProviderId, health: ProviderHealth): void {
    this.state.providerHealth.set(providerId, health);
  }
  
  /**
   * Update agent budget status
   */
  updateBudget(agentId: string, status: BudgetStatus): void {
    this.state.budgetStatus.set(agentId, status);
  }
  
  /**
   * Get adapter for a provider
   */
  getAdapter(providerId: ProviderId): LLMAdapter | undefined {
    return this.adapters.get(providerId);
  }
  
  /**
   * Get all healthy providers
   */
  getHealthyProviders(): ProviderId[] {
    return Array.from(this.state.providerHealth.entries())
      .filter(([_, health]) => health.healthy)
      .map(([id]) => id);
  }
  
  /**
   * Check all provider health
   */
  async checkAllHealth(): Promise<Map<ProviderId, ProviderHealth>> {
    const healthChecks = Array.from(this.adapters.entries()).map(
      async ([providerId, adapter]) => {
        try {
          const health = await adapter.checkHealth();
          this.state.providerHealth.set(providerId, health);
          return [providerId, health] as const;
        } catch (error) {
          const failedHealth: ProviderHealth = {
            provider: providerId,
            healthy: false,
            latencyMs: 0,
            lastCheck: new Date(),
            errorRate: 1,
            consecutiveFailures: 99,
          };
          this.state.providerHealth.set(providerId, failedHealth);
          return [providerId, failedHealth] as const;
        }
      }
    );
    
    const results = await Promise.all(healthChecks);
    return new Map(results);
  }
}
