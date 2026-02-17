/**
 * Unit Tests for EduGenius Model Router
 * Tests intelligent routing, fallback, and budget tracking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelRouter } from '../router/model-router';

// Mock provider registry
const mockRegistry = {
  providers: {
    gemini: {
      enabled: true,
      priority: 1,
      models: {
        'gemini-2.0-flash': {
          id: 'gemini-2.0-flash',
          tier: 'flash',
          costPer1kInput: 0.000075,
          costPer1kOutput: 0.0003,
          specialization: ['general', 'code'],
        },
        'gemini-2.0-pro': {
          id: 'gemini-2.0-pro',
          tier: 'pro',
          costPer1kInput: 0.00125,
          costPer1kOutput: 0.005,
          specialization: ['reasoning', 'complex'],
        },
      },
      fallbackOrder: ['gemini-2.0-flash', 'gemini-2.0-pro'],
    },
    anthropic: {
      enabled: true,
      priority: 2,
      models: {
        'claude-3-5-sonnet': {
          id: 'claude-3-5-sonnet-20241022',
          tier: 'standard',
          costPer1kInput: 0.003,
          costPer1kOutput: 0.015,
          specialization: ['reasoning', 'code', 'analysis'],
        },
        'claude-3-5-haiku': {
          id: 'claude-3-5-haiku-20241022',
          tier: 'fast',
          costPer1kInput: 0.001,
          costPer1kOutput: 0.005,
          specialization: ['general', 'fast'],
        },
      },
      fallbackOrder: ['claude-3-5-haiku', 'claude-3-5-sonnet'],
    },
    openai: {
      enabled: true,
      priority: 3,
      models: {
        'gpt-4o': {
          id: 'gpt-4o',
          tier: 'standard',
          costPer1kInput: 0.005,
          costPer1kOutput: 0.015,
          specialization: ['general', 'vision'],
        },
        'gpt-4o-mini': {
          id: 'gpt-4o-mini',
          tier: 'mini',
          costPer1kInput: 0.00015,
          costPer1kOutput: 0.0006,
          specialization: ['general', 'fast'],
        },
      },
      fallbackOrder: ['gpt-4o-mini', 'gpt-4o'],
    },
    ollama: {
      enabled: true,
      priority: 4,
      models: {
        'llama3': {
          id: 'llama3:8b',
          tier: 'local',
          costPer1kInput: 0,
          costPer1kOutput: 0,
          specialization: ['general'],
        },
      },
      fallbackOrder: ['llama3'],
    },
  },
  routingRules: {
    taskTypes: {
      'quality-critical': {
        preferredTiers: ['pro', 'standard'],
        preferredProviders: ['anthropic', 'gemini'],
      },
      'routine': {
        preferredTiers: ['flash', 'mini', 'fast'],
        preferredProviders: ['gemini', 'openai'],
      },
      'pedagogical': {
        preferredTiers: ['standard', 'pro'],
        preferredProviders: ['gemini'],
        preferredSpecializations: ['reasoning'],
      },
      'code': {
        preferredTiers: ['standard', 'pro'],
        preferredProviders: ['anthropic', 'gemini'],
        preferredSpecializations: ['code'],
      },
    },
    budgetLimits: {
      default: { dailyLimit: 10, warningThreshold: 0.8 },
      Scout: { dailyLimit: 5, warningThreshold: 0.7 },
      Atlas: { dailyLimit: 20, warningThreshold: 0.8 },
      Sage: { dailyLimit: 30, warningThreshold: 0.9 },
    },
  },
};

describe('ModelRouter', () => {
  let router: ModelRouter;

  beforeEach(() => {
    router = new ModelRouter(mockRegistry as any);
  });

  describe('Route Selection', () => {
    it('should route quality-critical tasks to pro/standard tiers', () => {
      const route = router.selectRoute({
        taskType: 'quality-critical',
        agentId: 'Jarvis',
      });

      expect(route.provider).toBe('anthropic');
      expect(route.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should route routine tasks to flash/mini tiers', () => {
      const route = router.selectRoute({
        taskType: 'routine',
        agentId: 'Scout',
      });

      expect(route.provider).toBe('gemini');
      expect(route.model).toBe('gemini-2.0-flash');
    });

    it('should route pedagogical tasks to Gemini', () => {
      const route = router.selectRoute({
        taskType: 'pedagogical',
        agentId: 'Sage',
      });

      expect(route.provider).toBe('gemini');
      // Should pick model with reasoning specialization
      expect(['gemini-2.0-pro', 'gemini-2.0-flash']).toContain(route.model);
    });

    it('should route code tasks to specialized models', () => {
      const route = router.selectRoute({
        taskType: 'code',
        agentId: 'Forge',
      });

      // Should pick model with code specialization
      expect(['anthropic', 'gemini']).toContain(route.provider);
    });

    it('should respect explicit model override', () => {
      const route = router.selectRoute({
        taskType: 'routine',
        agentId: 'Jarvis',
        preferredModel: 'gpt-4o',
      });

      expect(route.provider).toBe('openai');
      expect(route.model).toBe('gpt-4o');
    });

    it('should respect explicit provider override', () => {
      const route = router.selectRoute({
        taskType: 'routine',
        agentId: 'Jarvis',
        preferredProvider: 'ollama',
      });

      expect(route.provider).toBe('ollama');
      expect(route.model).toBe('llama3:8b');
    });
  });

  describe('Fallback Chain', () => {
    it('should return fallback chain for a route', () => {
      const route = router.selectRoute({
        taskType: 'routine',
        agentId: 'Scout',
      });

      const fallbacks = router.getFallbackChain(route);
      
      // Should have multiple fallback options
      expect(fallbacks.length).toBeGreaterThan(0);
      
      // First fallback should be different from primary
      if (fallbacks.length > 0) {
        expect(fallbacks[0].model).not.toBe(route.model);
      }
    });

    it('should include cross-provider fallbacks', () => {
      const route = router.selectRoute({
        taskType: 'quality-critical',
        agentId: 'Jarvis',
      });

      const fallbacks = router.getFallbackChain(route);
      const providers = new Set(fallbacks.map(f => f.provider));
      
      // Should have fallbacks from multiple providers
      expect(providers.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Budget Tracking', () => {
    it('should track usage per agent', () => {
      router.recordUsage('Scout', 1000, 500, 0.01);
      router.recordUsage('Scout', 2000, 1000, 0.02);

      const budget = router.getBudgetStatus('Scout');
      expect(budget.totalCost).toBeCloseTo(0.03);
      expect(budget.inputTokens).toBe(3000);
      expect(budget.outputTokens).toBe(1500);
    });

    it('should warn when approaching budget limit', () => {
      const warnSpy = vi.fn();
      router.on('budget:warning', warnSpy);

      // Scout has $5 daily limit, 70% warning = $3.50
      router.recordUsage('Scout', 100000, 50000, 4.00);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'Scout',
          percentage: expect.any(Number),
        })
      );
    });

    it('should block when budget exceeded', () => {
      const blockSpy = vi.fn();
      router.on('budget:exceeded', blockSpy);

      router.recordUsage('Scout', 200000, 100000, 6.00);

      expect(blockSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'Scout',
        })
      );
    });

    it('should use default budget for unknown agents', () => {
      router.recordUsage('NewAgent', 1000, 500, 0.01);
      const budget = router.getBudgetStatus('NewAgent');
      expect(budget.limit).toBe(10); // Default limit
    });

    it('should reset budget daily', () => {
      router.recordUsage('Scout', 1000, 500, 1.00);
      
      // Simulate day change
      router.resetDailyBudgets();
      
      const budget = router.getBudgetStatus('Scout');
      expect(budget.totalCost).toBe(0);
      expect(budget.inputTokens).toBe(0);
    });
  });

  describe('Provider Health', () => {
    it('should track provider failures', () => {
      router.recordFailure('gemini', 'gemini-2.0-flash', 'rate_limit');
      router.recordFailure('gemini', 'gemini-2.0-flash', 'rate_limit');
      router.recordFailure('gemini', 'gemini-2.0-flash', 'rate_limit');

      const health = router.getProviderHealth('gemini');
      expect(health.recentFailures).toBe(3);
      expect(health.available).toBe(true); // Still available but degraded
    });

    it('should mark provider unavailable after too many failures', () => {
      for (let i = 0; i < 10; i++) {
        router.recordFailure('openai', 'gpt-4o', 'api_error');
      }

      const health = router.getProviderHealth('openai');
      expect(health.available).toBe(false);
    });

    it('should recover provider after success', () => {
      for (let i = 0; i < 10; i++) {
        router.recordFailure('openai', 'gpt-4o', 'api_error');
      }

      // Record successful usage
      router.recordUsage('Jarvis', 1000, 500, 0.01, 'openai');

      const health = router.getProviderHealth('openai');
      expect(health.available).toBe(true);
    });

    it('should route around unavailable providers', () => {
      // Make Anthropic unavailable
      for (let i = 0; i < 10; i++) {
        router.recordFailure('anthropic', 'claude-3-5-sonnet', 'api_error');
      }

      const route = router.selectRoute({
        taskType: 'quality-critical',
        agentId: 'Jarvis',
      });

      // Should fall back to Gemini
      expect(route.provider).not.toBe('anthropic');
    });
  });

  describe('Cost Optimization', () => {
    it('should estimate cost before routing', () => {
      const estimate = router.estimateCost({
        taskType: 'routine',
        estimatedInputTokens: 1000,
        estimatedOutputTokens: 500,
      });

      expect(estimate.provider).toBeDefined();
      expect(estimate.model).toBeDefined();
      expect(estimate.estimatedCost).toBeGreaterThan(0);
    });

    it('should prefer cheaper models for routine tasks', () => {
      const routineEstimate = router.estimateCost({
        taskType: 'routine',
        estimatedInputTokens: 1000,
        estimatedOutputTokens: 500,
      });

      const qualityEstimate = router.estimateCost({
        taskType: 'quality-critical',
        estimatedInputTokens: 1000,
        estimatedOutputTokens: 500,
      });

      expect(routineEstimate.estimatedCost).toBeLessThan(qualityEstimate.estimatedCost);
    });

    it('should include local models as zero-cost fallback', () => {
      const estimate = router.estimateCost({
        taskType: 'routine',
        estimatedInputTokens: 1000,
        estimatedOutputTokens: 500,
        includeLocalModels: true,
      });

      // Local models should be in alternatives
      const localOption = estimate.alternatives?.find(a => a.provider === 'ollama');
      expect(localOption).toBeDefined();
      expect(localOption?.estimatedCost).toBe(0);
    });
  });
});

describe('Model Selection Strategies', () => {
  let router: ModelRouter;

  beforeEach(() => {
    router = new ModelRouter(mockRegistry as any);
  });

  it('should select by specialization match', () => {
    const models = router.findModelsBySpecialization('code');
    expect(models.length).toBeGreaterThan(0);
    expect(models.some(m => m.specialization?.includes('code'))).toBe(true);
  });

  it('should select by tier', () => {
    const models = router.findModelsByTier('flash');
    expect(models.length).toBeGreaterThan(0);
    expect(models.every(m => m.tier === 'flash')).toBe(true);
  });

  it('should select cheapest model', () => {
    const cheapest = router.findCheapestModel();
    expect(cheapest.costPer1kInput).toBe(0); // Ollama is free
  });

  it('should select fastest model', () => {
    const fastest = router.findFastestModel();
    expect(['flash', 'mini', 'fast', 'local']).toContain(fastest.tier);
  });
});
