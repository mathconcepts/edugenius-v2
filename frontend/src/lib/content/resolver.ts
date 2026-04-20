/**
 * Client-Side Content Resolver
 *
 * The client companion to src/content/resolver.ts. Provides the same four-tier
 * cascade experience on the browser, but with an important optimization:
 * the content bundle is fetched ONCE and cached in IndexedDB / memory, so
 * 80%+ of requests never touch the network at all.
 *
 * Flow:
 *   1. Try local bundle (Tier 0) — instant, free, offline-safe
 *   2. Try local RAG (Tier 1) — if query_embedding provided, search uploaded
 *      material chunks + bundle
 *   3. Call server resolver for Tier 2+ (generation / Wolfram verification)
 *
 * This is the cost moat on the client side: students practicing from a fully
 * loaded bundle never cost us a cent.
 */

import { searchMaterials, getCachedProblems, saveGeneratedProblem } from '../gbrain/db';
import { embed } from '../gbrain/embedder';

export type ContentSource =
  | 'tier-0-bundle-exact'
  | 'tier-0-explainer'
  | 'tier-0-client-cache'
  | 'tier-1-rag'
  | 'tier-1-material'
  | 'tier-2-generated'
  | 'tier-3-wolfram-verified'
  | 'miss';

export interface ResolvedContent {
  source: ContentSource;
  problem?: any;
  explainer?: any;
  confidence: number;
  latency_ms: number;
  wolfram_verified?: boolean;
  cost_estimate_usd: number;
  material_refs?: Array<{ material_id: string; chunk_id: string; score: number }>;
}

export interface ResolveRequest {
  intent: 'practice' | 'explain' | 'verify';
  concept_id?: string;
  topic?: string;
  difficulty?: number;
  target_error_type?: string;
  query_text?: string;
  problem_text?: string;
  expected_answer?: string;
  max_tier?: 0 | 1 | 2 | 3;
  require_wolfram?: boolean;
  /** If true, also search uploaded materials in tier-1 */
  use_materials?: boolean;
}

// ============================================================================
// Bundle loading (fetched once, cached in memory for the session)
// ============================================================================

interface ContentBundle {
  version: number;
  problems: any[];
  explainers: Record<string, any>;
  stats?: any;
}

let _bundlePromise: Promise<ContentBundle> | null = null;

function getBundle(): Promise<ContentBundle> {
  if (_bundlePromise) return _bundlePromise;
  _bundlePromise = (async () => {
    try {
      const res = await fetch('/data/content-bundle.json', { cache: 'force-cache' });
      if (!res.ok) throw new Error(`bundle HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      // Fallback to legacy pyq-bank.json
      try {
        const fallback = await fetch('/data/pyq-bank.json');
        if (fallback.ok) {
          const pyq = await fallback.json();
          return { version: 0, problems: pyq.problems || [], explainers: {} };
        }
      } catch {}
      return { version: 0, problems: [], explainers: {} };
    }
  })();
  return _bundlePromise;
}

// Call once at app start to warm the cache
export async function warmContentBundle(): Promise<void> {
  await getBundle();
}

// ============================================================================
// Tier 0: bundle match
// ============================================================================

function normalizeDifficulty(d: any): number {
  if (typeof d === 'number') return d;
  if (d === 'easy') return 0.25;
  if (d === 'medium') return 0.5;
  if (d === 'hard') return 0.75;
  return 0.5;
}

function tier0(req: ResolveRequest, bundle: ContentBundle): ResolvedContent | null {
  if (req.intent === 'explain' && req.concept_id) {
    const exp = bundle.explainers[req.concept_id];
    if (exp) {
      return {
        source: 'tier-0-explainer',
        explainer: exp,
        confidence: 1.0,
        latency_ms: 1,
        cost_estimate_usd: 0,
      };
    }
  }

  if (req.intent === 'practice' && (req.concept_id || req.topic)) {
    const difficulty = req.difficulty ?? 0.5;
    const tolerance = 0.25;

    const targetMatch = (p: any) => {
      if (req.concept_id) {
        if (p.concept_id === req.concept_id) return true;
        if (!p.concept_id && p.topic === req.concept_id) return true;
        if (p.topic === req.concept_id) return true;
      }
      if (req.topic && p.topic === req.topic) return true;
      return false;
    };

    // Primary: concept + difficulty within tolerance
    let matches = bundle.problems.filter(p => {
      if (!targetMatch(p)) return false;
      const pDiff = normalizeDifficulty(p.difficulty);
      if (Math.abs(pDiff - difficulty) > tolerance) return false;
      if (req.target_error_type && p.target_error_type && p.target_error_type !== req.target_error_type) return false;
      return true;
    });

    // Fallback: any difficulty for this concept
    if (matches.length === 0) {
      matches = bundle.problems.filter(p => {
        if (!targetMatch(p)) return false;
        if (req.target_error_type && p.target_error_type && p.target_error_type !== req.target_error_type) return false;
        return true;
      });
    }

    if (matches.length > 0) {
      matches.sort((a, b) => {
        const av = (a.wolfram_verified ? 2 : 0) + (a.verified ? 1 : 0);
        const bv = (b.wolfram_verified ? 2 : 0) + (b.verified ? 1 : 0);
        return bv - av;
      });
      const picked = matches[Math.floor(Math.random() * Math.min(matches.length, 3))];
      return {
        source: 'tier-0-bundle-exact',
        problem: picked,
        confidence: picked.wolfram_verified ? 1.0 : picked.verified ? 0.9 : 0.7,
        latency_ms: 2,
        wolfram_verified: !!picked.wolfram_verified,
        cost_estimate_usd: 0,
      };
    }
  }
  return null;
}

// ============================================================================
// Tier 1: client-side semantic RAG over materials + bundle
// ============================================================================

async function tier1(req: ResolveRequest): Promise<ResolvedContent | null> {
  if (!req.use_materials || !req.query_text) return null;
  try {
    const queryVec = await embed(req.query_text);
    const matches = await searchMaterials(queryVec, 3);
    const good = matches.filter(m => m.score > 0.55);
    if (good.length === 0) return null;

    return {
      source: 'tier-1-material',
      confidence: good[0].score,
      latency_ms: 80,
      cost_estimate_usd: 0,
      material_refs: good.map(m => ({ material_id: 'material', chunk_id: m.chunk_id, score: m.score })),
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Tier 0.5: check per-device generated cache
// ============================================================================

async function clientCache(req: ResolveRequest): Promise<ResolvedContent | null> {
  if (req.intent !== 'practice' || !req.concept_id) return null;
  const cached = await getCachedProblems(req.concept_id, req.difficulty ?? 0.5).catch(() => []);
  if (cached.length === 0) return null;
  const picked = cached[Math.floor(Math.random() * cached.length)];
  return {
    source: 'tier-0-client-cache',
    problem: picked,
    confidence: 0.85,
    latency_ms: 5,
    wolfram_verified: false,
    cost_estimate_usd: 0,
  };
}

// ============================================================================
// Tier 2+: server call
// ============================================================================

async function serverResolve(req: ResolveRequest): Promise<ResolvedContent | null> {
  const start = Date.now();
  try {
    const res = await fetch('/api/content/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) return null;
    const result = await res.json();
    // If server tier-2 generated a problem, cache it client-side for next time
    if (result.source === 'tier-2-generated' && result.problem) {
      try {
        await saveGeneratedProblem({
          id: result.problem.id || `gen-${Date.now()}`,
          concept_id: result.problem.concept_id || req.concept_id || '',
          topic: result.problem.topic || req.topic || '',
          difficulty: result.problem.difficulty ?? req.difficulty ?? 0.5,
          question_text: result.problem.question_text,
          correct_answer: result.problem.correct_answer,
          solution_steps: result.problem.solution_steps || [],
          distractors: result.problem.distractors || [],
          target_error_type: req.target_error_type,
          verified: !!result.wolfram_verified,
          created_at: new Date().toISOString(),
        });
      } catch {}
    }
    result.latency_ms = result.latency_ms || (Date.now() - start);
    return result;
  } catch {
    return null;
  }
}

// ============================================================================
// Main entry
// ============================================================================

/**
 * Fire-and-forget telemetry ping to server. Client-side tier-0/1 hits never
 * touch the resolve endpoint, so without this they'd be invisible to admin.
 * Use keepalive so in-flight requests survive page unload.
 */
function pingTelemetry(result: ResolvedContent, req: ResolveRequest): void {
  try {
    const payload = {
      source: result.source,
      latency_ms: result.latency_ms,
      cost_usd: result.cost_estimate_usd,
      topic: req.topic,
      concept_id: req.concept_id,
      tier_requested: req.max_tier,
      wolfram_verified: result.wolfram_verified,
    };
    fetch('/api/content/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {}); // swallow — telemetry must never break the user path
  } catch {}
}

/**
 * Resolve a content request. Walks tiers 0 → 3, short-circuiting on first hit.
 * Returns a `miss` if no tier succeeds (e.g., offline with no bundle match).
 */
export async function resolve(req: ResolveRequest): Promise<ResolvedContent> {
  const start = Date.now();
  const maxTier = req.max_tier ?? 3;

  // Tier 0a — bundle
  if (maxTier >= 0) {
    const bundle = await getBundle();
    const t0 = tier0(req, bundle);
    if (t0) { pingTelemetry(t0, req); return t0; }
  }

  // Tier 0b — per-device cache
  if (maxTier >= 0) {
    const cache = await clientCache(req);
    if (cache) { pingTelemetry(cache, req); return cache; }
  }

  // Tier 1 — materials
  if (maxTier >= 1) {
    const t1 = await tier1(req);
    if (t1) { pingTelemetry(t1, req); return t1; }
  }

  // Tier 2+ — server (server auto-records its own telemetry, skip client ping)
  if (maxTier >= 2) {
    const server = await serverResolve(req);
    if (server && server.source !== 'miss') return server;
  }

  const missResult: ResolvedContent = {
    source: 'miss',
    confidence: 0,
    latency_ms: Date.now() - start,
    cost_estimate_usd: 0,
  };
  pingTelemetry(missResult, req);
  return missResult;
}

/**
 * Quick bundle stats for dev tooling / the admin dashboard.
 */
export async function getBundleStats() {
  const bundle = await getBundle();
  return {
    version: bundle.version,
    total_problems: bundle.problems.length,
    total_explainers: Object.keys(bundle.explainers).length,
    stats: bundle.stats,
  };
}
