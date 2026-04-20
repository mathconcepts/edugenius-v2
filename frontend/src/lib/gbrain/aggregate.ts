/**
 * Opt-in anonymous aggregation.
 *
 * When the user opts in (via Settings → "Help improve GBrain"), events are
 * queued locally and flushed periodically to /api/aggregate.
 *
 * Privacy guarantee: events contain ONLY concept_id, error_type, topic,
 * motivation_state, misconception_id. No session_id, no text content, no PII.
 *
 * Storage: localStorage key `gbrain_aggregate_queue` (survives reloads).
 * Flush trigger: every 5 minutes OR on 20 queued events.
 */

const OPT_IN_KEY = 'gbrain_aggregate_optin';
const QUEUE_KEY = 'gbrain_aggregate_queue';
const FLUSH_INTERVAL_MS = 5 * 60 * 1000;
const MAX_QUEUE_BEFORE_FLUSH = 20;
const MAX_QUEUE_SIZE = 100;

export interface AggregateEvent {
  concept_id?: string;
  error_type?: string;
  topic?: string;
  motivation_state?: 'driven' | 'steady' | 'flagging' | 'frustrated' | 'anxious';
  misconception_id?: string;
  misconception_description?: string;
}

let _flushTimer: number | null = null;

export function isOptedIn(): boolean {
  try { return localStorage.getItem(OPT_IN_KEY) === 'true'; } catch { return false; }
}

export function setOptIn(value: boolean) {
  try {
    localStorage.setItem(OPT_IN_KEY, value ? 'true' : 'false');
    if (value) startFlushTimer();
    else stopFlushTimer();
  } catch {}
}

function loadQueue(): AggregateEvent[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveQueue(queue: AggregateEvent[]) {
  try {
    const trimmed = queue.slice(-MAX_QUEUE_SIZE);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
  } catch {}
}

/** Queue an event for aggregation. No-op if user hasn't opted in. */
export function trackAggregate(event: AggregateEvent) {
  if (!isOptedIn()) return;
  const queue = loadQueue();
  queue.push(event);
  saveQueue(queue);
  if (queue.length >= MAX_QUEUE_BEFORE_FLUSH) flush();
}

/** Flush queued events to server. */
export async function flush(): Promise<void> {
  if (!isOptedIn()) return;
  const queue = loadQueue();
  if (queue.length === 0) return;

  // Clear first to avoid duplicates on concurrent flushes
  saveQueue([]);

  try {
    const res = await fetch('/api/aggregate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: queue }),
    });
    if (!res.ok) {
      // Requeue on failure
      const current = loadQueue();
      saveQueue([...queue, ...current]);
    }
  } catch {
    // Network issue — requeue
    const current = loadQueue();
    saveQueue([...queue, ...current]);
  }
}

/** Start periodic flush. Idempotent. */
export function startFlushTimer() {
  if (_flushTimer !== null) return;
  _flushTimer = window.setInterval(() => flush(), FLUSH_INTERVAL_MS);
  // Flush on unload too
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => { flush(); });
  }
}

export function stopFlushTimer() {
  if (_flushTimer !== null) {
    clearInterval(_flushTimer);
    _flushTimer = null;
  }
}

// Auto-start if already opted in
if (typeof window !== 'undefined' && isOptedIn()) {
  startFlushTimer();
}
