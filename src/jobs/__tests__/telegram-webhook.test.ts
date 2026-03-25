/**
 * Unit Tests for Telegram Webhook Handler
 */

import { describe, it, expect } from 'vitest';

describe('Telegram Webhook Routes', () => {
  it('should export webhook route definition', async () => {
    const mod = await import('../telegram-webhook');
    expect(mod.telegramWebhookRoutes).toBeDefined();
    expect(mod.telegramWebhookRoutes).toHaveLength(1);
    expect(mod.telegramWebhookRoutes[0].method).toBe('POST');
    expect(mod.telegramWebhookRoutes[0].path).toBe('/telegram/webhook');
  });
});

describe('Callback Data Parsing', () => {
  it('should parse show_solution callback data', () => {
    const callbackData = 'show_solution:test-pyq-123';
    const prefix = 'show_solution:';

    expect(callbackData.startsWith(prefix)).toBe(true);
    expect(callbackData.replace(prefix, '')).toBe('test-pyq-123');
  });

  it('should handle callback data without colon', () => {
    const callbackData = 'unknown_action';
    expect(callbackData.startsWith('show_solution:')).toBe(false);
  });

  it('should handle empty callback data', () => {
    const callbackData = '';
    expect(callbackData.startsWith('show_solution:')).toBe(false);
  });
});

describe('Webhook Payload Parsing (via existing parseWebhook)', () => {
  it('should handle callback_query payloads', async () => {
    // Import the existing parseWebhook to verify it handles callback queries
    const { parseWebhook } = await import('../../channels/telegram');

    const payload = {
      callback_query: {
        id: 'cb-123',
        from: { id: 12345, username: 'student', first_name: 'Test', last_name: 'User' },
        message: { message_id: 999, chat: { id: -100123, type: 'supergroup' } },
        data: 'show_solution:pyq-456',
      },
    };

    const events = parseWebhook(payload);
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.data.isCallback).toBe(true);
    expect(event.data.content.text).toBe('show_solution:pyq-456');
    expect(event.data.callbackQueryId).toBe('cb-123');
    expect(event.data.chatId).toBe(-100123);
  });

  it('should handle /start message payloads', async () => {
    const { parseWebhook } = await import('../../channels/telegram');

    const payload = {
      message: {
        message_id: 100,
        from: { id: 12345, username: 'student', first_name: 'Test', last_name: 'User' },
        chat: { id: 12345, type: 'private' },
        text: '/start',
        date: Math.floor(Date.now() / 1000),
      },
    };

    const events = parseWebhook(payload);
    expect(events).toHaveLength(1);
    expect(events[0].data.content.text).toBe('/start');
    expect(events[0].data.isCallback).toBeUndefined();
  });
});
