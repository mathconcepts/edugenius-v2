/**
 * EduGenius Data Layer - Caching
 * In-memory and Redis-compatible cache implementations
 */

import { CacheAdapter } from './repository';

// ============================================================================
// In-Memory Cache
// ============================================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
}

export class InMemoryCache implements CacheAdapter {
  private store: Map<string, CacheEntry<unknown>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private defaultTTL: number = 300) {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    // Check expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTTL;
    const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async deletePattern(pattern: string): Promise<void> {
    const regex = this.patternToRegex(pattern);
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
      }
    }
  }

  // Additional cache operations
  async exists(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async getMultiple<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map((key) => this.get<T>(key)));
  }

  async setMultiple<T>(entries: { key: string; value: T; ttl?: number }[]): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl);
    }
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    const current = await this.get<number>(key);
    const newValue = (current || 0) + amount;
    await this.set(key, newValue);
    return newValue;
  }

  async decrement(key: string, amount: number = 1): Promise<number> {
    return this.increment(key, -amount);
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry || !entry.expiresAt) return -1;
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    entry.expiresAt = Date.now() + ttlSeconds * 1000;
    return true;
  }

  async keys(pattern: string = '*'): Promise<string[]> {
    const regex = this.patternToRegex(pattern);
    const result: string[] = [];
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        result.push(key);
      }
    }
    return result;
  }

  async flush(): Promise<void> {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }

  // -------------------------------------------------------------------------
  // Hash Operations (Redis-like)
  // -------------------------------------------------------------------------

  async hget<T>(key: string, field: string): Promise<T | null> {
    const hash = await this.get<Record<string, T>>(key);
    return hash?.[field] ?? null;
  }

  async hset<T>(key: string, field: string, value: T): Promise<void> {
    const hash = (await this.get<Record<string, T>>(key)) || {};
    hash[field] = value;
    await this.set(key, hash);
  }

  async hgetall<T>(key: string): Promise<Record<string, T> | null> {
    return this.get<Record<string, T>>(key);
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    const hash = await this.get<Record<string, unknown>>(key);
    if (!hash) return 0;
    
    let deleted = 0;
    for (const field of fields) {
      if (field in hash) {
        delete hash[field];
        deleted++;
      }
    }
    await this.set(key, hash);
    return deleted;
  }

  async hincrby(key: string, field: string, amount: number): Promise<number> {
    const current = await this.hget<number>(key, field);
    const newValue = (current || 0) + amount;
    await this.hset(key, field, newValue);
    return newValue;
  }

  // -------------------------------------------------------------------------
  // List Operations (Redis-like)
  // -------------------------------------------------------------------------

  async lpush<T>(key: string, ...values: T[]): Promise<number> {
    const list = (await this.get<T[]>(key)) || [];
    list.unshift(...values);
    await this.set(key, list);
    return list.length;
  }

  async rpush<T>(key: string, ...values: T[]): Promise<number> {
    const list = (await this.get<T[]>(key)) || [];
    list.push(...values);
    await this.set(key, list);
    return list.length;
  }

  async lpop<T>(key: string): Promise<T | null> {
    const list = await this.get<T[]>(key);
    if (!list || list.length === 0) return null;
    const value = list.shift()!;
    await this.set(key, list);
    return value;
  }

  async rpop<T>(key: string): Promise<T | null> {
    const list = await this.get<T[]>(key);
    if (!list || list.length === 0) return null;
    const value = list.pop()!;
    await this.set(key, list);
    return value;
  }

  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    const list = await this.get<T[]>(key);
    if (!list) return [];
    return list.slice(start, stop === -1 ? undefined : stop + 1);
  }

  async llen(key: string): Promise<number> {
    const list = await this.get<unknown[]>(key);
    return list?.length || 0;
  }

  // -------------------------------------------------------------------------
  // Set Operations (Redis-like)
  // -------------------------------------------------------------------------

  async sadd<T>(key: string, ...members: T[]): Promise<number> {
    const set = new Set(await this.get<T[]>(key) || []);
    const sizeBefore = set.size;
    for (const member of members) {
      set.add(member);
    }
    await this.set(key, Array.from(set));
    return set.size - sizeBefore;
  }

  async srem<T>(key: string, ...members: T[]): Promise<number> {
    const set = new Set(await this.get<T[]>(key) || []);
    let removed = 0;
    for (const member of members) {
      if (set.delete(member)) removed++;
    }
    await this.set(key, Array.from(set));
    return removed;
  }

  async sismember<T>(key: string, member: T): Promise<boolean> {
    const list = await this.get<T[]>(key);
    return list?.includes(member) || false;
  }

  async smembers<T>(key: string): Promise<T[]> {
    return (await this.get<T[]>(key)) || [];
  }

  async scard(key: string): Promise<number> {
    const list = await this.get<unknown[]>(key);
    return list?.length || 0;
  }

  // -------------------------------------------------------------------------
  // Sorted Set Operations (Redis-like)
  // -------------------------------------------------------------------------

  async zadd(key: string, ...scoreMembers: { score: number; member: string }[]): Promise<number> {
    const zset = (await this.get<{ score: number; member: string }[]>(key)) || [];
    const existing = new Set(zset.map((z) => z.member));
    let added = 0;
    
    for (const { score, member } of scoreMembers) {
      const idx = zset.findIndex((z) => z.member === member);
      if (idx >= 0) {
        zset[idx].score = score;
      } else {
        zset.push({ score, member });
        added++;
      }
    }
    
    zset.sort((a, b) => a.score - b.score);
    await this.set(key, zset);
    return added;
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    const zset = await this.get<{ score: number; member: string }[]>(key);
    if (!zset) return [];
    return zset.slice(start, stop === -1 ? undefined : stop + 1).map((z) => z.member);
  }

  async zrangeWithScores(key: string, start: number, stop: number): Promise<{ member: string; score: number }[]> {
    const zset = await this.get<{ score: number; member: string }[]>(key);
    if (!zset) return [];
    return zset.slice(start, stop === -1 ? undefined : stop + 1);
  }

  async zscore(key: string, member: string): Promise<number | null> {
    const zset = await this.get<{ score: number; member: string }[]>(key);
    return zset?.find((z) => z.member === member)?.score ?? null;
  }

  async zrank(key: string, member: string): Promise<number | null> {
    const zset = await this.get<{ score: number; member: string }[]>(key);
    const idx = zset?.findIndex((z) => z.member === member);
    return idx !== undefined && idx >= 0 ? idx : null;
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    const zset = await this.get<{ score: number; member: string }[]>(key);
    if (!zset) return 0;
    
    const memberSet = new Set(members);
    const newZset = zset.filter((z) => !memberSet.has(z.member));
    await this.set(key, newZset);
    return zset.length - newZset.length;
  }

  async zcard(key: string): Promise<number> {
    const zset = await this.get<{ score: number; member: string }[]>(key);
    return zset?.length || 0;
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

// ============================================================================
// Cache Manager
// ============================================================================

export interface CacheNamespace {
  prefix: string;
  ttlSeconds: number;
}

export class CacheManager {
  private cache: InMemoryCache;
  private namespaces: Map<string, CacheNamespace> = new Map();

  constructor(defaultTTL: number = 300) {
    this.cache = new InMemoryCache(defaultTTL);
  }

  registerNamespace(name: string, config: Partial<CacheNamespace>): void {
    this.namespaces.set(name, {
      prefix: config.prefix || name,
      ttlSeconds: config.ttlSeconds || 300,
    });
  }

  getNamespace(name: string): NamespacedCache {
    const ns = this.namespaces.get(name);
    if (!ns) {
      this.registerNamespace(name, {});
      return this.getNamespace(name);
    }
    return new NamespacedCache(this.cache, ns);
  }

  getCache(): InMemoryCache {
    return this.cache;
  }

  async flush(): Promise<void> {
    await this.cache.flush();
  }

  destroy(): void {
    this.cache.destroy();
  }
}

export class NamespacedCache implements CacheAdapter {
  constructor(
    private cache: InMemoryCache,
    private namespace: CacheNamespace
  ) {}

  private key(k: string): string {
    return `${this.namespace.prefix}:${k}`;
  }

  async get<T>(key: string): Promise<T | null> {
    return this.cache.get<T>(this.key(key));
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.cache.set(this.key(key), value, ttlSeconds ?? this.namespace.ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    await this.cache.delete(this.key(key));
  }

  async deletePattern(pattern: string): Promise<void> {
    await this.cache.deletePattern(this.key(pattern));
  }

  async exists(key: string): Promise<boolean> {
    return this.cache.exists(this.key(key));
  }
}

// ============================================================================
// Rate Limiter (using cache)
// ============================================================================

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export class RateLimiter {
  constructor(
    private cache: InMemoryCache,
    private config: RateLimitConfig
  ) {}

  async isAllowed(key: string): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const windowKey = `ratelimit:${key}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get current requests in window
    const requests = await this.cache.zrangeWithScores(windowKey, 0, -1);
    
    // Filter to current window
    const validRequests = requests.filter((r) => r.score > windowStart);
    
    if (validRequests.length >= this.config.maxRequests) {
      const resetAt = validRequests[0].score + this.config.windowMs;
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    // Add this request
    await this.cache.zadd(windowKey, { score: now, member: `${now}-${Math.random()}` });
    await this.cache.expire(windowKey, Math.ceil(this.config.windowMs / 1000));

    return {
      allowed: true,
      remaining: this.config.maxRequests - validRequests.length - 1,
      resetAt: now + this.config.windowMs,
    };
  }

  async reset(key: string): Promise<void> {
    await this.cache.delete(`ratelimit:${key}`);
  }
}

// ============================================================================
// Singleton
// ============================================================================

let cacheManagerInstance: CacheManager | null = null;

export function getCacheManager(defaultTTL?: number): CacheManager {
  if (!cacheManagerInstance) {
    cacheManagerInstance = new CacheManager(defaultTTL);
  }
  return cacheManagerInstance;
}

export function resetCacheManager(): void {
  cacheManagerInstance?.destroy();
  cacheManagerInstance = null;
}
