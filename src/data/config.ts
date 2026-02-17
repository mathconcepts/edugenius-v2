/**
 * EduGenius Data Layer - Configuration
 * Database and cache configuration
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYaml } from 'yaml';

// ============================================================================
// Configuration Types
// ============================================================================

export interface DataConfig {
  postgres: PostgresConfig;
  redis: RedisConfig;
  vectorStore: VectorStoreConfig;
  migrations: MigrationConfig;
}

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean | PostgresSslConfig;
  pool: PoolConfig;
  schema: string;
}

export interface PostgresSslConfig {
  rejectUnauthorized: boolean;
  ca?: string;
  cert?: string;
  key?: string;
}

export interface PoolConfig {
  min: number;
  max: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
  statementTimeoutMs: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  tls: boolean;
  cluster?: RedisClusterConfig;
  sentinel?: RedisSentinelConfig;
}

export interface RedisClusterConfig {
  nodes: { host: string; port: number }[];
  natMap?: Record<string, { host: string; port: number }>;
}

export interface RedisSentinelConfig {
  sentinels: { host: string; port: number }[];
  name: string;
}

export interface VectorStoreConfig {
  provider: 'pinecone' | 'qdrant' | 'weaviate' | 'pgvector' | 'memory';
  pinecone?: PineconeConfig;
  qdrant?: QdrantConfig;
  weaviate?: WeaviateConfig;
  pgvector?: PgVectorConfig;
  dimension: number;
  metric: 'cosine' | 'euclidean' | 'dotproduct';
}

export interface PineconeConfig {
  apiKey: string;
  environment: string;
  indexName: string;
}

export interface QdrantConfig {
  url: string;
  apiKey?: string;
  collectionName: string;
}

export interface WeaviateConfig {
  scheme: 'http' | 'https';
  host: string;
  apiKey?: string;
  className: string;
}

export interface PgVectorConfig {
  // Uses main Postgres connection
  indexType: 'ivfflat' | 'hnsw';
  lists?: number; // For ivfflat
  m?: number; // For hnsw
  efConstruction?: number; // For hnsw
}

export interface MigrationConfig {
  directory: string;
  tableName: string;
  autoRun: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

const defaultConfig: DataConfig = {
  postgres: {
    host: 'localhost',
    port: 5432,
    database: 'edugenius',
    user: 'edugenius',
    password: '',
    ssl: false,
    pool: {
      min: 2,
      max: 10,
      idleTimeoutMs: 30000,
      connectionTimeoutMs: 5000,
      statementTimeoutMs: 30000,
    },
    schema: 'public',
  },
  redis: {
    host: 'localhost',
    port: 6379,
    db: 0,
    keyPrefix: 'edugenius:',
    tls: false,
  },
  vectorStore: {
    provider: 'memory',
    dimension: 1536, // OpenAI embedding dimension
    metric: 'cosine',
  },
  migrations: {
    directory: './migrations',
    tableName: '_migrations',
    autoRun: false,
  },
};

// ============================================================================
// Configuration Loader
// ============================================================================

let cachedConfig: DataConfig | null = null;

export function loadDataConfig(configPath?: string): DataConfig {
  if (cachedConfig) return cachedConfig;

  // Try to load from file
  const paths = configPath
    ? [configPath]
    : [
        resolve(process.cwd(), 'config/database.yaml'),
        resolve(process.cwd(), 'config/database.yml'),
        resolve(process.cwd(), 'database.yaml'),
        resolve(process.cwd(), 'database.yml'),
      ];

  let fileConfig: Partial<DataConfig> = {};

  for (const path of paths) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf-8');
        fileConfig = parseYaml(content) as Partial<DataConfig>;
        break;
      } catch (error) {
        console.warn(`Failed to load config from ${path}:`, error);
      }
    }
  }

  // Merge with environment variables
  const envConfig = loadEnvConfig();

  // Deep merge: default <- file <- env
  cachedConfig = deepMerge(
    defaultConfig,
    fileConfig,
    envConfig
  ) as DataConfig;

  return cachedConfig;
}

function loadEnvConfig(): Partial<DataConfig> {
  const config: Partial<DataConfig> = {};

  // Postgres
  if (process.env.POSTGRES_HOST || process.env.DATABASE_URL) {
    config.postgres = {} as PostgresConfig;

    if (process.env.DATABASE_URL) {
      const url = new URL(process.env.DATABASE_URL);
      config.postgres.host = url.hostname;
      config.postgres.port = parseInt(url.port) || 5432;
      config.postgres.database = url.pathname.slice(1);
      config.postgres.user = url.username;
      config.postgres.password = url.password;
      config.postgres.ssl = url.searchParams.get('ssl') === 'true';
    } else {
      if (process.env.POSTGRES_HOST) config.postgres.host = process.env.POSTGRES_HOST;
      if (process.env.POSTGRES_PORT) config.postgres.port = parseInt(process.env.POSTGRES_PORT);
      if (process.env.POSTGRES_DB) config.postgres.database = process.env.POSTGRES_DB;
      if (process.env.POSTGRES_USER) config.postgres.user = process.env.POSTGRES_USER;
      if (process.env.POSTGRES_PASSWORD) config.postgres.password = process.env.POSTGRES_PASSWORD;
      if (process.env.POSTGRES_SSL) config.postgres.ssl = process.env.POSTGRES_SSL === 'true';
    }
  }

  // Redis
  if (process.env.REDIS_HOST || process.env.REDIS_URL) {
    config.redis = {} as RedisConfig;

    if (process.env.REDIS_URL) {
      const url = new URL(process.env.REDIS_URL);
      config.redis.host = url.hostname;
      config.redis.port = parseInt(url.port) || 6379;
      if (url.password) config.redis.password = url.password;
      if (url.pathname.length > 1) config.redis.db = parseInt(url.pathname.slice(1));
    } else {
      if (process.env.REDIS_HOST) config.redis.host = process.env.REDIS_HOST;
      if (process.env.REDIS_PORT) config.redis.port = parseInt(process.env.REDIS_PORT);
      if (process.env.REDIS_PASSWORD) config.redis.password = process.env.REDIS_PASSWORD;
      if (process.env.REDIS_DB) config.redis.db = parseInt(process.env.REDIS_DB);
    }
  }

  // Vector Store
  if (process.env.VECTOR_STORE_PROVIDER) {
    config.vectorStore = {
      provider: process.env.VECTOR_STORE_PROVIDER as VectorStoreConfig['provider'],
    } as VectorStoreConfig;

    if (process.env.PINECONE_API_KEY) {
      config.vectorStore.pinecone = {
        apiKey: process.env.PINECONE_API_KEY,
        environment: process.env.PINECONE_ENVIRONMENT || '',
        indexName: process.env.PINECONE_INDEX || 'edugenius',
      };
    }

    if (process.env.QDRANT_URL) {
      config.vectorStore.qdrant = {
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
        collectionName: process.env.QDRANT_COLLECTION || 'edugenius',
      };
    }
  }

  return config;
}

// ============================================================================
// Utilities
// ============================================================================

function deepMerge(...objects: Partial<DataConfig>[]): Partial<DataConfig> {
  const result: Record<string, unknown> = {};

  for (const obj of objects) {
    if (!obj) continue;

    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue;

      if (isPlainObject(value) && isPlainObject(result[key])) {
        result[key] = deepMerge(
          result[key] as Partial<DataConfig>,
          value as Partial<DataConfig>
        );
      } else {
        result[key] = value;
      }
    }
  }

  return result as Partial<DataConfig>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function resetConfigCache(): void {
  cachedConfig = null;
}

// ============================================================================
// Connection String Builders
// ============================================================================

export function getPostgresConnectionString(config: PostgresConfig): string {
  const { host, port, database, user, password, ssl } = config;
  const sslParam = ssl ? '?ssl=true' : '';
  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}${sslParam}`;
}

export function getRedisConnectionString(config: RedisConfig): string {
  const { host, port, password, db, tls } = config;
  const protocol = tls ? 'rediss' : 'redis';
  const auth = password ? `:${password}@` : '';
  return `${protocol}://${auth}${host}:${port}/${db}`;
}
