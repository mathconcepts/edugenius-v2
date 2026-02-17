/**
 * EduGenius Agent Communication Channel
 * High-level API for agent-to-agent messaging
 */

import { randomUUID } from 'crypto';
import { EventBus, getEventBus } from './event-bus';
import {
  EventType,
  EventTypeMap,
  AgentId,
  SubAgentId,
  EventPriority,
  EventHandler,
  TypedEvent,
} from './types';

// ============================================================================
// Agent Channel
// ============================================================================

export class AgentChannel {
  private agentId: AgentId;
  private bus: EventBus;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private messageHandlers: Map<string, MessageHandler[]> = new Map();

  constructor(agentId: AgentId, bus?: EventBus) {
    this.agentId = agentId;
    this.bus = bus || getEventBus();
    this.setupDefaultSubscriptions();
  }

  // -------------------------------------------------------------------------
  // Sending Messages
  // -------------------------------------------------------------------------

  /**
   * Send a typed event from this agent
   */
  send<T extends EventType>(
    type: T,
    payload: EventTypeMap[T],
    options: SendOptions = {}
  ): string {
    return this.bus.publish(type, payload, {
      source: this.agentId,
      target: options.to,
      priority: options.priority,
      correlationId: options.correlationId,
      ttlMs: options.ttlMs,
    });
  }

  /**
   * Send to a specific agent
   */
  sendTo<T extends EventType>(
    target: AgentId | SubAgentId,
    type: T,
    payload: EventTypeMap[T],
    options: Omit<SendOptions, 'to'> = {}
  ): string {
    return this.send(type, payload, { ...options, to: target });
  }

  /**
   * Broadcast to all agents
   */
  broadcast<T extends EventType>(
    type: T,
    payload: EventTypeMap[T],
    options: Omit<SendOptions, 'to'> = {}
  ): string {
    return this.send(type, payload, { ...options, to: 'broadcast' });
  }

  /**
   * Send and wait for response (request/reply pattern)
   */
  async request<T extends EventType, R extends EventType>(
    target: AgentId | SubAgentId,
    requestType: T,
    payload: EventTypeMap[T],
    responseType: R,
    options: RequestOptions = {}
  ): Promise<TypedEvent<R>> {
    const correlationId = randomUUID();
    const timeout = options.timeout || 30000;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(correlationId, {
        responseType,
        resolve: (event) => {
          clearTimeout(timeoutId);
          this.pendingRequests.delete(correlationId);
          resolve(event as TypedEvent<R>);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          this.pendingRequests.delete(correlationId);
          reject(error);
        },
      });

      this.sendTo(target, requestType, payload, {
        ...options,
        correlationId,
      });
    });
  }

  /**
   * Reply to a received event
   */
  reply<T extends EventType>(
    originalEvent: TypedEvent<EventType>,
    responseType: T,
    payload: EventTypeMap[T]
  ): string {
    return this.send(responseType, payload, {
      to: originalEvent.meta.source as AgentId,
      correlationId: originalEvent.meta.correlationId,
      priority: originalEvent.meta.priority,
    });
  }

  // -------------------------------------------------------------------------
  // Receiving Messages
  // -------------------------------------------------------------------------

  /**
   * Listen for a specific event type
   */
  on<T extends EventType>(
    eventType: T,
    handler: EventHandler<T>,
    options: ListenOptions = {}
  ): () => void {
    const wrappedHandler = this.wrapHandler(handler, options);

    // Subscribe with filter for events targeted at this agent
    return this.bus.subscribeWithFilter(
      eventType,
      wrappedHandler,
      {
        target: options.receiveAll ? undefined : [this.agentId],
      },
      { priority: options.priority }
    );
  }

  /**
   * Listen for multiple event types
   */
  onMany<T extends EventType>(
    eventTypes: T[],
    handler: EventHandler<T>,
    options: ListenOptions = {}
  ): () => void {
    const unsubscribers = eventTypes.map((type) => this.on(type, handler, options));
    return () => unsubscribers.forEach((unsub) => unsub());
  }

  /**
   * Listen once
   */
  once<T extends EventType>(
    eventType: T,
    handler: EventHandler<T>
  ): () => void {
    const unsubscribe = this.on(eventType, async (event) => {
      unsubscribe();
      await handler(event);
    });
    return unsubscribe;
  }

  /**
   * Register a request handler (auto-replies)
   */
  onRequest<Req extends EventType, Res extends EventType>(
    requestType: Req,
    responseType: Res,
    handler: (event: TypedEvent<Req>) => Promise<EventTypeMap[Res]>
  ): () => void {
    return this.on(requestType, async (event) => {
      try {
        const responsePayload = await handler(event);
        this.reply(event, responseType, responsePayload);
      } catch (error) {
        // Could emit error event here
        console.error(`Request handler error for ${requestType}:`, error);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Agent Presence
  // -------------------------------------------------------------------------

  /**
   * Send heartbeat
   */
  sendHeartbeat(status: 'healthy' | 'degraded' | 'unhealthy', info: HeartbeatInfo): string {
    return this.send('system.agent.heartbeat', {
      agentId: this.agentId,
      status,
      activeSubAgents: info.activeSubAgents || [],
      currentTasks: info.currentTasks || 0,
      queuedTasks: info.queuedTasks || 0,
      resourceUsage: info.resourceUsage || {
        tokensUsed: 0,
        tokenBudget: 0,
        apiCallsLastHour: 0,
      },
      lastActivity: Date.now(),
    });
  }

  /**
   * Report an error
   */
  reportError(error: Error, context?: Record<string, unknown>): string {
    return this.broadcast('system.agent.error', {
      agentId: this.agentId,
      errorType: error.name,
      message: error.message,
      stack: error.stack,
      context,
      recoverable: true,
      timestamp: Date.now(),
    });
  }

  // -------------------------------------------------------------------------
  // Workflow Support
  // -------------------------------------------------------------------------

  /**
   * Start a workflow
   */
  startWorkflow(
    workflowType: string,
    participants: AgentId[],
    input: Record<string, unknown>
  ): string {
    const workflowId = randomUUID();

    this.broadcast('system.workflow.started', {
      workflowId,
      workflowType,
      initiator: this.agentId,
      participants,
      input,
      startedAt: Date.now(),
    });

    return workflowId;
  }

  /**
   * Report workflow step completion
   */
  reportWorkflowStep(
    workflowId: string,
    stepId: string,
    stepName: string,
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped',
    output?: Record<string, unknown>,
    error?: string
  ): string {
    return this.broadcast('system.workflow.step', {
      workflowId,
      stepId,
      stepName,
      status,
      agent: this.agentId,
      output,
      error,
    });
  }

  /**
   * Complete a workflow
   */
  completeWorkflow(
    workflowId: string,
    workflowType: string,
    status: 'completed' | 'failed' | 'cancelled',
    result?: Record<string, unknown>,
    stats?: { duration: number; stepsCompleted: number; stepsFailed: number }
  ): string {
    return this.broadcast('system.workflow.completed', {
      workflowId,
      workflowType,
      status,
      result,
      duration: stats?.duration || 0,
      stepsCompleted: stats?.stepsCompleted || 0,
      stepsFailed: stats?.stepsFailed || 0,
    });
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  private setupDefaultSubscriptions(): void {
    // Listen for responses to pending requests
    this.bus.subscribeWithFilter(
      '*' as EventType,
      async (event) => {
        if (event.meta.correlationId) {
          const pending = this.pendingRequests.get(event.meta.correlationId);
          if (pending && event.type === pending.responseType) {
            pending.resolve(event);
          }
        }
      },
      { target: [this.agentId] }
    );
  }

  private wrapHandler<T extends EventType>(
    handler: EventHandler<T>,
    options: ListenOptions
  ): EventHandler<T> {
    return async (event) => {
      try {
        await handler(event);
      } catch (error) {
        if (options.errorHandler) {
          options.errorHandler(error as Error, event);
        } else {
          console.error(`Handler error for ${event.type}:`, error);
        }
      }
    };
  }

  // -------------------------------------------------------------------------
  // Getters
  // -------------------------------------------------------------------------

  getAgentId(): AgentId {
    return this.agentId;
  }

  getBus(): EventBus {
    return this.bus;
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

interface SendOptions {
  to?: AgentId | SubAgentId | 'broadcast';
  priority?: EventPriority;
  correlationId?: string;
  ttlMs?: number;
}

interface RequestOptions extends Omit<SendOptions, 'to'> {
  timeout?: number;
}

interface ListenOptions {
  priority?: number;
  receiveAll?: boolean;  // Receive events not targeted at this agent
  errorHandler?: (error: Error, event: TypedEvent<EventType>) => void;
}

interface PendingRequest {
  responseType: EventType;
  resolve: (event: TypedEvent<EventType>) => void;
  reject: (error: Error) => void;
}

interface MessageHandler {
  eventType: EventType;
  handler: EventHandler<EventType>;
}

interface HeartbeatInfo {
  activeSubAgents?: SubAgentId[];
  currentTasks?: number;
  queuedTasks?: number;
  resourceUsage?: {
    tokensUsed: number;
    tokenBudget: number;
    apiCallsLastHour: number;
  };
}

// ============================================================================
// Factory Function
// ============================================================================

const channels: Map<AgentId, AgentChannel> = new Map();

export function getAgentChannel(agentId: AgentId, bus?: EventBus): AgentChannel {
  if (!channels.has(agentId)) {
    channels.set(agentId, new AgentChannel(agentId, bus));
  }
  return channels.get(agentId)!;
}

export function resetAgentChannels(): void {
  channels.clear();
}
