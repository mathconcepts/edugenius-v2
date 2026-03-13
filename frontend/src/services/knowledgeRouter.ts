/**
 * knowledgeRouter.ts — Modular Knowledge Source Router
 *
 * Priority chain: MCP sources → External APIs → Static PYQs → RAG → LLM fallback
 * Every query is logged for progressive RAG growth.
 * Config-driven: sources registered via KnowledgeSourceConfig[]
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { queryWolfram, isWolframAvailable } from './wolframService';
import { getRagContext } from './ragService';
import { callLLM } from './llmService';
import { getKey } from './connectionBridge';

// ─── Types ────────────────────────────────────────────────────────────────────

export type KnowledgeSourceType =
  | 'wolfram_mcp'
  | 'wolfram_api'
  | 'custom_mcp'
  | 'external_api'
  | 'static_pyq'
  | 'rag_supabase'
  | 'llm_fallback';

export interface KnowledgeSourceConfig {
  id: string;
  type: KnowledgeSourceType;
  displayName: string;
  enabled: boolean;
  priority: number;         // lower = higher priority
  // MCP-specific
  mcpEndpoint?: string;
  mcpTool?: string;
  // External API-specific
  apiEndpoint?: string;
  apiHeaders?: Record<string, string>;
  apiQueryParam?: string;
  apiResponsePath?: string;
  // Confidence threshold — skip source if result below this
  minConfidence?: number;
  timeoutMs?: number;
}

export interface KnowledgeResult {
  answer: string;
  source: KnowledgeSourceType;
  sourceId: string;
  confidence: number;
  citations?: string[];
  steps?: string[];
  wolframCode?: string;
  verified: boolean;
  metadata?: Record<string, unknown>;
}

export interface RouterQuery {
  text: string;
  examId: string;
  topicId?: string;
  sessionId?: string;
  studentId?: string;
  requiresComputation?: boolean;
  requiresFact?: boolean;
}

export interface QueryLogEntry {
  id: string;
  query: string;
  examId: string;
  topicId?: string;
  timestamp: string;
  resolvedSource: KnowledgeSourceType;
  sourceId: string;
  answerPreview: string;
  confidence: number;
  embeddingQueued: boolean;
  embeddingDone: boolean;
  sessionId?: string;
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const SOURCES_KEY = 'edugenius_knowledge_sources';
const QUERY_LOG_KEY = 'edugenius_query_log';

// ─── Default Source Registry ──────────────────────────────────────────────────

const DEFAULT_SOURCES: KnowledgeSourceConfig[] = [
  {
    id: 'wolfram-api-primary',
    type: 'wolfram_api',
    displayName: 'Wolfram Alpha',
    enabled: true,
    priority: 1,
    minConfidence: 0.7,
    timeoutMs: 12000,
  },
  {
    id: 'static-pyq-bundle',
    type: 'static_pyq',
    displayName: 'PYQ Bundle',
    enabled: true,
    priority: 3,
    minConfidence: 0.5,
    timeoutMs: 500,
  },
  {
    id: 'rag-supabase-primary',
    type: 'rag_supabase',
    displayName: 'Vector RAG',
    enabled: true,
    priority: 4,
    minConfidence: 0.6,
    timeoutMs: 8000,
  },
  {
    id: 'llm-fallback',
    type: 'llm_fallback',
    displayName: 'LLM Fallback',
    enabled: true,
    priority: 99,
    minConfidence: 0,
  },
];

// ─── Source Registry CRUD ─────────────────────────────────────────────────────

export function loadSources(): KnowledgeSourceConfig[] {
  try {
    const stored = localStorage.getItem(SOURCES_KEY);
    if (!stored) return [...DEFAULT_SOURCES];
    const parsed = JSON.parse(stored) as KnowledgeSourceConfig[];
    const ids = new Set(parsed.map((s) => s.id));
    const merged = [...parsed];
    for (const d of DEFAULT_SOURCES) {
      if (!ids.has(d.id)) merged.push(d);
    }
    return merged.sort((a, b) => a.priority - b.priority);
  } catch {
    return [...DEFAULT_SOURCES];
  }
}

export function saveSources(sources: KnowledgeSourceConfig[]): void {
  localStorage.setItem(SOURCES_KEY, JSON.stringify(sources));
}

export function registerSource(config: KnowledgeSourceConfig): void {
  const sources = loadSources();
  const idx = sources.findIndex((s) => s.id === config.id);
  if (idx >= 0) sources[idx] = config;
  else sources.push(config);
  saveSources(sources.sort((a, b) => a.priority - b.priority));
}

export function removeSource(id: string): void {
  saveSources(loadSources().filter((s) => s.id !== id));
}

export function toggleSource(id: string, enabled: boolean): void {
  const sources = loadSources();
  const src = sources.find((s) => s.id === id);
  if (src) {
    src.enabled = enabled;
    saveSources(sources);
  }
}

// ─── Query Log ────────────────────────────────────────────────────────────────

export function logQuery(
  entry: Omit<QueryLogEntry, 'id' | 'embeddingQueued' | 'embeddingDone'>
): QueryLogEntry {
  const log = loadQueryLog();
  const full: QueryLogEntry = {
    ...entry,
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    embeddingQueued: false,
    embeddingDone: false,
  };
  log.unshift(full);
  if (log.length > 2000) log.splice(2000);
  localStorage.setItem(QUERY_LOG_KEY, JSON.stringify(log));
  return full;
}

export function loadQueryLog(): QueryLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(QUERY_LOG_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function getQueryLogStats(): { total: number; pendingEmbedding: number; embedded: number } {
  const log = loadQueryLog();
  return {
    total: log.length,
    pendingEmbedding: log.filter((q) => !q.embeddingDone).length,
    embedded: log.filter((q) => q.embeddingDone).length,
  };
}

export function getUnembeddedQueries(limit = 50): QueryLogEntry[] {
  return loadQueryLog()
    .filter((q) => !q.embeddingDone && q.confidence >= 0.6)
    .slice(0, limit);
}

export function markQueryEmbedded(id: string): void {
  const log = loadQueryLog();
  const entry = log.find((q) => q.id === id);
  if (entry) {
    entry.embeddingDone = true;
    entry.embeddingQueued = true;
    localStorage.setItem(QUERY_LOG_KEY, JSON.stringify(log));
  }
}

// ─── Credential Resolver ──────────────────────────────────────────────────────

/**
 * Resolve runtime credentials for a source config.
 * If a required credential is now available via the bridge, enables the source.
 */
function resolveSourceCredentials(source: KnowledgeSourceConfig): KnowledgeSourceConfig {
  const resolved = { ...source };

  if (source.id === 'wolfram-api-primary' || source.type === 'wolfram_api' || source.type === 'wolfram_mcp') {
    const key = getKey('VITE_WOLFRAM_APP_ID', 'WOLFRAM_APP_ID');
    if (key) resolved.enabled = true;
  }

  if (source.id === 'rag-supabase-primary' || source.type === 'rag_supabase') {
    const url = getKey('VITE_SUPABASE_URL', 'VITE_SUPABASE_URL');
    const anonKey = getKey('VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
    if (url && anonKey) resolved.enabled = true;
  }

  return resolved;
}

// ─── Individual Source Resolvers ──────────────────────────────────────────────

async function resolveWolframApi(
  query: RouterQuery,
  _config: KnowledgeSourceConfig
): Promise<KnowledgeResult | null> {
  if (!isWolframAvailable()) return null;
  try {
    const result = await queryWolfram(query.text);
    if (!result.success) return null;
    return {
      answer: result.answer,
      source: 'wolfram_api',
      sourceId: 'wolfram-api-primary',
      confidence: result.confidence,
      steps: result.steps,
      wolframCode: result.wolfram_code,
      verified: true,
      citations: ['Wolfram Alpha'],
      metadata: { pods: result.pods },
    };
  } catch {
    return null;
  }
}

async function resolveCustomMcp(
  query: RouterQuery,
  config: KnowledgeSourceConfig
): Promise<KnowledgeResult | null> {
  if (!config.mcpEndpoint || !config.mcpTool) return null;
  try {
    const response = await fetch(config.mcpEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: config.mcpTool,
        arguments: { query: query.text, exam: query.examId, topic: query.topicId },
      }),
      signal: AbortSignal.timeout(config.timeoutMs ?? 8000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return {
      answer: String(data.result ?? data.text ?? data.answer ?? JSON.stringify(data)),
      source: 'custom_mcp',
      sourceId: config.id,
      confidence: (data.confidence as number) ?? 0.8,
      verified: true,
      citations: data.citations as string[] | undefined,
    };
  } catch {
    return null;
  }
}

async function resolveExternalApi(
  query: RouterQuery,
  config: KnowledgeSourceConfig
): Promise<KnowledgeResult | null> {
  if (!config.apiEndpoint) return null;
  try {
    const param = config.apiQueryParam ?? 'q';
    const url = new URL(config.apiEndpoint);
    url.searchParams.set(param, query.text);
    if (query.examId) url.searchParams.set('exam', query.examId);
    const response = await fetch(url.toString(), {
      headers: { 'Content-Type': 'application/json', ...(config.apiHeaders ?? {}) },
      signal: AbortSignal.timeout(config.timeoutMs ?? 8000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const answer = config.apiResponsePath
      ? (config.apiResponsePath.split('.').reduce(
          (obj: any, key: string) => obj?.[key],
          data
        ) as string)
      : JSON.stringify(data);
    return {
      answer: String(answer ?? ''),
      source: 'external_api',
      sourceId: config.id,
      confidence: 0.75,
      verified: false,
      citations: [config.apiEndpoint],
    };
  } catch {
    return null;
  }
}

async function resolveStaticPYQ(
  query: RouterQuery,
  _config: KnowledgeSourceConfig
): Promise<KnowledgeResult | null> {
  try {
    const { getStaticPYQContext } = await import('./staticPyqService');
    const context = getStaticPYQContext(query.text, query.examId);
    if (!context) return null;
    return {
      answer: context,
      source: 'static_pyq',
      sourceId: 'static-pyq-bundle',
      confidence: 0.7,
      verified: true,
      citations: ['PYQ Bundle'],
    };
  } catch {
    return null;
  }
}

async function resolveRAG(
  query: RouterQuery,
  _config: KnowledgeSourceConfig
): Promise<KnowledgeResult | null> {
  try {
    const ctx = await getRagContext(query.text, query.examId, query.topicId);
    if (!ctx.hasContext) return null;
    const parts: string[] = [];
    if (ctx.chunks.length > 0) {
      parts.push('Relevant content:\n' + ctx.chunks.map((c) => c.content).join('\n\n'));
    }
    if (ctx.pyqs.length > 0) {
      parts.push(
        'Related past questions:\n' +
          ctx.pyqs
            .map(
              (q) =>
                `Q: ${q.question_text}\nAnswer: ${q.correct_answer}\nExplanation: ${q.explanation ?? ''}`
            )
            .join('\n\n')
      );
    }
    return {
      answer: parts.join('\n\n'),
      source: 'rag_supabase',
      sourceId: 'rag-supabase-primary',
      confidence: Math.max(...ctx.chunks.map((c) => c.similarity), ...ctx.pyqs.map((p) => p.similarity), 0.6),
      verified: false,
      citations: ctx.chunks.map((c) => c.document_id),
    };
  } catch {
    return null;
  }
}

async function resolveLLMFallback(query: RouterQuery): Promise<KnowledgeResult> {
  try {
    const resp = await callLLM({
      agent: 'sage',
      message: query.text,
    });
    return {
      answer: resp?.text ?? '',
      source: 'llm_fallback',
      sourceId: 'llm-fallback',
      confidence: 0.5,
      verified: false,
    };
  } catch {
    return {
      answer: '',
      source: 'llm_fallback',
      sourceId: 'llm-fallback',
      confidence: 0,
      verified: false,
    };
  }
}

// ─── RAG Auto-Indexing ────────────────────────────────────────────────────────

async function queueForRagIndexing(
  query: RouterQuery,
  _result: KnowledgeResult
): Promise<void> {
  // Mark as queued in log
  const log = loadQueryLog();
  const entry = log.find((q) => q.query === query.text && !q.embeddingQueued);
  if (entry) {
    entry.embeddingQueued = true;
    localStorage.setItem(QUERY_LOG_KEY, JSON.stringify(log));
  }
  // Actual Supabase upsert handled by ragIndexer.ts runProgressiveIndexing()
}

// ─── Main Router ──────────────────────────────────────────────────────────────

export async function resolveKnowledge(query: RouterQuery): Promise<KnowledgeResult> {
  const sources = loadSources()
    .filter((s) => s.type !== 'llm_fallback')
    .map(resolveSourceCredentials)          // resolve runtime credentials
    .filter((s) => s.enabled)
    .sort((a, b) => a.priority - b.priority);

  let result: KnowledgeResult | null = null;

  for (const source of sources) {
    try {
      switch (source.type) {
        case 'wolfram_api':
        case 'wolfram_mcp':
          result = await resolveWolframApi(query, source);
          break;
        case 'custom_mcp':
          result = await resolveCustomMcp(query, source);
          break;
        case 'external_api':
          result = await resolveExternalApi(query, source);
          break;
        case 'static_pyq':
          result = await resolveStaticPYQ(query, source);
          break;
        case 'rag_supabase':
          result = await resolveRAG(query, source);
          break;
      }
    } catch {
      result = null;
    }

    if (result && result.confidence >= (source.minConfidence ?? 0.5)) {
      break;
    }
    result = null;
  }

  if (!result) {
    result = await resolveLLMFallback(query);
  }

  // Log every query
  logQuery({
    query: query.text,
    examId: query.examId,
    topicId: query.topicId,
    timestamp: new Date().toISOString(),
    resolvedSource: result.source,
    sourceId: result.sourceId,
    answerPreview: result.answer.slice(0, 200),
    confidence: result.confidence,
    sessionId: query.sessionId,
  });

  // Auto-queue high-confidence non-LLM answers for RAG growth
  if (result.confidence >= 0.7 && result.source !== 'llm_fallback') {
    queueForRagIndexing(query, result).catch(() => {});
  }

  // ── Update Course Playbook with search intelligence ────────────────────────
  try {
    const examId = query.examId ?? 'GATE_EM';
    const topicId = query.topicId ?? query.text.split(' ')[0].toLowerCase();
    const { updateFromKnowledgeRouter } = await import('./coursePlaybookService');
    updateFromKnowledgeRouter(examId, topicId, topicId, result, query.text);
  } catch { /* non-fatal */ }

  return result;
}

// ─── User-Scoped Resolution ───────────────────────────────────────────────────

/**
 * Resolve knowledge for a specific user, filtering to their allowed sources.
 * Called from Chat.tsx and channelBotHandler.ts with the user's MCPPrivileges.
 */
export async function resolveKnowledgeForUser(
  query: RouterQuery,
  userAllowedSources?: string[]
): Promise<KnowledgeResult> {
  // No filter = all sources (enterprise or unauthenticated)
  if (!userAllowedSources || userAllowedSources.length === 0) {
    return resolveKnowledge(query);
  }
  const allSources = loadSources();
  const filteredSources = allSources.filter(
    (s) => userAllowedSources.includes(s.id) || s.type === 'llm_fallback'
  );
  return resolveKnowledgeWithSources(query, filteredSources);
}

/**
 * Internal: resolve knowledge using an explicit source list (not loadSources()).
 */
async function resolveKnowledgeWithSources(
  query: RouterQuery,
  sources: KnowledgeSourceConfig[]
): Promise<KnowledgeResult> {
  const enabledSources = sources
    .filter((s) => s.type !== 'llm_fallback')
    .map(resolveSourceCredentials)
    .filter((s) => s.enabled)
    .sort((a, b) => a.priority - b.priority);

  let result: KnowledgeResult | null = null;

  for (const source of enabledSources) {
    try {
      switch (source.type) {
        case 'wolfram_api':
        case 'wolfram_mcp':
          result = await resolveWolframApi(query, source);
          break;
        case 'custom_mcp':
          result = await resolveCustomMcp(query, source);
          break;
        case 'external_api':
          result = await resolveExternalApi(query, source);
          break;
        case 'static_pyq':
          result = await resolveStaticPYQ(query, source);
          break;
        case 'rag_supabase':
          result = await resolveRAG(query, source);
          break;
      }
    } catch {
      result = null;
    }

    if (result && result.confidence >= (source.minConfidence ?? 0.5)) {
      break;
    }
    result = null;
  }

  if (!result) {
    result = await resolveLLMFallback(query);
  }

  logQuery({
    query: query.text,
    examId: query.examId,
    topicId: query.topicId,
    timestamp: new Date().toISOString(),
    resolvedSource: result.source,
    sourceId: result.sourceId,
    answerPreview: result.answer.slice(0, 200),
    confidence: result.confidence,
    sessionId: query.sessionId,
  });

  if (result.confidence >= 0.7 && result.source !== 'llm_fallback') {
    queueForRagIndexing(query, result).catch(() => {});
  }

  return result;
}
