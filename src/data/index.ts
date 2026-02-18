/**
 * EduGenius Data Layer - Public API
 * Re-exports all data layer components
 */

// Types
export * from './types';

// Repository
export type { Repository, CacheAdapter, RepositoryConfig, RepositoryType } from './repository';
export { InMemoryRepository, CachedRepository, createRepository } from './repository';

// Cache
export {
  InMemoryCache,
  CacheManager,
  NamespacedCache,
  RateLimiter,
  getCacheManager,
  resetCacheManager,
  type CacheNamespace,
  type RateLimitConfig,
} from './cache';

// Vector Store
export type { VectorStore, VectorDocument, VectorMetadata, VectorSearchParams, VectorSearchResult, VectorFilter, EmbeddingProvider, KnowledgeNode, KnowledgeEdge } from './vector-store';
export { InMemoryVectorStore, SemanticSearchService, MockEmbeddingProvider, StudentKnowledgeGraph, getVectorStore, resetVectorStore } from './vector-store';

// ============================================================================
// Convenience Functions
// ============================================================================

import { createRepository, RepositoryConfig } from './repository';
import { getCacheManager } from './cache';
import { getVectorStore } from './vector-store';
import type {
  Student,
  Content,
  Exam,
  User,
  TutoringSession,
  AnalyticsEvent,
  AgentState,
} from './types';

// Default config for development
const defaultConfig: RepositoryConfig = {
  type: 'memory',
  caching: {
    enabled: true,
    ttlSeconds: 300,
    adapter: getCacheManager().getCache(),
  },
};

// Pre-configured repositories
let repositories: {
  users?: ReturnType<typeof createRepository<User>>;
  students?: ReturnType<typeof createRepository<Student>>;
  content?: ReturnType<typeof createRepository<Content>>;
  exams?: ReturnType<typeof createRepository<Exam>>;
  sessions?: ReturnType<typeof createRepository<TutoringSession>>;
  events?: ReturnType<typeof createRepository<AnalyticsEvent>>;
  agents?: ReturnType<typeof createRepository<AgentState>>;
} = {};

export function getRepositories(config: RepositoryConfig = defaultConfig) {
  if (!repositories.users) {
    repositories = {
      users: createRepository<User>('users', config, ['email', 'role']),
      students: createRepository<Student>('students', config, ['userId']),
      content: createRepository<Content>('content', config, ['type', 'status', 'slug']),
      exams: createRepository<Exam>('exams', config, ['slug', 'category']),
      sessions: createRepository<TutoringSession>('sessions', config, ['studentId', 'status']),
      events: createRepository<AnalyticsEvent>('events', config, ['eventType', 'userId']),
      agents: createRepository<AgentState>('agents', config, ['agentId', 'status']),
    };
  }
  return repositories;
}

export function resetRepositories(): void {
  repositories = {};
}

// ============================================================================
// Data Layer Initialization
// ============================================================================

export interface DataLayerConfig {
  repository: RepositoryConfig;
  cache: {
    defaultTTL: number;
    namespaces?: Record<string, { ttlSeconds: number }>;
  };
  vectorStore?: {
    enabled: boolean;
    dimension?: number;
  };
}

export function initDataLayer(config: DataLayerConfig): void {
  // Initialize cache manager
  const cacheManager = getCacheManager(config.cache.defaultTTL);
  
  if (config.cache.namespaces) {
    for (const [name, nsConfig] of Object.entries(config.cache.namespaces)) {
      cacheManager.registerNamespace(name, nsConfig);
    }
  }

  // Initialize repositories with cache
  const repoConfig: RepositoryConfig = {
    ...config.repository,
    caching: {
      enabled: true,
      ttlSeconds: config.cache.defaultTTL,
      adapter: cacheManager.getCache(),
    },
  };
  
  getRepositories(repoConfig);

  // Initialize vector store if enabled
  if (config.vectorStore?.enabled) {
    getVectorStore();
  }
}

// ============================================================================
// Health Check
// ============================================================================

export interface DataLayerHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    cache: { status: string; size: number };
    vectorStore: { status: string; count: number };
    repositories: { status: string; types: string[] };
  };
  timestamp: number;
}

export async function checkDataLayerHealth(): Promise<DataLayerHealth> {
  const cache = getCacheManager().getCache();
  const vectorStore = getVectorStore();
  const repos = getRepositories();

  const cacheSize = cache.size();
  const vectorCount = await vectorStore.count();
  const repoTypes = Object.keys(repos);

  return {
    status: 'healthy',
    components: {
      cache: { status: 'ok', size: cacheSize },
      vectorStore: { status: 'ok', count: vectorCount },
      repositories: { status: 'ok', types: repoTypes },
    },
    timestamp: Date.now(),
  };
}
