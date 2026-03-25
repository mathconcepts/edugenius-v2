// @ts-nocheck
/**
 * Daily GATE Math Problem — Telegram Bot Job
 *
 * Posts one GATE engineering math PYQ per day to configured Telegram groups.
 * Called via external cron hitting POST /telegram/daily-problem.
 *
 * Architecture:
 *   Cron → POST /telegram/daily-problem (Authorization: Bearer <token>)
 *     → SELECT unposted PYQ (FOR UPDATE SKIP LOCKED — atomic)
 *     → Format problem + inline keyboard
 *     → sendPhoto (LaTeX image) or sendTextMessage (Unicode fallback)
 *     → UPDATE posted_at
 */

import { ServerResponse } from 'http';
import {
  configureTelegram,
  sendTextMessage,
  sendPhoto,
  createInlineKeyboard,
} from '../channels/telegram';
import { renderLatexToPng, hasComplexMath } from '../utils/latex-to-image';

// ============================================================================
// Types
// ============================================================================

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

interface PYQ {
  id: string;
  exam_id: string;
  year: number;
  question_text: string;
  options: Record<string, string>;
  correct_answer: string;
  explanation: string;
  topic: string;
  difficulty: string;
  marks: number;
}

// ============================================================================
// Configuration
// ============================================================================

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('[daily-problem] DATABASE_URL not configured');
  const { Pool } = require('pg');
  return new Pool({ connectionString, max: 2, idleTimeoutMillis: 10_000 });
}

function getCronSecret(): string {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error('[daily-problem] CRON_SECRET not configured');
  return secret;
}

function getTargetChatIds(): string[] {
  const ids = process.env.TELEGRAM_GROUP_IDS;
  if (!ids) throw new Error('[daily-problem] TELEGRAM_GROUP_IDS not configured');
  return ids.split(',').map(s => s.trim()).filter(Boolean);
}

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Select a random unposted PYQ using FOR UPDATE SKIP LOCKED for idempotency.
 * Returns null if pool is exhausted.
 */
async function selectUnpostedPYQ(pool: any): Promise<PYQ | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(`
      SELECT * FROM pyq_questions
      WHERE posted_at IS NULL
      ORDER BY RANDOM()
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const pyq = result.rows[0];

    await client.query(
      'UPDATE pyq_questions SET posted_at = NOW() WHERE id = $1',
      [pyq.id]
    );

    await client.query('COMMIT');
    return pyq;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Format a PYQ as a Telegram message.
 */
function formatProblemCaption(pyq: PYQ): string {
  const difficultyStars = pyq.difficulty === 'easy' ? '★☆☆'
    : pyq.difficulty === 'medium' ? '★★☆' : '★★★';

  const topicLabel = pyq.topic.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const options = typeof pyq.options === 'string' ? JSON.parse(pyq.options) : pyq.options;
  const optionLines = Object.entries(options)
    .map(([key, val]) => `${key}) ${val}`)
    .join('\n');

  return [
    `📐 <b>GATE Engineering Math — Daily Problem</b>`,
    ``,
    `<b>Topic:</b> ${topicLabel}`,
    `<b>Difficulty:</b> ${difficultyStars} ${pyq.difficulty} | ${pyq.marks} marks`,
    `<b>Year:</b> GATE ${pyq.year}`,
    ``,
    `${pyq.question_text}`,
    ``,
    optionLines,
  ].join('\n');
}

/**
 * Format a solution reply.
 */
function formatSolution(pyq: PYQ): string {
  return [
    `✅ <b>Answer: ${pyq.correct_answer})</b>`,
    ``,
    pyq.explanation,
    ``,
    `──────────────────────`,
    `Want more? Follow this bot for daily GATE math problems.`,
  ].join('\n');
}

/**
 * Post a daily problem to all configured groups.
 */
async function postDailyProblem(): Promise<{ posted: boolean; pyqId?: string; groups?: number; reason?: string }> {
  // Ensure Telegram is configured
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error('[daily-problem] TELEGRAM_BOT_TOKEN not configured');
  configureTelegram({ botToken });

  const pool = getPool();
  try {
    const pyq = await selectUnpostedPYQ(pool);

    if (!pyq) {
      console.warn('[daily-problem] ALERT: No unposted PYQs remaining. Pool exhausted.');
      return { posted: false, reason: 'pool_exhausted' };
    }

    const chatIds = getTargetChatIds();
    const caption = formatProblemCaption(pyq);
    const keyboard = createInlineKeyboard([
      [{ text: '💡 Show Solution', callbackData: `show_solution:${pyq.id}` }],
    ]);

    // Try LaTeX image rendering for the question
    let questionImage: Buffer | null = null;
    if (hasComplexMath(pyq.question_text)) {
      questionImage = await renderLatexToPng(pyq.question_text);
    }

    let successCount = 0;
    for (const chatId of chatIds) {
      try {
        if (questionImage) {
          // Send as photo with caption
          // Telegram sendPhoto with Buffer requires multipart — use URL instead
          // For MVP, send text message (image rendering is a bonus)
          await sendTextMessage(chatId, caption, {
            parseMode: 'HTML',
            keyboard,
          });
        } else {
          await sendTextMessage(chatId, caption, {
            parseMode: 'HTML',
            keyboard,
          });
        }
        successCount++;
        console.log(`[daily-problem] Posted PYQ #${pyq.id} (${pyq.topic}, ${pyq.year}) to group ${chatId}`);
      } catch (err) {
        console.error(`[daily-problem] Failed to post to group ${chatId}: ${(err as Error).message}`);
      }
    }

    return { posted: successCount > 0, pyqId: pyq.id, groups: successCount };
  } finally {
    await pool.end().catch(() => {});
  }
}

// ============================================================================
// Route Handler
// ============================================================================

async function handleDailyProblem(req: ParsedRequest, res: ServerResponse): Promise<void> {
  // Auth check: Authorization: Bearer <CRON_SECRET>
  const authHeader = (req.headers?.['authorization'] || req.headers?.['Authorization']) as string | undefined;
  const expectedToken = getCronSecret();

  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    console.warn('[daily-problem] Unauthorized cron request');
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  try {
    const result = await postDailyProblem();

    if (!result.posted && result.reason === 'pool_exhausted') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'pool_exhausted', message: 'No unposted PYQs remaining' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'posted', pyqId: result.pyqId, groups: result.groups }));
  } catch (err) {
    console.error(`[daily-problem] Error: ${(err as Error).message}`);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}

// ============================================================================
// Exports
// ============================================================================

export { postDailyProblem, selectUnpostedPYQ, formatProblemCaption, formatSolution };

export const dailyProblemRoutes: RouteDefinition[] = [
  { method: 'POST', path: '/telegram/daily-problem', handler: handleDailyProblem },
];
