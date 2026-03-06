/**
 * batchContentService.ts — Batch content generation orchestrator
 *
 * Generates multiple content items in batch with:
 *   - Arbitration: auto-selects source path per item
 *   - Concurrency: max 3 parallel generation jobs (dynamically reduced on 429)
 *   - Retry: up to 2 retries per failed item (rate-limit errors don't consume retry slots)
 *   - Progress: per-item + aggregate progress callbacks
 *   - Export: JSON export of results
 *   - Rate limiting: token-bucket + exponential backoff via rateLimitService
 *   - 2-phase Wolfram optimisation: pre-fetch all Wolfram queries serially,
 *     then run LLM generation in parallel against the pre-warmed cache
 */

import {
  generateContent,
  type GenerationRequest,
  type GeneratedContent,
  type ContentOutputFormat,
} from './contentGenerationService';
import {
  arbitrateContentSource,
  resolveGenerationRequest,
  type ArbitrationDecision,
} from './contentArbitrationService';
import {
  withRateLimit,
  acquireToken,
  releaseToken,
  getState,
  type ApiType,
} from './rateLimitService';
import { queryWolfram } from './wolframService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BatchItem {
  id: string;
  request: GenerationRequest;
  arbitration?: ArbitrationDecision;
  status: 'pending' | 'running' | 'done' | 'failed' | 'retrying' | 'rate_limited';
  result?: GeneratedContent;
  error?: string;
  /** 'rate_limit' when the last failure was a 429; 'error' for generation failures */
  retryReason?: 'rate_limit' | 'error';
  retryCount: number;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
}

export interface BatchJob {
  id: string;
  name: string;
  items: BatchItem[];
  concurrency: number;  // default 3
  maxRetries: number;   // default 2
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface BatchProgress {
  jobId: string;
  totalItems: number;
  pending: number;
  running: number;
  done: number;
  failed: number;
  verifiedCount: number;         // items with wolframVerified === true
  overallPercent: number;        // 0–100
  currentItem?: string;          // title/topic of item being processed
  // Rate-limit-aware fields
  rateLimitHits: number;         // total 429s encountered
  effectiveConcurrency: number;  // current active concurrency
  waitingForRateLimit: boolean;  // true when throttled
  estimatedRemainingMs?: number; // ms until completion
  prefetchPhase?: boolean;       // true during Wolfram pre-fetch phase
  prefetchDone?: number;         // how many wolfram prefetches completed
  prefetchTotal?: number;        // total wolfram prefetches needed
}

export interface BatchResult {
  jobId: string;
  jobName: string;
  items: BatchItem[];
  successCount: number;
  failCount: number;
  verifiedCount: number;       // wolframVerified === true
  totalDurationMs: number;
  exportedAt: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

function computeProgress(
  job: BatchJob,
  effectiveConcurrency: number,
  rateLimitHits: number,
  completedDurations: number[],
  currentItemLabel?: string,
  prefetchInfo?: { phase: boolean; done: number; total: number },
): BatchProgress {
  let pending = 0, running = 0, done = 0, failed = 0, verifiedCount = 0;
  for (const item of job.items) {
    switch (item.status) {
      case 'pending': pending++; break;
      case 'running':
      case 'retrying':
      case 'rate_limited': running++; break;
      case 'done': done++; if (item.result?.wolframVerified) verifiedCount++; break;
      case 'failed': failed++; break;
    }
  }
  const finished = done + failed;
  const total = job.items.length;
  const overallPercent = total === 0 ? 0 : Math.round((finished / total) * 100);

  // Estimate remaining time after first 3 completions
  let estimatedRemainingMs: number | undefined;
  if (completedDurations.length >= 3) {
    const avgDuration =
      completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length;
    const remainingItems = pending + running;
    estimatedRemainingMs = Math.round(avgDuration * remainingItems / Math.max(1, effectiveConcurrency));

    // Add backoff wait if in backoff
    const llmState = getState('llm');
    if (llmState.backoffUntil > Date.now()) {
      estimatedRemainingMs += llmState.backoffUntil - Date.now();
    }
  }

  const llmState = getState('llm');
  const waitingForRateLimit = llmState.backoffUntil > Date.now();

  return {
    jobId: job.id,
    totalItems: total,
    pending,
    running,
    done,
    failed,
    verifiedCount,
    overallPercent,
    currentItem: currentItemLabel,
    rateLimitHits,
    effectiveConcurrency,
    waitingForRateLimit,
    estimatedRemainingMs,
    prefetchPhase: prefetchInfo?.phase,
    prefetchDone: prefetchInfo?.done,
    prefetchTotal: prefetchInfo?.total,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * createBatchJob — build a BatchJob with arbitration resolved upfront for each item.
 */
export function createBatchJob(
  name: string,
  requests: GenerationRequest[],
  options?: { concurrency?: number; maxRetries?: number },
): BatchJob {
  const items: BatchItem[] = requests.map(req => {
    const arbitration = arbitrateContentSource(req);
    return {
      id: generateId('item'),
      request: req,
      arbitration,
      status: 'pending',
      retryCount: 0,
    };
  });

  return {
    id: generateId('job'),
    name,
    items,
    concurrency: options?.concurrency ?? 3,
    maxRetries: options?.maxRetries ?? 2,
    createdAt: new Date(),
  };
}

/**
 * runBatchJob — execute the batch with bounded concurrency and retry logic.
 *
 * Uses a promise-pool pattern with:
 *   - Dynamic concurrency reduction on rate limit hits
 *   - Rate limit errors do NOT consume retry slots (they re-queue)
 *   - Only generation errors consume retries
 */
export async function runBatchJob(
  job: BatchJob,
  onProgress?: (p: BatchProgress) => void,
  onItemComplete?: (item: BatchItem) => void,
): Promise<BatchResult> {
  const jobStart = Date.now();
  job.startedAt = new Date(jobStart);

  const items = job.items;
  const { maxRetries } = job;

  // Dynamic concurrency state
  let effectiveConcurrency = job.concurrency;
  let consecutiveSuccesses = 0;
  let rateLimitHits = 0;
  const completedDurations: number[] = [];

  let itemIndex = 0;
  const running = new Set<Promise<void>>();

  // Emit initial progress
  onProgress?.(computeProgress(job, effectiveConcurrency, rateLimitHits, completedDurations));

  async function processItem(item: BatchItem): Promise<void> {
    const topic =
      item.request.sourceData.prompt ??
      item.request.sourceData.wolframQuery ??
      item.request.topicId ??
      item.id;

    item.startedAt = new Date();
    item.status = 'running';
    onProgress?.(computeProgress(job, effectiveConcurrency, rateLimitHits, completedDurations, topic));

    let lastError: string | undefined;
    let errorRetries = 0; // only count real generation errors

    // Outer loop handles rate limit re-queuing without consuming retries
    while (true) {
      // For display purposes, track attempt number including rate-limit waits
      if (errorRetries > 0) {
        item.status = 'retrying';
        item.retryCount = errorRetries;
        item.retryReason = 'error';
        onProgress?.(computeProgress(job, effectiveConcurrency, rateLimitHits, completedDurations, topic));
        await sleep(errorRetries * 1000); // exponential backoff for real errors
      }

      try {
        const resolvedRequest = resolveGenerationRequest(item.request);

        // For wolfram-grounded requests, acquire wolfram token too before starting
        const isWolframPath = item.arbitration?.path === 'wolfram';
        if (isWolframPath) {
          await acquireToken('wolfram');
        }

        let result: GeneratedContent;
        try {
          result = await withRateLimit('llm', () => generateContent(resolvedRequest));
        } finally {
          if (isWolframPath) {
            releaseToken('wolfram');
          }
        }

        item.status = 'done';
        item.result = result;
        item.completedAt = new Date();
        item.durationMs = item.completedAt.getTime() - (item.startedAt?.getTime() ?? 0);
        item.retryReason = undefined;
        lastError = undefined;

        // Track success streak for dynamic concurrency restoration
        consecutiveSuccesses++;
        if (consecutiveSuccesses >= 5) {
          effectiveConcurrency = Math.min(job.concurrency, effectiveConcurrency + 1);
          consecutiveSuccesses = 0;
        }

        if (item.durationMs !== undefined) {
          completedDurations.push(item.durationMs);
        }
        break; // success
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);

        if (isRateLimitError(err)) {
          // Rate limit: reduce concurrency, mark as rate-limited, wait, then retry
          rateLimitHits++;
          consecutiveSuccesses = 0;
          effectiveConcurrency = Math.max(1, effectiveConcurrency - 1);

          item.status = 'rate_limited';
          item.retryReason = 'rate_limit';
          onProgress?.(
            computeProgress(job, effectiveConcurrency, rateLimitHits, completedDurations, topic),
          );

          // Wait for backoff to clear (rateLimitService already updated backoffUntil)
          const llmState = getState('llm');
          const backoffRemaining = Math.max(0, llmState.backoffUntil - Date.now());
          if (backoffRemaining > 0) {
            await sleep(backoffRemaining + 500); // small buffer after backoff expires
          }

          // Re-queue: do NOT break or increment errorRetries — loop again
          item.status = 'retrying';
          continue;
        }

        // Real generation error — consume a retry slot
        lastError = errMsg;
        errorRetries++;
        if (errorRetries > maxRetries) {
          break;
        }
        // continue to retry loop
      }
    }

    if (lastError !== undefined) {
      item.status = 'failed';
      item.error = lastError;
      item.retryReason = 'error';
      item.completedAt = new Date();
      item.durationMs = item.completedAt.getTime() - (item.startedAt?.getTime() ?? 0);
    }

    onProgress?.(computeProgress(job, effectiveConcurrency, rateLimitHits, completedDurations));
    onItemComplete?.(item);
  }

  // Promise pool
  while (itemIndex < items.length || running.size > 0) {
    // Fill up available concurrency slots (uses dynamic effectiveConcurrency)
    while (running.size < effectiveConcurrency && itemIndex < items.length) {
      const item = items[itemIndex++];
      const p = processItem(item).then(() => {
        running.delete(p);
      });
      running.add(p);
    }

    if (running.size > 0) {
      await Promise.race(running);
    }
  }

  job.completedAt = new Date();

  const totalDurationMs = job.completedAt.getTime() - jobStart;
  const successCount = items.filter(i => i.status === 'done').length;
  const failCount = items.filter(i => i.status === 'failed').length;
  const verifiedCount = items.filter(i => i.result?.wolframVerified === true).length;

  return {
    jobId: job.id,
    jobName: job.name,
    items,
    successCount,
    failCount,
    verifiedCount,
    totalDurationMs,
    exportedAt: new Date(),
  };
}

// ─── 2-phase Wolfram + LLM batch ─────────────────────────────────────────────

/**
 * runBatchJobWithPrefetch — 2-phase batch execution:
 *
 * Phase 1 (serial, Wolfram rate-limited):
 *   Pre-fetch all Wolfram queries for wolfram-path items → warm sessionStorage cache
 *
 * Phase 2 (parallel, LLM rate-limited):
 *   LLM generation using cached Wolfram results (no Wolfram calls during LLM phase)
 *
 * Benefits:
 *   - Wolfram calls happen one-at-a-time (strict 20s inter-call spacing)
 *   - LLM calls can safely parallelise without Wolfram interleaving
 *   - Rate limiters never contend with each other
 */
export async function runBatchJobWithPrefetch(
  job: BatchJob,
  onProgress?: (p: BatchProgress) => void,
  onItemComplete?: (item: BatchItem) => void,
): Promise<BatchResult> {
  const jobStart = Date.now();
  job.startedAt = new Date(jobStart);

  const items = job.items;
  const completedDurations: number[] = [];
  let rateLimitHits = 0;

  // ── Phase 1: Wolfram pre-fetch (serial) ──────────────────────────────────
  const wolframItems = items.filter(
    item =>
      item.arbitration?.path === 'wolfram' &&
      item.request.sourceData.wolframQuery,
  );

  if (wolframItems.length > 0) {
    let prefetchDone = 0;
    const prefetchTotal = wolframItems.length;

    onProgress?.(
      computeProgress(
        job,
        job.concurrency,
        rateLimitHits,
        completedDurations,
        `Pre-fetching Wolfram (${prefetchDone}/${prefetchTotal})…`,
        { phase: true, done: prefetchDone, total: prefetchTotal },
      ),
    );

    for (const item of wolframItems) {
      const query = item.request.sourceData.wolframQuery!;

      try {
        // Acquire wolfram token (respects 20s minimum delay + backoff)
        await acquireToken('wolfram');

        try {
          // queryWolfram will cache the result in sessionStorage
          await queryWolfram(query);
        } finally {
          releaseToken('wolfram');
        }
      } catch (err) {
        // Wolfram prefetch failure is non-fatal: LLM will fall back to direct prompt
        console.warn(`[BatchPrefetch] Wolfram prefetch failed for "${query}":`, err);
      }

      prefetchDone++;
      onProgress?.(
        computeProgress(
          job,
          job.concurrency,
          rateLimitHits,
          completedDurations,
          `Pre-fetching Wolfram (${prefetchDone}/${prefetchTotal})…`,
          { phase: true, done: prefetchDone, total: prefetchTotal },
        ),
      );
    }
  }

  // ── Phase 2: LLM generation (parallel, rate-limited) ─────────────────────
  // Now that Wolfram cache is warm, delegate to runBatchJob which will use
  // withRateLimit('llm', ...) for all items. Wolfram calls in contentGenerationService
  // will hit the sessionStorage cache and return immediately without network calls.

  const { maxRetries } = job;
  let effectiveConcurrency = job.concurrency;
  let consecutiveSuccesses = 0;

  let itemIndex = 0;
  const running = new Set<Promise<void>>();

  onProgress?.(computeProgress(job, effectiveConcurrency, rateLimitHits, completedDurations));

  async function processItem(item: BatchItem): Promise<void> {
    const topic =
      item.request.sourceData.prompt ??
      item.request.sourceData.wolframQuery ??
      item.request.topicId ??
      item.id;

    item.startedAt = new Date();
    item.status = 'running';
    onProgress?.(computeProgress(job, effectiveConcurrency, rateLimitHits, completedDurations, topic));

    let lastError: string | undefined;
    let errorRetries = 0;

    while (true) {
      if (errorRetries > 0) {
        item.status = 'retrying';
        item.retryCount = errorRetries;
        item.retryReason = 'error';
        onProgress?.(
          computeProgress(job, effectiveConcurrency, rateLimitHits, completedDurations, topic),
        );
        await sleep(errorRetries * 1000);
      }

      try {
        const resolvedRequest = resolveGenerationRequest(item.request);
        const result = await withRateLimit('llm', () => generateContent(resolvedRequest));

        item.status = 'done';
        item.result = result;
        item.completedAt = new Date();
        item.durationMs = item.completedAt.getTime() - (item.startedAt?.getTime() ?? 0);
        item.retryReason = undefined;
        lastError = undefined;

        consecutiveSuccesses++;
        if (consecutiveSuccesses >= 5) {
          effectiveConcurrency = Math.min(job.concurrency, effectiveConcurrency + 1);
          consecutiveSuccesses = 0;
        }

        if (item.durationMs !== undefined) {
          completedDurations.push(item.durationMs);
        }
        break;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);

        if (isRateLimitError(err)) {
          rateLimitHits++;
          consecutiveSuccesses = 0;
          effectiveConcurrency = Math.max(1, effectiveConcurrency - 1);

          item.status = 'rate_limited';
          item.retryReason = 'rate_limit';
          onProgress?.(
            computeProgress(job, effectiveConcurrency, rateLimitHits, completedDurations, topic),
          );

          const llmState = getState('llm');
          const backoffRemaining = Math.max(0, llmState.backoffUntil - Date.now());
          if (backoffRemaining > 0) {
            await sleep(backoffRemaining + 500);
          }

          item.status = 'retrying';
          continue;
        }

        lastError = errMsg;
        errorRetries++;
        if (errorRetries > maxRetries) {
          break;
        }
      }
    }

    if (lastError !== undefined) {
      item.status = 'failed';
      item.error = lastError;
      item.retryReason = 'error';
      item.completedAt = new Date();
      item.durationMs = item.completedAt.getTime() - (item.startedAt?.getTime() ?? 0);
    }

    onProgress?.(computeProgress(job, effectiveConcurrency, rateLimitHits, completedDurations));
    onItemComplete?.(item);
  }

  while (itemIndex < items.length || running.size > 0) {
    while (running.size < effectiveConcurrency && itemIndex < items.length) {
      const item = items[itemIndex++];
      const p = processItem(item).then(() => {
        running.delete(p);
      });
      running.add(p);
    }

    if (running.size > 0) {
      await Promise.race(running);
    }
  }

  job.completedAt = new Date();

  const totalDurationMs = job.completedAt.getTime() - jobStart;
  const successCount = items.filter(i => i.status === 'done').length;
  const failCount = items.filter(i => i.status === 'failed').length;
  const verifiedCount = items.filter(i => i.result?.wolframVerified === true).length;

  return {
    jobId: job.id,
    jobName: job.name,
    items,
    successCount,
    failCount,
    verifiedCount,
    totalDurationMs,
    exportedAt: new Date(),
  };
}

/**
 * exportBatchResult — serialise a BatchResult to a JSON string.
 */
export function exportBatchResult(result: BatchResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * createBatchItemsFromTopics — convenience helper.
 * Converts an array of topic strings into GenerationRequests
 * with the appropriate defaults.
 */
export function createBatchItemsFromTopics(
  topics: string[],
  examTarget: string,
  outputFormat: ContentOutputFormat,
  count: number = 10,
): GenerationRequest[] {
  return topics
    .map(t => t.trim())
    .filter(t => t.length > 0)
    .map(topic => ({
      source: 'direct_prompt' as const,
      sourceData: {
        prompt: topic,
        wolframQuery: topic,
      },
      outputFormat,
      examTarget,
      topicId: topic,
      difficultyLevel: 'mixed' as const,
      count,
      useWolframVerification: true,
      useWolframGrounding: true,
    }));
}
