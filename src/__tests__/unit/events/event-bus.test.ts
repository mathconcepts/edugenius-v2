/**
 * Unit Tests for Event Bus
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus } from '../../../events/event-bus';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  afterEach(() => {
    eventBus.clear();
  });

  describe('Basic Pub/Sub', () => {
    it('should subscribe to an event', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe('test.event', handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should publish an event', async () => {
      const handler = vi.fn();
      eventBus.subscribe('test.event', handler);

      await eventBus.publish('test.event', { data: 'test' });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should pass payload to handler', async () => {
      const handler = vi.fn();
      eventBus.subscribe('test.event', handler);

      await eventBus.publish('test.event', { value: 42 });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: { value: 42 },
        })
      );
    });

    it('should include event metadata', async () => {
      const handler = vi.fn();
      eventBus.subscribe('test.event', handler);

      await eventBus.publish('test.event', { data: 'test' });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'test.event',
          timestamp: expect.any(Number),
          id: expect.any(String),
        })
      );
    });

    it('should unsubscribe correctly', async () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe('test.event', handler);

      unsubscribe();
      await eventBus.publish('test.event', { data: 'test' });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Multiple Subscribers', () => {
    it('should notify all subscribers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      eventBus.subscribe('test.event', handler1);
      eventBus.subscribe('test.event', handler2);
      eventBus.subscribe('test.event', handler3);

      await eventBus.publish('test.event', { data: 'test' });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    it('should maintain subscription order', async () => {
      const order: number[] = [];

      eventBus.subscribe('test.event', () => order.push(1));
      eventBus.subscribe('test.event', () => order.push(2));
      eventBus.subscribe('test.event', () => order.push(3));

      await eventBus.publish('test.event', {});

      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe('Event Types', () => {
    it('should isolate different event types', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.subscribe('event.type1', handler1);
      eventBus.subscribe('event.type2', handler2);

      await eventBus.publish('event.type1', {});

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should handle hierarchical event names', async () => {
      const handler = vi.fn();
      eventBus.subscribe('agent.scout.trend.found', handler);

      await eventBus.publish('agent.scout.trend.found', { trend: 'test' });

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Wildcard Subscriptions', () => {
    it('should support subscribeAll for wildcard matching', async () => {
      const handler = vi.fn();
      eventBus.subscribeAll('agent.*', handler);

      await eventBus.publish('agent.scout.event', {});
      await eventBus.publish('agent.atlas.event', {});

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should not match unrelated events with wildcard', async () => {
      const handler = vi.fn();
      eventBus.subscribeAll('agent.*', handler);

      await eventBus.publish('other.event', {});

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Once Subscriptions', () => {
    it('should fire once subscription only once', async () => {
      const handler = vi.fn();
      eventBus.once('test.event', handler);

      await eventBus.publish('test.event', {});
      await eventBus.publish('test.event', {});

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Async Handlers', () => {
    it('should wait for async handlers', async () => {
      let completed = false;

      eventBus.subscribe('test.event', async () => {
        await new Promise(r => setTimeout(r, 50));
        completed = true;
      });

      await eventBus.publish('test.event', {});

      expect(completed).toBe(true);
    });

    it('should handle multiple async handlers', async () => {
      const results: number[] = [];

      eventBus.subscribe('test.event', async () => {
        await new Promise(r => setTimeout(r, 30));
        results.push(1);
      });

      eventBus.subscribe('test.event', async () => {
        await new Promise(r => setTimeout(r, 10));
        results.push(2);
      });

      await eventBus.publish('test.event', {});

      expect(results).toContain(1);
      expect(results).toContain(2);
    });
  });

  describe('Error Handling', () => {
    it('should not fail on handler error', async () => {
      eventBus.subscribe('test.event', () => {
        throw new Error('Handler error');
      });

      await expect(
        eventBus.publish('test.event', {})
      ).resolves.not.toThrow();
    });

    it('should continue to other handlers on error', async () => {
      const handler2 = vi.fn();

      eventBus.subscribe('test.event', () => {
        throw new Error('Handler 1 error');
      });
      eventBus.subscribe('test.event', handler2);

      await eventBus.publish('test.event', {});

      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('Clear', () => {
    it('should clear all subscriptions', async () => {
      const handler = vi.fn();
      eventBus.subscribe('test.event', handler);

      eventBus.clear();
      await eventBus.publish('test.event', {});

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle publishing to no subscribers', async () => {
      await expect(
        eventBus.publish('no.subscribers', { data: 'test' })
      ).resolves.not.toThrow();
    });

    it('should handle empty event type', async () => {
      const handler = vi.fn();
      eventBus.subscribe('', handler);

      await eventBus.publish('', {});
      expect(handler).toHaveBeenCalled();
    });

    it('should handle null payload', async () => {
      const handler = vi.fn();
      eventBus.subscribe('test.event', handler);

      await eventBus.publish('test.event', null);
      expect(handler).toHaveBeenCalled();
    });

    it('should handle undefined payload', async () => {
      const handler = vi.fn();
      eventBus.subscribe('test.event', handler);

      await eventBus.publish('test.event', undefined);
      expect(handler).toHaveBeenCalled();
    });

    it('should handle very long event names', async () => {
      const longName = 'event.' + 'x'.repeat(1000);
      const handler = vi.fn();

      eventBus.subscribe(longName, handler);
      await eventBus.publish(longName, {});

      expect(handler).toHaveBeenCalled();
    });

    it('should handle high frequency events', async () => {
      const handler = vi.fn();
      eventBus.subscribe('test.event', handler);

      const promises = Array(100).fill(null).map(() =>
        eventBus.publish('test.event', {})
      );

      await Promise.all(promises);

      expect(handler).toHaveBeenCalledTimes(100);
    });

    it('should handle concurrent subscribe/publish', async () => {
      const handlers: (() => void)[] = [];
      
      for (let i = 0; i < 10; i++) {
        const handler = vi.fn();
        handlers.push(handler);
        eventBus.subscribe(`event.${i}`, handler);
      }

      const publishPromises = Array(10).fill(null).map((_, i) =>
        eventBus.publish(`event.${i}`, {})
      );

      await Promise.all(publishPromises);

      handlers.forEach(h => {
        expect(h).toHaveBeenCalledTimes(1);
      });
    });
  });
});

describe('EventBus Performance', () => {
  it('should handle many subscriptions efficiently', () => {
    const eventBus = new EventBus();
    const start = Date.now();

    for (let i = 0; i < 1000; i++) {
      eventBus.subscribe(`event.${i}`, () => {});
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000); // Should complete in under 1 second

    eventBus.clear();
  });

  it('should handle rapid publish efficiently', async () => {
    const eventBus = new EventBus();
    eventBus.subscribe('test.event', () => {});

    const start = Date.now();

    for (let i = 0; i < 1000; i++) {
      await eventBus.publish('test.event', { i });
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000); // Should complete in under 5 seconds

    eventBus.clear();
  });
});
