// @ts-nocheck
/**
 * Telegram Webhook Handler
 *
 * Handles incoming Telegram webhook events:
 * - Callback queries ("Show Solution" button taps)
 * - Direct messages to the bot
 *
 * Registered as POST /telegram/webhook
 */

import { ServerResponse } from 'http';
import {
  configureTelegram,
  sendTextMessage,
  answerCallbackQuery,
  verifyWebhookSecret,
  parseWebhook,
} from '../channels/telegram';
import { formatSolution } from './daily-problem';

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

// ============================================================================
// Database
// ============================================================================

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('[telegram-webhook] DATABASE_URL not configured');
  const { Pool } = require('pg');
  return new Pool({ connectionString, max: 2, idleTimeoutMillis: 10_000 });
}

async function findPYQById(pool: any, id: string): Promise<any | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM pyq_questions WHERE id = $1 LIMIT 1',
      [id]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

// ============================================================================
// Callback Handlers
// ============================================================================

/**
 * Handle "Show Solution" button tap.
 * callback_data format: "show_solution:<pyq_id>"
 */
async function handleShowSolution(
  callbackQueryId: string,
  chatId: string | number,
  messageId: number | undefined,
  pyqId: string,
  userId: number
): Promise<void> {
  const pool = getPool();
  try {
    const pyq = await findPYQById(pool, pyqId);

    if (!pyq) {
      await answerCallbackQuery(callbackQueryId, {
        text: 'This problem is no longer available.',
        showAlert: true,
      });
      return;
    }

    // Answer the callback to remove the loading spinner
    await answerCallbackQuery(callbackQueryId, {
      text: `Answer: ${pyq.correct_answer})`,
    });

    // Send the full solution as a reply
    const solutionText = formatSolution(pyq);
    await sendTextMessage(chatId, solutionText, {
      parseMode: 'HTML',
      replyTo: messageId,
    });

    console.log(`[telegram-webhook] Solution for PYQ #${pyqId} sent to user ${userId} in chat ${chatId}`);
  } finally {
    await pool.end().catch(() => {});
  }
}

// ============================================================================
// Route Handler
// ============================================================================

async function handleWebhook(req: ParsedRequest, res: ServerResponse): Promise<void> {
  // Verify webhook secret if configured
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (webhookSecret) {
    const headerSecret = (req.headers?.['x-telegram-bot-api-secret-token'] || '') as string;
    if (headerSecret !== webhookSecret) {
      console.warn('[telegram-webhook] Invalid webhook secret');
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid webhook secret' }));
      return;
    }
  }

  // Ensure Telegram is configured
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Bot not configured' }));
    return;
  }
  configureTelegram({ botToken });

  // Always respond 200 to Telegram quickly (they retry on non-200)
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));

  // Process the webhook payload asynchronously
  try {
    const payload = req.body;
    if (!payload) return;

    const events = parseWebhook(payload);

    for (const event of events) {
      const data = event.data as any;

      // Handle callback queries (button presses)
      if (data?.isCallback && data?.content?.text) {
        const callbackData = data.content.text;

        if (callbackData.startsWith('show_solution:')) {
          const pyqId = callbackData.replace('show_solution:', '');
          await handleShowSolution(
            data.callbackQueryId,
            data.chatId,
            data.messageId,
            pyqId,
            data.from?.id
          );
        }
      }

      // Handle direct messages (future: /start, /help, /topic commands)
      if (!data?.isCallback && data?.content?.text) {
        const text = data.content.text.trim();
        if (text === '/start') {
          await sendTextMessage(data.chatId, [
            '📐 <b>GATE Engineering Math Bot</b>',
            '',
            'I post daily GATE engineering math problems with verified step-by-step solutions.',
            '',
            'Commands:',
            '/start — This message',
            '/topics — List available topics',
            '',
            'Add me to your GATE preparation group for daily problems!',
          ].join('\n'), { parseMode: 'HTML' });
        }
      }
    }
  } catch (err) {
    // Don't throw — we already sent 200 to Telegram
    console.error(`[telegram-webhook] Processing error: ${(err as Error).message}`);
  }
}

// ============================================================================
// Exports
// ============================================================================

export const telegramWebhookRoutes: RouteDefinition[] = [
  { method: 'POST', path: '/telegram/webhook', handler: handleWebhook },
];
