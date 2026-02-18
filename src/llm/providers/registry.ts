// @ts-nocheck
/**
 * LLM Provider Registry
 * Modular, extensible provider management - add ANY LLM provider
 */

import type { LLMAdapter, GenerateOptions, GenerateResult, StreamChunk, ProviderHealth } from '../types';

// ============================================================================
// TYPES - Provider-agnostic interfaces
// ============================================================================

export interface ProviderDefinition {
  id: string;
  name: string;
  type: 'cloud' | 'local' | 'proxy';
  supportsStreaming: boolean;
  supportsEmbeddings: boolean;
  supportsFunctions: boolean;
  defaultEndpoint?: string;
  models: ModelDefinition[];
  authType: 'api_key' | 'oauth' | 'none' | 'custom';
  configSchema: ConfigField[];
}

export interface ModelDefinition {
  id: string;
  name: string;
  contextWindow: number;
  maxOutput: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  tier: 'economy' | 'routine' | 'quality' | 'premium';
  capabilities: string[];
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'string' | 'password' | 'url' | 'number' | 'boolean' | 'select';
  required: boolean;
  default?: any;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

export interface ProviderInstance {
  definition: ProviderDefinition;
  adapter: LLMAdapter;
  config: Record<string, any>;
  status: 'active' | 'inactive' | 'error' | 'rate_limited';
  health: ProviderHealth;
  priority: number;
}

// ============================================================================
// BUILT-IN PROVIDER DEFINITIONS
// ============================================================================

export const BUILTIN_PROVIDERS: ProviderDefinition[] = [
  // Google Gemini
  {
    id: 'gemini',
    name: 'Google Gemini',
    type: 'cloud',
    supportsStreaming: true,
    supportsEmbeddings: true,
    supportsFunctions: true,
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
    authType: 'api_key',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1000000, maxOutput: 8192, costPer1kInput: 0.0001, costPer1kOutput: 0.0004, tier: 'routine', capabilities: ['chat', 'code', 'analysis'] },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2000000, maxOutput: 8192, costPer1kInput: 0.00125, costPer1kOutput: 0.005, tier: 'quality', capabilities: ['chat', 'code', 'analysis', 'reasoning'] },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, maxOutput: 8192, costPer1kInput: 0.000075, costPer1kOutput: 0.0003, tier: 'economy', capabilities: ['chat', 'code'] },
    ],
    configSchema: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'AIza...' },
      { key: 'endpoint', label: 'Endpoint', type: 'url', required: false, placeholder: 'Custom endpoint (optional)' },
    ],
  },

  // Anthropic Claude
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    type: 'cloud',
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsFunctions: true,
    defaultEndpoint: 'https://api.anthropic.com/v1',
    authType: 'api_key',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000, maxOutput: 8192, costPer1kInput: 0.003, costPer1kOutput: 0.015, tier: 'quality', capabilities: ['chat', 'code', 'analysis', 'reasoning'] },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextWindow: 200000, maxOutput: 8192, costPer1kInput: 0.001, costPer1kOutput: 0.005, tier: 'routine', capabilities: ['chat', 'code'] },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', contextWindow: 200000, maxOutput: 4096, costPer1kInput: 0.015, costPer1kOutput: 0.075, tier: 'premium', capabilities: ['chat', 'code', 'analysis', 'reasoning', 'complex'] },
    ],
    configSchema: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-ant-...' },
    ],
  },

  // OpenAI
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'cloud',
    supportsStreaming: true,
    supportsEmbeddings: true,
    supportsFunctions: true,
    defaultEndpoint: 'https://api.openai.com/v1',
    authType: 'api_key',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, maxOutput: 16384, costPer1kInput: 0.005, costPer1kOutput: 0.015, tier: 'quality', capabilities: ['chat', 'code', 'analysis', 'vision'] },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, maxOutput: 16384, costPer1kInput: 0.00015, costPer1kOutput: 0.0006, tier: 'routine', capabilities: ['chat', 'code'] },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000, maxOutput: 4096, costPer1kInput: 0.01, costPer1kOutput: 0.03, tier: 'premium', capabilities: ['chat', 'code', 'analysis', 'reasoning'] },
      { id: 'o1-preview', name: 'o1 Preview', contextWindow: 128000, maxOutput: 32768, costPer1kInput: 0.015, costPer1kOutput: 0.06, tier: 'premium', capabilities: ['reasoning', 'analysis', 'complex'] },
    ],
    configSchema: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-...' },
      { key: 'organization', label: 'Organization ID', type: 'string', required: false, placeholder: 'org-...' },
    ],
  },

  // Ollama (Local)
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    type: 'local',
    supportsStreaming: true,
    supportsEmbeddings: true,
    supportsFunctions: false,
    defaultEndpoint: 'http://localhost:11434',
    authType: 'none',
    models: [
      { id: 'llama3.2', name: 'Llama 3.2', contextWindow: 128000, maxOutput: 4096, costPer1kInput: 0, costPer1kOutput: 0, tier: 'economy', capabilities: ['chat', 'code'] },
      { id: 'mistral', name: 'Mistral', contextWindow: 32000, maxOutput: 4096, costPer1kInput: 0, costPer1kOutput: 0, tier: 'economy', capabilities: ['chat', 'code'] },
      { id: 'codellama', name: 'Code Llama', contextWindow: 16000, maxOutput: 4096, costPer1kInput: 0, costPer1kOutput: 0, tier: 'routine', capabilities: ['code'] },
      { id: 'deepseek-coder', name: 'DeepSeek Coder', contextWindow: 128000, maxOutput: 4096, costPer1kInput: 0, costPer1kOutput: 0, tier: 'routine', capabilities: ['code', 'analysis'] },
    ],
    configSchema: [
      { key: 'endpoint', label: 'Ollama URL', type: 'url', required: true, default: 'http://localhost:11434' },
    ],
  },

  // Groq
  {
    id: 'groq',
    name: 'Groq',
    type: 'cloud',
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsFunctions: true,
    defaultEndpoint: 'https://api.groq.com/openai/v1',
    authType: 'api_key',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextWindow: 128000, maxOutput: 32768, costPer1kInput: 0.00059, costPer1kOutput: 0.00079, tier: 'quality', capabilities: ['chat', 'code', 'analysis'] },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', contextWindow: 128000, maxOutput: 8192, costPer1kInput: 0.00005, costPer1kOutput: 0.00008, tier: 'economy', capabilities: ['chat', 'code'] },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', contextWindow: 32768, maxOutput: 4096, costPer1kInput: 0.00024, costPer1kOutput: 0.00024, tier: 'routine', capabilities: ['chat', 'code'] },
    ],
    configSchema: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'gsk_...' },
    ],
  },

  // Together AI
  {
    id: 'together',
    name: 'Together AI',
    type: 'cloud',
    supportsStreaming: true,
    supportsEmbeddings: true,
    supportsFunctions: false,
    defaultEndpoint: 'https://api.together.xyz/v1',
    authType: 'api_key',
    models: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo', contextWindow: 128000, maxOutput: 4096, costPer1kInput: 0.00088, costPer1kOutput: 0.00088, tier: 'quality', capabilities: ['chat', 'code', 'analysis'] },
      { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', name: 'Qwen 2.5 72B', contextWindow: 32768, maxOutput: 4096, costPer1kInput: 0.0012, costPer1kOutput: 0.0012, tier: 'quality', capabilities: ['chat', 'code', 'analysis'] },
      { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3', contextWindow: 128000, maxOutput: 4096, costPer1kInput: 0.0009, costPer1kOutput: 0.0009, tier: 'quality', capabilities: ['chat', 'code', 'reasoning'] },
    ],
    configSchema: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    ],
  },

  // Fireworks AI
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    type: 'cloud',
    supportsStreaming: true,
    supportsEmbeddings: true,
    supportsFunctions: true,
    defaultEndpoint: 'https://api.fireworks.ai/inference/v1',
    authType: 'api_key',
    models: [
      { id: 'accounts/fireworks/models/llama-v3p3-70b-instruct', name: 'Llama 3.3 70B', contextWindow: 128000, maxOutput: 4096, costPer1kInput: 0.0009, costPer1kOutput: 0.0009, tier: 'quality', capabilities: ['chat', 'code'] },
      { id: 'accounts/fireworks/models/deepseek-v3', name: 'DeepSeek V3', contextWindow: 128000, maxOutput: 4096, costPer1kInput: 0.0009, costPer1kOutput: 0.0009, tier: 'quality', capabilities: ['chat', 'code', 'reasoning'] },
    ],
    configSchema: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    ],
  },

  // Cerebras
  {
    id: 'cerebras',
    name: 'Cerebras',
    type: 'cloud',
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsFunctions: false,
    defaultEndpoint: 'https://api.cerebras.ai/v1',
    authType: 'api_key',
    models: [
      { id: 'llama3.1-70b', name: 'Llama 3.1 70B', contextWindow: 128000, maxOutput: 8192, costPer1kInput: 0.0006, costPer1kOutput: 0.0006, tier: 'quality', capabilities: ['chat', 'code'] },
      { id: 'llama3.1-8b', name: 'Llama 3.1 8B', contextWindow: 128000, maxOutput: 8192, costPer1kInput: 0.0001, costPer1kOutput: 0.0001, tier: 'economy', capabilities: ['chat', 'code'] },
    ],
    configSchema: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    ],
  },

  // Mistral AI
  {
    id: 'mistral',
    name: 'Mistral AI',
    type: 'cloud',
    supportsStreaming: true,
    supportsEmbeddings: true,
    supportsFunctions: true,
    defaultEndpoint: 'https://api.mistral.ai/v1',
    authType: 'api_key',
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large', contextWindow: 128000, maxOutput: 4096, costPer1kInput: 0.002, costPer1kOutput: 0.006, tier: 'quality', capabilities: ['chat', 'code', 'analysis', 'reasoning'] },
      { id: 'mistral-small-latest', name: 'Mistral Small', contextWindow: 32000, maxOutput: 4096, costPer1kInput: 0.0002, costPer1kOutput: 0.0006, tier: 'routine', capabilities: ['chat', 'code'] },
      { id: 'codestral-latest', name: 'Codestral', contextWindow: 32000, maxOutput: 4096, costPer1kInput: 0.0002, costPer1kOutput: 0.0006, tier: 'routine', capabilities: ['code'] },
    ],
    configSchema: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    ],
  },

  // DeepSeek
  {
    id: 'deepseek',
    name: 'DeepSeek',
    type: 'cloud',
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsFunctions: true,
    defaultEndpoint: 'https://api.deepseek.com',
    authType: 'api_key',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', contextWindow: 64000, maxOutput: 8192, costPer1kInput: 0.00014, costPer1kOutput: 0.00028, tier: 'quality', capabilities: ['chat', 'code', 'analysis', 'reasoning'] },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', contextWindow: 64000, maxOutput: 8192, costPer1kInput: 0.00055, costPer1kOutput: 0.00219, tier: 'premium', capabilities: ['reasoning', 'analysis', 'complex'] },
    ],
    configSchema: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    ],
  },

  // OpenRouter (Proxy to many providers)
  {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'proxy',
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsFunctions: true,
    defaultEndpoint: 'https://openrouter.ai/api/v1',
    authType: 'api_key',
    models: [
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (via OR)', contextWindow: 200000, maxOutput: 8192, costPer1kInput: 0.003, costPer1kOutput: 0.015, tier: 'quality', capabilities: ['chat', 'code', 'analysis'] },
      { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', contextWindow: 1000000, maxOutput: 8192, costPer1kInput: 0, costPer1kOutput: 0, tier: 'economy', capabilities: ['chat', 'code'] },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1 (via OR)', contextWindow: 64000, maxOutput: 8192, costPer1kInput: 0.00055, costPer1kOutput: 0.00219, tier: 'premium', capabilities: ['reasoning'] },
    ],
    configSchema: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-or-...' },
      { key: 'siteUrl', label: 'Site URL', type: 'url', required: false, placeholder: 'https://your-app.com' },
      { key: 'siteName', label: 'Site Name', type: 'string', required: false, placeholder: 'EduGenius' },
    ],
  },

  // LearnLM (Google's educational model)
  {
    id: 'learnlm',
    name: 'LearnLM (Educational)',
    type: 'cloud',
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsFunctions: false,
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
    authType: 'api_key',
    models: [
      { id: 'learnlm-1.5-pro-experimental', name: 'LearnLM 1.5 Pro', contextWindow: 32000, maxOutput: 8192, costPer1kInput: 0.001, costPer1kOutput: 0.004, tier: 'quality', capabilities: ['education', 'tutoring', 'explanation'] },
    ],
    configSchema: [
      { key: 'apiKey', label: 'API Key (Gemini)', type: 'password', required: true, placeholder: 'Uses Gemini API key' },
    ],
  },
];

// ============================================================================
// PROVIDER REGISTRY CLASS
// ============================================================================

export class ProviderRegistry {
  private providers: Map<string, ProviderInstance> = new Map();
  private customProviders: Map<string, ProviderDefinition> = new Map();
  
  constructor() {
    // Load built-in provider definitions
    for (const def of BUILTIN_PROVIDERS) {
      this.customProviders.set(def.id, def);
    }
  }
  
  /**
   * Register a custom provider definition
   */
  registerProvider(definition: ProviderDefinition): void {
    this.customProviders.set(definition.id, definition);
  }
  
  /**
   * Get all available provider definitions
   */
  getAvailableProviders(): ProviderDefinition[] {
    return Array.from(this.customProviders.values());
  }
  
  /**
   * Get provider definition by ID
   */
  getProviderDefinition(id: string): ProviderDefinition | undefined {
    return this.customProviders.get(id);
  }
  
  /**
   * Enable a provider with configuration
   */
  async enableProvider(
    providerId: string, 
    config: Record<string, any>,
    adapter: LLMAdapter,
    priority: number = 50
  ): Promise<void> {
    const definition = this.customProviders.get(providerId);
    if (!definition) {
      throw new Error(`Unknown provider: ${providerId}`);
    }
    
    // Check health
    let health: ProviderHealth;
    try {
      health = await adapter.checkHealth();
    } catch {
      health = {
        provider: providerId as any,
        healthy: false,
        latencyMs: 0,
        lastCheck: new Date(),
        errorRate: 1,
        consecutiveFailures: 1,
      };
    }
    
    this.providers.set(providerId, {
      definition,
      adapter,
      config,
      status: health.healthy ? 'active' : 'error',
      health,
      priority,
    });
  }
  
  /**
   * Disable a provider
   */
  disableProvider(providerId: string): void {
    this.providers.delete(providerId);
  }
  
  /**
   * Get all enabled providers sorted by priority
   */
  getEnabledProviders(): ProviderInstance[] {
    return Array.from(this.providers.values())
      .filter(p => p.status === 'active')
      .sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Get provider instance by ID
   */
  getProvider(id: string): ProviderInstance | undefined {
    return this.providers.get(id);
  }
  
  /**
   * Find providers by capability
   */
  findByCapability(capability: string): ProviderInstance[] {
    return this.getEnabledProviders().filter(p =>
      p.definition.models.some(m => m.capabilities.includes(capability))
    );
  }
  
  /**
   * Find providers by tier
   */
  findByTier(tier: 'economy' | 'routine' | 'quality' | 'premium'): ProviderInstance[] {
    return this.getEnabledProviders().filter(p =>
      p.definition.models.some(m => m.tier === tier)
    );
  }
  
  /**
   * Get cheapest provider for a task
   */
  getCheapest(): { provider: ProviderInstance; model: ModelDefinition } | null {
    let cheapest: { provider: ProviderInstance; model: ModelDefinition; cost: number } | null = null;
    
    for (const provider of this.getEnabledProviders()) {
      for (const model of provider.definition.models) {
        const cost = model.costPer1kInput + model.costPer1kOutput;
        if (!cheapest || cost < cheapest.cost) {
          cheapest = { provider, model, cost };
        }
      }
    }
    
    return cheapest ? { provider: cheapest.provider, model: cheapest.model } : null;
  }
  
  /**
   * Export configuration for persistence
   */
  exportConfig(): Record<string, { config: Record<string, any>; priority: number }> {
    const result: Record<string, { config: Record<string, any>; priority: number }> = {};
    for (const [id, instance] of this.providers) {
      result[id] = { config: instance.config, priority: instance.priority };
    }
    return result;
  }
}

// Singleton instance
export const providerRegistry = new ProviderRegistry();
