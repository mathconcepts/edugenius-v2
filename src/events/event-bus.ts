// @ts-nocheck
/**
 * EduGenius Event Bus - Core Implementation
 * Provides typed pub/sub messaging between agents
 */

import { randomUUID } from 'crypto';
import {
  EventType,
  EventTypeMap,
  TypedEvent,
  EventHandler,
  EventSubscription,
  EventFilter,
  SubscriptionOptions,
  EventMetadata,
  EventBusConfig,
  defaultEventBusConfig,
  EventPriority,
  AgentId,
  SubAgentId,
  EventStatus,
} from './types';

// ============================================================================
// Event Bus Implementation
// ============================================================================

export class EventBus {
  private subscriptions: Map<string, EventSubscription> = new Map();
  private eventQueue: QueuedEvent[] = [];
  private processing = false;
  private deadLetterQueue: FailedEvent[] = [];
  private metrics: EventMetrics;
  private config: EventBusConfig;

  constructor(config: Partial<EventBusConfig> = {}) {
    this.config = { ...defaultEventBusConfig, ...config };
    this.metrics = new EventMetrics(this.config.metrics.sampleRate);
  }

  // -------------------------------------------------------------------------
  // Publishing
  // -------------------------------------------------------------------------

  /**
   * Publish a typed event
   */
  publish<T extends EventType>(
    type: T,
    payload: EventTypeMap[T],
    options: Partial<EventMetadata> = {}
  ): string {
    const eventId = randomUUID();
    
    const meta: EventMetadata = {
      id: eventId,
      timestamp: Date.now(),
      source: options.source || ('system' as AgentId),
      target: options.target,
      priority: options.priority || 'normal',
      correlationId: options.correlationId,
      causationId: options.causationId,
      ttlMs: options.ttlMs || this.config.defaultTTL,
      retryCount: 0,
      maxRetries: options.maxRetries ?? this.config.retryConfig.maxRetries,
    };

    const event: TypedEvent<T> = { type, payload, meta };

    this.enqueue(event);
    this.metrics.recordPublish(type);

    return eventId;
  }

  /**
   * Publish and wait for all handlers to complete
   */
  async publishAndWait<T extends EventType>(
    type: T,
    payload: EventTypeMap[T],
    options: Partial<EventMetadata> = {}
  ): Promise<void> {
    const eventId = this.publish(type, payload, options);
    await this.waitForEvent(eventId);
  }

  /**
   * Publish to a specific agent
   */
  publishTo<T extends EventType>(
    target: AgentId | SubAgentId,
    type: T,
    payload: EventTypeMap[T],
    options: Partial<EventMetadata> = {}
  ): string {
    return this.publish(type, payload, { ...options, target });
  }

  /**
   * Broadcast to all agents
   */
  broadcast<T extends EventType>(
    type: T,
    payload: EventTypeMap[T],
    options: Partial<EventMetadata> = {}
  ): string {
    return this.publish(type, payload, { ...options, target: 'broadcast' });
  }

  // -------------------------------------------------------------------------
  // Subscribing
  // -------------------------------------------------------------------------

  /**
   * Subscribe to a specific event type
   */
  subscribe<T extends EventType>(
    eventType: T,
    handler: EventHandler<T>,
    options: SubscriptionOptions = {}
  ): () => void {
    const subscription: EventSubscription = {
      id: randomUUID(),
      eventType,
      handler,
      options,
    };

    this.subscriptions.set(subscription.id, subscription);
    this.metrics.recordSubscription(eventType);

    // Return unsubscribe function
    return () => this.unsubscribe(subscription.id);
  }

  /**
   * Subscribe to multiple event types
   */
  subscribeMany<T extends EventType>(
    eventTypes: T[],
    handler: EventHandler<T>,
    options: SubscriptionOptions = {}
  ): () => void {
    const subscription: EventSubscription = {
      id: randomUUID(),
      eventType: eventTypes,
      handler,
      options,
    };

    this.subscriptions.set(subscription.id, subscription);
    
    for (const type of eventTypes) {
      this.metrics.recordSubscription(type);
    }

    return () => this.unsubscribe(subscription.id);
  }

  /**
   * Subscribe to all events (wildcard)
   */
  subscribeAll(
    handler: EventHandler<EventType>,
    options: SubscriptionOptions = {}
  ): () => void {
    const subscription: EventSubscription = {
      id: randomUUID(),
      eventType: '*',
      handler,
      options,
    };

    this.subscriptions.set(subscription.id, subscription);
    return () => this.unsubscribe(subscription.id);
  }

  /**
   * Subscribe with filter
   */
  subscribeWithFilter<T extends EventType>(
    eventType: T,
    handler: EventHandler<T>,
    filter: EventFilter,
    options: SubscriptionOptions = {}
  ): () => void {
    const subscription: EventSubscription = {
      id: randomUUID(),
      eventType,
      handler,
      filter,
      options,
    };

    this.subscriptions.set(subscription.id, subscription);
    this.metrics.recordSubscription(eventType);

    return () => this.unsubscribe(subscription.id);
  }

  /**
   * Subscribe once (auto-unsubscribe after first event)
   */
  once<T extends EventType>(
    eventType: T,
    handler: EventHandler<T>
  ): () => void {
    return this.subscribe(eventType, handler, { once: true });
  }

  /**
   * Unsubscribe by subscription ID
   */
  unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  // -------------------------------------------------------------------------
  // Queue Processing
  // -------------------------------------------------------------------------

  private enqueue(event: TypedEvent<EventType>): void {
    if (this.eventQueue.length >= this.config.maxQueueSize) {
      this.handleQueueOverflow(event);
      return;
    }

    const queuedEvent: QueuedEvent = {
      event,
      status: 'pending',
      enqueuedAt: Date.now(),
    };

    // Insert by priority
    const insertIndex = this.findInsertIndex(event.meta.priority);
    this.eventQueue.splice(insertIndex, 0, queuedEvent);

    // Start processing if not already
    if (!this.processing) {
      this.processQueue();
    }
  }

  private findInsertIndex(priority: EventPriority): number {
    const priorityOrder: EventPriority[] = ['critical', 'high', 'normal', 'low'];
    const targetPriorityIndex = priorityOrder.indexOf(priority);

    for (let i = 0; i < this.eventQueue.length; i++) {
      const currentPriorityIndex = priorityOrder.indexOf(
        this.eventQueue[i].event.meta.priority
      );
      if (currentPriorityIndex > targetPriorityIndex) {
        return i;
      }
    }

    return this.eventQueue.length;
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.eventQueue.length > 0) {
      const queuedEvent = this.eventQueue.shift();
      if (!queuedEvent) break;

      // Check TTL
      if (this.isExpired(queuedEvent)) {
        this.metrics.recordExpired(queuedEvent.event.type);
        continue;
      }

      queuedEvent.status = 'processing';
      const startTime = Date.now();

      try {
        await this.deliverEvent(queuedEvent.event);
        queuedEvent.status = 'completed';
        this.metrics.recordDelivery(queuedEvent.event.type, Date.now() - startTime);
      } catch (error) {
        await this.handleDeliveryFailure(queuedEvent, error as Error);
      }
    }

    this.processing = false;
  }

  private isExpired(queuedEvent: QueuedEvent): boolean {
    const ttl = queuedEvent.event.meta.ttlMs || this.config.defaultTTL;
    return Date.now() - queuedEvent.enqueuedAt > ttl;
  }

  private async deliverEvent(event: TypedEvent<EventType>): Promise<void> {
    const handlers = this.getMatchingHandlers(event);
    
    if (handlers.length === 0) {
      this.metrics.recordNoHandler(event.type);
      return;
    }

    // Sort by priority
    handlers.sort((a, b) => (b.options?.priority || 0) - (a.options?.priority || 0));

    const promises = handlers.map(async (subscription) => {
      try {
        const timeout = subscription.options?.timeout;
        if (timeout) {
          await Promise.race([
            subscription.handler(event),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Handler timeout')), timeout)
            ),
          ]);
        } else {
          await subscription.handler(event);
        }

        // Handle once subscriptions
        if (subscription.options?.once) {
          this.unsubscribe(subscription.id);
        }
      } catch (error) {
        this.metrics.recordHandlerError(event.type, subscription.id);
        throw error;
      }
    });

    await Promise.all(promises);
  }

  private getMatchingHandlers(event: TypedEvent<EventType>): EventSubscription[] {
    const matching: EventSubscription[] = [];

    for (const subscription of this.subscriptions.values()) {
      if (!this.matchesEventType(subscription, event.type)) {
        continue;
      }

      if (subscription.filter && !this.matchesFilter(subscription.filter, event)) {
        continue;
      }

      matching.push(subscription);
    }

    return matching;
  }

  private matchesEventType(subscription: EventSubscription, eventType: EventType): boolean {
    if (subscription.eventType === '*') return true;
    if (Array.isArray(subscription.eventType)) {
      return subscription.eventType.includes(eventType);
    }
    return subscription.eventType === eventType;
  }

  private matchesFilter(filter: EventFilter, event: TypedEvent<EventType>): boolean {
    const { source, target, priority, correlationId } = filter;
    const meta = event.meta;

    if (source) {
      const sources = Array.isArray(source) ? source : [source];
      if (!sources.includes(meta.source as AgentId)) return false;
    }

    if (target) {
      const targets = Array.isArray(target) ? target : [target];
      if (!targets.includes(meta.target as AgentId)) return false;
    }

    if (priority) {
      const priorities = Array.isArray(priority) ? priority : [priority];
      if (!priorities.includes(meta.priority)) return false;
    }

    if (correlationId && meta.correlationId !== correlationId) {
      return false;
    }

    return true;
  }

  private async handleDeliveryFailure(
    queuedEvent: QueuedEvent,
    error: Error
  ): Promise<void> {
    const event = queuedEvent.event;
    const retryCount = event.meta.retryCount || 0;
    const maxRetries = event.meta.maxRetries ?? this.config.retryConfig.maxRetries;

    if (retryCount < maxRetries) {
      // Schedule retry with exponential backoff
      const delay = this.calculateRetryDelay(retryCount);
      event.meta.retryCount = retryCount + 1;

      setTimeout(() => {
        this.enqueue(event);
      }, delay);

      this.metrics.recordRetry(event.type);
    } else {
      // Move to dead letter queue
      queuedEvent.status = 'failed';
      
      if (this.config.deadLetterQueue) {
        this.deadLetterQueue.push({
          event,
          error: error.message,
          failedAt: Date.now(),
        });
      }

      this.metrics.recordDeadLetter(event.type);
    }
  }

  private calculateRetryDelay(retryCount: number): number {
    const { initialDelayMs, maxDelayMs, backoffMultiplier } = this.config.retryConfig;
    const delay = initialDelayMs * Math.pow(backoffMultiplier, retryCount);
    return Math.min(delay, maxDelayMs);
  }

  private handleQueueOverflow(event: TypedEvent<EventType>): void {
    // Drop low priority events first
    const lowPriorityIndex = this.eventQueue.findIndex(
      (e) => e.event.meta.priority === 'low'
    );

    if (lowPriorityIndex >= 0) {
      const dropped = this.eventQueue.splice(lowPriorityIndex, 1)[0];
      this.metrics.recordDropped(dropped.event.type);
      this.enqueue(event);
    } else if (event.meta.priority === 'critical') {
      // For critical events, drop oldest normal priority
      const normalIndex = this.eventQueue.findIndex(
        (e) => e.event.meta.priority === 'normal'
      );
      if (normalIndex >= 0) {
        const dropped = this.eventQueue.splice(normalIndex, 1)[0];
        this.metrics.recordDropped(dropped.event.type);
        this.enqueue(event);
      }
    }

    this.metrics.recordOverflow();
  }

  private async waitForEvent(eventId: string, timeoutMs = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const inQueue = this.eventQueue.some((e) => e.event.meta.id === eventId);
      if (!inQueue) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Timeout waiting for event ${eventId}`);
  }

  // -------------------------------------------------------------------------
  // Management
  // -------------------------------------------------------------------------

  /**
   * Get dead letter queue contents
   */
  getDeadLetterQueue(): FailedEvent[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Replay a dead letter event
   */
  replayDeadLetter(eventId: string): boolean {
    const index = this.deadLetterQueue.findIndex(
      (e) => e.event.meta.id === eventId
    );
    
    if (index === -1) return false;

    const [failed] = this.deadLetterQueue.splice(index, 1);
    failed.event.meta.retryCount = 0;
    this.enqueue(failed.event);
    return true;
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetterQueue(): void {
    this.deadLetterQueue = [];
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.eventQueue.length;
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get metrics
   */
  getMetrics(): EventMetricsSummary {
    return this.metrics.getSummary();
  }

  /**
   * Clear all subscriptions
   */
  clearSubscriptions(): void {
    this.subscriptions.clear();
  }

  /**
   * Shutdown the event bus
   */
  async shutdown(): Promise<void> {
    // Wait for queue to drain
    while (this.eventQueue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    this.clearSubscriptions();
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

interface QueuedEvent {
  event: TypedEvent<EventType>;
  status: EventStatus;
  enqueuedAt: number;
}

interface FailedEvent {
  event: TypedEvent<EventType>;
  error: string;
  failedAt: number;
}

interface EventMetricsSummary {
  published: number;
  delivered: number;
  failed: number;
  retried: number;
  expired: number;
  dropped: number;
  avgDeliveryTimeMs: number;
  queueOverflows: number;
  byEventType: Record<string, { published: number; delivered: number; failed: number }>;
}

// ============================================================================
// Metrics
// ============================================================================

class EventMetrics {
  private published = 0;
  private delivered = 0;
  private failed = 0;
  private retried = 0;
  private expired = 0;
  private dropped = 0;
  private deliveryTimes: number[] = [];
  private queueOverflows = 0;
  private byEventType: Map<string, { published: number; delivered: number; failed: number }> = new Map();
  private sampleRate: number;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  private shouldSample(): boolean {
    return Math.random() < this.sampleRate;
  }

  recordPublish(eventType: string): void {
    this.published++;
    this.getOrCreateTypeMetrics(eventType).published++;
  }

  recordDelivery(eventType: string, durationMs: number): void {
    this.delivered++;
    this.getOrCreateTypeMetrics(eventType).delivered++;
    if (this.shouldSample()) {
      this.deliveryTimes.push(durationMs);
      if (this.deliveryTimes.length > 1000) {
        this.deliveryTimes.shift();
      }
    }
  }

  recordHandlerError(eventType: string, _subscriptionId: string): void {
    this.failed++;
    this.getOrCreateTypeMetrics(eventType).failed++;
  }

  recordRetry(eventType: string): void {
    this.retried++;
  }

  recordExpired(eventType: string): void {
    this.expired++;
  }

  recordDropped(eventType: string): void {
    this.dropped++;
  }

  recordDeadLetter(eventType: string): void {
    this.failed++;
    this.getOrCreateTypeMetrics(eventType).failed++;
  }

  recordNoHandler(eventType: string): void {
    // Track events with no handlers if needed
  }

  recordOverflow(): void {
    this.queueOverflows++;
  }

  recordSubscription(eventType: string): void {
    // Track subscription metrics if needed
  }

  private getOrCreateTypeMetrics(eventType: string) {
    if (!this.byEventType.has(eventType)) {
      this.byEventType.set(eventType, { published: 0, delivered: 0, failed: 0 });
    }
    return this.byEventType.get(eventType)!;
  }

  getSummary(): EventMetricsSummary {
    const avgDeliveryTimeMs =
      this.deliveryTimes.length > 0
        ? this.deliveryTimes.reduce((a, b) => a + b, 0) / this.deliveryTimes.length
        : 0;

    return {
      published: this.published,
      delivered: this.delivered,
      failed: this.failed,
      retried: this.retried,
      expired: this.expired,
      dropped: this.dropped,
      avgDeliveryTimeMs,
      queueOverflows: this.queueOverflows,
      byEventType: Object.fromEntries(this.byEventType),
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let eventBusInstance: EventBus | null = null;

export function getEventBus(config?: Partial<EventBusConfig>): EventBus {
  if (!eventBusInstance) {
    eventBusInstance = new EventBus(config);
  }
  return eventBusInstance;
}

export function resetEventBus(): void {
  eventBusInstance = null;
}
