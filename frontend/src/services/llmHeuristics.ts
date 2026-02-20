/**
 * llmHeuristics.ts — LLM Selection Heuristic Engine
 *
 * Acts as a decision wrapper over all LLM calls in EduGenius.
 * For every task × context combination, this file defines:
 *   - Which model to use (default + fallback chain)
 *   - Why (latency / cost / quality tradeoff reasoning)
 *   - CEO-overridable thresholds
 *
 * USAGE:
 *   const decision = resolveLLM({ task: 'tutoring', agent: 'sage', context: { tier: 'struggling', daysToExam: 12 } });
 *   // → { model: 'gemini-1.5-pro', provider: 'gemini', reason: '...', estimatedCost: 0.0008 }
 *
 * OVERRIDE:
 *   CEO can override defaults via /autonomy-settings → saved to localStorage key 'edugenius_llm_heuristics'
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type LLMProvider = 'gemini' | 'anthropic' | 'openai' | 'groq' | 'learnlm' | 'mock';

export type TaskType =
  | 'tutoring'           // Sage: explain concept, answer question
  | 'tutoring_hard'      // Sage: multi-step proof, JEE Advanced level
  | 'tutoring_socratic'  // Sage: Socratic dialogue, guided discovery
  | 'emotion_response'   // Sage: emotionally-aware motivational reply
  | 'content_gen'        // Atlas: write blog post, lesson, MCQs
  | 'content_verify'     // Atlas: check answer correctness
  | 'market_research'    // Scout: competitor analysis, trend spotting
  | 'outreach_copy'      // Herald: write WhatsApp/email campaign
  | 'analytics_summary'  // Oracle: summarise data into insight
  | 'daily_brief'        // Oracle: generate CEO daily briefing
  | 'realtime_hint'      // Sage: live typing hints (< 800ms target)
  | 'translation'        // Atlas/Sage: translate content to Hindi/regional
  | 'embedding'          // Vector embedding for RAG
  | 'code_review'        // Forge: review/generate code
  | 'opportunity_scout'  // Scout: opportunity discovery pipeline
  | 'plan_eval'          // Scout: business case evaluation
  | 'pricing_analysis';  // RevenueArchitect: pricing recommendations

export interface LLMContext {
  studentTier?: 'struggling' | 'average' | 'good' | 'advanced';
  daysToExam?: number;
  examType?: string;       // JEE, NEET, CAT, etc.
  messageLength?: number;  // rough token estimate of user's message
  requiresVerification?: boolean; // math/science: should we cross-check?
  budgetMode?: 'strict' | 'balanced' | 'quality';
}

export interface LLMHeuristicRule {
  task: TaskType;
  /** Human-readable description of the tradeoff */
  rationale: string;
  primary: { provider: LLMProvider; model: string };
  fallbacks: { provider: LLMProvider; model: string }[];
  /** Estimated cost per 1K tokens in USD */
  estimatedCostPer1KTokens: number;
  /** Target latency in ms */
  targetLatencyMs: number;
  /** Quality score 1-10 for this task type */
  qualityScore: number;
  /** Whether CEO can override this rule */
  ceoOverridable: boolean;
  /** Conditions that trigger a different model choice */
  contextOverrides?: {
    condition: string;
    when: (ctx: LLMContext) => boolean;
    use: { provider: LLMProvider; model: string };
    reason: string;
  }[];
}

export interface LLMDecision {
  task: TaskType;
  provider: LLMProvider;
  model: string;
  reason: string;
  estimatedCostPer1KTokens: number;
  targetLatencyMs: number;
  qualityScore: number;
  fallbackChain: { provider: LLMProvider; model: string }[];
  isCEOOverride: boolean;
  isFallback: boolean;
}

export interface CEOLLMOverrides {
  /** Force a specific provider for all tasks */
  globalProvider?: LLMProvider;
  /** Force specific rules by task type */
  taskOverrides?: Partial<Record<TaskType, { provider: LLMProvider; model: string }>>;
  /** Cost ceiling per 1K tokens — reject models above this */
  maxCostPer1KTokens?: number;
  /** Quality floor — reject models below this score */
  minQualityScore?: number;
  /** Latency ceiling in ms — reject models slower than this */
  maxLatencyMs?: number;
  /** Preferred budget mode */
  budgetMode?: 'strict' | 'balanced' | 'quality';
}

// ─── Default Heuristic Rules ──────────────────────────────────────────────────

/**
 * MODEL CATALOGUE (as of Feb 2026):
 *
 * gemini-2.0-flash         → $0.000075/1K | ~600ms  | Quality: 7  | Best: speed + value
 * gemini-1.5-pro           → $0.0035/1K   | ~2000ms | Quality: 9  | Best: complex reasoning
 * learnlm-1.5-pro          → $0.0035/1K   | ~2200ms | Quality: 10 | Best: pedagogy/tutoring
 * claude-3-haiku           → $0.00025/1K  | ~800ms  | Quality: 7  | Best: cheap structured output
 * claude-sonnet-4          → $0.003/1K    | ~2500ms | Quality: 9  | Best: long-form, code
 * gpt-4o-mini              → $0.00015/1K  | ~700ms  | Quality: 7  | Best: embeddings, structured
 * gpt-4o                   → $0.005/1K    | ~3000ms | Quality: 9  | Best: multimodal, broad
 * llama-3-70b (Groq)       → $0.00059/1K  | ~200ms  | Quality: 6  | Best: real-time hints
 * mixtral-8x7b (Groq)      → $0.00027/1K  | ~150ms  | Quality: 5  | Best: ultra-fast drafts
 */

export const DEFAULT_HEURISTICS: LLMHeuristicRule[] = [
  {
    task: 'tutoring',
    rationale: 'LearnLM is built specifically for pedagogical tutoring — guides students through concepts rather than just answering. Falls back to Gemini 1.5 Pro (strong reasoning) then Claude Haiku for cost-sensitive deployments.',
    primary: { provider: 'learnlm', model: 'learnlm-1.5-pro' },
    fallbacks: [
      { provider: 'gemini', model: 'gemini-1.5-pro' },
      { provider: 'anthropic', model: 'claude-3-haiku-20240307' },
      { provider: 'gemini', model: 'gemini-2.0-flash' },
    ],
    estimatedCostPer1KTokens: 0.0035,
    targetLatencyMs: 2200,
    qualityScore: 10,
    ceoOverridable: true,
    contextOverrides: [
      {
        condition: 'Student struggling AND < 7 days to exam',
        when: ctx => ctx.studentTier === 'struggling' && (ctx.daysToExam ?? 999) < 7,
        use: { provider: 'learnlm', model: 'learnlm-1.5-pro' },
        reason: 'Exam crunch: maximum pedagogical quality — no compromise on teaching effectiveness',
      },
      {
        condition: 'Advanced student, quick concept check',
        when: ctx => ctx.studentTier === 'advanced' && (ctx.messageLength ?? 0) < 50,
        use: { provider: 'gemini', model: 'gemini-2.0-flash' },
        reason: 'Advanced students need fast answers more than guided discovery — use Flash',
      },
      {
        condition: 'Budget mode: strict',
        when: ctx => ctx.budgetMode === 'strict',
        use: { provider: 'anthropic', model: 'claude-3-haiku-20240307' },
        reason: 'Cost ceiling active — Haiku delivers 7/10 quality at 10x lower cost',
      },
    ],
  },

  {
    task: 'tutoring_hard',
    rationale: 'Complex JEE Advanced / GATE multi-step problems need the strongest reasoning. Gemini 1.5 Pro handles multi-step math chains reliably. Claude Sonnet as fallback for code-heavy derivations.',
    primary: { provider: 'gemini', model: 'gemini-1.5-pro' },
    fallbacks: [
      { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
      { provider: 'openai', model: 'gpt-4o' },
      { provider: 'gemini', model: 'gemini-2.0-flash' },
    ],
    estimatedCostPer1KTokens: 0.0035,
    targetLatencyMs: 3000,
    qualityScore: 9,
    ceoOverridable: true,
  },

  {
    task: 'tutoring_socratic',
    rationale: 'LearnLM is the only model trained specifically for Socratic dialogue. It prefers guiding questions over direct answers — exactly what EduGenius needs for exam prep.',
    primary: { provider: 'learnlm', model: 'learnlm-1.5-pro' },
    fallbacks: [
      { provider: 'gemini', model: 'gemini-1.5-pro' },
      { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    ],
    estimatedCostPer1KTokens: 0.0035,
    targetLatencyMs: 2500,
    qualityScore: 10,
    ceoOverridable: false, // Non-overridable: Socratic quality is a product differentiator
  },

  {
    task: 'emotion_response',
    rationale: 'Emotionally-aware responses need empathy and nuance — Claude Sonnet excels here. Cost justified because emotional moments have highest churn risk.',
    primary: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    fallbacks: [
      { provider: 'learnlm', model: 'learnlm-1.5-pro' },
      { provider: 'gemini', model: 'gemini-1.5-pro' },
    ],
    estimatedCostPer1KTokens: 0.003,
    targetLatencyMs: 2500,
    qualityScore: 9,
    ceoOverridable: true,
  },

  {
    task: 'realtime_hint',
    rationale: 'Live typing hints must respond in < 800ms. Groq (Llama 3) is 5-10x faster than Gemini Flash at < 200ms P50. Quality is secondary to latency here.',
    primary: { provider: 'groq', model: 'llama-3-70b-8192' },
    fallbacks: [
      { provider: 'gemini', model: 'gemini-2.0-flash' },
      { provider: 'anthropic', model: 'claude-3-haiku-20240307' },
    ],
    estimatedCostPer1KTokens: 0.00059,
    targetLatencyMs: 250,
    qualityScore: 6,
    ceoOverridable: true,
  },

  {
    task: 'content_gen',
    rationale: 'Atlas generates lessons, blogs, MCQs. Gemini 1.5 Pro for quality; Flash for high-volume batch jobs. MCQ generation benefits from structured output mode.',
    primary: { provider: 'gemini', model: 'gemini-1.5-pro' },
    fallbacks: [
      { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
      { provider: 'gemini', model: 'gemini-2.0-flash' },
    ],
    estimatedCostPer1KTokens: 0.0035,
    targetLatencyMs: 3000,
    qualityScore: 9,
    ceoOverridable: true,
    contextOverrides: [
      {
        condition: 'High-volume batch (> 50 items/day)',
        when: ctx => (ctx.budgetMode === 'strict'),
        use: { provider: 'gemini', model: 'gemini-2.0-flash' },
        reason: 'Flash at 47x lower cost for bulk content generation (MCQs, summaries)',
      },
    ],
  },

  {
    task: 'content_verify',
    rationale: 'Answer verification is a structured task: compare LLM answer vs Wolfram/SymPy result. Flash is sufficient — the real verification is done by Wolfram, not the LLM.',
    primary: { provider: 'gemini', model: 'gemini-2.0-flash' },
    fallbacks: [
      { provider: 'openai', model: 'gpt-4o-mini' },
      { provider: 'anthropic', model: 'claude-3-haiku-20240307' },
    ],
    estimatedCostPer1KTokens: 0.000075,
    targetLatencyMs: 600,
    qualityScore: 7,
    ceoOverridable: true,
  },

  {
    task: 'market_research',
    rationale: 'Scout analyses competitor data, news, trends. Long-context analysis benefits from Gemini 1.5 Pro (2M token context). Claude Sonnet for structured competitor teardowns.',
    primary: { provider: 'gemini', model: 'gemini-1.5-pro' },
    fallbacks: [
      { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
      { provider: 'openai', model: 'gpt-4o' },
    ],
    estimatedCostPer1KTokens: 0.0035,
    targetLatencyMs: 5000,
    qualityScore: 9,
    ceoOverridable: true,
  },

  {
    task: 'opportunity_scout',
    rationale: 'Opportunity discovery is a critical strategic task. Run with strongest model — this output gates the entire exam creation pipeline. Cost is negligible vs. the decision value.',
    primary: { provider: 'gemini', model: 'gemini-1.5-pro' },
    fallbacks: [
      { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
      { provider: 'openai', model: 'gpt-4o' },
    ],
    estimatedCostPer1KTokens: 0.0035,
    targetLatencyMs: 5000,
    qualityScore: 9,
    ceoOverridable: false, // Non-overridable: strategic decisions must use best model
  },

  {
    task: 'plan_eval',
    rationale: 'Business case and pricing analysis. Claude Sonnet excels at structured analytical reasoning and producing well-reasoned reports.',
    primary: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    fallbacks: [
      { provider: 'gemini', model: 'gemini-1.5-pro' },
      { provider: 'openai', model: 'gpt-4o' },
    ],
    estimatedCostPer1KTokens: 0.003,
    targetLatencyMs: 4000,
    qualityScore: 9,
    ceoOverridable: true,
  },

  {
    task: 'outreach_copy',
    rationale: 'Herald writes WhatsApp/email campaigns. Claude Sonnet for empathetic, conversion-focused copy. Flash for high-volume A/B variant generation.',
    primary: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    fallbacks: [
      { provider: 'gemini', model: 'gemini-1.5-pro' },
      { provider: 'gemini', model: 'gemini-2.0-flash' },
    ],
    estimatedCostPer1KTokens: 0.003,
    targetLatencyMs: 3000,
    qualityScore: 9,
    ceoOverridable: true,
  },

  {
    task: 'analytics_summary',
    rationale: 'Oracle summarises usage data. Gemini Flash is sufficient — data is structured, creativity not required. Optimise for cost and speed.',
    primary: { provider: 'gemini', model: 'gemini-2.0-flash' },
    fallbacks: [
      { provider: 'openai', model: 'gpt-4o-mini' },
      { provider: 'anthropic', model: 'claude-3-haiku-20240307' },
    ],
    estimatedCostPer1KTokens: 0.000075,
    targetLatencyMs: 1000,
    qualityScore: 7,
    ceoOverridable: true,
  },

  {
    task: 'daily_brief',
    rationale: 'CEO daily brief: 5 metrics, 3 decisions, 1 win. Structured output, medium complexity. Claude Haiku: fast, cheap, reliable structured formatting.',
    primary: { provider: 'anthropic', model: 'claude-3-haiku-20240307' },
    fallbacks: [
      { provider: 'gemini', model: 'gemini-2.0-flash' },
      { provider: 'openai', model: 'gpt-4o-mini' },
    ],
    estimatedCostPer1KTokens: 0.00025,
    targetLatencyMs: 1200,
    qualityScore: 7,
    ceoOverridable: true,
  },

  {
    task: 'translation',
    rationale: 'Hindi/regional language translation for content and tutoring. Gemini 1.5 Pro has the strongest multilingual performance for Indian languages (Hindi, Tamil, Telugu, Kannada).',
    primary: { provider: 'gemini', model: 'gemini-1.5-pro' },
    fallbacks: [
      { provider: 'gemini', model: 'gemini-2.0-flash' },
      { provider: 'openai', model: 'gpt-4o' },
    ],
    estimatedCostPer1KTokens: 0.0035,
    targetLatencyMs: 2000,
    qualityScore: 9,
    ceoOverridable: true,
  },

  {
    task: 'embedding',
    rationale: 'Vector embeddings for RAG: text-embedding-3-small is cost-optimal, widely compatible with Pinecone/Qdrant. Google embedding-004 as fallback.',
    primary: { provider: 'openai', model: 'text-embedding-3-small' },
    fallbacks: [
      { provider: 'gemini', model: 'embedding-001' },
    ],
    estimatedCostPer1KTokens: 0.00002,
    targetLatencyMs: 300,
    qualityScore: 8,
    ceoOverridable: true,
  },

  {
    task: 'code_review',
    rationale: 'Forge reviews and generates code. Claude Sonnet is the gold standard for code tasks — superior to GPT-4o for Python/TypeScript.',
    primary: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    fallbacks: [
      { provider: 'openai', model: 'gpt-4o' },
      { provider: 'gemini', model: 'gemini-1.5-pro' },
    ],
    estimatedCostPer1KTokens: 0.003,
    targetLatencyMs: 4000,
    qualityScore: 9,
    ceoOverridable: true,
  },

  {
    task: 'pricing_analysis',
    rationale: 'RevenueArchitect runs pricing models. Claude Sonnet for analytical depth; Gemini Pro as cost-balanced alternative.',
    primary: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    fallbacks: [
      { provider: 'gemini', model: 'gemini-1.5-pro' },
      { provider: 'openai', model: 'gpt-4o' },
    ],
    estimatedCostPer1KTokens: 0.003,
    targetLatencyMs: 3000,
    qualityScore: 9,
    ceoOverridable: true,
  },
];

// ─── CEO Override Storage ─────────────────────────────────────────────────────

const HEURISTICS_KEY = 'edugenius_llm_heuristics';

export function loadCEOOverrides(): CEOLLMOverrides {
  try {
    return JSON.parse(localStorage.getItem(HEURISTICS_KEY) || '{}');
  } catch { return {}; }
}

export function saveCEOOverrides(overrides: CEOLLMOverrides): void {
  localStorage.setItem(HEURISTICS_KEY, JSON.stringify(overrides));
  window.dispatchEvent(new StorageEvent('storage', {
    key: HEURISTICS_KEY,
    newValue: JSON.stringify(overrides),
  }));
}

export function resetCEOOverrides(): void {
  localStorage.removeItem(HEURISTICS_KEY);
  window.dispatchEvent(new StorageEvent('storage', { key: HEURISTICS_KEY, newValue: null }));
}

// ─── Core Resolution Function ─────────────────────────────────────────────────

/**
 * Resolves which LLM to use for a given task + context.
 * 
 * Priority order:
 *   1. CEO task-level override (if set in /autonomy-settings)
 *   2. CEO global provider override
 *   3. CEO cost/quality/latency ceiling filters
 *   4. Context-specific overrides from heuristic rule
 *   5. Default primary model from heuristic rule
 */
export function resolveLLM(params: {
  task: TaskType;
  context?: LLMContext;
  availableProviders?: LLMProvider[];
}): LLMDecision {
  const { task, context = {}, availableProviders } = params;
  const overrides = loadCEOOverrides();

  // Merge budget mode from context or CEO override
  const budgetMode = overrides.budgetMode ?? context.budgetMode ?? 'balanced';
  const effectiveContext: LLMContext = { ...context, budgetMode };

  // Find the rule
  const rule = DEFAULT_HEURISTICS.find(r => r.task === task) ?? DEFAULT_HEURISTICS[0];

  // --- Priority 1: CEO task-level override ---
  if (overrides.taskOverrides?.[task] && rule.ceoOverridable) {
    const ov = overrides.taskOverrides[task]!;
    if (!availableProviders || availableProviders.includes(ov.provider)) {
      return {
        task, provider: ov.provider, model: ov.model,
        reason: `CEO override for ${task}`,
        estimatedCostPer1KTokens: rule.estimatedCostPer1KTokens,
        targetLatencyMs: rule.targetLatencyMs,
        qualityScore: rule.qualityScore,
        fallbackChain: rule.fallbacks,
        isCEOOverride: true,
        isFallback: false,
      };
    }
  }

  // --- Priority 2: CEO global provider ---
  if (overrides.globalProvider && rule.ceoOverridable) {
    const bestModel = getBestModelForProvider(overrides.globalProvider, task);
    return {
      task, provider: overrides.globalProvider, model: bestModel,
      reason: `CEO global provider: ${overrides.globalProvider}`,
      estimatedCostPer1KTokens: rule.estimatedCostPer1KTokens,
      targetLatencyMs: rule.targetLatencyMs,
      qualityScore: rule.qualityScore,
      fallbackChain: rule.fallbacks,
      isCEOOverride: true,
      isFallback: false,
    };
  }

  // --- Priority 3: Context overrides ---
  if (rule.contextOverrides) {
    for (const co of rule.contextOverrides) {
      if (co.when(effectiveContext)) {
        const candidate = co.use;
        if (!availableProviders || availableProviders.includes(candidate.provider)) {
          return {
            task, provider: candidate.provider, model: candidate.model,
            reason: `Context rule: "${co.condition}" — ${co.reason}`,
            estimatedCostPer1KTokens: rule.estimatedCostPer1KTokens,
            targetLatencyMs: rule.targetLatencyMs,
            qualityScore: rule.qualityScore,
            fallbackChain: rule.fallbacks,
            isCEOOverride: false,
            isFallback: false,
          };
        }
      }
    }
  }

  // --- Priority 4: Default primary, filtered by availability + CEO ceilings ---
  const candidates = [rule.primary, ...rule.fallbacks];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (availableProviders && !availableProviders.includes(c.provider)) continue;
    if (overrides.maxCostPer1KTokens && rule.estimatedCostPer1KTokens > overrides.maxCostPer1KTokens && i < candidates.length - 1) continue;
    if (overrides.minQualityScore && rule.qualityScore < overrides.minQualityScore && i < candidates.length - 1) continue;
    if (overrides.maxLatencyMs && rule.targetLatencyMs > overrides.maxLatencyMs && i < candidates.length - 1) continue;

    return {
      task, provider: c.provider, model: c.model,
      reason: i === 0
        ? `Default heuristic for ${task}: ${rule.rationale.split('.')[0]}`
        : `Fallback #${i} — primary unavailable or filtered by CEO ceiling`,
      estimatedCostPer1KTokens: rule.estimatedCostPer1KTokens,
      targetLatencyMs: rule.targetLatencyMs,
      qualityScore: rule.qualityScore,
      fallbackChain: rule.fallbacks.slice(i),
      isCEOOverride: false,
      isFallback: i > 0,
    };
  }

  // Last resort: mock
  return {
    task, provider: 'mock', model: 'mock',
    reason: 'No configured provider available — running in demo mode',
    estimatedCostPer1KTokens: 0,
    targetLatencyMs: 100,
    qualityScore: 1,
    fallbackChain: [],
    isCEOOverride: false,
    isFallback: true,
  };
}

/** Pick the best model for a given provider */
function getBestModelForProvider(provider: LLMProvider, _task: TaskType): string {
  const best: Record<LLMProvider, string> = {
    gemini:    'gemini-1.5-pro',
    anthropic: 'claude-sonnet-4-20250514',
    openai:    'gpt-4o',
    groq:      'llama-3-70b-8192',
    learnlm:   'learnlm-1.5-pro',
    mock:      'mock',
  };
  return best[provider] ?? 'unknown';
}

// ─── Bulk summary (used by CEOThresholdConfig + heuristics dashboard) ─────────

export interface HeuristicsSummary {
  totalRules: number;
  primaryProvider: LLMProvider;
  estimatedDailyCostUSD: number; // rough baseline for typical usage
  nonOverridableCount: number;
  byTask: { task: TaskType; provider: LLMProvider; model: string; cost: number; quality: number; latency: number }[];
}

export function getHeuristicsSummary(availableProviders?: LLMProvider[]): HeuristicsSummary {
  const overrides = loadCEOOverrides();
  const byTask = DEFAULT_HEURISTICS.map(rule => {
    const decision = resolveLLM({ task: rule.task, availableProviders });
    return {
      task: rule.task,
      provider: decision.provider,
      model: decision.model,
      cost: decision.estimatedCostPer1KTokens,
      quality: decision.qualityScore,
      latency: decision.targetLatencyMs,
    };
  });

  // Rough daily cost estimate assuming 500 student sessions, 10 exchanges each
  // ~1K tokens per exchange average
  const sessionsPerDay = 500;
  const exchangesPerSession = 10;
  const tokensPerExchange = 1.5; // in thousands
  const tutoringRule = DEFAULT_HEURISTICS.find(r => r.task === 'tutoring')!;
  const estimatedDailyCostUSD = sessionsPerDay * exchangesPerSession * tokensPerExchange * tutoringRule.estimatedCostPer1KTokens;

  // Find most common primary provider
  const providerCount: Partial<Record<LLMProvider, number>> = {};
  byTask.forEach(t => { providerCount[t.provider] = (providerCount[t.provider] ?? 0) + 1; });
  const primaryProvider = (Object.entries(providerCount).sort((a, b) => b[1] - a[1])[0]?.[0] as LLMProvider) ?? 'gemini';

  return {
    totalRules: DEFAULT_HEURISTICS.length,
    primaryProvider,
    estimatedDailyCostUSD: Math.round(estimatedDailyCostUSD * 100) / 100,
    nonOverridableCount: DEFAULT_HEURISTICS.filter(r => !r.ceoOverridable).length,
    byTask,
  };
}

// ─── Quick-access helpers ──────────────────────────────────────────────────────

/** Convenience: resolve for tutoring based on student persona */
export function resolveTutoringLLM(studentTier: LLMContext['studentTier'], daysToExam: number): LLMDecision {
  return resolveLLM({ task: 'tutoring', context: { studentTier, daysToExam } });
}

/** Convenience: resolve for content generation with budget awareness */
export function resolveContentLLM(bulkMode: boolean): LLMDecision {
  return resolveLLM({
    task: 'content_gen',
    context: { budgetMode: bulkMode ? 'strict' : 'balanced' },
  });
}

/** Convenience: resolve for opportunity scouting (always best model) */
export function resolveScoutLLM(): LLMDecision {
  return resolveLLM({ task: 'opportunity_scout' });
}
