/**
 * Unit Tests for EduGenius Cache
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InMemoryCache, CacheManager, RateLimiter, getCacheManager, resetCacheManager } from '../cache';

describe('InMemoryCache', () => {
  let cache: InMemoryCache;

  beforeEach(() => {
    cache = new InMemoryCache(300);
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('Basic Operations', () => {
    it('should set and get values', async () => {
      await cache.set('key1', 'value1');
      const value = await cache.get('key1');
      expect(value).toBe('value1');
    });

    it('should return null for non-existent keys', async () => {
      const value = await cache.get('non-existent');
      expect(value).toBeNull();
    });

    it('should delete values', async () => {
      await cache.set('key1', 'value1');
      await cache.delete('key1');
      const value = await cache.get('key1');
      expect(value).toBeNull();
    });

    it('should check existence', async () => {
      await cache.set('exists', true);
      expect(await cache.exists('exists')).toBe(true);
      expect(await cache.exists('not-exists')).toBe(false);
    });

    it('should handle complex objects', async () => {
      const obj = { name: 'test', nested: { value: 123 } };
      await cache.set('obj', obj);
      const retrieved = await cache.get<typeof obj>('obj');
      expect(retrieved).toEqual(obj);
    });
  });

  describe('TTL', () => {
    it('should expire values after TTL', async () => {
      vi.useFakeTimers();
      
      await cache.set('expiring', 'value', 1); // 1 second TTL
      
      // Should exist initially
      expect(await cache.get('expiring')).toBe('value');
      
      // Advance time past TTL
      vi.advanceTimersByTime(1500);
      
      // Should be expired
      expect(await cache.get('expiring')).toBeNull();
      
      vi.useRealTimers();
    });

    it('should return TTL for key', async () => {
      await cache.set('withTTL', 'value', 60);
      const ttl = await cache.ttl('withTTL');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    });

    it('should update TTL with expire', async () => {
      await cache.set('key', 'value', 60);
      await cache.expire('key', 120);
      const ttl = await cache.ttl('key');
      expect(ttl).toBeGreaterThan(60);
    });
  });

  describe('Pattern Operations', () => {
    it('should delete by pattern', async () => {
      await cache.set('prefix:a', 1);
      await cache.set('prefix:b', 2);
      await cache.set('other:c', 3);

      await cache.deletePattern('prefix:*');

      expect(await cache.get('prefix:a')).toBeNull();
      expect(await cache.get('prefix:b')).toBeNull();
      expect(await cache.get('other:c')).toBe(3);
    });

    it('should list keys by pattern', async () => {
      await cache.set('users:1', 'a');
      await cache.set('users:2', 'b');
      await cache.set('posts:1', 'c');

      const userKeys = await cache.keys('users:*');
      expect(userKeys).toHaveLength(2);
      expect(userKeys).toContain('users:1');
      expect(userKeys).toContain('users:2');
    });
  });

  describe('Increment/Decrement', () => {
    it('should increment values', async () => {
      await cache.set('counter', 0);
      expect(await cache.increment('counter')).toBe(1);
      expect(await cache.increment('counter', 5)).toBe(6);
    });

    it('should decrement values', async () => {
      await cache.set('counter', 10);
      expect(await cache.decrement('counter')).toBe(9);
      expect(await cache.decrement('counter', 3)).toBe(6);
    });

    it('should start from 0 if key does not exist', async () => {
      expect(await cache.increment('new-counter')).toBe(1);
    });
  });

  describe('Hash Operations', () => {
    it('should set and get hash fields', async () => {
      await cache.hset('user:1', 'name', 'John');
      await cache.hset('user:1', 'age', 25);

      expect(await cache.hget('user:1', 'name')).toBe('John');
      expect(await cache.hget('user:1', 'age')).toBe(25);
    });

    it('should get all hash fields', async () => {
      await cache.hset('user:1', 'name', 'John');
      await cache.hset('user:1', 'age', 25);

      const hash = await cache.hgetall('user:1');
      expect(hash).toEqual({ name: 'John', age: 25 });
    });

    it('should delete hash fields', async () => {
      await cache.hset('user:1', 'name', 'John');
      await cache.hset('user:1', 'age', 25);

      const deleted = await cache.hdel('user:1', 'age');
      expect(deleted).toBe(1);

      expect(await cache.hget('user:1', 'age')).toBeNull();
      expect(await cache.hget('user:1', 'name')).toBe('John');
    });

    it('should increment hash field', async () => {
      await cache.hset('stats', 'views', 100);
      const newValue = await cache.hincrby('stats', 'views', 5);
      expect(newValue).toBe(105);
    });
  });

  describe('List Operations', () => {
    it('should push and pop from left', async () => {
      await cache.lpush('list', 'a', 'b', 'c');
      expect(await cache.lpop('list')).toBe('c');
      expect(await cache.lpop('list')).toBe('b');
    });

    it('should push and pop from right', async () => {
      await cache.rpush('list', 'a', 'b', 'c');
      expect(await cache.rpop('list')).toBe('c');
      expect(await cache.rpop('list')).toBe('b');
    });

    it('should get list range', async () => {
      await cache.rpush('list', 'a', 'b', 'c', 'd', 'e');
      expect(await cache.lrange('list', 0, 2)).toEqual(['a', 'b', 'c']);
      expect(await cache.lrange('list', -3, -1)).toEqual(['c', 'd', 'e']);
    });

    it('should get list length', async () => {
      await cache.rpush('list', 'a', 'b', 'c');
      expect(await cache.llen('list')).toBe(3);
    });
  });

  describe('Set Operations', () => {
    it('should add and check members', async () => {
      await cache.sadd('tags', 'a', 'b', 'c');
      expect(await cache.sismember('tags', 'a')).toBe(true);
      expect(await cache.sismember('tags', 'd')).toBe(false);
    });

    it('should get all members', async () => {
      await cache.sadd('tags', 'a', 'b', 'c');
      const members = await cache.smembers('tags');
      expect(members).toHaveLength(3);
      expect(members).toContain('a');
    });

    it('should remove members', async () => {
      await cache.sadd('tags', 'a', 'b', 'c');
      const removed = await cache.srem('tags', 'b', 'c');
      expect(removed).toBe(2);
      expect(await cache.smembers('tags')).toEqual(['a']);
    });

    it('should get cardinality', async () => {
      await cache.sadd('tags', 'a', 'b', 'c');
      expect(await cache.scard('tags')).toBe(3);
    });

    it('should not add duplicates', async () => {
      await cache.sadd('tags', 'a', 'a', 'b');
      expect(await cache.scard('tags')).toBe(2);
    });
  });

  describe('Sorted Set Operations', () => {
    it('should add and get by rank', async () => {
      await cache.zadd('leaderboard',
        { score: 100, member: 'alice' },
        { score: 200, member: 'bob' },
        { score: 150, member: 'charlie' }
      );

      const top = await cache.zrange('leaderboard', 0, -1);
      expect(top).toEqual(['alice', 'charlie', 'bob']);
    });

    it('should get scores', async () => {
      await cache.zadd('leaderboard', { score: 100, member: 'alice' });
      expect(await cache.zscore('leaderboard', 'alice')).toBe(100);
    });

    it('should get rank', async () => {
      await cache.zadd('leaderboard',
        { score: 100, member: 'alice' },
        { score: 200, member: 'bob' }
      );
      expect(await cache.zrank('leaderboard', 'alice')).toBe(0);
      expect(await cache.zrank('leaderboard', 'bob')).toBe(1);
    });

    it('should update score for existing member', async () => {
      await cache.zadd('leaderboard', { score: 100, member: 'alice' });
      await cache.zadd('leaderboard', { score: 150, member: 'alice' });
      expect(await cache.zscore('leaderboard', 'alice')).toBe(150);
    });

    it('should remove members', async () => {
      await cache.zadd('leaderboard',
        { score: 100, member: 'alice' },
        { score: 200, member: 'bob' }
      );
      await cache.zrem('leaderboard', 'alice');
      expect(await cache.zcard('leaderboard')).toBe(1);
    });
  });

  describe('Multiple Operations', () => {
    it('should get multiple values', async () => {
      await cache.set('k1', 'v1');
      await cache.set('k2', 'v2');
      await cache.set('k3', 'v3');

      const values = await cache.getMultiple(['k1', 'k2', 'k4']);
      expect(values).toEqual(['v1', 'v2', null]);
    });

    it('should set multiple values', async () => {
      await cache.setMultiple([
        { key: 'k1', value: 'v1' },
        { key: 'k2', value: 'v2', ttl: 60 },
      ]);

      expect(await cache.get('k1')).toBe('v1');
      expect(await cache.get('k2')).toBe('v2');
    });
  });
});

describe('CacheManager', () => {
  beforeEach(() => {
    resetCacheManager();
  });

  it('should create namespaced caches', () => {
    const manager = getCacheManager();
    manager.registerNamespace('users', { ttlSeconds: 600 });

    const userCache = manager.getNamespace('users');
    expect(userCache).toBeDefined();
  });

  it('should prefix keys in namespace', async () => {
    const manager = getCacheManager();
    manager.registerNamespace('users', { prefix: 'usr', ttlSeconds: 60 });

    const userCache = manager.getNamespace('users');
    await userCache.set('123', { name: 'Test' });

    // Check underlying cache has prefixed key
    const rawCache = manager.getCache();
    expect(await rawCache.get('usr:123')).toBeDefined();
  });

  it('should return singleton instance', () => {
    const manager1 = getCacheManager();
    const manager2 = getCacheManager();
    expect(manager1).toBe(manager2);
  });
});

describe('RateLimiter', () => {
  let cache: InMemoryCache;
  let limiter: RateLimiter;

  beforeEach(() => {
    cache = new InMemoryCache();
    limiter = new RateLimiter(cache, {
      windowMs: 1000,
      maxRequests: 3,
    });
  });

  afterEach(() => {
    cache.destroy();
  });

  it('should allow requests within limit', async () => {
    const r1 = await limiter.isAllowed('user:1');
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = await limiter.isAllowed('user:1');
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = await limiter.isAllowed('user:1');
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('should block requests over limit', async () => {
    await limiter.isAllowed('user:1');
    await limiter.isAllowed('user:1');
    await limiter.isAllowed('user:1');

    const r4 = await limiter.isAllowed('user:1');
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  it('should track separate keys independently', async () => {
    await limiter.isAllowed('user:1');
    await limiter.isAllowed('user:1');
    await limiter.isAllowed('user:1');

    // User 2 should still be allowed
    const r = await limiter.isAllowed('user:2');
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });

  it('should reset after window', async () => {
    vi.useFakeTimers();

    await limiter.isAllowed('user:1');
    await limiter.isAllowed('user:1');
    await limiter.isAllowed('user:1');

    // Blocked
    expect((await limiter.isAllowed('user:1')).allowed).toBe(false);

    // Wait for window to pass
    vi.advanceTimersByTime(1100);

    // Should be allowed again
    expect((await limiter.isAllowed('user:1')).allowed).toBe(true);

    vi.useRealTimers();
  });

  it('should reset manually', async () => {
    await limiter.isAllowed('user:1');
    await limiter.isAllowed('user:1');
    await limiter.isAllowed('user:1');

    await limiter.reset('user:1');

    const r = await limiter.isAllowed('user:1');
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });
});
