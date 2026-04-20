// @ts-nocheck
/**
 * Cohort Aggregation — Phase 7 of PLAN-dbless-gbrain.md.
 *
 * Opt-in anonymous stats from clients. Stored in a flat JSON file on disk
 * (no Postgres dependency — survives DB-less deployment).
 *
 * Why file-backed: preserves the DB-less promise. For scale beyond 10k events/day,
 * swap to Cloudflare KV or Upstash Redis — same interface.
 *
 * Endpoints:
 *   POST /api/aggregate          — receive batched anonymized events
 *   POST /api/aggregate/event    — receive single event (simpler client API)
 *   GET  /api/aggregate/cohort   — detailed aggregate (admin/teacher)
 *   GET  /api/aggregate/stats    — public summary (non-sensitive)
 *
 * Payload rule: events contain ONLY concept_id, error_type, topic, motivation_state,
 * is_correct, misconception_id. Never session_id, never text, never PII.
 */

import { ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import { requireRole } from './auth-middleware';

interface ParsedRequest {
  pathname: string;
  query: URLSearchParams;
  params: Record<string, string>;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
}

type RouteHandler = (req: ParsedRequest, res: ServerResponse) => Promise<void>;

const DATA_DIR = process.env.AGGREGATE_DATA_DIR || path.resolve(process.cwd(), '.data');
const AGGREGATE_FILE = process.env.AGGREGATE_STORE_PATH || path.join(DATA_DIR, 'aggregate.json');
const MAX_EVENTS_PER_DAY = 50_000;

interface AggregateState {
  version: 2;
  started_at: string;
  day: string;
  events_today: number;
  total_events: number;
  by_concept: Record<string, number>;
  by_error_type: Record<string, number>;
  by_topic: Record<string, { attempts: number; correct: number }>;
  by_motivation: Record<string, number>;
  misconceptions: Record<string, { count: number; concept_id?: string; topic?: string; description?: string }>;
  daily_active: Record<string, number>;
}

function sendJSON(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, status: number, msg: string) {
  sendJSON(res, { error: msg }, status);
}

function emptyState(): AggregateState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    version: 2,
    started_at: new Date().toISOString(),
    day: today,
    events_today: 0,
    total_events: 0,
    by_concept: {},
    by_error_type: {},
    by_topic: {},
    by_motivation: {},
    misconceptions: {},
    daily_active: {},
  };
}

function loadState(): AggregateState {
  try {
    fs.mkdirSync(path.dirname(AGGREGATE_FILE), { recursive: true });
    if (fs.existsSync(AGGREGATE_FILE)) {
      const raw = fs.readFileSync(AGGREGATE_FILE, 'utf-8');
      const state = JSON.parse(raw);
      const today = new Date().toISOString().slice(0, 10);
      // Day rollover — reset events_today counter
      if (state.day !== today) {
        state.daily_active[state.day] = state.events_today;
        state.day = today;
        state.events_today = 0;
      }
      // Migrate v1 → v2 if needed
      if (state.version === 1) {
        state.version = 2;
        state.day = state.day || today;
        state.events_today = state.events_today || 0;
        if (!state.by_topic || (Object.keys(state.by_topic).length > 0 && typeof Object.values(state.by_topic)[0] === 'number')) {
          state.by_topic = {};
        }
      }
      return state;
    }
  } catch {}
  return emptyState();
}

function saveState(state: AggregateState) {
  state.daily_active[state.day] = state.events_today;
  fs.mkdirSync(path.dirname(AGGREGATE_FILE), { recursive: true });
  const tmp = AGGREGATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, AGGREGATE_FILE);
}

// ============================================================================
// Event sanitization — strict regex, bounded lengths, no arbitrary text
// ============================================================================

const KEBAB_RE = /^[a-z0-9-]+$/;
const SNAKE_RE = /^[a-z_]+$/;
const MOTIVATION_STATES = ['driven', 'steady', 'flagging', 'frustrated', 'anxious'];

function sanitizeEvent(e: any): any | null {
  if (!e || typeof e !== 'object') return null;
  const clean: any = {};
  // Accept both `concept` and `concept_id` key names
  const conceptVal = e.concept_id || e.concept;
  if (typeof conceptVal === 'string' && conceptVal.length < 80 && KEBAB_RE.test(conceptVal)) clean.concept_id = conceptVal;
  if (typeof e.error_type === 'string' && e.error_type.length < 40 && SNAKE_RE.test(e.error_type)) clean.error_type = e.error_type;
  if (typeof e.topic === 'string' && e.topic.length < 80 && KEBAB_RE.test(e.topic)) clean.topic = e.topic;
  if (typeof e.motivation_state === 'string' && MOTIVATION_STATES.includes(e.motivation_state)) clean.motivation_state = e.motivation_state;
  if (typeof e.misconception_id === 'string' && e.misconception_id.length < 80 && KEBAB_RE.test(e.misconception_id)) clean.misconception_id = e.misconception_id;
  // Accept both `misconception_description` and `misconception_example`
  const descVal = e.misconception_description || e.misconception_example;
  if (typeof descVal === 'string' && descVal.length < 200) clean.misconception_description = descVal.slice(0, 200);
  if (typeof e.is_correct === 'boolean') clean.is_correct = e.is_correct;
  return Object.keys(clean).length > 0 ? clean : null;
}

function applyEvent(state: AggregateState, e: any): void {
  state.total_events += 1;
  state.events_today += 1;
  if (e.concept_id) state.by_concept[e.concept_id] = (state.by_concept[e.concept_id] || 0) + 1;
  if (e.error_type) state.by_error_type[e.error_type] = (state.by_error_type[e.error_type] || 0) + 1;
  if (e.topic) {
    const t = state.by_topic[e.topic] || { attempts: 0, correct: 0 };
    t.attempts += 1;
    if (e.is_correct) t.correct += 1;
    state.by_topic[e.topic] = t;
  }
  if (e.motivation_state) state.by_motivation[e.motivation_state] = (state.by_motivation[e.motivation_state] || 0) + 1;
  if (e.misconception_id) {
    const m = state.misconceptions[e.misconception_id] || { count: 0 };
    m.count += 1;
    if (e.concept_id) m.concept_id = e.concept_id;
    if (e.topic) m.topic = e.topic;
    if (e.misconception_description && !m.description) m.description = e.misconception_description;
    state.misconceptions[e.misconception_id] = m;
  }
}

// ============================================================================
// POST /api/aggregate — batched ingest
// ============================================================================

async function handleIngestBatch(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = req.body as any;
  const events: any[] = Array.isArray(body?.events) ? body.events : [];
  if (events.length === 0) return sendError(res, 400, 'events array required');
  if (events.length > 100) return sendError(res, 400, 'max 100 events per batch');

  const state = loadState();

  if (state.events_today >= MAX_EVENTS_PER_DAY) {
    return sendJSON(res, { accepted: 0, rejected: events.length, rate_limited: true });
  }

  let accepted = 0;
  for (const raw of events) {
    const e = sanitizeEvent(raw);
    if (!e) continue;
    applyEvent(state, e);
    accepted++;
    if (state.events_today >= MAX_EVENTS_PER_DAY) break;
  }

  try {
    saveState(state);
    sendJSON(res, { accepted, rejected: events.length - accepted });
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
}

// ============================================================================
// POST /api/aggregate/event — single event
// ============================================================================

async function handleIngestSingle(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = (req.body as any) || {};
  const e = sanitizeEvent(body);
  if (!e) return sendJSON(res, { ok: true, rejected: true });

  const state = loadState();
  if (state.events_today >= MAX_EVENTS_PER_DAY) {
    return sendJSON(res, { ok: true, rate_limited: true });
  }
  applyEvent(state, e);

  try {
    saveState(state);
    sendJSON(res, { ok: true });
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
}

// ============================================================================
// GET /api/aggregate/cohort — admin/teacher detailed aggregate
// ============================================================================

async function handleCohortReport(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const user = await requireRole(req, res, 'admin', 'teacher');
  if (!user) return;

  const state = loadState();

  const topMisconceptions = Object.entries(state.misconceptions)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 30)
    .map(([id, v]) => ({ id, ...v }));

  const topConcepts = Object.entries(state.by_concept)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([concept_id, count]) => ({ concept_id, count }));

  const topErrorTypes = Object.entries(state.by_error_type)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));

  const topicAccuracy = Object.entries(state.by_topic).map(([topic, t]) => ({
    topic,
    attempts: t.attempts,
    correct: t.correct,
    accuracy: t.attempts > 0 ? t.correct / t.attempts : 0,
  }));

  sendJSON(res, {
    version: state.version,
    started_at: state.started_at,
    day: state.day,
    events_today: state.events_today,
    total_events: state.total_events,
    top_misconceptions: topMisconceptions,
    top_concepts: topConcepts,
    bottleneck_concepts: topConcepts,
    error_type_distribution: topErrorTypes,
    topic_accuracy: topicAccuracy,
    motivation_health: state.by_motivation,
    daily_active_last_14: Object.entries(state.daily_active)
      .sort()
      .slice(-14)
      .map(([day, count]) => ({ day, count })),
  });
}

// ============================================================================
// GET /api/aggregate/stats — public summary
// ============================================================================

async function handlePublicStats(_req: ParsedRequest, res: ServerResponse): Promise<void> {
  const state = loadState();
  sendJSON(res, {
    total_events: state.total_events,
    events_today: state.events_today,
    active_days: Object.keys(state.daily_active).length,
    misconception_count: Object.keys(state.misconceptions).length,
    concept_coverage: Object.keys(state.by_concept).length,
  });
}

// ============================================================================
// Export routes
// ============================================================================

export const aggregateRoutes: Array<{ method: string; path: string; handler: RouteHandler }> = [
  { method: 'POST', path: '/api/aggregate', handler: handleIngestBatch },
  { method: 'POST', path: '/api/aggregate/event', handler: handleIngestSingle },
  { method: 'GET', path: '/api/aggregate/cohort', handler: handleCohortReport },
  { method: 'GET', path: '/api/aggregate/stats', handler: handlePublicStats },
];
