// @ts-nocheck
/**
 * Content Resolver — Four-Tier Cascade
 *
 * Every problem/explainer request flows through here. Each tier is an
 * escalation — we only pay for higher tiers when lower ones miss.
 *
 * Tier 0: Static bundle exact match (free, <10ms)
 * Tier 1: Semantic RAG over bundle + materials (free, ~50ms client-side)
 * Tier 2: Generate on demand via Gemini Flash-Lite (cheap, ~2s)
 * Tier 3: Wolfram MCP verification for high-stakes (slow, small cost)
 *
 * The class returns a typed result with `source` so callers can show
 * provenance ("verified by Wolfram" badge, etc.)
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { verifyProblemWithWolfram } from '../services/wolfram-service';

export type ContentSource =
  | 'tier-0-bundle-exact'
  | 'tier-0-explainer'
  | 'tier-1-rag'
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
}

export interface ResolveRequest {
  /** What the student wants — a concept to practice, explain, or verify */
  intent: 'practice' | 'explain' | 'verify';
  concept_id?: string;
  topic?: string;
  difficulty?: number;
  target_error_type?: string;
  /** For semantic search in tier 1 */
  query_text?: string;
  query_embedding?: number[];
  /** For verify intent */
  problem_text?: string;
  expected_answer?: string;
  /** Escalation controls */
  max_tier?: 0 | 1 | 2 | 3;
  require_wolfram?: boolean;
}

// ============================================================================
// Bundle loading (cached in memory on server)
// ============================================================================

interface ContentBundle {
  version: number;
  problems: any[];
  explainers: Record<string, any>;
  problem_embeddings?: Array<{ id: string; vector: number[] }>;
}

let _bundle: ContentBundle | null = null;

function loadBundle(): ContentBundle {
  if (_bundle) return _bundle;
  const candidates = [
    path.resolve(process.cwd(), 'frontend/public/data/content-bundle.json'),
    path.resolve(process.cwd(), '../frontend/public/data/content-bundle.json'),
    path.resolve(process.cwd(), 'public/data/content-bundle.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        _bundle = JSON.parse(fs.readFileSync(p, 'utf-8'));
        return _bundle!;
      } catch {}
    }
  }
  // Fallback: assemble from legacy bundles if content-bundle.json doesn't exist
  _bundle = assembleFromLegacyBundles();
  return _bundle!;
}

function assembleFromLegacyBundles(): ContentBundle {
  const bundle: ContentBundle = { version: 1, problems: [], explainers: {} };
  const pyqPath = path.resolve(process.cwd(), 'frontend/public/data/pyq-bank.json');
  if (fs.existsSync(pyqPath)) {
    try {
      const pyq = JSON.parse(fs.readFileSync(pyqPath, 'utf-8'));
      bundle.problems = pyq.problems || [];
    } catch {}
  }
  const explainerPath = path.resolve(process.cwd(), 'frontend/public/data/explainers.json');
  if (fs.existsSync(explainerPath)) {
    try {
      const ex = JSON.parse(fs.readFileSync(explainerPath, 'utf-8'));
      bundle.explainers = ex.by_concept || {};
    } catch {}
  }
  return bundle;
}

export function reloadBundle(): void { _bundle = null; }

// ============================================================================
// Cosine similarity (for embedded search)
// ============================================================================

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
}

// ============================================================================
// Tier 0 — Exact bundle match
// ============================================================================

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

    // Predicate: matches target by concept_id OR topic (legacy problems may lack concept_id)
    const targetMatch = (p: any) => {
      if (req.concept_id) {
        if (p.concept_id === req.concept_id) return true;
        if (!p.concept_id && p.topic === req.concept_id) return true;
        if (p.topic === req.concept_id) return true;
      }
      if (req.topic && p.topic === req.topic) return true;
      return false;
    };

    // Primary pass: match concept + difficulty within tolerance
    let matches = bundle.problems.filter(p => {
      if (!targetMatch(p)) return false;
      const pDiff = typeof p.difficulty === 'number' ? p.difficulty
        : p.difficulty === 'easy' ? 0.25
        : p.difficulty === 'hard' ? 0.75
        : 0.5;
      if (Math.abs(pDiff - difficulty) > tolerance) return false;
      if (req.target_error_type && p.target_error_type && p.target_error_type !== req.target_error_type) return false;
      return true;
    });

    // Fallback: if difficulty-filter eliminated everything, return any problem for this concept
    if (matches.length === 0) {
      matches = bundle.problems.filter(p => {
        if (!targetMatch(p)) return false;
        if (req.target_error_type && p.target_error_type && p.target_error_type !== req.target_error_type) return false;
        return true;
      });
    }
    if (matches.length > 0) {
      // Prefer Wolfram-verified, then high verification confidence
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
// Tier 1 — Semantic RAG over bundle
// ============================================================================

async function tier1(req: ResolveRequest, bundle: ContentBundle): Promise<ResolvedContent | null> {
  if (!bundle.problem_embeddings || bundle.problem_embeddings.length === 0) return null;
  if (!req.query_embedding) return null;

  const scored = bundle.problem_embeddings
    .map(e => ({ id: e.id, score: cosine(req.query_embedding!, e.vector) }))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0 || scored[0].score < 0.65) return null;

  const picked = bundle.problems.find(p => p.id === scored[0].id);
  if (!picked) return null;

  return {
    source: 'tier-1-rag',
    problem: picked,
    confidence: scored[0].score,
    latency_ms: 50,
    wolfram_verified: !!picked.wolfram_verified,
    cost_estimate_usd: 0,
  };
}

// ============================================================================
// Tier 2 — Generate on demand
// ============================================================================

async function tier2(req: ResolveRequest): Promise<ResolvedContent | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const start = Date.now();

  const genAI = new GoogleGenerativeAI(apiKey);
  // Flash-Lite is 3x cheaper and sufficient for this
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  const diff = req.difficulty ?? 0.5;
  const diffLabel = diff < 0.33 ? 'easy' : diff < 0.66 ? 'medium' : 'hard';

  const prompt = `Generate a ${diffLabel} difficulty GATE Engineering Mathematics problem.

Concept: ${req.concept_id || 'general'}
Topic: ${req.topic || 'calculus'}
${req.target_error_type ? `Target this error type: ${req.target_error_type}` : ''}

Respond ONLY with JSON (no markdown):
{
  "question_text": "...",
  "correct_answer": "...",
  "solution_steps": ["..."],
  "distractors": ["...", "...", "..."]
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json\s*|\s*```/g, '').trim();
    const problem = JSON.parse(text);
    problem.id = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    problem.concept_id = req.concept_id;
    problem.topic = req.topic;
    problem.difficulty = diff;
    problem.verified = false;
    return {
      source: 'tier-2-generated',
      problem,
      confidence: 0.6,
      latency_ms: Date.now() - start,
      wolfram_verified: false,
      cost_estimate_usd: 0.0005,
    };
  } catch (err) {
    return null;
  }
}

// ============================================================================
// Tier 3 — Wolfram verification
// ============================================================================

async function tier3(resolved: ResolvedContent): Promise<ResolvedContent> {
  if (!resolved.problem) return resolved;
  const start = Date.now();
  const verify = await verifyProblemWithWolfram(
    resolved.problem.question_text,
    resolved.problem.correct_answer,
  );
  return {
    ...resolved,
    source: 'tier-3-wolfram-verified',
    confidence: verify.verified ? Math.max(resolved.confidence, 0.95) : resolved.confidence * 0.6,
    wolfram_verified: verify.verified,
    latency_ms: resolved.latency_ms + (Date.now() - start),
    cost_estimate_usd: resolved.cost_estimate_usd + 0.002,
  };
}

// ============================================================================
// Main entry
// ============================================================================

/**
 * Resolve a content request through the cascade. Returns lowest-tier match.
 */
export async function resolveContent(req: ResolveRequest): Promise<ResolvedContent> {
  const start = Date.now();
  const maxTier = req.max_tier ?? 3;
  const bundle = loadBundle();

  // Verify intent — dedicated path
  if (req.intent === 'verify' && req.problem_text && req.expected_answer) {
    const verify = await verifyProblemWithWolfram(req.problem_text, req.expected_answer);
    return {
      source: 'tier-3-wolfram-verified',
      problem: { question_text: req.problem_text, correct_answer: req.expected_answer },
      confidence: verify.verified ? 0.99 : 0.5,
      wolfram_verified: verify.verified,
      latency_ms: Date.now() - start,
      cost_estimate_usd: 0.002,
    };
  }

  // Tier 0
  if (maxTier >= 0) {
    const t0 = tier0(req, bundle);
    if (t0) {
      if (req.require_wolfram && !t0.wolfram_verified && maxTier >= 3) return tier3(t0);
      return t0;
    }
  }

  // Tier 1
  if (maxTier >= 1) {
    const t1 = await tier1(req, bundle);
    if (t1) {
      if (req.require_wolfram && !t1.wolfram_verified && maxTier >= 3) return tier3(t1);
      return t1;
    }
  }

  // Tier 2
  if (maxTier >= 2) {
    const t2 = await tier2(req);
    if (t2) {
      if (maxTier >= 3) return tier3(t2);
      return t2;
    }
  }

  // Total miss
  return {
    source: 'miss',
    confidence: 0,
    latency_ms: Date.now() - start,
    cost_estimate_usd: 0,
  };
}

/**
 * Quick stats about what's in the loaded bundle.
 */
export function bundleStats() {
  const bundle = loadBundle();
  const byTopic: Record<string, number> = {};
  for (const p of bundle.problems) {
    byTopic[p.topic || 'unknown'] = (byTopic[p.topic || 'unknown'] || 0) + 1;
  }
  return {
    version: bundle.version,
    total_problems: bundle.problems.length,
    total_explainers: Object.keys(bundle.explainers).length,
    has_embeddings: !!(bundle.problem_embeddings && bundle.problem_embeddings.length),
    by_topic: byTopic,
    wolfram_verified_count: bundle.problems.filter(p => p.wolfram_verified).length,
  };
}
