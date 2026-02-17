/**
 * EduGenius Base Agent
 * Foundation class for all domain agents
 */

import { randomUUID } from 'crypto';
import { AgentChannel, getAgentChannel } from '../events/agent-channel';
import { EventBus, getEventBus } from '../events/event-bus';
import { LLMClient } from '../llm';
import { InMemoryCache } from '../data/cache';
import {
  AgentId,
  EventType,
  EventTypeMap,
  TypedEvent,
  EventHandler,
} from '../events/types';

// ============================================================================
// Agent Types
// ============================================================================

export interface AgentConfig {
  id: AgentId;
  name: string;
  description: string;
  heartbeatIntervalMs: number;
  budget: {
    dailyTokenLimit: number;
    warningThreshold: number;
  };
  subAgents?: SubAgentConfig[];
}

export interface SubAgentConfig {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  handler: string;
}

export interface AgentState {
  status: 'idle' | 'active' | 'busy' | 'blocked' | 'offline';
  currentTask?: {
    id: string;
    type: string;
    startedAt: number;
    progress: number;
  };
  tokensUsedToday: number;
  lastHeartbeat: number;
  lastActivity: number;
  errors: AgentError[];
}

export interface AgentError {
  timestamp: number;
  type: string;
  message: string;
  recoverable: boolean;
}

export interface AgentContext {
  agentId: AgentId;
  taskId?: string;
  correlationId?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

// ============================================================================
// Base Agent Class
// ============================================================================

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected state: AgentState;
  protected channel: AgentChannel;
  protected bus: EventBus;
  protected llm: LLMClient | null = null;
  protected cache: InMemoryCache;
  protected subAgentHandlers: Map<string, SubAgentHandler> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private subscriptions: (() => void)[] = [];

  constructor(config: AgentConfig) {
    this.config = config;
    this.bus = getEventBus();
    this.channel = getAgentChannel(config.id, this.bus);
    this.cache = new InMemoryCache(3600); // 1 hour default TTL

    this.state = {
      status: 'idle',
      tokensUsedToday: 0,
      lastHeartbeat: 0,
      lastActivity: 0,
      errors: [],
    };
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async start(): Promise<void> {
    console.log(`[${this.config.id}] Starting agent...`);

    // Initialize LLM client if needed
    await this.initializeLLM();

    // Register sub-agents
    this.registerSubAgents();

    // Setup event subscriptions
    await this.setupSubscriptions();

    // Start heartbeat
    this.startHeartbeat();

    this.state.status = 'active';
    this.state.lastActivity = Date.now();

    // Emit started event
    this.channel.sendHeartbeat('healthy', {
      activeSubAgents: Array.from(this.subAgentHandlers.keys()),
      currentTasks: 0,
      queuedTasks: 0,
      resourceUsage: {
        tokensUsed: this.state.tokensUsedToday,
        tokenBudget: this.config.budget.dailyTokenLimit,
        apiCallsLastHour: 0,
      },
    });

    console.log(`[${this.config.id}] Agent started`);
  }

  async stop(): Promise<void> {
    console.log(`[${this.config.id}] Stopping agent...`);

    // Stop heartbeat
    this.stopHeartbeat();

    // Unsubscribe from events
    for (const unsub of this.subscriptions) {
      unsub();
    }
    this.subscriptions = [];

    // Cleanup
    this.cache.destroy();

    this.state.status = 'offline';

    console.log(`[${this.config.id}] Agent stopped`);
  }

  // -------------------------------------------------------------------------
  // Abstract Methods (implement in subclasses)
  // -------------------------------------------------------------------------

  /**
   * Initialize LLM client with agent-specific config
   */
  protected abstract initializeLLM(): Promise<void>;

  /**
   * Register sub-agent handlers
   */
  protected abstract registerSubAgents(): void;

  /**
   * Setup event subscriptions
   */
  protected abstract setupSubscriptions(): Promise<void>;

  /**
   * Handle heartbeat (called periodically)
   */
  protected abstract onHeartbeat(): Promise<void>;

  // -------------------------------------------------------------------------
  // Sub-Agent Management
  // -------------------------------------------------------------------------

  protected registerSubAgent(
    id: string,
    handler: SubAgentHandler
  ): void {
    this.subAgentHandlers.set(id, handler);
  }

  protected async invokeSubAgent<T>(
    subAgentId: string,
    input: unknown,
    context: AgentContext
  ): Promise<T> {
    const handler = this.subAgentHandlers.get(subAgentId);
    if (!handler) {
      throw new Error(`Sub-agent not found: ${subAgentId}`);
    }

    const startTime = Date.now();

    try {
      this.state.currentTask = {
        id: context.taskId || randomUUID(),
        type: subAgentId,
        startedAt: startTime,
        progress: 0,
      };

      const result = await handler(input, context, this);

      this.state.currentTask = undefined;
      this.state.lastActivity = Date.now();

      return result as T;
    } catch (error) {
      this.handleError(error as Error, subAgentId);
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // Event Handling
  // -------------------------------------------------------------------------

  protected subscribe<T extends EventType>(
    eventType: T,
    handler: EventHandler<T>
  ): void {
    const unsub = this.channel.on(eventType, handler);
    this.subscriptions.push(unsub);
  }

  protected subscribeAll<T extends EventType>(
    eventType: T,
    handler: EventHandler<T>
  ): void {
    const unsub = this.channel.on(eventType, handler, { receiveAll: true });
    this.subscriptions.push(unsub);
  }

  protected emit<T extends EventType>(
    type: T,
    payload: EventTypeMap[T],
    options?: { to?: AgentId; priority?: 'low' | 'normal' | 'high' | 'critical' }
  ): string {
    if (options?.to) {
      return this.channel.sendTo(options.to, type, payload, {
        priority: options.priority,
      });
    }
    return this.channel.broadcast(type, payload, { priority: options?.priority });
  }

  // -------------------------------------------------------------------------
  // LLM Integration
  // -------------------------------------------------------------------------

  protected async generate(
    prompt: string,
    options: {
      systemPrompt?: string;
      taskType?: 'quality-critical' | 'routine' | 'pedagogical' | 'code';
      maxTokens?: number;
      temperature?: number;
    } = {}
  ): Promise<string> {
    if (!this.llm) {
      throw new Error('LLM client not initialized');
    }

    const response = await this.llm.generate({
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: options.systemPrompt,
      taskType: options.taskType || 'routine',
      agentId: this.config.id,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    });

    // Track token usage
    this.state.tokensUsedToday += response.usage.totalTokens;

    // Check budget
    this.checkBudget();

    return response.content;
  }

  protected async generateJSON<T>(
    prompt: string,
    options: {
      systemPrompt?: string;
      schema?: string;
      taskType?: 'quality-critical' | 'routine';
    } = {}
  ): Promise<T> {
    const systemPrompt = options.systemPrompt || 
      `You are a helpful assistant. Respond only with valid JSON.${
        options.schema ? `\n\nExpected schema:\n${options.schema}` : ''
      }`;

    const response = await this.generate(prompt, {
      systemPrompt,
      taskType: options.taskType,
    });

    // Extract JSON from response
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
                      response.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from response');
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    return JSON.parse(jsonStr);
  }

  // -------------------------------------------------------------------------
  // Budget Management
  // -------------------------------------------------------------------------

  private checkBudget(): void {
    const { dailyTokenLimit, warningThreshold } = this.config.budget;
    const usage = this.state.tokensUsedToday / dailyTokenLimit;

    if (usage >= 1) {
      this.state.status = 'blocked';
      this.channel.reportError(
        new Error(`Daily token budget exceeded: ${this.state.tokensUsedToday}/${dailyTokenLimit}`),
        { type: 'budget_exceeded' }
      );
    } else if (usage >= warningThreshold) {
      console.warn(`[${this.config.id}] Budget warning: ${Math.round(usage * 100)}% used`);
    }
  }

  resetDailyBudget(): void {
    this.state.tokensUsedToday = 0;
    if (this.state.status === 'blocked') {
      this.state.status = 'active';
    }
  }

  // -------------------------------------------------------------------------
  // Heartbeat
  // -------------------------------------------------------------------------

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(
      () => this.heartbeat(),
      this.config.heartbeatIntervalMs
    );
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async heartbeat(): Promise<void> {
    this.state.lastHeartbeat = Date.now();

    try {
      // Call agent-specific heartbeat logic
      await this.onHeartbeat();

      // Send heartbeat event
      this.channel.sendHeartbeat(
        this.state.status === 'blocked' ? 'degraded' : 'healthy',
        {
          activeSubAgents: Array.from(this.subAgentHandlers.keys()),
          currentTasks: this.state.currentTask ? 1 : 0,
          queuedTasks: 0,
          resourceUsage: {
            tokensUsed: this.state.tokensUsedToday,
            tokenBudget: this.config.budget.dailyTokenLimit,
            apiCallsLastHour: 0,
          },
        }
      );
    } catch (error) {
      this.handleError(error as Error, 'heartbeat');
    }
  }

  // -------------------------------------------------------------------------
  // Error Handling
  // -------------------------------------------------------------------------

  private handleError(error: Error, context: string): void {
    const agentError: AgentError = {
      timestamp: Date.now(),
      type: error.name,
      message: error.message,
      recoverable: true,
    };

    this.state.errors.push(agentError);

    // Keep only last 100 errors
    if (this.state.errors.length > 100) {
      this.state.errors = this.state.errors.slice(-100);
    }

    // Report error
    this.channel.reportError(error, { context, agentId: this.config.id });

    console.error(`[${this.config.id}] Error in ${context}:`, error.message);
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  getState(): Readonly<AgentState> {
    return { ...this.state };
  }

  getConfig(): Readonly<AgentConfig> {
    return { ...this.config };
  }

  getId(): AgentId {
    return this.config.id;
  }

  isActive(): boolean {
    return this.state.status === 'active' || this.state.status === 'busy';
  }
}

// ============================================================================
// Types
// ============================================================================

export type SubAgentHandler = (
  input: unknown,
  context: AgentContext,
  agent: BaseAgent
) => Promise<unknown>;
