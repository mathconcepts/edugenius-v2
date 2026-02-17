/**
 * Unit Tests for Cache Layer
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Cache } from '../../../data/cache';

describe('Cache', () => {
  let cache: Cache;

  beforeEach(async () => {
    cache = new Cache();
    await cache.connect();
  });

  afterEach(async () => {
    await cache.clear();
    await cache.disconnect();
  });

  describe('Basic Operations', () => {
    it('should set and get a value', async () => {
      await cache.set('test-key', 'test-value');
      const value = await cache.get<string>('test-key');

      expect(value).toBe('test-value');
    });

    it('should get undefined for missing key', async () => {
      const value = await cache.get('non-existent-key');
      expect(value).toBeUndefined();
    });

    it('should delete a key', async () => {
      await cache.set('test-key', 'test-value');
      await cache.delete('test-key');

      const value = await cache.get('test-key');
      expect(value).toBeUndefined();
    });

    it('should check if key exists', async () => {
      await cache.set('test-key', 'test-value');

      expect(await cache.exists('test-key')).toBe(true);
      expect(await cache.exists('non-existent')).toBe(false);
    });
  });

  describe('Data Types', () => {
    it('should cache strings', async () => {
      await cache.set('string', 'hello world');
      const value = await cache.get<string>('string');
      expect(value).toBe('hello world');
    });

    it('should cache numbers', async () => {
      await cache.set('number', 42);
      const value = await cache.get<number>('number');
      expect(value).toBe(42);
    });

    it('should cache booleans', async () => {
      await cache.set('bool-true', true);
      await cache.set('bool-false', false);

      expect(await cache.get<boolean>('bool-true')).toBe(true);
      expect(await cache.get<boolean>('bool-false')).toBe(false);
    });

    it('should cache objects', async () => {
      const obj = { name: 'test', count: 42, nested: { value: true } };
      await cache.set('object', obj);

      const value = await cache.get<typeof obj>('object');
      expect(value).toEqual(obj);
    });

    it('should cache arrays', async () => {
      const arr = [1, 'two', { three: 3 }];
      await cache.set('array', arr);

      const value = await cache.get<typeof arr>('array');
      expect(value).toEqual(arr);
    });

    it('should cache null', async () => {
      await cache.set('null-value', null);
      const value = await cache.get('null-value');
      expect(value).toBeNull();
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should respect TTL', async () => {
      await cache.set('ttl-key', 'value', 100); // 100ms TTL

      const valueBefore = await cache.get('ttl-key');
      expect(valueBefore).toBe('value');

      await new Promise(r => setTimeout(r, 150));

      const valueAfter = await cache.get('ttl-key');
      expect(valueAfter).toBeUndefined();
    });

    it('should persist without TTL', async () => {
      await cache.set('no-ttl', 'persistent');

      await new Promise(r => setTimeout(r, 100));

      const value = await cache.get('no-ttl');
      expect(value).toBe('persistent');
    });
  });

  describe('Increment/Decrement', () => {
    it('should increment value', async () => {
      await cache.set('counter', 0);
      await cache.increment('counter');

      const value = await cache.get<number>('counter');
      expect(value).toBe(1);
    });

    it('should increment by amount', async () => {
      await cache.set('counter', 10);
      await cache.increment('counter', 5);

      const value = await cache.get<number>('counter');
      expect(value).toBe(15);
    });

    it('should decrement value', async () => {
      await cache.set('counter', 10);
      await cache.decrement('counter');

      const value = await cache.get<number>('counter');
      expect(value).toBe(9);
    });

    it('should decrement by amount', async () => {
      await cache.set('counter', 10);
      await cache.decrement('counter', 3);

      const value = await cache.get<number>('counter');
      expect(value).toBe(7);
    });

    it('should create key on increment if not exists', async () => {
      await cache.increment('new-counter');
      const value = await cache.get<number>('new-counter');
      expect(value).toBe(1);
    });
  });

  describe('Clear', () => {
    it('should clear all keys', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      await cache.clear();

      expect(await cache.get('key1')).toBeUndefined();
      expect(await cache.get('key2')).toBeUndefined();
      expect(await cache.get('key3')).toBeUndefined();
    });
  });

  describe('Multi-Key Operations', () => {
    it('should get multiple keys', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      const values = await cache.mget(['key1', 'key2', 'key3']);

      expect(values).toEqual(['value1', 'value2', 'value3']);
    });

    it('should return undefined for missing keys in mget', async () => {
      await cache.set('key1', 'value1');

      const values = await cache.mget(['key1', 'missing', 'key1']);

      expect(values[0]).toBe('value1');
      expect(values[1]).toBeUndefined();
      expect(values[2]).toBe('value1');
    });

    it('should set multiple keys', async () => {
      await cache.mset([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
        { key: 'key3', value: 'value3' },
      ]);

      expect(await cache.get('key1')).toBe('value1');
      expect(await cache.get('key2')).toBe('value2');
      expect(await cache.get('key3')).toBe('value3');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string key', async () => {
      await cache.set('', 'empty-key-value');
      const value = await cache.get('');
      expect(value).toBe('empty-key-value');
    });

    it('should handle very long key', async () => {
      const longKey = 'x'.repeat(1000);
      await cache.set(longKey, 'long-key-value');

      const value = await cache.get(longKey);
      expect(value).toBe('long-key-value');
    });

    it('should handle special characters in key', async () => {
      const specialKey = 'key:with/special.chars-and_more';
      await cache.set(specialKey, 'special-value');

      const value = await cache.get(specialKey);
      expect(value).toBe('special-value');
    });

    it('should handle large values', async () => {
      const largeValue = 'x'.repeat(100000);
      await cache.set('large', largeValue);

      const value = await cache.get<string>('large');
      expect(value?.length).toBe(100000);
    });

    it('should handle concurrent operations', async () => {
      const promises = Array(100).fill(null).map((_, i) =>
        cache.set(`concurrent-${i}`, `value-${i}`)
      );

      await Promise.all(promises);

      const getPromises = Array(100).fill(null).map((_, i) =>
        cache.get(`concurrent-${i}`)
      );

      const values = await Promise.all(getPromises);
      values.forEach((v, i) => {
        expect(v).toBe(`value-${i}`);
      });
    });

    it('should handle rapid set/get cycles', async () => {
      for (let i = 0; i < 100; i++) {
        await cache.set('rapid', i);
        const value = await cache.get<number>('rapid');
        expect(value).toBe(i);
      }
    });

    it('should handle overwriting values', async () => {
      await cache.set('overwrite', 'first');
      await cache.set('overwrite', 'second');
      await cache.set('overwrite', 'third');

      const value = await cache.get('overwrite');
      expect(value).toBe('third');
    });
  });
});

describe('Cache Connection', () => {
  it('should connect successfully', async () => {
    const cache = new Cache();
    await expect(cache.connect()).resolves.not.toThrow();
    await cache.disconnect();
  });

  it('should disconnect successfully', async () => {
    const cache = new Cache();
    await cache.connect();
    await expect(cache.disconnect()).resolves.not.toThrow();
  });

  it('should handle multiple connect calls', async () => {
    const cache = new Cache();
    await cache.connect();
    await cache.connect(); // Should not throw
    await cache.disconnect();
  });

  it('should handle operations after disconnect', async () => {
    const cache = new Cache();
    await cache.connect();
    await cache.set('key', 'value');
    await cache.disconnect();

    // Operations after disconnect may throw or return undefined
    // Implementation dependent
  });
});
