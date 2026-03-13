/**
 * events-routes.ts — Session Milestone Event Webhook
 *
 * POST /api/events/session-milestone
 *
 * Receives session milestone events from Sage tutor and routes them:
 *   minutes: 15   → Nudge 7 (Deep Focus) trigger for Mentor
 *   minutes: 20   → Deep Diver badge award
 *   minutes: null → Post-session badge + streak nudge queue
 *
 * Contract defined in: C160 (Sage), C161 (Mentor)
 * Built by: Forge ⚙️ | 2026-03-12
 */

import { IncomingMessage, ServerResponse } from 'http';
import { getEventBus } from '../events/event-bus';

// ============================================================================
// Types
// ============================================================================

export interface SessionMilestonePayload {
  event: 'session_milestone';
  studentId: string;
  sessionId: string;
  examContext: string;           // e.g. "GATE_EM"
  minutes: number | null;        // null = session end
  topicsActive: string[];
  socraticDepth: number;
}

export interface SessionMilestoneRouteConfig {
  method: 'POST';
  path: string;
  handler: (req: ParsedRequest, res: ServerResponse) => Promise<void>;
}

interface ParsedRequest extends IncomingMessage {
  pathname: string;
  query: URLSearchParams;
  params: Record<string, string>;
  body: unknown;
}

// ============================================================================
// Validation
// ============================================================================

function isValidPayload(body: unknown): body is SessionMilestonePayload {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  if (b.event !== 'session_milestone') return false;
  if (typeof b.studentId !== 'string' || !b.studentId) return false;
  if (typeof b.sessionId !== 'string' || !b.sessionId) return false;
  if (typeof b.examContext !== 'string') return false;
  if (b.minutes !== null && typeof b.minutes !== 'number') return false;
  if (!Array.isArray(b.topicsActive)) return false;
  if (typeof b.socraticDepth !== 'number') return false;
  return true;
}

// ============================================================================
// Route Handler
// ============================================================================

async function handleSessionMilestone(req: ParsedRequest, res: ServerResponse): Promise<void> {
  // Fast path: send 200 immediately, process async (avoid latency for student UX)
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, received: Date.now() }));

  // Validate payload
  const body = req.body as unknown;
  if (!isValidPayload(body)) {
    console.warn('[SessionMilestone] Invalid payload received:', JSON.stringify(body));
    return;
  }

  const payload = body;
  const bus = getEventBus();

  console.log(`[SessionMilestone] Received: studentId=${payload.studentId} sessionId=${payload.sessionId} minutes=${payload.minutes} examContext=${payload.examContext} socraticDepth=${payload.socraticDepth}`);

  try {
    if (payload.minutes === 15) {
      // ── Nudge 7: Deep Focus Mode trigger ──────────────────────────────────
      // Route to Mentor → fires "Deep Focus Mode" nudge (C161)
      bus.publish(
        'mentor.nudge.requested',
        {
          studentId: payload.studentId,
          nudgeType: 'encouragement',
          channel: 'in_app',
          content: payload.socraticDepth >= 2
            ? `You've reached ${payload.socraticDepth} rounds of Socratic dialogue — you're thinking like a GATE topper. Keep this momentum. 🔥`
            : "Deep Focus Mode activated! 15 minutes in — you're building real mastery. 🔥",
          scheduledFor: Date.now(),
        },
        {
          source: 'Forge',
          target: 'Mentor',
          priority: 'high',
          correlationId: payload.sessionId,
        }
      );

      // Also publish a typed session milestone event for any other listeners
      bus.publish(
        'sage.progress.updated',
        {
          studentId: payload.studentId,
          subject: payload.examContext,
          topic: payload.topicsActive[0] || 'general',
          masteryLevel: 0,       // Sage owns mastery scoring; we just relay
          questionsAttempted: 0,
          questionsCorrect: 0,
          timeSpent: 15,
          streakDays: 0,
        },
        {
          source: 'Forge',
          target: 'Mentor',
          priority: 'normal',
          correlationId: payload.sessionId,
        }
      );

      console.log(`[SessionMilestone] ✅ Nudge 7 (Deep Focus) routed → Mentor | studentId=${payload.studentId}`);

    } else if (payload.minutes === 20) {
      // ── Deep Diver Badge Award ─────────────────────────────────────────────
      // Publish badge award event → Mentor picks this up and awards the badge
      bus.publish(
        'mentor.progress.update',
        {
          type: 'badge_award',
          badge: {
            id: 'deep_diver',
            name: 'Deep Diver',
            emoji: '🤿',
            description: '20 minutes of focused GATE preparation in a single session',
            rarity: 'rare',
            examContext: payload.examContext,
          },
          studentId: payload.studentId,
          sessionId: payload.sessionId,
          topicsActive: payload.topicsActive,
          socraticDepth: payload.socraticDepth,
          awardedAt: Date.now(),
        },
        {
          source: 'Forge',
          target: 'Mentor',
          priority: 'high',
          correlationId: payload.sessionId,
        }
      );

      console.log(`[SessionMilestone] ✅ Deep Diver badge event routed → Mentor | studentId=${payload.studentId}`);

    } else if (payload.minutes === null) {
      // ── Session End: Post-session badge + streak nudge ─────────────────────
      // 1) Session complete badge
      bus.publish(
        'mentor.progress.update',
        {
          type: 'session_complete',
          badge: {
            id: 'session_complete',
            name: 'Session Complete',
            emoji: '✅',
            description: 'Completed a GATE study session',
            rarity: 'common',
            examContext: payload.examContext,
          },
          studentId: payload.studentId,
          sessionId: payload.sessionId,
          topicsActive: payload.topicsActive,
          socraticDepth: payload.socraticDepth,
          completedAt: Date.now(),
        },
        {
          source: 'Forge',
          target: 'Mentor',
          priority: 'normal',
          correlationId: payload.sessionId,
        }
      );

      // 2) Streak nudge (C6 pattern from Mentor)
      bus.publish(
        'mentor.nudge.requested',
        {
          studentId: payload.studentId,
          nudgeType: 'celebration',
          channel: 'in_app',
          content: `Session complete! 🎉 Your GATE prep streak is growing. Come back tomorrow to keep the momentum!`,
          scheduledFor: Date.now(),
        },
        {
          source: 'Forge',
          target: 'Mentor',
          priority: 'normal',
          correlationId: payload.sessionId,
        }
      );

      console.log(`[SessionMilestone] ✅ Session-end events (badge + streak nudge) routed → Mentor | studentId=${payload.studentId}`);

    } else {
      // Unknown minutes value — log but don't error
      console.info(`[SessionMilestone] Unhandled minutes value: ${payload.minutes} — no routing action taken`);
    }

  } catch (err) {
    // Never let event routing errors surface to student
    console.error('[SessionMilestone] Error routing event:', err);
  }
}

// ============================================================================
// Route Export
// ============================================================================

export const sessionMilestoneRoute: SessionMilestoneRouteConfig = {
  method: 'POST',
  path: '/events/session-milestone',
  handler: handleSessionMilestone,
};

/**
 * All event routes — extend here for future event webhooks
 */
export const eventRoutes: SessionMilestoneRouteConfig[] = [
  sessionMilestoneRoute,
];
