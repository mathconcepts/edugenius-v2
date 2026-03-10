/**
 * contentTierService.ts — Progressive Content Generation Tier System
 *
 * Five tiers, each escalating cost, quality, and latency:
 *   T0: Static    — Pre-indexed PYQs + formula sheets (0ms, free)
 *   T1: RAG       — Supabase vector search (200ms, free)
 *   T2: LLM       — Gemini/Anthropic generation (2s, API cost)
 *   T3: Wolfram   — LLM + Wolfram MCP verification (5s, API cost)
 *   T4: RichMedia — T3 + image prompt + video script (10s, highest cost)
 *
 * Tier selection is automatic (based on topic, surface, user plan)
 * but can be overridden by CEO in ContentOrchestrator settings.
 */

import { getKey } from './connectionBridge';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContentTier =
  | 'T0_static'
  | 'T1_rag'
  | 'T2_llm'
  | 'T3_wolfram'
  | 'T4_richmedia';

export type DeliverySurface =
  | 'in_app'     // student dashboard, learn page, chat
  | 'blog_web'   // SEO blog post, landing page
  | 'whatsapp'   // WhatsApp message (short, image-friendly)
  | 'telegram'   // Telegram channel post or bot message
  | 'youtube'    // YouTube video script + chapters + thumbnail
  | 'pdf'        // Downloadable PDF export
  | 'email'      // Newsletter / drip email
  | 'chat';      // In-app chat (Sage)

export type MediaFormat =
  | 'text'
  | 'image_prompt'
  | 'video_script'
  | 'audio_script'
  | 'infographic_spec';

export interface TierConfig {
  tier: ContentTier;
  name: string;
  description: string;
  emoji: string;
  maxLatencyMs: number;
  requiresConnections: string[]; // connectionIds from ConnectionRegistry
  supportedSurfaces: DeliverySurface[];
  supportedFormats: MediaFormat[];
  costLevel: 'free' | 'low' | 'medium' | 'high';
  minUserPlan: 'free' | 'basic' | 'pro' | 'enterprise';
  fallbackTier?: ContentTier;
}

// ─── Tier Definitions ─────────────────────────────────────────────────────────

export const TIER_CONFIGS: Record<ContentTier, TierConfig> = {
  T0_static: {
    tier: 'T0_static',
    name: 'Static Index',
    emoji: '📦',
    description: 'Pre-built PYQ database and formula sheets. Instant, always available.',
    maxLatencyMs: 50,
    requiresConnections: [],
    costLevel: 'free',
    minUserPlan: 'free',
    supportedSurfaces: ['in_app', 'telegram', 'pdf'],
    supportedFormats: ['text'],
    fallbackTier: undefined,
  },
  T1_rag: {
    tier: 'T1_rag',
    name: 'RAG Search',
    emoji: '🔍',
    description: 'Semantic search over your document corpus. No generation, high relevance.',
    maxLatencyMs: 500,
    requiresConnections: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    costLevel: 'free',
    minUserPlan: 'free',
    supportedSurfaces: ['in_app', 'chat', 'telegram', 'pdf'],
    supportedFormats: ['text'],
    fallbackTier: 'T0_static',
  },
  T2_llm: {
    tier: 'T2_llm',
    name: 'LLM Generation',
    emoji: '🤖',
    description: 'Gemini/Anthropic generates fresh, persona-adapted content.',
    maxLatencyMs: 5000,
    requiresConnections: ['VITE_GEMINI_API_KEY'],
    costLevel: 'low',
    minUserPlan: 'free',
    supportedSurfaces: ['in_app', 'chat', 'blog_web', 'whatsapp', 'telegram', 'email', 'pdf'],
    supportedFormats: ['text', 'image_prompt'],
    fallbackTier: 'T1_rag',
  },
  T3_wolfram: {
    tier: 'T3_wolfram',
    name: 'Wolfram-Grounded',
    emoji: '🔬',
    description: 'LLM generation verified by Wolfram Alpha. Mathematically accurate.',
    maxLatencyMs: 10000,
    requiresConnections: ['VITE_GEMINI_API_KEY', 'VITE_WOLFRAM_APP_ID'],
    costLevel: 'medium',
    minUserPlan: 'basic',
    supportedSurfaces: ['in_app', 'chat', 'blog_web', 'pdf'],
    supportedFormats: ['text', 'image_prompt'],
    fallbackTier: 'T2_llm',
  },
  T4_richmedia: {
    tier: 'T4_richmedia',
    name: 'Rich Media',
    emoji: '🎬',
    description:
      'Full package: verified text + image generation prompt + video script + thumbnail brief.',
    maxLatencyMs: 20000,
    requiresConnections: ['VITE_GEMINI_API_KEY', 'VITE_WOLFRAM_APP_ID'],
    costLevel: 'high',
    minUserPlan: 'pro',
    supportedSurfaces: ['blog_web', 'youtube', 'email', 'whatsapp', 'telegram'],
    supportedFormats: ['text', 'image_prompt', 'video_script', 'audio_script', 'infographic_spec'],
    fallbackTier: 'T3_wolfram',
  },
};

// ─── Tier Selection Input / Result ────────────────────────────────────────────

export interface TierSelectionInput {
  topic: string;
  examType: string;
  surface: DeliverySurface;
  userPlan?: 'free' | 'basic' | 'pro' | 'enterprise';
  requiresVerification?: boolean; // math/science = true
  isMarketing?: boolean;          // blog/YouTube = T4 preferred
  forceTier?: ContentTier;        // CEO override
}

export interface TierSelectionResult {
  selectedTier: ContentTier;
  config: TierConfig;
  reason: string;
  availableConnections: string[];
  wouldUpgradeTo?: ContentTier; // "unlock T3 by adding Wolfram key"
}

// ─── Connection availability ──────────────────────────────────────────────────

/**
 * Check if all required connections for a tier are available.
 */
export function canUseTier(tier: ContentTier): boolean {
  const config = TIER_CONFIGS[tier];
  return config.requiresConnections.every((connKey) => {
    const val = getKey(connKey, connKey);
    return !!val;
  });
}

/**
 * Return list of all tiers whose required connections are fully satisfied.
 */
export function getAvailableTiers(): ContentTier[] {
  const all: ContentTier[] = ['T0_static', 'T1_rag', 'T2_llm', 'T3_wolfram', 'T4_richmedia'];
  return all.filter(canUseTier);
}

/**
 * For each unavailable tier, return which connections are blocking it.
 */
export function getTierUpgradePath(): { tier: ContentTier; blockedBy: string[] }[] {
  const all: ContentTier[] = ['T0_static', 'T1_rag', 'T2_llm', 'T3_wolfram', 'T4_richmedia'];
  return all
    .filter((t) => !canUseTier(t))
    .map((t) => ({
      tier: t,
      blockedBy: TIER_CONFIGS[t].requiresConnections.filter(
        (connKey) => !getKey(connKey, connKey),
      ),
    }));
}

// ─── User plan rank helper ────────────────────────────────────────────────────

const PLAN_RANK: Record<string, number> = {
  free: 0,
  basic: 1,
  pro: 2,
  enterprise: 3,
};

function planSatisfies(userPlan: string | undefined, minPlan: string): boolean {
  const userRank = PLAN_RANK[userPlan ?? 'free'] ?? 0;
  const minRank = PLAN_RANK[minPlan] ?? 0;
  return userRank >= minRank;
}

// ─── Tier Selection Logic ─────────────────────────────────────────────────────

/**
 * Walk down from a preferred tier using the fallback chain until we find one
 * that is both available (connections) and plan-satisfying.
 */
function resolveTierWithFallback(
  preferredTier: ContentTier,
  userPlan?: string,
): { tier: ContentTier; reason: string } | null {
  let current: ContentTier | undefined = preferredTier;

  while (current) {
    const tier: ContentTier = current;
    const cfg: TierConfig = TIER_CONFIGS[tier];
    if (canUseTier(tier) && planSatisfies(userPlan, cfg.minUserPlan)) {
      return { tier, reason: `Resolved via fallback chain from ${preferredTier}` };
    }
    current = cfg.fallbackTier;
  }
  return null;
}

/**
 * Determine the best tier for a content generation request.
 *
 * Priority logic:
 *  1. forceTier → use it (CEO override)
 *  2. isMarketing + surface in [blog_web, youtube] → prefer T4
 *  3. requiresVerification + wolfram configured → T3
 *  4. surface = in_app → T0 for static PYQ topics
 *  5. RAG configured → T1
 *  6. Default → T2
 *
 * Each step falls back down the chain if connections are unavailable.
 */
export function selectTier(input: TierSelectionInput): TierSelectionResult {
  const available = getAvailableTiers();
  const availableConnections = available.flatMap(
    (t) => TIER_CONFIGS[t].requiresConnections,
  );

  // ── 1. CEO force override ──
  if (input.forceTier) {
    const cfg = TIER_CONFIGS[input.forceTier];
    if (canUseTier(input.forceTier)) {
      return {
        selectedTier: input.forceTier,
        config: cfg,
        reason: 'CEO tier override applied',
        availableConnections,
      };
    }
    // Forced tier not available — walk down fallback
    const fallback = resolveTierWithFallback(input.forceTier, input.userPlan);
    if (fallback) {
      return {
        selectedTier: fallback.tier,
        config: TIER_CONFIGS[fallback.tier],
        reason: `CEO forced ${input.forceTier} but connections unavailable — fell back to ${fallback.tier}`,
        availableConnections,
        wouldUpgradeTo: input.forceTier,
      };
    }
  }

  // ── 2. Marketing surfaces → prefer T4 ──
  const marketingSurfaces: DeliverySurface[] = ['blog_web', 'youtube'];
  if (input.isMarketing && marketingSurfaces.includes(input.surface)) {
    const resolved = resolveTierWithFallback('T4_richmedia', input.userPlan);
    if (resolved) {
      const wouldUpgradeTo =
        resolved.tier !== 'T4_richmedia' ? ('T4_richmedia' as ContentTier) : undefined;
      return {
        selectedTier: resolved.tier,
        config: TIER_CONFIGS[resolved.tier],
        reason: `Marketing surface "${input.surface}" — targeting T4 rich media`,
        availableConnections,
        wouldUpgradeTo,
      };
    }
  }

  // ── 3. Requires mathematical verification → T3 ──
  if (input.requiresVerification) {
    const resolved = resolveTierWithFallback('T3_wolfram', input.userPlan);
    if (resolved) {
      const wouldUpgradeTo =
        resolved.tier !== 'T3_wolfram' ? ('T3_wolfram' as ContentTier) : undefined;
      return {
        selectedTier: resolved.tier,
        config: TIER_CONFIGS[resolved.tier],
        reason: 'Topic requires mathematical verification — targeting T3 Wolfram-grounded',
        availableConnections,
        wouldUpgradeTo,
      };
    }
  }

  // ── 4. In-app surface with static content ──
  const staticTopicKeywords = [
    'pyq', 'previous year', 'formula', 'sheet', 'gate em', 'cat', 'revision',
  ];
  const topicLower = input.topic.toLowerCase();
  const isStaticTopic = staticTopicKeywords.some((kw) => topicLower.includes(kw));
  if (input.surface === 'in_app' && isStaticTopic && canUseTier('T0_static')) {
    return {
      selectedTier: 'T0_static',
      config: TIER_CONFIGS.T0_static,
      reason: 'In-app static PYQ/formula content — using T0 index for instant response',
      availableConnections,
      wouldUpgradeTo: available.includes('T1_rag') ? 'T1_rag' : undefined,
    };
  }

  // ── 5. RAG available → T1 ──
  if (canUseTier('T1_rag') && planSatisfies(input.userPlan, 'free')) {
    return {
      selectedTier: 'T1_rag',
      config: TIER_CONFIGS.T1_rag,
      reason: 'RAG (Supabase) available — semantic search over corpus',
      availableConnections,
      wouldUpgradeTo: available.includes('T2_llm') ? 'T2_llm' : undefined,
    };
  }

  // ── 6. Default → T2 ──
  if (canUseTier('T2_llm') && planSatisfies(input.userPlan, 'free')) {
    return {
      selectedTier: 'T2_llm',
      config: TIER_CONFIGS.T2_llm,
      reason: 'Default LLM generation via Gemini',
      availableConnections,
    };
  }

  // ── Final fallback: T0 (always available) ──
  return {
    selectedTier: 'T0_static',
    config: TIER_CONFIGS.T0_static,
    reason: 'All higher tiers unavailable — falling back to static PYQ index',
    availableConnections,
    wouldUpgradeTo: 'T2_llm',
  };
}

/**
 * Get the recommended tier for a delivery surface without full context.
 */
export function getTierForSurface(surface: DeliverySurface, userPlan?: string): ContentTier {
  const marketingSurfaces: DeliverySurface[] = ['blog_web', 'youtube'];
  if (marketingSurfaces.includes(surface)) {
    const result = resolveTierWithFallback('T4_richmedia', userPlan);
    return result?.tier ?? 'T2_llm';
  }
  if (surface === 'in_app') return canUseTier('T1_rag') ? 'T1_rag' : 'T0_static';
  if (surface === 'pdf') return canUseTier('T2_llm') ? 'T2_llm' : 'T0_static';
  return canUseTier('T2_llm') ? 'T2_llm' : 'T0_static';
}
