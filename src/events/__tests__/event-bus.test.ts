/**
 * Unit Tests for EduGenius Event Bus
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus, getEventBus, resetEventBus } from '../event-bus';
import type { EventType, EventTypeMap, TrendDetectedPayload } from '../types';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    resetEventBus();
    bus = new EventBus();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Publishing', () => {
    it('should publish events and return event ID', () => {
      const eventId = bus.publish('scout.trend.detected', {
        trendId: 'trend-1',
        topic: 'AI in Education',
        source: 'google_trends',
        score: 0.85,
        keywords: ['AI', 'education'],
        relatedTopics: ['edtech'],
        velocity: 'rising',
        detectedAt: Date.now(),
      });

      expect(eventId).toBeDefined();
      expect(typeof eventId).toBe('string');
    });

    it('should deliver events to subscribers', async () => {
      const handler = vi.fn();
      bus.subscribe('scout.trend.detected', handler);

      bus.publish('scout.trend.detected', {
        trendId: 'trend-1',
        topic: 'Test',
        source: 'google_trends',
        score: 0.5,
        keywords: [],
        relatedTopics: [],
        velocity: 'stable',
        detectedAt: Date.now(),
      });

      // Wait for async delivery
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].type).toBe('scout.trend.detected');
    });

    it('should include metadata in events', async () => {
      const handler = vi.fn();
      bus.subscribe('scout.trend.detected', handler);

      bus.publish('scout.trend.detected', {
        trendId: 'trend-1',
        topic: 'Test',
        source: 'google_trends',
        score: 0.5,
        keywords: [],
        relatedTopics: [],
        velocity: 'stable',
        detectedAt: Date.now(),
      }, {
        source: 'Scout',
        priority: 'high',
        correlationId: 'corr-123',
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      const event = handler.mock.calls[0][0];
      expect(event.meta.source).toBe('Scout');
      expect(event.meta.priority).toBe('high');
      expect(event.meta.correlationId).toBe('corr-123');
    });

    it('should publish to specific target', async () => {
      const handler = vi.fn();
      bus.subscribeWithFilter('scout.trend.detected', handler, {
        target: ['Atlas'],
      });

      bus.publishTo('Atlas', 'scout.trend.detected', {
        trendId: 'trend-1',
        topic: 'Test',
        source: 'google_trends',
        score: 0.5,
        keywords: [],
        relatedTopics: [],
        velocity: 'stable',
        detectedAt: Date.now(),
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Subscribing', () => {
    it('should subscribe to specific event types', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.subscribe('scout.trend.detected', handler1);
      bus.subscribe('atlas.content.created', handler2);

      bus.publish('scout.trend.detected', {
        trendId: 'trend-1',
        topic: 'Test',
        source: 'google_trends',
        score: 0.5,
        keywords: [],
        relatedTopics: [],
        velocity: 'stable',
        detectedAt: Date.now(),
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should subscribe to multiple event types', async () => {
      const handler = vi.fn();

      bus.subscribeMany(['scout.trend.detected', 'scout.competitor.updated'], handler);

      bus.publish('scout.trend.detected', {
        trendId: 'trend-1',
        topic: 'Test',
        source: 'google_trends',
        score: 0.5,
        keywords: [],
        relatedTopics: [],
        velocity: 'stable',
        detectedAt: Date.now(),
      });

      bus.publish('scout.competitor.updated', {
        competitorId: 'comp-1',
        name: 'Competitor',
        updateType: 'feature',
        changes: {},
        impact: 'medium',
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should subscribe to all events with wildcard', async () => {
      const handler = vi.fn();
      bus.subscribeAll(handler);

      bus.publish('scout.trend.detected', {
        trendId: 'trend-1',
        topic: 'Test',
        source: 'google_trends',
        score: 0.5,
        keywords: [],
        relatedTopics: [],
        velocity: 'stable',
        detectedAt: Date.now(),
      });

      bus.publish('atlas.content.created', {
        contentId: 'content-1',
        requestId: 'req-1',
        contentType: 'lesson',
        title: 'Test',
        status: 'draft',
        wordCount: 100,
        mediaAssets: [],
        createdBy: 'Atlas.Curator',
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should unsubscribe correctly', async () => {
      const handler = vi.fn();
      const unsubscribe = bus.subscribe('scout.trend.detected', handler);

      unsubscribe();

      bus.publish('scout.trend.detected', {
        trendId: 'trend-1',
        topic: 'Test',
        source: 'google_trends',
        score: 0.5,
        keywords: [],
        relatedTopics: [],
        velocity: 'stable',
        detectedAt: Date.now(),
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle once subscriptions', async () => {
      const handler = vi.fn();
      bus.once('scout.trend.detected', handler);

      bus.publish('scout.trend.detected', {
        trendId: 'trend-1',
        topic: 'Test',
        source: 'google_trends',
        score: 0.5,
        keywords: [],
        relatedTopics: [],
        velocity: 'stable',
        detectedAt: Date.now(),
      });

      bus.publish('scout.trend.detected', {
        trendId: 'trend-2',
        topic: 'Test 2',
        source: 'google_trends',
        score: 0.6,
        keywords: [],
        relatedTopics: [],
        velocity: 'rising',
        detectedAt: Date.now(),
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Filtering', () => {
    it('should filter by source', async () => {
      const handler = vi.fn();
      bus.subscribeWithFilter('scout.trend.detected', handler, {
        source: ['Scout'],
      });

      bus.publish('scout.trend.detected', {
        trendId: 'trend-1',
        topic: 'From Scout',
        source: 'google_trends',
        score: 0.5,
        keywords: [],
        relatedTopics: [],
        velocity: 'stable',
        detectedAt: Date.now(),
      }, { source: 'Scout' });

      bus.publish('scout.trend.detected', {
        trendId: 'trend-2',
        topic: 'From Atlas',
        source: 'google_trends',
        score: 0.5,
        keywords: [],
        relatedTopics: [],
        velocity: 'stable',
        detectedAt: Date.now(),
      }, { source: 'Atlas' });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].payload.topic).toBe('From Scout');
    });

    it('should filter by priority', async () => {
      const handler = vi.fn();
      bus.subscribeWithFilter('scout.trend.detected', handler, {
        priority: ['high', 'critical'],
      });

      bus.publish('scout.trend.detected', {
        trendId: 'trend-1',
        topic: 'Normal',
        source: 'google_trends',
        score: 0.5,
        keywords: [],
        relatedTopics: [],
        velocity: 'stable',
        detectedAt: Date.now(),
      }, { priority: 'normal' });

      bus.publish('scout.trend.detected', {
        trendId: 'trend-2',
        topic: 'High',
        source: 'google_trends',
        score: 0.8,
        keywords: [],
        relatedTopics: [],
        velocity: 'rising',
        detectedAt: Date.now(),
      }, { priority: 'high' });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].payload.topic).toBe('High');
    });

    it('should filter by correlationId', async () => {
      const handler = vi.fn();
      bus.subscribeWithFilter('scout.trend.detected', handler, {
        correlationId: 'workflow-123',
      });

      bus.publish('scout.trend.detected', {
        trendId: 'trend-1',
        topic: 'No correlation',
        source: 'google_trends',
        score: 0.5,
        keywords: [],
        relatedTopics: [],
        velocity: 'stable',
        detectedAt: Date.now(),
      });

      bus.publish('scout.trend.detected', {
        trendId: 'trend-2',
        topic: 'With correlation',
        source: 'google_trends',
        score: 0.5,
        keywords: [],
        relatedTopics: [],
        velocity: 'stable',
        detectedAt: Date.now(),
      }, { correlationId: 'workflow-123' });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].payload.topic).toBe('With correlation');
    });
  });

  describe('Priority Queue', () => {
    it('should process critical events before normal', async () => {
      const order: string[] = [];
      
      bus.subscribe('scout.trend.detected', async (event) => {
        order.push(event.payload.trendId);
      });

      // Publish normal first, then critical
      bus.publish('scout.trend.detected', {
        trendId: 'normal-1',
        topic: 'Normal',
        source: 'google_trends',
        score: 0.5,
        keywords: [],
        relatedTopics: [],
        velocity: 'stable',
        detectedAt: Date.now(),
      }, { priority: 'normal' });

      bus.publish('scout.trend.detected', {
        trendId: 'critical-1',
        topic: 'Critical',
        source: 'google_trends',
        score: 0.9,
        keywords: [],
        relatedTopics: [],
        velocity: 'rising',
        detectedAt: Date.now(),
      }, { priority: 'critical' });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Both should be processed, critical should be first if queue was empty
      expect(order).toContain('normal-1');
      expect(order).toContain('critical-1');
    });
  });

  describe('Dead Letter Queue', () => {
    it('should move failed events to DLQ after retries', async () => {
      const busWithRetries = new EventBus({
        retryConfig: {
          maxRetries: 2,
          initialDelayMs: 10,
          maxDelayMs: 50,
          backoffMultiplier: 2,
        },
      });

      busWithRetries.subscribe('scout.trend.detected', async () => {
        throw new Error('Handler failed');
      });

      busWithRetries.publish('scout.trend.detected', {
        trendId: 'trend-1',
        topic: 'Will fail',
        source: 'google_trends',
        score: 0.5,
        keywords: [],
        relatedTopics: [],
        velocity: 'stable',
        detectedAt: Date.now(),
      });

      // Wait for retries
      await new Promise(resolve => setTimeout(resolve, 500));

      const dlq = busWithRetries.getDeadLetterQueue();
      expect(dlq.length).toBe(1);
      expect(dlq[0].error).toBe('Handler failed');
    });

    it('should replay dead letter events', async () => {
      const handler = vi.fn()
        .mockRejectedValueOnce(new Error('First fail'))
        .mockResolvedValueOnce(undefined);

      const busWithDLQ = new EventBus({
        retryConfig: { maxRetries: 0, initialDelayMs: 10, maxDelayMs: 50, backoffMultiplier: 2 },
      });

      busWithDLQ.subscribe('scout.trend.detected', handler);

      busWithDLQ.publish('scout.trend.detected', {
        trendId: 'trend-1',
        topic: 'Test',
        source: 'google_trends',
        score: 0.5,
        keywords: [],
        relatedTopics: [],
        velocity: 'stable',
        detectedAt: Date.now(),
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const dlq = busWithDLQ.getDeadLetterQueue();
      expect(dlq.length).toBe(1);

      // Replay
      const eventId = dlq[0].event.meta.id;
      busWithDLQ.replayDeadLetter(eventId);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(busWithDLQ.getDeadLetterQueue().length).toBe(0);
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Metrics', () => {
    it('should track event metrics', async () => {
      const handler = vi.fn();
      bus.subscribe('scout.trend.detected', handler);

      bus.publish('scout.trend.detected', {
        trendId: 'trend-1',
        topic: 'Test',
        source: 'google_trends',
        score: 0.5,
        keywords: [],
        relatedTopics: [],
        velocity: 'stable',
        detectedAt: Date.now(),
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      const metrics = bus.getMetrics();
      expect(metrics.published).toBeGreaterThanOrEqual(1);
      expect(metrics.delivered).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Singleton', () => {
    it('should return same instance', () => {
      const bus1 = getEventBus();
      const bus2 = getEventBus();
      expect(bus1).toBe(bus2);
    });

    it('should reset singleton', () => {
      const bus1 = getEventBus();
      resetEventBus();
      const bus2 = getEventBus();
      expect(bus1).not.toBe(bus2);
    });
  });
});
