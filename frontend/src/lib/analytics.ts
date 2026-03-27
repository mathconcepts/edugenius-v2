/**
 * Lightweight analytics — fire-and-forget event tracking.
 * Uses the existing analytics_events table in Supabase.
 */

let sessionId: string | null = null;

export function setAnalyticsSession(id: string) {
  sessionId = id;
}

export function trackEvent(
  eventType: string,
  metadata: Record<string, unknown> = {},
) {
  if (!sessionId) return;
  const body = JSON.stringify({
    event_type: eventType,
    identifier: sessionId,
    metadata: { ...metadata, timestamp: new Date().toISOString() },
  });
  // Fire-and-forget — don't await, don't block
  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => {}); // Silently ignore failures
}
