// @ts-nocheck
/**
 * Retention Engine — Email queue + push notifications + cron processor
 *
 * Cron endpoints (Bearer CRON_SECRET):
 *   POST /api/email/process       — process pending emails (Resend or skip)
 *   POST /api/retention/enqueue   — check streaks + enqueue retention emails
 *
 * Email sending is optional — if RESEND_API_KEY is not set,
 * emails are logged and marked 'skipped'.
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

const FROM_EMAIL = process.env.FROM_EMAIL || 'GATE Math <noreply@gatemath.app>';
const BASE_URL = process.env.BASE_URL || 'https://gate-math-api.onrender.com';

// ── Auth helper ───────────────────────────────────────────────────────────────

function isCronAuthorized(req: ParsedRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.authorization as string;
  return auth === `Bearer ${secret}`;
}

// ── Email templates ───────────────────────────────────────────────────────────

interface EmailTemplate {
  subject: string;
  html: string;
}

function renderEmailTemplate(template: string, payload: Record<string, unknown>): EmailTemplate {
  switch (template) {
    case 'welcome_day0':
      return {
        subject: 'Welcome to GATE Math — Your Study Plan Starts Now',
        html: `<div style="font-family:'DM Sans',sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h1 style="color:#0f172a;font-size:24px;margin-bottom:16px">Welcome to GATE Math!</h1>
          <p style="color:#334155;line-height:1.6">You've taken the first step toward mastering GATE Engineering Mathematics. Our AI-powered platform creates personalized study plans based on your strengths and weaknesses.</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${BASE_URL}/onboard" style="display:inline-block;background:#10b981;color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600">Start Your Diagnostic Test</a>
          </div>
          <p style="color:#64748b;font-size:14px">The diagnostic takes about 10 minutes and helps us build your personalized plan.</p>
        </div>`,
      };

    case 'welcome_day3':
      return {
        subject: 'Your GATE Math Study Plan is Ready',
        html: `<div style="font-family:'DM Sans',sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h1 style="color:#0f172a;font-size:24px;margin-bottom:16px">Your Personalized Plan</h1>
          <p style="color:#334155;line-height:1.6">Based on your diagnostic results, Study Commander has created a daily plan focused on your weak topics. Log in to see today's tasks.</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${BASE_URL}/" style="display:inline-block;background:#10b981;color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600">See Today's Plan</a>
          </div>
        </div>`,
      };

    case 'welcome_day7':
      return {
        subject: 'Your First Week with GATE Math — Progress Report',
        html: `<div style="font-family:'DM Sans',sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h1 style="color:#0f172a;font-size:24px;margin-bottom:16px">Week 1 Complete!</h1>
          <p style="color:#334155;line-height:1.6">You've been with GATE Math for a week. ${payload.problems_solved ? `You've solved ${payload.problems_solved} problems.` : 'Time to start solving problems!'}</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${BASE_URL}/progress" style="display:inline-block;background:#10b981;color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600">View Your Progress</a>
          </div>
        </div>`,
      };

    case 'streak_reminder':
      return {
        subject: `Your ${payload.streak_count}-day streak is at risk!`,
        html: `<div style="font-family:'DM Sans',sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h1 style="color:#0f172a;font-size:24px;margin-bottom:16px">Don't break your streak!</h1>
          <p style="color:#334155;line-height:1.6">You have a ${payload.streak_count}-day streak going. Solve just one problem today to keep it alive.</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${BASE_URL}/" style="display:inline-block;background:#f59e0b;color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600">Quick Practice</a>
          </div>
        </div>`,
      };

    case 'weekly_digest': {
      const stats = payload as { problems_solved?: number; accuracy?: number; streak?: number; weak_topics?: string[] };
      return {
        subject: 'Your Weekly GATE Math Digest',
        html: `<div style="font-family:'DM Sans',sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h1 style="color:#0f172a;font-size:24px;margin-bottom:16px">Weekly Progress</h1>
          <div style="display:flex;gap:24px;margin:24px 0">
            <div style="text-align:center"><div style="font-size:32px;font-weight:800;color:#10b981">${stats.problems_solved || 0}</div><div style="color:#64748b;font-size:12px">Problems</div></div>
            <div style="text-align:center"><div style="font-size:32px;font-weight:800;color:#3b82f6">${stats.accuracy || 0}%</div><div style="color:#64748b;font-size:12px">Accuracy</div></div>
            <div style="text-align:center"><div style="font-size:32px;font-weight:800;color:#f59e0b">${stats.streak || 0}</div><div style="color:#64748b;font-size:12px">Day Streak</div></div>
          </div>
          ${stats.weak_topics?.length ? `<p style="color:#334155;margin-top:16px">Focus areas this week: <strong>${stats.weak_topics.join(', ')}</strong></p>` : ''}
          <div style="text-align:center;margin:32px 0">
            <a href="${BASE_URL}/" style="display:inline-block;background:#10b981;color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600">Continue Studying</a>
          </div>
        </div>`,
      };
    }

    default:
      return {
        subject: 'GATE Math Update',
        html: `<p>You have an update from GATE Math. <a href="${BASE_URL}">Visit the app</a>.</p>`,
      };
  }
}

// ── Send email (Resend or skip) ───────────────────────────────────────────────

async function sendEmail(to: string, template: EmailTemplate): Promise<boolean> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.log(`[retention] Email skipped (no RESEND_API_KEY): to=${to} subject="${template.subject}"`);
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: template.subject,
        html: template.html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[retention] Resend API error: ${response.status} ${error}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[retention] Email send failed:', err);
    return false;
  }
}

// ── Process email queue ───────────────────────────────────────────────────────

async function handleProcessEmails(req: ParsedRequest, res: ServerResponse): Promise<void> {
  if (!isCronAuthorized(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  const pending = await pool.query(
    `SELECT eq.id, eq.user_id, eq.template, eq.payload,
            up.email
     FROM email_queue eq
     LEFT JOIN user_profiles up ON eq.user_id = up.id
     WHERE eq.status = 'pending' AND eq.scheduled_at <= NOW()
     ORDER BY eq.scheduled_at ASC
     LIMIT 20`
  );

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of pending.rows) {
    if (!row.email) {
      await pool.query(`UPDATE email_queue SET status = 'skipped' WHERE id = $1`, [row.id]);
      skipped++;
      continue;
    }

    const template = renderEmailTemplate(row.template, row.payload || {});
    const success = await sendEmail(row.email, template);

    if (success) {
      await pool.query(`UPDATE email_queue SET status = 'sent', sent_at = NOW() WHERE id = $1`, [row.id]);
      sent++;
    } else if (!process.env.RESEND_API_KEY) {
      await pool.query(`UPDATE email_queue SET status = 'skipped' WHERE id = $1`, [row.id]);
      skipped++;
    } else {
      await pool.query(`UPDATE email_queue SET status = 'failed' WHERE id = $1`, [row.id]);
      failed++;
    }
  }

  console.log(`[retention] Processed ${pending.rows.length} emails: ${sent} sent, ${skipped} skipped, ${failed} failed`);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ processed: pending.rows.length, sent, skipped, failed }));
}

// ── Enqueue retention emails (streak checks + welcome sequence) ───────────────

async function handleEnqueueRetention(req: ParsedRequest, res: ServerResponse): Promise<void> {
  if (!isCronAuthorized(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  let enqueued = 0;
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const istHour = istNow.getUTCHours();
  const istDay = istNow.getUTCDay(); // 0 = Sunday

  // 1. Streak reminders (6pm IST check)
  if (istHour >= 17 && istHour <= 19) {
    const streakUsers = await pool.query(
      `SELECT up.id as user_id, up.email,
              COALESCE((up.study_profile->>'current_streak')::int, 0) as streak
       FROM user_profiles up
       WHERE COALESCE((up.study_profile->>'current_streak')::int, 0) >= 3
         AND up.notification_prefs->>'streak_reminders' != 'false'
         AND NOT EXISTS (
           SELECT 1 FROM sr_sessions ss
           WHERE ss.user_id = up.id::text
             AND ss.updated_at >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date
         )
         AND NOT EXISTS (
           SELECT 1 FROM email_queue eq
           WHERE eq.user_id = up.id AND eq.template = 'streak_reminder'
             AND eq.created_at >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date
         )`
    );

    for (const user of streakUsers.rows) {
      await pool.query(
        `INSERT INTO email_queue (user_id, template, payload, scheduled_at)
         VALUES ($1, 'streak_reminder', $2, NOW())`,
        [user.user_id, JSON.stringify({ streak_count: user.streak })]
      );
      enqueued++;
    }
  }

  // 2. Weekly digest (Sunday 10am IST)
  if (istDay === 0 && istHour >= 9 && istHour <= 11) {
    const digestUsers = await pool.query(
      `SELECT up.id as user_id
       FROM user_profiles up
       WHERE up.notification_prefs->>'email_digest' != 'false'
         AND NOT EXISTS (
           SELECT 1 FROM email_queue eq
           WHERE eq.user_id = up.id AND eq.template = 'weekly_digest'
             AND eq.created_at >= NOW() - INTERVAL '6 days'
         )`
    );

    for (const user of digestUsers.rows) {
      // Get stats for the week
      const stats = await pool.query(
        `SELECT
           COUNT(*) as problems_solved,
           AVG(CASE WHEN correct_count > 0 THEN correct_count::float / NULLIF(attempts, 0) ELSE 0 END) * 100 as accuracy
         FROM sr_sessions
         WHERE user_id = $1 AND updated_at >= NOW() - INTERVAL '7 days'`,
        [user.user_id]
      );

      await pool.query(
        `INSERT INTO email_queue (user_id, template, payload, scheduled_at)
         VALUES ($1, 'weekly_digest', $2, NOW())`,
        [user.user_id, JSON.stringify({
          problems_solved: parseInt(stats.rows[0]?.problems_solved || '0'),
          accuracy: Math.round(parseFloat(stats.rows[0]?.accuracy || '0')),
        })]
      );
      enqueued++;
    }
  }

  console.log(`[retention] Enqueued ${enqueued} emails`);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ enqueued }));
}

// ── Enqueue welcome sequence (called when signup_complete funnel event fires) ─

export async function enqueueWelcomeSequence(userId: string): Promise<void> {
  const now = new Date();
  const day3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const day7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO email_queue (user_id, template, payload, scheduled_at) VALUES
     ($1, 'welcome_day0', '{}', NOW()),
     ($1, 'welcome_day3', '{}', $2),
     ($1, 'welcome_day7', '{}', $3)`,
    [userId, day3.toISOString(), day7.toISOString()]
  );
}

// ── Export ─────────────────────────────────────────────────────────────────────

export const retentionRoutes: RouteDefinition[] = [
  { method: 'POST', path: '/api/email/process', handler: handleProcessEmails },
  { method: 'POST', path: '/api/retention/enqueue', handler: handleEnqueueRetention },
];
