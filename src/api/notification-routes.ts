// @ts-nocheck
/**
 * Notification Routes — Push subscriptions + preferences
 *
 * POST /api/notifications/subscribe    — save push subscription
 * POST /api/notifications/preferences  — update email/push preferences
 * GET  /api/notifications/preferences  — get current preferences
 */

import { ServerResponse } from 'http';
import pg from 'pg';

interface ParsedRequest {
  pathname: string;
  query: URLSearchParams;
  params: Record<string, string>;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
}

type RouteHandler = (req: ParsedRequest, res: ServerResponse) => Promise<void>;

interface RouteDefinition {
  method: string;
  path: string;
  handler: RouteHandler;
}

const pool = new pg.Pool({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL });

// ── Subscribe to push notifications ───────────────────────────────────────────

async function handlePushSubscribe(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = req.body as {
    session_id?: string;
    user_id?: string;
    subscription?: { endpoint: string; keys: { p256dh: string; auth: string } };
  } | null;

  if (!body?.subscription?.endpoint || !body?.subscription?.keys) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'subscription with endpoint and keys required' }));
    return;
  }

  await pool.query(
    `INSERT INTO push_subscriptions (user_id, session_id, endpoint, keys)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint)
     DO UPDATE SET keys = $4, active = true, user_id = COALESCE($1, push_subscriptions.user_id)`,
    [body.user_id || null, body.session_id || null, body.subscription.endpoint, JSON.stringify(body.subscription.keys)]
  );

  res.writeHead(201, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
}

// ── Update notification preferences ───────────────────────────────────────────

async function handleUpdatePreferences(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = req.body as {
    session_id?: string;
    user_id?: string;
    email_digest?: boolean;
    streak_reminders?: boolean;
    push_enabled?: boolean;
  } | null;

  if (!body?.session_id && !body?.user_id) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'session_id or user_id required' }));
    return;
  }

  // Store preferences in user_profiles if user_id exists, otherwise in a simple key-value
  const prefs = {
    email_digest: body.email_digest ?? true,
    streak_reminders: body.streak_reminders ?? true,
    push_enabled: body.push_enabled ?? true,
  };

  if (body.user_id) {
    await pool.query(
      `UPDATE user_profiles SET notification_prefs = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(prefs), body.user_id]
    );
  }

  // If disabling push, deactivate subscriptions
  if (body.push_enabled === false) {
    if (body.user_id) {
      await pool.query(`UPDATE push_subscriptions SET active = false WHERE user_id = $1`, [body.user_id]);
    } else if (body.session_id) {
      await pool.query(`UPDATE push_subscriptions SET active = false WHERE session_id = $1`, [body.session_id]);
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, preferences: prefs }));
}

// ── Get notification preferences ──────────────────────────────────────────────

async function handleGetPreferences(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const userId = req.query.get('user_id');
  if (!userId) {
    // Default preferences for anonymous users
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ email_digest: true, streak_reminders: true, push_enabled: true }));
    return;
  }

  const result = await pool.query(
    `SELECT notification_prefs FROM user_profiles WHERE id = $1`,
    [userId]
  );

  const prefs = result.rows[0]?.notification_prefs || {
    email_digest: true,
    streak_reminders: true,
    push_enabled: true,
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(prefs));
}

// ── VAPID public key endpoint (for frontend to subscribe) ─────────────────────

async function handleVapidKey(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const vapidKey = process.env.VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Push notifications not configured' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ publicKey: vapidKey }));
}

// ── Export ─────────────────────────────────────────────────────────────────────

export const notificationRoutes: RouteDefinition[] = [
  { method: 'POST', path: '/api/notifications/subscribe', handler: handlePushSubscribe },
  { method: 'POST', path: '/api/notifications/preferences', handler: handleUpdatePreferences },
  { method: 'GET', path: '/api/notifications/preferences', handler: handleGetPreferences },
  { method: 'GET', path: '/api/notifications/vapid-key', handler: handleVapidKey },
];
