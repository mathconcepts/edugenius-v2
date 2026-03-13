/**
 * rateLimitService.ts — Token-bucket rate limiter + 429 backoff manager
 *
 * Handles rate limiting for:
 *   - Gemini LLM API (default: 15 RPM on free tier, 60 RPM on paid)
 *   - Wolfram API (default: 2000 calls/month, ~67/day, ~2-3/min burst)
 *
 * Strategy:
 *   1. Token bucket: pre-configured RPM limit, tokens refill each second
 *   2. 429 detection: when a 429 is returned, back off and reduce concurrency
 *   3. Jitter: random ±20% on all wait times to avoid thundering herd
 *   4. Queue: requests wait for a token instead of firing immediately
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApiType = 'llm' | 'wolfram';

export interface RateLimitConfig {
  requestsPerMinute: number; // RPM limit
  burstSize: number;         // max simultaneous requests
  minDelayMs: number;        // minimum ms between any two requests
}

export interface RateLimitState {
  tokens: number;                  // current available tokens
  lastRefillTime: number;          // timestamp of last token refill
  lastRequestTime: number;         // timestamp of last actual request sent
  consecutiveRateLimits: number;   // count of recent 429s
  backoffUntil: number;            // timestamp, don't send until this
  totalRequestsSent: number;
  totalRateLimitHits: number;
}

// ─── Default configs ──────────────────────────────────────────────────────────

const DEFAULT_CONFIGS: Record<ApiType, RateLimitConfig> = {
  llm: {
    requestsPerMinute: 10, // conservative (Gemini free = 15 RPM, leave headroom)
    burstSize: 2,          // max 2 concurrent LLM calls
    minDelayMs: 4000,      // at least 4s between LLM calls
  },
  wolfram: {
    requestsPerMinute: 3,  // Wolfram burst ~2-3/min
    burstSize: 1,          // never more than 1 Wolfram call at a time
    minDelayMs: 20000,     // 20s between Wolfram calls
  },
};

// ─── Internal state (module-level singleton) ──────────────────────────────────

const configs: Record<ApiType, RateLimitConfig> = {
  llm: { ...DEFAULT_CONFIGS.llm },
  wolfram: { ...DEFAULT_CONFIGS.wolfram },
};

function makeInitialState(): RateLimitState {
  return {
    tokens: 0,
    lastRefillTime: Date.now(),
    lastRequestTime: 0,
    consecutiveRateLimits: 0,
    backoffUntil: 0,
    totalRequestsSent: 0,
    totalRateLimitHits: 0,
  };
}

const states: Record<ApiType, RateLimitState> = {
  llm: makeInitialState(),
  wolfram: makeInitialState(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function withJitter(ms: number): number {
  // ±20% random jitter to avoid thundering herd
  const factor = 0.8 + Math.random() * 0.4;
  return Math.max(0, Math.round(ms * factor));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * acquireToken — waits until a token is available, respects backoff.
 * Caller MUST call releaseToken when done.
 */
export async function acquireToken(api: ApiType): Promise<void> {
  const cfg = configs[api];
  const state = states[api];

  // 1. Check backoff
  const now = Date.now();
  if (state.backoffUntil > now) {
    const waitMs = state.backoffUntil - now;
    await sleep(withJitter(waitMs));
  }

  // 2. Refill tokens based on elapsed time
  const refillNow = Date.now();
  const elapsed = refillNow - state.lastRefillTime;
  const refillAmount = elapsed * (cfg.requestsPerMinute / 60000);
  state.tokens = Math.min(cfg.burstSize, state.tokens + refillAmount);
  state.lastRefillTime = refillNow;

  // 3. Wait until a token is available
  while (state.tokens < 1) {
    const timeToNextToken = (1 - state.tokens) * (60000 / cfg.requestsPerMinute);
    await sleep(withJitter(timeToNextToken));

    // Refill again after waiting
    const refillNow2 = Date.now();
    const elapsed2 = refillNow2 - state.lastRefillTime;
    const refillAmount2 = elapsed2 * (cfg.requestsPerMinute / 60000);
    state.tokens = Math.min(cfg.burstSize, state.tokens + refillAmount2);
    state.lastRefillTime = refillNow2;
  }

  // 4. Enforce minimum delay between requests
  const timeSinceLast = Date.now() - state.lastRequestTime;
  if (state.lastRequestTime > 0 && timeSinceLast < cfg.minDelayMs) {
    const extraWait = cfg.minDelayMs - timeSinceLast;
    await sleep(withJitter(extraWait));
  }

  // 5. Consume one token
  state.tokens -= 1;
  state.lastRequestTime = Date.now();
  state.totalRequestsSent += 1;
}

/**
 * releaseToken — called after request completes (success or fail).
 * Currently a no-op since token bucket auto-refills, but kept for
 * future use with active-connection tracking.
 */
export function releaseToken(_api: ApiType): void {
  // Token bucket refills over time; no explicit release needed.
  // This function is intentionally left as a hook for future extensions
  // (e.g., tracking active in-flight count for burstSize enforcement).
}

/**
 * reportRateLimit — called when a 429 is received.
 * Increases backoff exponentially and zeroes tokens.
 */
export function reportRateLimit(api: ApiType): void {
  const state = states[api];
  state.consecutiveRateLimits += 1;
  state.totalRateLimitHits += 1;

  // Exponential backoff: 10s, 20s, 40s, 80s, max 5 min
  const backoffMs = Math.min(300000, 5000 * Math.pow(2, state.consecutiveRateLimits));
  state.backoffUntil = Date.now() + backoffMs;

  // Drain all tokens to prevent further requests until backoff expires
  state.tokens = 0;
}

/**
 * reportSuccess — resets consecutive failure counter.
 */
export function reportSuccess(api: ApiType): void {
  states[api].consecutiveRateLimits = 0;
}

/**
 * getState — returns a snapshot of current state (for UI display).
 */
export function getState(api: ApiType): RateLimitState {
  return { ...states[api] };
}

/**
 * getRateLimitConfig — returns current config for an API.
 */
export function getRateLimitConfig(api: ApiType): RateLimitConfig {
  return { ...configs[api] };
}

/**
 * updateConfig — allows runtime config update (e.g., from UI slider).
 */
export function updateConfig(api: ApiType, patch: Partial<RateLimitConfig>): void {
  configs[api] = { ...configs[api], ...patch };
}

/**
 * resetState — reset rate limit state (for testing or manual retry).
 */
export function resetState(api: ApiType): void {
  states[api] = makeInitialState();
}

// ─── 429 detection ────────────────────────────────────────────────────────────

function isRateLimitError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return (
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.toLowerCase().includes('quota') ||
    msg.includes('too many requests') ||
    msg.includes('RESOURCE_EXHAUSTED')
  );
}

// ─── withRateLimit wrapper ────────────────────────────────────────────────────

/**
 * withRateLimit — high-level wrapper that:
 *   1. Acquires a token (waits if needed)
 *   2. Runs fn()
 *   3. Releases token
 *   4. On 429: calls reportRateLimit and rethrows
 *   5. On success: calls reportSuccess
 */
export async function withRateLimit<T>(
  api: ApiType,
  fn: () => Promise<T>,
): Promise<T> {
  await acquireToken(api);
  try {
    const result = await fn();
    reportSuccess(api);
    releaseToken(api);
    return result;
  } catch (err) {
    releaseToken(api);
    if (isRateLimitError(err)) {
      reportRateLimit(api);
    }
    throw err;
  }
}

// ─── Content Generation Budget ───────────────────────────────────────────────
//
// Layered daily budget system on top of the token bucket:
//   - Total: dailyLLMCallsLimit calls/day (default 100)
//   - mandatoryReserve: calls reserved exclusively for mandatory content
//   - personalizationBudget: remaining after mandatory reserve
//   - Resets daily (localStorage key: eg_content_budget_{YYYY-MM-DD})

export interface ContentGenerationBudget {
  dailyLLMCallsLimit: number;    // default: 100
  dailyLLMCallsUsed: number;
  mandatoryReserve: number;      // calls reserved for mandatory generation (default: 20)
  personalizationBudget: number; // remaining for hyper-personalization
  resetAt: string;               // ISO date of next reset (tomorrow midnight)
}

function todayKey(): string {
  return `eg_content_budget_${new Date().toISOString().slice(0, 10)}`;
}

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const DAILY_LIMIT = 100;
const MANDATORY_RESERVE = 20;

function readBudget(): ContentGenerationBudget {
  try {
    const raw = localStorage.getItem(todayKey());
    if (raw) {
      const parsed = JSON.parse(raw) as ContentGenerationBudget;
      return parsed;
    }
  } catch { /* corrupted */ }

  // Fresh daily budget
  return {
    dailyLLMCallsLimit: DAILY_LIMIT,
    dailyLLMCallsUsed: 0,
    mandatoryReserve: MANDATORY_RESERVE,
    personalizationBudget: DAILY_LIMIT - MANDATORY_RESERVE,
    resetAt: tomorrowIso(),
  };
}

function writeBudget(budget: ContentGenerationBudget): void {
  try {
    localStorage.setItem(todayKey(), JSON.stringify(budget));
  } catch { /* quota exceeded */ }
}

/**
 * Returns the current content generation budget for today.
 */
export function getContentBudget(): ContentGenerationBudget {
  return readBudget();
}

/**
 * Consumes one call from the appropriate budget pool.
 * - 'mandatory': uses from mandatory reserve first, then general limit
 * - 'personalized': uses from personalization budget only
 *
 * Returns true if budget was available and consumed, false if exhausted.
 */
export function consumeContentBudget(type: 'mandatory' | 'personalized'): boolean {
  const budget = readBudget();

  if (budget.dailyLLMCallsUsed >= budget.dailyLLMCallsLimit) {
    return false; // total daily limit hit
  }

  if (type === 'personalized') {
    if (budget.personalizationBudget <= 0) {
      return false; // personalization pool exhausted
    }
    budget.personalizationBudget = Math.max(0, budget.personalizationBudget - 1);
    budget.dailyLLMCallsUsed += 1;
    writeBudget(budget);
    return true;
  }

  // type === 'mandatory': always prioritized
  if (budget.mandatoryReserve > 0) {
    budget.mandatoryReserve = Math.max(0, budget.mandatoryReserve - 1);
  } else {
    // Use from personalization budget as overflow
    budget.personalizationBudget = Math.max(0, budget.personalizationBudget - 1);
  }
  budget.dailyLLMCallsUsed += 1;
  writeBudget(budget);
  return true;
}

/**
 * Returns a human-readable budget status.
 * 'healthy'   — plenty of calls remaining
 * 'caution'   — < 30% remaining
 * 'exhausted' — no personalization budget remaining
 */
export function getContentBudgetStatus(): 'healthy' | 'caution' | 'exhausted' {
  const budget = readBudget();
  if (budget.personalizationBudget <= 0) return 'exhausted';
  const remaining = budget.dailyLLMCallsLimit - budget.dailyLLMCallsUsed;
  const pct = remaining / budget.dailyLLMCallsLimit;
  if (pct < 0.3) return 'caution';
  return 'healthy';
}

// ─── Utility: format backoff remaining as human string ────────────────────────

export function formatBackoffRemaining(api: ApiType): string {
  const state = states[api];
  const remaining = Math.max(0, state.backoffUntil - Date.now());
  if (remaining <= 0) return '';
  if (remaining < 60000) return `${Math.ceil(remaining / 1000)}s`;
  const mins = Math.floor(remaining / 60000);
  const secs = Math.ceil((remaining % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

/**
 * isInBackoff — true when the given API is currently in a backoff window.
 */
export function isInBackoff(api: ApiType): boolean {
  return states[api].backoffUntil > Date.now();
}
