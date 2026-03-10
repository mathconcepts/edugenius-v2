/**
 * contentSyncService.ts — Cross-Agent Sync Layer
 *
 * Ensures data flows correctly between all content-related agents and services:
 *   userResearchSkill → strategy selector
 *   Scout (Reddit/Trends) → content topics + hooks
 *   Atlas (generation) → RAG indexer
 *   Herald (delivery) → Oracle (performance)
 *   RAG → Sage's knowledge base
 *
 * All localStorage keys prefixed `edugenius_content_`.
 * Sync health emitted to `localStorage['content_sync_health']`.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncConnectionId =
  | 'user_intent_to_strategy'
  | 'scout_to_topics'
  | 'atlas_to_rag'
  | 'herald_to_oracle'
  | 'rag_to_sage'
  | 'strategy_to_atlas'
  | 'oracle_to_feedback'
  | 'page_builder_to_oracle';

export type SyncStatus = 'live' | 'broken' | 'degraded' | 'unconfigured';

export interface SyncConnection {
  id: SyncConnectionId;
  label: string;
  from: string;
  to: string;
  description: string;
  status: SyncStatus;
  lastSignalTs?: number;
  lastSignalKey?: string;
  signalAgeMs?: number;
  detail?: string;
}

export interface SyncHealthReport {
  connections: SyncConnection[];
  liveCount: number;
  brokenCount: number;
  degradedCount: number;
  unconfiguredCount: number;
  overallHealth: 'healthy' | 'degraded' | 'critical';
  generatedAt: string;
}

// ─── Signal constants ─────────────────────────────────────────────────────────

// Source signals emitted by each agent
const SIGNAL_KEYS: Record<SyncConnectionId, { key: string; maxAgeMs: number }> = {
  user_intent_to_strategy: {
    key: 'content:user_intent',
    maxAgeMs: 3600000,   // 1 hour
  },
  scout_to_topics: {
    key: 'content:scout:insights',
    maxAgeMs: 86400000,  // 24 hours
  },
  atlas_to_rag: {
    key: 'content:atlas:content_ready',
    maxAgeMs: 3600000,
  },
  herald_to_oracle: {
    key: 'content:herald:distribute_request',
    maxAgeMs: 3600000,
  },
  rag_to_sage: {
    key: 'edugenius_rag_indexer_job',
    maxAgeMs: 3600000,
  },
  strategy_to_atlas: {
    key: 'content:strategy:selected',
    maxAgeMs: 3600000,
  },
  oracle_to_feedback: {
    key: 'content:oracle:track_campaign',
    maxAgeMs: 86400000,
  },
  page_builder_to_oracle: {
    key: 'edugenius_content_built_pages',
    maxAgeMs: 86400000,
  },
};

// Connection metadata
const CONNECTION_META: Record<SyncConnectionId, { label: string; from: string; to: string; description: string }> = {
  user_intent_to_strategy: {
    label: 'User Intent → Strategy',
    from: 'userResearchSkill',
    to: 'contentStrategyService',
    description: 'Student/teacher intent signals flow into strategy selector to personalise content type and tone.',
  },
  scout_to_topics: {
    label: 'Scout → Content Topics',
    from: 'scoutIntelligenceService',
    to: 'contentGenerationHub',
    description: 'Reddit/Trends intelligence from Scout feeds recommended topics and hooks for content generation.',
  },
  atlas_to_rag: {
    label: 'Atlas → RAG Indexer',
    from: 'contentGenerationHub (Atlas)',
    to: 'ragIndexer',
    description: 'Every Atlas-generated content piece is indexed in the RAG store for future retrieval.',
  },
  herald_to_oracle: {
    label: 'Herald → Oracle',
    from: 'contentDeliveryService (Herald)',
    to: 'Oracle analytics',
    description: 'Content delivery events are tracked by Oracle for performance measurement.',
  },
  rag_to_sage: {
    label: 'RAG → Sage',
    from: 'ragIndexer',
    to: 'Sage (Socratic Tutor)',
    description: 'RAG knowledge base feeds Sage\'s retrieval context for tutoring responses.',
  },
  strategy_to_atlas: {
    label: 'Strategy → Atlas',
    from: 'contentStrategyService',
    to: 'contentGenerationHub (Atlas)',
    description: 'Content strategy (exam × audience × channel) selector feeds Atlas generation requests.',
  },
  oracle_to_feedback: {
    label: 'Oracle → Feedback Loop',
    from: 'Oracle analytics',
    to: 'Strategy / Content Quality',
    description: 'Oracle performance metrics feed back into strategy and quality improvements.',
  },
  page_builder_to_oracle: {
    label: 'Page Builder → Oracle',
    from: 'localPageBuilderService',
    to: 'Oracle analytics',
    description: 'Deployed landing pages feed conversion metrics to Oracle.',
  },
};

// ─── Signal reader ────────────────────────────────────────────────────────────

function readSignalTs(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    // Try to parse ts field
    const parsed = JSON.parse(raw) as { ts?: number; payload?: unknown };
    if (parsed.ts) return parsed.ts;
    // Some signals just store data directly
    return Date.now() - 1000; // treat as fresh if data exists
  } catch {
    // Key exists but not JSON — still counts as live
    if (localStorage.getItem(key) !== null) return Date.now() - 1000;
    return null;
  }
}

// ─── Connection checker ───────────────────────────────────────────────────────

function checkConnection(id: SyncConnectionId): SyncConnection {
  const meta = CONNECTION_META[id];
  const signal = SIGNAL_KEYS[id];
  const now = Date.now();

  const ts = readSignalTs(signal.key);

  let status: SyncStatus;
  let detail: string;

  if (ts === null) {
    status = 'unconfigured';
    detail = `No signal found at ${signal.key}`;
  } else {
    const age = now - ts;
    const signalAgeMs = age;
    if (age <= signal.maxAgeMs) {
      status = 'live';
      detail = `Last signal ${Math.round(age / 1000)}s ago`;
    } else if (age <= signal.maxAgeMs * 3) {
      status = 'degraded';
      detail = `Signal stale: ${Math.round(age / 60000)}m ago (max: ${Math.round(signal.maxAgeMs / 60000)}m)`;
    } else {
      status = 'broken';
      detail = `Signal too old: ${Math.round(age / 3600000)}h ago`;
    }
    const conn: SyncConnection = {
      id,
      ...meta,
      status,
      lastSignalTs: ts,
      lastSignalKey: signal.key,
      signalAgeMs,
      detail,
    };
    return conn;
  }

  return {
    id,
    ...meta,
    status,
    lastSignalTs: ts ?? undefined,
    lastSignalKey: signal.key,
    detail,
  };
}

// ─── Audit function ───────────────────────────────────────────────────────────

export function auditContentSync(): SyncHealthReport {
  const connectionIds: SyncConnectionId[] = [
    'user_intent_to_strategy',
    'scout_to_topics',
    'atlas_to_rag',
    'herald_to_oracle',
    'rag_to_sage',
    'strategy_to_atlas',
    'oracle_to_feedback',
    'page_builder_to_oracle',
  ];

  const connections = connectionIds.map(checkConnection);
  const liveCount = connections.filter(c => c.status === 'live').length;
  const brokenCount = connections.filter(c => c.status === 'broken').length;
  const degradedCount = connections.filter(c => c.status === 'degraded').length;
  const unconfiguredCount = connections.filter(c => c.status === 'unconfigured').length;

  const overallHealth: SyncHealthReport['overallHealth'] =
    brokenCount > 2 ? 'critical' :
    (brokenCount > 0 || degradedCount > 2 || unconfiguredCount > 3) ? 'degraded' :
    'healthy';

  const report: SyncHealthReport = {
    connections,
    liveCount,
    brokenCount,
    degradedCount,
    unconfiguredCount,
    overallHealth,
    generatedAt: new Date().toISOString(),
  };

  // Emit sync health
  try {
    localStorage.setItem('content_sync_health', JSON.stringify(report));
    localStorage.setItem('edugenius_content_sync_last_audit', new Date().toISOString());
  } catch { /* ignore */ }

  return report;
}

// ─── User intent sync ─────────────────────────────────────────────────────────

/**
 * Called by userResearchSkill when new user signals are available.
 * Feeds into strategy selector.
 */
export function syncUserIntent(intent: {
  userId: string;
  exam: string;
  preferredChannel: string;
  studyStyle: string;
  archetype: string;
}): void {
  try {
    localStorage.setItem('content:user_intent', JSON.stringify({
      payload: intent,
      ts: Date.now(),
    }));
    // Also update strategy selector preference
    localStorage.setItem('edugenius_content_user_intent_latest', JSON.stringify(intent));
  } catch { /* ignore */ }
}

/**
 * Get the latest user intent signal.
 */
export function getLatestUserIntent(): {
  userId: string;
  exam: string;
  preferredChannel: string;
  studyStyle: string;
  archetype: string;
} | null {
  try {
    const raw = localStorage.getItem('edugenius_content_user_intent_latest');
    if (!raw) return null;
    return JSON.parse(raw) as ReturnType<typeof getLatestUserIntent>;
  } catch {
    return null;
  }
}

// ─── Scout sync ───────────────────────────────────────────────────────────────

/**
 * Called by Scout when new market intelligence is ready.
 */
export function syncScoutInsights(insights: {
  trendingTopics: string[];
  recommendedAngles: string[];
  audienceSignals: string[];
  capturedAt: string;
}): void {
  try {
    localStorage.setItem('content:scout:insights', JSON.stringify({
      payload: insights,
      ts: Date.now(),
    }));
    localStorage.setItem('edugenius_content_scout_insights_latest', JSON.stringify(insights));
  } catch { /* ignore */ }
}

export interface ScoutInsightsPayload {
  trendingTopics: string[];
  recommendedAngles: string[];
  audienceSignals: string[];
  capturedAt: string;
}

/**
 * Get latest Scout insights for content topics/hooks.
 */
export function getLatestScoutInsights(): ScoutInsightsPayload | null {
  try {
    const raw = localStorage.getItem('edugenius_content_scout_insights_latest');
    if (!raw) return null;
    return JSON.parse(raw) as ScoutInsightsPayload;
  } catch {
    return null;
  }
}

// ─── Atlas → RAG sync ─────────────────────────────────────────────────────────

/**
 * Called after Atlas generates content — triggers RAG indexing.
 */
export function syncAtlasToRag(data: {
  campaignId: string;
  exam: string;
  topic: string;
  channelCount: number;
}): void {
  try {
    localStorage.setItem('content:atlas:content_ready', JSON.stringify({
      payload: data,
      ts: Date.now(),
    }));
    // Queue for RAG indexer
    const queue = JSON.parse(localStorage.getItem('edugenius_content_rag_queue') ?? '[]') as typeof data[];
    queue.push(data);
    localStorage.setItem('edugenius_content_rag_queue', JSON.stringify(queue));
  } catch { /* ignore */ }
}

// ─── Herald → Oracle sync ─────────────────────────────────────────────────────

/**
 * Called when Herald distributes content — registers with Oracle.
 */
export function syncHeraldToOracle(data: {
  campaignId: string;
  channels: string[];
  distributedAt: string;
}): void {
  try {
    localStorage.setItem('content:herald:distribute_request', JSON.stringify({
      payload: data,
      ts: Date.now(),
    }));
    // Oracle tracking registry
    const registry = JSON.parse(localStorage.getItem('edugenius_content_oracle_registry') ?? '[]') as typeof data[];
    registry.push(data);
    localStorage.setItem('edugenius_content_oracle_registry', JSON.stringify(registry));
  } catch { /* ignore */ }
}

// ─── RAG → Sage sync ─────────────────────────────────────────────────────────

/**
 * Checks if RAG is keeping Sage's knowledge base updated.
 */
export function checkRagSageSync(): { isSynced: boolean; lastIndexed: string | null } {
  try {
    const ragJob = JSON.parse(localStorage.getItem('edugenius_rag_indexer_job') ?? 'null') as {
      status: string;
      lastRun?: string;
    } | null;
    if (!ragJob) return { isSynced: false, lastIndexed: null };
    return {
      isSynced: ragJob.status === 'done' || ragJob.status === 'idle',
      lastIndexed: ragJob.lastRun ?? null,
    };
  } catch {
    return { isSynced: false, lastIndexed: null };
  }
}

// ─── Emit sync health on demand ───────────────────────────────────────────────

export function emitSyncHealth(): void {
  const report = auditContentSync();
  try {
    localStorage.setItem('content_sync_health', JSON.stringify(report));
  } catch { /* ignore */ }
}

// ─── Watch for sync changes (event listener) ─────────────────────────────────

export function watchSyncHealth(callback: (report: SyncHealthReport) => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key?.startsWith('content:') || e.key === 'edugenius_rag_indexer_job') {
      const report = auditContentSync();
      callback(report);
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
