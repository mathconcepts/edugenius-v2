// @ts-nocheck
/**
 * EduGenius Data Layer - Repository Pattern
 * Generic repository interface with implementations
 */

import { randomUUID } from 'crypto';
import {
  BaseEntity,
  UUID,
  QueryParams,
  PaginatedResult,
  FilterParams,
  FilterOperator,
  SortParams,
} from './types';

// ============================================================================
// Repository Interface
// ============================================================================

export interface Repository<T extends BaseEntity> {
  // Basic CRUD
  findById(id: UUID): Promise<T | null>;
  findOne(params: QueryParams<T>): Promise<T | null>;
  findMany(params?: QueryParams<T>): Promise<PaginatedResult<T>>;
  create(data: Omit<T, keyof BaseEntity>): Promise<T>;
  update(id: UUID, data: Partial<T>): Promise<T>;
  delete(id: UUID): Promise<boolean>;
  
  // Batch operations
  createMany(data: Omit<T, keyof BaseEntity>[]): Promise<T[]>;
  updateMany(ids: UUID[], data: Partial<T>): Promise<number>;
  deleteMany(ids: UUID[]): Promise<number>;
  
  // Utilities
  count(filters?: FilterParams<T>): Promise<number>;
  exists(id: UUID): Promise<boolean>;
}

// ============================================================================
// In-Memory Repository (for development/testing)
// ============================================================================

export class InMemoryRepository<T extends BaseEntity> implements Repository<T> {
  protected store: Map<UUID, T> = new Map();
  protected indexes: Map<string, Map<unknown, Set<UUID>>> = new Map();

  constructor(private indexFields: (keyof T)[] = []) {
    for (const field of indexFields) {
      this.indexes.set(field as string, new Map());
    }
  }

  async findById(id: UUID): Promise<T | null> {
    return this.store.get(id) || null;
  }

  async findOne(params: QueryParams<T>): Promise<T | null> {
    const result = await this.findMany({ ...params, pagination: { page: 1, limit: 1 } });
    return result.items[0] || null;
  }

  async findMany(params: QueryParams<T> = {}): Promise<PaginatedResult<T>> {
    let items = Array.from(this.store.values());

    // Apply filters
    if (params.filters) {
      items = items.filter((item) => this.matchesFilters(item, params.filters!));
    }

    // Get total before pagination
    const total = items.length;

    // Apply sorting
    if (params.sort && params.sort.length > 0) {
      items = this.sortItems(items, params.sort);
    }

    // Apply pagination
    const page = params.pagination?.page || 1;
    const limit = params.pagination?.limit || 20;
    const offset = (page - 1) * limit;
    items = items.slice(offset, offset + limit);

    // Apply field selection
    if (params.select && params.select.length > 0) {
      items = items.map((item) => this.selectFields(item, params.select!));
    }

    return {
      items,
      total,
      page,
      limit,
      hasMore: offset + items.length < total,
      nextCursor: offset + items.length < total ? String(offset + limit) : undefined,
    };
  }

  async create(data: Omit<T, keyof BaseEntity>): Promise<T> {
    const now = Date.now();
    const entity = {
      ...data,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      version: 1,
    } as T;

    this.store.set(entity.id, entity);
    this.updateIndexes(entity);
    return entity;
  }

  async update(id: UUID, data: Partial<T>): Promise<T> {
    const existing = this.store.get(id);
    if (!existing) {
      throw new Error(`Entity not found: ${id}`);
    }

    // Optimistic locking
    if (data.version !== undefined && data.version !== existing.version) {
      throw new Error(`Version conflict: expected ${existing.version}, got ${data.version}`);
    }

    const updated = {
      ...existing,
      ...data,
      id, // Prevent ID modification
      createdAt: existing.createdAt, // Prevent creation time modification
      updatedAt: Date.now(),
      version: existing.version + 1,
    } as T;

    this.removeFromIndexes(existing);
    this.store.set(id, updated);
    this.updateIndexes(updated);
    return updated;
  }

  async delete(id: UUID): Promise<boolean> {
    const existing = this.store.get(id);
    if (!existing) return false;

    this.removeFromIndexes(existing);
    return this.store.delete(id);
  }

  async createMany(data: Omit<T, keyof BaseEntity>[]): Promise<T[]> {
    return Promise.all(data.map((item) => this.create(item)));
  }

  async updateMany(ids: UUID[], data: Partial<T>): Promise<number> {
    let count = 0;
    for (const id of ids) {
      try {
        await this.update(id, data);
        count++;
      } catch {
        // Skip failed updates
      }
    }
    return count;
  }

  async deleteMany(ids: UUID[]): Promise<number> {
    let count = 0;
    for (const id of ids) {
      if (await this.delete(id)) count++;
    }
    return count;
  }

  async count(filters?: FilterParams<T>): Promise<number> {
    if (!filters) return this.store.size;
    
    let count = 0;
    for (const item of this.store.values()) {
      if (this.matchesFilters(item, filters)) count++;
    }
    return count;
  }

  async exists(id: UUID): Promise<boolean> {
    return this.store.has(id);
  }

  // -------------------------------------------------------------------------
  // Protected Methods
  // -------------------------------------------------------------------------

  protected matchesFilters(item: T, filters: FilterParams<T>): boolean {
    for (const [key, filter] of Object.entries(filters)) {
      const value = (item as Record<string, unknown>)[key];

      if (typeof filter === 'object' && filter !== null && !Array.isArray(filter)) {
        const op = filter as FilterOperator;
        
        if (op.eq !== undefined && value !== op.eq) return false;
        if (op.ne !== undefined && value === op.ne) return false;
        if (op.gt !== undefined && !(value as number > (op.gt as number))) return false;
        if (op.gte !== undefined && !(value as number >= (op.gte as number))) return false;
        if (op.lt !== undefined && !(value as number < (op.lt as number))) return false;
        if (op.lte !== undefined && !(value as number <= (op.lte as number))) return false;
        if (op.in !== undefined && !op.in.includes(value)) return false;
        if (op.notIn !== undefined && op.notIn.includes(value)) return false;
        if (op.contains !== undefined && !String(value).includes(op.contains)) return false;
        if (op.startsWith !== undefined && !String(value).startsWith(op.startsWith)) return false;
        if (op.endsWith !== undefined && !String(value).endsWith(op.endsWith)) return false;
        if (op.isNull === true && value !== null && value !== undefined) return false;
        if (op.isNull === false && (value === null || value === undefined)) return false;
      } else {
        // Direct equality
        if (value !== filter) return false;
      }
    }
    return true;
  }

  protected sortItems(items: T[], sorts: SortParams[]): T[] {
    return items.sort((a, b) => {
      for (const sort of sorts) {
        const aVal = (a as Record<string, unknown>)[sort.field];
        const bVal = (b as Record<string, unknown>)[sort.field];

        if (aVal === bVal) continue;

        const comparison = aVal < bVal ? -1 : 1;
        return sort.direction === 'asc' ? comparison : -comparison;
      }
      return 0;
    });
  }

  protected selectFields(item: T, fields: (keyof T)[]): T {
    const result: Partial<T> = {};
    for (const field of fields) {
      result[field] = item[field];
    }
    // Always include ID
    result.id = item.id;
    return result as T;
  }

  protected updateIndexes(entity: T): void {
    for (const [field, index] of this.indexes) {
      const value = (entity as Record<string, unknown>)[field];
      if (!index.has(value)) {
        index.set(value, new Set());
      }
      index.get(value)!.add(entity.id);
    }
  }

  protected removeFromIndexes(entity: T): void {
    for (const [field, index] of this.indexes) {
      const value = (entity as Record<string, unknown>)[field];
      index.get(value)?.delete(entity.id);
    }
  }

  // -------------------------------------------------------------------------
  // Query by Index (optimized lookups)
  // -------------------------------------------------------------------------

  async findByIndex(field: keyof T, value: unknown): Promise<T[]> {
    const index = this.indexes.get(field as string);
    if (!index) {
      // Fall back to full scan
      const result = await this.findMany({
        filters: { [field]: value } as FilterParams<T>,
      });
      return result.items;
    }

    const ids = index.get(value);
    if (!ids || ids.size === 0) return [];

    const items: T[] = [];
    for (const id of ids) {
      const item = this.store.get(id);
      if (item) items.push(item);
    }
    return items;
  }

  // -------------------------------------------------------------------------
  // Debugging
  // -------------------------------------------------------------------------

  getAllItems(): T[] {
    return Array.from(this.store.values());
  }

  clear(): void {
    this.store.clear();
    for (const index of this.indexes.values()) {
      index.clear();
    }
  }
}

// ============================================================================
// Cached Repository Wrapper
// ============================================================================

export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  deletePattern(pattern: string): Promise<void>;
}

export class CachedRepository<T extends BaseEntity> implements Repository<T> {
  constructor(
    private repository: Repository<T>,
    private cache: CacheAdapter,
    private options: {
      prefix: string;
      ttlSeconds: number;
      cacheQueries?: boolean;
    }
  ) {}

  private cacheKey(id: UUID): string {
    return `${this.options.prefix}:${id}`;
  }

  private queryKey(params: QueryParams<T>): string {
    return `${this.options.prefix}:query:${JSON.stringify(params)}`;
  }

  async findById(id: UUID): Promise<T | null> {
    const key = this.cacheKey(id);
    
    // Try cache first
    const cached = await this.cache.get<T>(key);
    if (cached) return cached;

    // Fetch from repository
    const item = await this.repository.findById(id);
    if (item) {
      await this.cache.set(key, item, this.options.ttlSeconds);
    }
    return item;
  }

  async findOne(params: QueryParams<T>): Promise<T | null> {
    return this.repository.findOne(params);
  }

  async findMany(params?: QueryParams<T>): Promise<PaginatedResult<T>> {
    if (!this.options.cacheQueries) {
      return this.repository.findMany(params);
    }

    const key = this.queryKey(params || {});
    const cached = await this.cache.get<PaginatedResult<T>>(key);
    if (cached) return cached;

    const result = await this.repository.findMany(params);
    await this.cache.set(key, result, this.options.ttlSeconds);
    return result;
  }

  async create(data: Omit<T, keyof BaseEntity>): Promise<T> {
    const item = await this.repository.create(data);
    await this.cache.set(this.cacheKey(item.id), item, this.options.ttlSeconds);
    await this.invalidateQueries();
    return item;
  }

  async update(id: UUID, data: Partial<T>): Promise<T> {
    const item = await this.repository.update(id, data);
    await this.cache.set(this.cacheKey(id), item, this.options.ttlSeconds);
    await this.invalidateQueries();
    return item;
  }

  async delete(id: UUID): Promise<boolean> {
    const result = await this.repository.delete(id);
    if (result) {
      await this.cache.delete(this.cacheKey(id));
      await this.invalidateQueries();
    }
    return result;
  }

  async createMany(data: Omit<T, keyof BaseEntity>[]): Promise<T[]> {
    const items = await this.repository.createMany(data);
    for (const item of items) {
      await this.cache.set(this.cacheKey(item.id), item, this.options.ttlSeconds);
    }
    await this.invalidateQueries();
    return items;
  }

  async updateMany(ids: UUID[], data: Partial<T>): Promise<number> {
    const count = await this.repository.updateMany(ids, data);
    for (const id of ids) {
      await this.cache.delete(this.cacheKey(id));
    }
    await this.invalidateQueries();
    return count;
  }

  async deleteMany(ids: UUID[]): Promise<number> {
    const count = await this.repository.deleteMany(ids);
    for (const id of ids) {
      await this.cache.delete(this.cacheKey(id));
    }
    await this.invalidateQueries();
    return count;
  }

  async count(filters?: FilterParams<T>): Promise<number> {
    return this.repository.count(filters);
  }

  async exists(id: UUID): Promise<boolean> {
    const cached = await this.cache.get(this.cacheKey(id));
    if (cached) return true;
    return this.repository.exists(id);
  }

  private async invalidateQueries(): Promise<void> {
    if (this.options.cacheQueries) {
      await this.cache.deletePattern(`${this.options.prefix}:query:*`);
    }
  }
}

// ============================================================================
// PostgreSQL Repository
// ============================================================================

export class PostgresRepository<T extends BaseEntity> implements Repository<T> {
  private pool: import('pg').Pool | null = null;
  private tableName: string;

  constructor(entityName: string, private _indexFields: (keyof T)[] = []) {
    this.tableName = entityName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    this.initPool();
  }

  private initPool(): void {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.warn(`[PostgresRepository:${this.tableName}] DATABASE_URL not set — queries will fail gracefully`);
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Pool } = require('pg');
      this.pool = new Pool({
        connectionString,
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      });
      this.pool!.on('error', (err: Error) => {
        console.error(`[PostgresRepository:${this.tableName}] Pool error:`, err.message);
      });
    } catch (e) {
      console.error(`[PostgresRepository:${this.tableName}] Failed to init pool:`, e);
    }
  }

  private async query<R = unknown>(sql: string, params: unknown[] = []): Promise<R[]> {
    if (!this.pool) throw new Error(`[PostgresRepository:${this.tableName}] DATABASE_URL not configured`);
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows as R[];
    } finally {
      client.release();
    }
  }

  async findById(id: UUID): Promise<T | null> {
    const rows = await this.query<T>(`SELECT * FROM ${this.tableName} WHERE id = $1 LIMIT 1`, [id]);
    return rows[0] ?? null;
  }

  async findOne(params: QueryParams<T>): Promise<T | null> {
    const result = await this.findMany({ ...params, pagination: { page: 1, limit: 1 } });
    return result.data[0] ?? null;
  }

  async findMany(params?: QueryParams<T>): Promise<PaginatedResult<T>> {
    const conditions: string[] = ['deleted_at IS NULL'];
    const values: unknown[] = [];
    let idx = 1;

    if (params?.filters) {
      for (const filter of params.filters) {
        const opMap: Record<FilterOperator, string> = {
          eq: '=', ne: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=',
          in: '= ANY', nin: '!= ALL', like: 'LIKE', ilike: 'ILIKE',
          contains: '@>', startsWith: 'LIKE', endsWith: 'LIKE', exists: 'IS NOT NULL',
        };
        const op = opMap[filter.operator] ?? '=';
        if (filter.operator === 'in' || filter.operator === 'nin') {
          conditions.push(`${String(filter.field)} ${op}($${idx++})`);
        } else {
          conditions.push(`${String(filter.field)} ${op} $${idx++}`);
        }
        values.push(filter.value);
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderBy = params?.sort ? `ORDER BY ${String(params.sort.field)} ${params.sort.direction.toUpperCase()}` : 'ORDER BY created_at DESC';
    const limit = params?.pagination?.limit ?? 50;
    const offset = ((params?.pagination?.page ?? 1) - 1) * limit;

    const countRows = await this.query<{ count: string }>(`SELECT COUNT(*) as count FROM ${this.tableName} ${where}`, values);
    const total = parseInt(countRows[0]?.count ?? '0', 10);

    const dataRows = await this.query<T>(
      `SELECT * FROM ${this.tableName} ${where} ${orderBy} LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    return {
      data: dataRows,
      total,
      page: params?.pagination?.page ?? 1,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(data: Omit<T, keyof BaseEntity>): Promise<T> {
    const id = randomUUID();
    const now = new Date();
    const record = { id, ...data, createdAt: now, updatedAt: now };
    const keys = Object.keys(record);
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const rows = await this.query<T>(
      `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      Object.values(record)
    );
    return rows[0];
  }

  async update(id: UUID, data: Partial<T>): Promise<T> {
    const updates = { ...data, updatedAt: new Date() };
    const keys = Object.keys(updates);
    const sets = keys.map((k, i) => `${k} = $${i + 2}`);
    const rows = await this.query<T>(
      `UPDATE ${this.tableName} SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      [id, ...Object.values(updates)]
    );
    if (!rows[0]) throw new Error(`[PostgresRepository] Entity ${id} not found`);
    return rows[0];
  }

  async delete(id: UUID): Promise<boolean> {
    const rows = await this.query(`UPDATE ${this.tableName} SET deleted_at = NOW() WHERE id = $1 RETURNING id`, [id]);
    return rows.length > 0;
  }

  async createMany(data: Omit<T, keyof BaseEntity>[]): Promise<T[]> {
    return Promise.all(data.map((d) => this.create(d)));
  }

  async updateMany(ids: UUID[], data: Partial<T>): Promise<number> {
    const updates = { ...data, updatedAt: new Date() };
    const keys = Object.keys(updates);
    const sets = keys.map((k, i) => `${k} = $${i + 2}`);
    const rows = await this.query(
      `UPDATE ${this.tableName} SET ${sets.join(', ')} WHERE id = ANY($1) RETURNING id`,
      [ids, ...Object.values(updates)]
    );
    return rows.length;
  }

  async deleteMany(ids: UUID[]): Promise<number> {
    const rows = await this.query(
      `UPDATE ${this.tableName} SET deleted_at = NOW() WHERE id = ANY($1) RETURNING id`,
      [ids]
    );
    return rows.length;
  }

  async count(filters?: FilterParams<T>): Promise<number> {
    const result = await this.findMany({ filters });
    return result.total;
  }

  async exists(id: UUID): Promise<boolean> {
    const rows = await this.query(`SELECT 1 FROM ${this.tableName} WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [id]);
    return rows.length > 0;
  }
}

// ============================================================================
// Repository Factory
// ============================================================================

export type RepositoryType = 'memory' | 'postgres' | 'mongodb';

export interface RepositoryConfig {
  type: RepositoryType;
  connection?: string;
  poolSize?: number;
  caching?: {
    enabled: boolean;
    ttlSeconds: number;
    adapter: CacheAdapter;
  };
}

export function createRepository<T extends BaseEntity>(
  _entityName: string,
  config: RepositoryConfig,
  indexFields: (keyof T)[] = []
): Repository<T> {
  let repository: Repository<T>;

  switch (config.type) {
    case 'memory':
      repository = new InMemoryRepository<T>(indexFields);
      break;
    case 'postgres':
      repository = new PostgresRepository<T>(_entityName, indexFields);
      break;
    case 'mongodb':
      // MongoDB: lower priority — use Postgres or InMemory for now
      console.warn('[Repository] MongoDB not implemented — falling back to InMemory');
      repository = new InMemoryRepository<T>(indexFields);
      break;
    default:
      throw new Error(`Unknown repository type: ${config.type}`);
  }

  if (config.caching?.enabled && config.caching.adapter) {
    return new CachedRepository<T>(repository, config.caching.adapter, {
      prefix: _entityName,
      ttlSeconds: config.caching.ttlSeconds,
      cacheQueries: true,
    });
  }

  return repository;
}
