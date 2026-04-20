// @ts-nocheck
/**
 * Content Telemetry
 *
 * Observability layer for the four-tier resolver. Every resolve() call flows
 * an anonymized data point into this store so the admin dashboard can show
 * tier hit rates, cost per day, and LLM fallback rate.
 *
 * Storage: same flat-file pattern as aggregate.ts — no Postgres dependency.
 * Key: source type + day bucket. Value: counters + cost accumulator.
 *
 * Endpoints (wired in content-routes.ts):
 *   POST /api/content/telemetry — ingest a single resolve event (fire-and-forget)
 *   GET  /api/content/telemetry/summary — admin-only summary
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.AGGREGATE_DATA_DIR || path.resolve(process.cwd(), '.data');
const TELEMETRY_FILE = path.join(DATA_DIR, 'content-telemetry.json');

interface DailyBucket {
  day: string;
  total_events: number;
  by_source: Record<string, number>;
  total_cost_usd: number;
  total_latency_ms: number;
  by_topic: Record<string, number>;
}

interface TelemetryState {
  version: 1;
  started_at: string;
  daily: Record<string, DailyBucket>;
  lifetime: {
    total_events: number;
    by_source: Record<string, number>;
    total_cost_usd: number;
  };
}

export interface TelemetryEvent {
  source: string;
  latency_ms: number;
  cost_usd: number;
  topic?: string;
  concept_id?: string;
  tier_requested?: number;
  wolfram_verified?: boolean;
}

function emptyState(): TelemetryState {
  return {
    version: 1,
    started_at: new Date().toISOString(),
    daily: {},
    lifetime: { total_events: 0, by_source: {}, total_cost_usd: 0 },
  };
}

function loadState(): TelemetryState {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(TELEMETRY_FILE)) {
      return JSON.parse(fs.readFileSync(TELEMETRY_FILE, 'utf-8'));
    }
  } catch {}
  return emptyState();
}

function saveState(state: TelemetryState) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = TELEMETRY_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, TELEMETRY_FILE);
}

const VALID_SOURCES = new Set([
  'tier-0-bundle-exact', 'tier-0-explainer', 'tier-0-client-cache',
  'tier-1-rag', 'tier-1-material',
  'tier-2-generated', 'tier-3-wolfram-verified',
  'miss',
]);

const KEBAB_RE = /^[a-z0-9-]+$/;

function sanitize(ev: any): TelemetryEvent | null {
  if (!ev || typeof ev !== 'object') return null;
  if (typeof ev.source !== 'string' || !VALID_SOURCES.has(ev.source)) return null;
  const latency_ms = Number(ev.latency_ms);
  const cost_usd = Number(ev.cost_usd);
  if (!Number.isFinite(latency_ms) || latency_ms < 0 || latency_ms > 120000) return null;
  if (!Number.isFinite(cost_usd) || cost_usd < 0 || cost_usd > 1) return null;
  const clean: TelemetryEvent = { source: ev.source, latency_ms, cost_usd };
  if (typeof ev.topic === 'string' && ev.topic.length < 60 && KEBAB_RE.test(ev.topic)) clean.topic = ev.topic;
  if (typeof ev.concept_id === 'string' && ev.concept_id.length < 60 && KEBAB_RE.test(ev.concept_id)) clean.concept_id = ev.concept_id;
  if (Number.isFinite(ev.tier_requested)) clean.tier_requested = ev.tier_requested;
  if (typeof ev.wolfram_verified === 'boolean') clean.wolfram_verified = ev.wolfram_verified;
  return clean;
}

/** Record a single telemetry event. Creates or updates the day bucket. */
export function recordTelemetry(rawEvent: any): { accepted: boolean } {
  const ev = sanitize(rawEvent);
  if (!ev) return { accepted: false };

  const state = loadState();
  const today = new Date().toISOString().slice(0, 10);
  const bucket = state.daily[today] || {
    day: today,
    total_events: 0,
    by_source: {},
    total_cost_usd: 0,
    total_latency_ms: 0,
    by_topic: {},
  };

  bucket.total_events += 1;
  bucket.by_source[ev.source] = (bucket.by_source[ev.source] || 0) + 1;
  bucket.total_cost_usd += ev.cost_usd;
  bucket.total_latency_ms += ev.latency_ms;
  if (ev.topic) bucket.by_topic[ev.topic] = (bucket.by_topic[ev.topic] || 0) + 1;
  state.daily[today] = bucket;

  state.lifetime.total_events += 1;
  state.lifetime.by_source[ev.source] = (state.lifetime.by_source[ev.source] || 0) + 1;
  state.lifetime.total_cost_usd += ev.cost_usd;

  try { saveState(state); return { accepted: true }; }
  catch { return { accepted: false }; }
}

export function getTelemetrySummary() {
  const state = loadState();
  const days = Object.keys(state.daily).sort();
  const last14 = days.slice(-14).map(d => {
    const b = state.daily[d];
    const avgLatency = b.total_events > 0 ? Math.round(b.total_latency_ms / b.total_events) : 0;
    const tier0Count = (b.by_source['tier-0-bundle-exact'] || 0) + (b.by_source['tier-0-explainer'] || 0) + (b.by_source['tier-0-client-cache'] || 0);
    const tier1Count = (b.by_source['tier-1-rag'] || 0) + (b.by_source['tier-1-material'] || 0);
    const tier2Count = b.by_source['tier-2-generated'] || 0;
    const tier3Count = b.by_source['tier-3-wolfram-verified'] || 0;
    const missCount = b.by_source['miss'] || 0;
    return {
      day: d,
      total: b.total_events,
      cost_usd: Number(b.total_cost_usd.toFixed(4)),
      avg_latency_ms: avgLatency,
      tier_0: tier0Count,
      tier_1: tier1Count,
      tier_2: tier2Count,
      tier_3: tier3Count,
      miss: missCount,
      free_hit_rate_pct: b.total_events > 0 ? Math.round(((tier0Count + tier1Count) / b.total_events) * 100) : 0,
    };
  });

  const total = state.lifetime.total_events;
  const freeHits = (state.lifetime.by_source['tier-0-bundle-exact'] || 0)
    + (state.lifetime.by_source['tier-0-explainer'] || 0)
    + (state.lifetime.by_source['tier-0-client-cache'] || 0)
    + (state.lifetime.by_source['tier-1-rag'] || 0)
    + (state.lifetime.by_source['tier-1-material'] || 0);

  return {
    lifetime: {
      total_events: total,
      total_cost_usd: Number(state.lifetime.total_cost_usd.toFixed(4)),
      by_source: state.lifetime.by_source,
      free_hit_rate_pct: total > 0 ? Math.round((freeHits / total) * 100) : 0,
      avg_cost_per_event_usd: total > 0 ? Number((state.lifetime.total_cost_usd / total).toFixed(6)) : 0,
    },
    last_14_days: last14,
    started_at: state.started_at,
  };
}
