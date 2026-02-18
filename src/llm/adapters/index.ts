// @ts-nocheck
/**
 * EduGenius LLM Abstraction Layer - Adapter Factory
 * Creates and manages provider adapters
 */

import type { LLMAdapter, ProviderId, ProviderConfig, ModelConfig } from '../types';
import { GeminiAdapter } from './gemini';
import { AnthropicAdapter } from './anthropic';
import { OpenAIAdapter } from './openai';
import { OllamaAdapter } from './ollama';

// Environment variable names for API keys
const API_KEY_ENV_VARS: Record<ProviderId, string> = {
  gemini: 'GEMINI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  ollama: '', // No API key needed
  learnlm: 'GEMINI_API_KEY', // LearnLM uses Gemini API
};

// Default base URLs
const DEFAULT_BASE_URLS: Record<ProviderId, string> = {
  gemini: 'https://generativelanguage.googleapis.com',
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com',
  ollama: 'http://localhost:11434',
  learnlm: 'https://generativelanguage.googleapis.com',
};

// Adapter registry
const adapters: Map<ProviderId, LLMAdapter> = new Map();

/**
 * Create an adapter for a specific provider
 */
export function createAdapter(
  providerId: ProviderId,
  config: ProviderConfig,
  apiKey?: string
): LLMAdapter {
  const key = apiKey || process.env[API_KEY_ENV_VARS[providerId]] || '';
  const baseUrl = config.baseUrl || DEFAULT_BASE_URLS[providerId];
  
  // Convert config models to ModelConfig format
  const models: Record<string, ModelConfig> = {};
  for (const [name, model] of Object.entries(config.models)) {
    models[name] = {
      id: model.id,
      contextWindow: model.contextWindow,
      maxOutput: model.maxOutput,
      costPer1kInput: model.costPer1kInput,
      costPer1kOutput: model.costPer1kOutput,
      tier: model.tier,
      specialization: model.specialization,
    };
  }
  
  const defaultModel = config.fallbackOrder[0] || Object.keys(config.models)[0];
  
  const adapterConfig = {
    apiKey: key,
    baseUrl,
    models,
    defaultModel,
  };
  
  switch (providerId) {
    case 'gemini':
    case 'learnlm':
      return new GeminiAdapter(adapterConfig);
      
    case 'anthropic':
      return new AnthropicAdapter(adapterConfig);
      
    case 'openai':
      return new OpenAIAdapter(adapterConfig);
      
    case 'ollama':
      return new OllamaAdapter(adapterConfig);
      
    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
}

/**
 * Get or create an adapter for a provider
 */
export function getAdapter(
  providerId: ProviderId,
  config: ProviderConfig,
  apiKey?: string
): LLMAdapter {
  if (!adapters.has(providerId)) {
    adapters.set(providerId, createAdapter(providerId, config, apiKey));
  }
  return adapters.get(providerId)!;
}

/**
 * Clear all cached adapters (useful for testing or config reload)
 */
export function clearAdapters(): void {
  adapters.clear();
}

/**
 * Get all initialized adapters
 */
export function getAllAdapters(): Map<ProviderId, LLMAdapter> {
  return new Map(adapters);
}

// Re-export adapter classes for direct use
export { GeminiAdapter } from './gemini';
export { AnthropicAdapter } from './anthropic';
export { OpenAIAdapter } from './openai';
export { OllamaAdapter } from './ollama';
