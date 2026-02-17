/**
 * EduGenius LLM Abstraction Layer - Type Definitions
 * Provider-agnostic types for LLM interactions
 */

// Provider identifiers
export type ProviderId = 'gemini' | 'anthropic' | 'openai' | 'ollama' | 'learnlm';

// Model tiers for routing decisions
export type ModelTier = 'quality' | 'routine' | 'pedagogical' | 'local';

// Task types for intelligent routing
export type TaskType = 
  | 'content_generation'
  | 'lesson_creation'
  | 'assessment_creation'
  | 'blog_writing'
  | 'summarization'
  | 'classification'
  | 'extraction'
  | 'simple_qa'
  | 'tutoring'
  | 'doubt_resolution'
  | 'socratic_dialogue'
  | 'learning_assessment';

// Message roles
export type MessageRole = 'system' | 'user' | 'assistant';

// Message structure
export interface Message {
  role: MessageRole;
  content: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

// Generation request
export interface GenerateRequest {
  messages: Message[];
  taskType?: TaskType;
  agentId?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  stream?: boolean;
  metadata?: {
    correlationId?: string;
    studentId?: string;
    sessionId?: string;
    [key: string]: unknown;
  };
}

// Token usage tracking
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

// Generation response
export interface GenerateResponse {
  content: string;
  finishReason: 'stop' | 'length' | 'content_filter' | 'error';
  usage: TokenUsage;
  model: string;
  provider: ProviderId;
  latencyMs: number;
  metadata?: Record<string, unknown>;
}

// Streaming chunk
export interface StreamChunk {
  content: string;
  done: boolean;
  usage?: TokenUsage;
}

// Embedding request
export interface EmbedRequest {
  texts: string[];
  model?: string;
}

// Embedding response
export interface EmbedResponse {
  embeddings: number[][];
  model: string;
  usage: {
    totalTokens: number;
    estimatedCostUsd: number;
  };
}

// Provider health status
export interface ProviderHealth {
  provider: ProviderId;
  healthy: boolean;
  latencyMs: number;
  lastCheck: Date;
  errorRate: number;
  consecutiveFailures: number;
}

// Budget status
export interface BudgetStatus {
  agentId: string;
  dailySpentUsd: number;
  dailyLimitUsd: number;
  remainingUsd: number;
  warningTriggered: boolean;
  budgetExhausted: boolean;
}

// Model configuration from YAML
export interface ModelConfig {
  id: string;
  contextWindow: number;
  maxOutput: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  tier: ModelTier;
  specialization?: string;
}

// Provider configuration from YAML
export interface ProviderConfig {
  enabled: boolean;
  baseUrl?: string;
  models: Record<string, ModelConfig>;
  fallbackOrder: string[];
  healthCheck?: {
    endpoint: string;
    intervalSeconds: number;
    timeoutMs: number;
  };
}

// Full configuration
export interface LLMConfig {
  version: string;
  defaultProvider: ProviderId;
  providers: Record<ProviderId, ProviderConfig>;
  taskRouting: Record<string, TaskType[]>;
  fallback: {
    strategy: 'waterfall' | 'round_robin';
    maxRetries: number;
    retryDelayMs: number;
    degradationLevels: Array<{
      name: string;
      providers: ProviderId[];
      alert?: boolean;
    }>;
  };
  budget: {
    dailyLimitUsd: number;
    warningThreshold: number;
    perAgentLimits: Record<string, number>;
  };
}

// Adapter interface - all providers implement this
export interface LLMAdapter {
  readonly providerId: ProviderId;
  
  generate(request: GenerateRequest): Promise<GenerateResponse>;
  generateStream(request: GenerateRequest): AsyncGenerator<StreamChunk>;
  embed(request: EmbedRequest): Promise<EmbedResponse>;
  
  checkHealth(): Promise<ProviderHealth>;
  countTokens(text: string): number;
}

// Events emitted by the LLM layer
export type LLMEvent = 
  | { type: 'generation_started'; correlationId: string; provider: ProviderId; agentId?: string }
  | { type: 'generation_completed'; correlationId: string; usage: TokenUsage; latencyMs: number }
  | { type: 'generation_failed'; correlationId: string; error: string; provider: ProviderId }
  | { type: 'provider_unhealthy'; provider: ProviderId; error: string }
  | { type: 'provider_recovered'; provider: ProviderId }
  | { type: 'fallback_triggered'; from: ProviderId; to: ProviderId; reason: string }
  | { type: 'budget_warning'; agentId: string; percentUsed: number }
  | { type: 'budget_exhausted'; agentId: string };
