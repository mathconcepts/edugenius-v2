/**
 * Unit Tests for EduGenius Repository
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository, CachedRepository } from '../repository';
import { InMemoryCache } from '../cache';
import type { BaseEntity } from '../types';

interface TestEntity extends BaseEntity {
  name: string;
  email: string;
  age: number;
  status: 'active' | 'inactive';
  tags: string[];
}

describe('InMemoryRepository', () => {
  let repo: InMemoryRepository<TestEntity>;

  beforeEach(() => {
    repo = new InMemoryRepository<TestEntity>(['email', 'status']);
  });

  describe('CRUD Operations', () => {
    it('should create entity with generated fields', async () => {
      const entity = await repo.create({
        name: 'John Doe',
        email: 'john@example.com',
        age: 25,
        status: 'active',
        tags: ['test'],
      });

      expect(entity.id).toBeDefined();
      expect(entity.createdAt).toBeDefined();
      expect(entity.updatedAt).toBeDefined();
      expect(entity.version).toBe(1);
      expect(entity.name).toBe('John Doe');
    });

    it('should find entity by ID', async () => {
      const created = await repo.create({
        name: 'Jane Doe',
        email: 'jane@example.com',
        age: 30,
        status: 'active',
        tags: [],
      });

      const found = await repo.findById(created.id);
      expect(found).toEqual(created);
    });

    it('should return null for non-existent ID', async () => {
      const found = await repo.findById('non-existent-id');
      expect(found).toBeNull();
    });

    it('should update entity', async () => {
      const created = await repo.create({
        name: 'Test User',
        email: 'test@example.com',
        age: 20,
        status: 'active',
        tags: [],
      });

      const updated = await repo.update(created.id, {
        name: 'Updated User',
        age: 21,
      });

      expect(updated.name).toBe('Updated User');
      expect(updated.age).toBe(21);
      expect(updated.version).toBe(2);
      expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
      expect(updated.createdAt).toBe(created.createdAt); // Should not change
    });

    it('should delete entity', async () => {
      const created = await repo.create({
        name: 'To Delete',
        email: 'delete@example.com',
        age: 25,
        status: 'active',
        tags: [],
      });

      const deleted = await repo.delete(created.id);
      expect(deleted).toBe(true);

      const found = await repo.findById(created.id);
      expect(found).toBeNull();
    });

    it('should return false when deleting non-existent entity', async () => {
      const deleted = await repo.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      await repo.create({ name: 'Alice', email: 'alice@example.com', age: 25, status: 'active', tags: ['a'] });
      await repo.create({ name: 'Bob', email: 'bob@example.com', age: 30, status: 'active', tags: ['b'] });
      await repo.create({ name: 'Charlie', email: 'charlie@example.com', age: 35, status: 'inactive', tags: ['c'] });
      await repo.create({ name: 'Diana', email: 'diana@example.com', age: 28, status: 'active', tags: ['d'] });
    });

    it('should find many with no filters', async () => {
      const result = await repo.findMany();
      expect(result.items.length).toBe(4);
      expect(result.total).toBe(4);
    });

    it('should filter by equality', async () => {
      const result = await repo.findMany({
        filters: { status: 'active' },
      });
      expect(result.items.length).toBe(3);
    });

    it('should filter by gt operator', async () => {
      const result = await repo.findMany({
        filters: { age: { gt: 28 } },
      });
      expect(result.items.length).toBe(2);
      expect(result.items.every((i) => i.age > 28)).toBe(true);
    });

    it('should filter by in operator', async () => {
      const result = await repo.findMany({
        filters: { name: { in: ['Alice', 'Bob'] } },
      });
      expect(result.items.length).toBe(2);
    });

    it('should filter by contains operator', async () => {
      const result = await repo.findMany({
        filters: { email: { contains: 'charlie' } },
      });
      expect(result.items.length).toBe(1);
      expect(result.items[0].name).toBe('Charlie');
    });

    it('should sort ascending', async () => {
      const result = await repo.findMany({
        sort: [{ field: 'age', direction: 'asc' }],
      });
      expect(result.items[0].age).toBe(25);
      expect(result.items[3].age).toBe(35);
    });

    it('should sort descending', async () => {
      const result = await repo.findMany({
        sort: [{ field: 'age', direction: 'desc' }],
      });
      expect(result.items[0].age).toBe(35);
      expect(result.items[3].age).toBe(25);
    });

    it('should paginate results', async () => {
      const page1 = await repo.findMany({
        pagination: { page: 1, limit: 2 },
      });
      expect(page1.items.length).toBe(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.total).toBe(4);

      const page2 = await repo.findMany({
        pagination: { page: 2, limit: 2 },
      });
      expect(page2.items.length).toBe(2);
      expect(page2.hasMore).toBe(false);
    });

    it('should findOne', async () => {
      const result = await repo.findOne({
        filters: { name: 'Bob' },
      });
      expect(result?.name).toBe('Bob');
    });

    it('should count with filters', async () => {
      const count = await repo.count({ status: 'active' });
      expect(count).toBe(3);
    });

    it('should check exists', async () => {
      const items = repo.getAllItems();
      expect(await repo.exists(items[0].id)).toBe(true);
      expect(await repo.exists('non-existent')).toBe(false);
    });
  });

  describe('Batch Operations', () => {
    it('should create many', async () => {
      const entities = await repo.createMany([
        { name: 'User 1', email: 'user1@example.com', age: 20, status: 'active', tags: [] },
        { name: 'User 2', email: 'user2@example.com', age: 21, status: 'active', tags: [] },
        { name: 'User 3', email: 'user3@example.com', age: 22, status: 'active', tags: [] },
      ]);

      expect(entities.length).toBe(3);
      expect(entities.every((e) => e.id)).toBe(true);
    });

    it('should update many', async () => {
      const created = await repo.createMany([
        { name: 'A', email: 'a@example.com', age: 20, status: 'active', tags: [] },
        { name: 'B', email: 'b@example.com', age: 21, status: 'active', tags: [] },
      ]);

      const count = await repo.updateMany(
        created.map((e) => e.id),
        { status: 'inactive' }
      );

      expect(count).toBe(2);

      const result = await repo.findMany({ filters: { status: 'inactive' } });
      expect(result.items.length).toBe(2);
    });

    it('should delete many', async () => {
      const created = await repo.createMany([
        { name: 'A', email: 'a@example.com', age: 20, status: 'active', tags: [] },
        { name: 'B', email: 'b@example.com', age: 21, status: 'active', tags: [] },
      ]);

      const count = await repo.deleteMany(created.map((e) => e.id));
      expect(count).toBe(2);

      const result = await repo.findMany();
      expect(result.items.length).toBe(0);
    });
  });

  describe('Index Operations', () => {
    it('should find by index efficiently', async () => {
      await repo.create({ name: 'Test', email: 'indexed@example.com', age: 25, status: 'active', tags: [] });
      await repo.create({ name: 'Other', email: 'other@example.com', age: 30, status: 'active', tags: [] });

      const results = await repo.findByIndex('email', 'indexed@example.com');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Test');
    });

    it('should find by status index', async () => {
      await repo.create({ name: 'Active 1', email: 'a1@example.com', age: 25, status: 'active', tags: [] });
      await repo.create({ name: 'Active 2', email: 'a2@example.com', age: 30, status: 'active', tags: [] });
      await repo.create({ name: 'Inactive', email: 'i@example.com', age: 35, status: 'inactive', tags: [] });

      const active = await repo.findByIndex('status', 'active');
      expect(active.length).toBe(2);

      const inactive = await repo.findByIndex('status', 'inactive');
      expect(inactive.length).toBe(1);
    });
  });

  describe('Optimistic Locking', () => {
    it('should increment version on update', async () => {
      const created = await repo.create({
        name: 'Test',
        email: 'test@example.com',
        age: 25,
        status: 'active',
        tags: [],
      });
      expect(created.version).toBe(1);

      const updated1 = await repo.update(created.id, { age: 26 });
      expect(updated1.version).toBe(2);

      const updated2 = await repo.update(created.id, { age: 27 });
      expect(updated2.version).toBe(3);
    });

    it('should reject update with wrong version', async () => {
      const created = await repo.create({
        name: 'Test',
        email: 'test@example.com',
        age: 25,
        status: 'active',
        tags: [],
      });

      // Update once
      await repo.update(created.id, { age: 26 });

      // Try to update with old version
      await expect(
        repo.update(created.id, { age: 27, version: 1 })
      ).rejects.toThrow(/version conflict/i);
    });
  });
});

describe('CachedRepository', () => {
  let baseRepo: InMemoryRepository<TestEntity>;
  let cache: InMemoryCache;
  let cachedRepo: CachedRepository<TestEntity>;

  beforeEach(() => {
    baseRepo = new InMemoryRepository<TestEntity>();
    cache = new InMemoryCache(60);
    cachedRepo = new CachedRepository(baseRepo, cache, {
      prefix: 'test',
      ttlSeconds: 60,
      cacheQueries: true,
    });
  });

  it('should cache findById results', async () => {
    const created = await cachedRepo.create({
      name: 'Cached User',
      email: 'cached@example.com',
      age: 25,
      status: 'active',
      tags: [],
    });

    // First call should cache
    const first = await cachedRepo.findById(created.id);
    expect(first).not.toBeNull();

    // Verify it's in cache
    const cached = await cache.get(`test:${created.id}`);
    expect(cached).not.toBeNull();

    // Second call should use cache
    const second = await cachedRepo.findById(created.id);
    expect(second).toEqual(first);
  });

  it('should invalidate cache on update', async () => {
    const created = await cachedRepo.create({
      name: 'Test',
      email: 'test@example.com',
      age: 25,
      status: 'active',
      tags: [],
    });

    // Cache it
    await cachedRepo.findById(created.id);

    // Update
    await cachedRepo.update(created.id, { name: 'Updated' });

    // Cache should have updated value
    const cached = await cache.get<TestEntity>(`test:${created.id}`);
    expect(cached?.name).toBe('Updated');
  });

  it('should invalidate cache on delete', async () => {
    const created = await cachedRepo.create({
      name: 'To Delete',
      email: 'delete@example.com',
      age: 25,
      status: 'active',
      tags: [],
    });

    // Cache it
    await cachedRepo.findById(created.id);

    // Delete
    await cachedRepo.delete(created.id);

    // Should not be in cache
    const cached = await cache.get(`test:${created.id}`);
    expect(cached).toBeNull();
  });

  it('should use cache for exists check', async () => {
    const created = await cachedRepo.create({
      name: 'Test',
      email: 'test@example.com',
      age: 25,
      status: 'active',
      tags: [],
    });

    // Cache it
    await cachedRepo.findById(created.id);

    // Exists should return true from cache
    const exists = await cachedRepo.exists(created.id);
    expect(exists).toBe(true);
  });
});
