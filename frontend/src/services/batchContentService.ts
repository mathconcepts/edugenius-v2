/**
 * batchContentService.ts — Batch content generation orchestrator
 *
 * Generates multiple content items in batch with:
 *   - Arbitration: auto-selects source path per item
 *   - Concurrency: max 3 parallel generation jobs
 *   - Retry: up to 2 retries per failed item
 *   - Progress: per-item + aggregate progress callbacks
 *   - Export: JSON export of results
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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BatchItem {
  id: string;
  request: GenerationRequest;
  arbitration?: ArbitrationDecision;
  status: 'pending' | 'running' | 'done' | 'failed' | 'retrying';
  result?: GeneratedContent;
  error?: string;
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
  verifiedCount: number;       // items with wolframVerified === true
  overallPercent: number;      // 0–100
  currentItem?: string;        // title/topic of item being processed
  estimatedRemainingMs?: number;
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

function computeProgress(job: BatchJob, currentItemLabel?: string): BatchProgress {
  let pending = 0, running = 0, done = 0, failed = 0, verifiedCount = 0;
  for (const item of job.items) {
    switch (item.status) {
      case 'pending': pending++; break;
      case 'running':
      case 'retrying': running++; break;
      case 'done': done++; if (item.result?.wolframVerified) verifiedCount++; break;
      case 'failed': failed++; break;
    }
  }
  const finished = done + failed;
  const total = job.items.length;
  const overallPercent = total === 0 ? 0 : Math.round((finished / total) * 100);

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
 * Uses a simple promise-pool pattern:
 *   - Maintain a set of running promises
 *   - As each slot frees, add the next item
 *   - Retry with exponential backoff on failure
 */
export async function runBatchJob(
  job: BatchJob,
  onProgress?: (p: BatchProgress) => void,
  onItemComplete?: (item: BatchItem) => void,
): Promise<BatchResult> {
  const jobStart = Date.now();
  job.startedAt = new Date(jobStart);

  const items = job.items;
  const { concurrency, maxRetries } = job;

  let itemIndex = 0;
  const running = new Set<Promise<void>>();

  // Emit initial progress
  onProgress?.(computeProgress(job));

  async function processItem(item: BatchItem): Promise<void> {
    const topic =
      item.request.sourceData.prompt ??
      item.request.sourceData.wolframQuery ??
      item.request.topicId ??
      item.id;

    item.startedAt = new Date();
    item.status = 'running';
    onProgress?.(computeProgress(job, topic));

    let lastError: string | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        item.status = 'retrying';
        item.retryCount = attempt;
        onProgress?.(computeProgress(job, topic));
        // Exponential backoff: 1s, 2s
        await sleep(attempt * 1000);
      }

      try {
        // Resolve the request through arbitration (may upgrade to wolfram etc.)
        const resolvedRequest = resolveGenerationRequest(item.request);
        const result = await generateContent(resolvedRequest);

        item.status = 'done';
        item.result = result;
        item.completedAt = new Date();
        item.durationMs = item.completedAt.getTime() - (item.startedAt?.getTime() ?? 0);
        lastError = undefined;
        break; // success — exit retry loop
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    if (lastError !== undefined) {
      item.status = 'failed';
      item.error = lastError;
      item.completedAt = new Date();
      item.durationMs = item.completedAt.getTime() - (item.startedAt?.getTime() ?? 0);
    }

    onProgress?.(computeProgress(job));
    onItemComplete?.(item);
  }

  // Promise pool
  while (itemIndex < items.length || running.size > 0) {
    // Fill up available concurrency slots
    while (running.size < concurrency && itemIndex < items.length) {
      const item = items[itemIndex++];
      const p = processItem(item).then(() => {
        running.delete(p);
      });
      running.add(p);
    }

    if (running.size > 0) {
      // Wait for at least one slot to free
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
