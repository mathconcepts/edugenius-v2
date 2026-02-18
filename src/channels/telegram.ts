// @ts-nocheck
/**
 * Telegram Channel Adapter
 * Telegram Bot API integration
 */

import * as crypto from 'crypto';
import { MessageContent, ChannelConfig, WebhookEvent } from './types';

// Telegram Bot API base URL
const TELEGRAM_API_BASE = 'https://api.telegram.org';

// Configuration
let telegramConfig: ChannelConfig['credentials']['telegram'] | null = null;

export function configureTelegram(config: NonNullable<ChannelConfig['credentials']['telegram']>): void {
  telegramConfig = config;
}

function getConfig(): NonNullable<ChannelConfig['credentials']['telegram']> {
  if (!telegramConfig) {
    throw new Error('Telegram not configured');
  }
  return telegramConfig;
}

function getApiUrl(method: string): string {
  const config = getConfig();
  return `${TELEGRAM_API_BASE}/bot${config.botToken}/${method}`;
}

// Keyboard types
export interface TelegramKeyboard {
  inline_keyboard?: Array<Array<{
    text: string;
    callback_data?: string;
    url?: string;
  }>>;
  keyboard?: Array<Array<{ text: string }>>;
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  remove_keyboard?: boolean;
}

/**
 * Send a text message
 */
export async function sendTextMessage(
  chatId: string | number,
  text: string,
  options: {
    replyTo?: number;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    disablePreview?: boolean;
    keyboard?: TelegramKeyboard;
  } = {}
): Promise<number> {
  const payload: any = {
    chat_id: chatId,
    text,
    parse_mode: options.parseMode || 'HTML',
    disable_web_page_preview: options.disablePreview
  };
  
  if (options.replyTo) {
    payload.reply_to_message_id = options.replyTo;
  }
  
  if (options.keyboard) {
    payload.reply_markup = options.keyboard;
  }
  
  const response = await fetch(getApiUrl('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const result = await response.json();
  
  if (!result.ok) {
    throw new Error(`Telegram API error: ${result.description}`);
  }
  
  return result.result.message_id;
}

/**
 * Send a photo
 */
export async function sendPhoto(
  chatId: string | number,
  photo: string,
  caption?: string,
  options: {
    replyTo?: number;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    keyboard?: TelegramKeyboard;
  } = {}
): Promise<number> {
  const payload: any = {
    chat_id: chatId,
    photo,
    caption,
    parse_mode: options.parseMode || 'HTML'
  };
  
  if (options.replyTo) payload.reply_to_message_id = options.replyTo;
  if (options.keyboard) payload.reply_markup = options.keyboard;
  
  const response = await fetch(getApiUrl('sendPhoto'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const result = await response.json();
  if (!result.ok) throw new Error(`Telegram API error: ${result.description}`);
  return result.result.message_id;
}

/**
 * Send a document
 */
export async function sendDocument(
  chatId: string | number,
  document: string,
  caption?: string,
  options: { replyTo?: number; keyboard?: TelegramKeyboard } = {}
): Promise<number> {
  const payload: any = { chat_id: chatId, document, caption };
  if (options.replyTo) payload.reply_to_message_id = options.replyTo;
  if (options.keyboard) payload.reply_markup = options.keyboard;
  
  const response = await fetch(getApiUrl('sendDocument'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const result = await response.json();
  if (!result.ok) throw new Error(`Telegram API error: ${result.description}`);
  return result.result.message_id;
}

/**
 * Send audio
 */
export async function sendAudio(
  chatId: string | number,
  audio: string,
  caption?: string,
  options: { duration?: number; title?: string; replyTo?: number } = {}
): Promise<number> {
  const payload: any = {
    chat_id: chatId,
    audio,
    caption,
    duration: options.duration,
    title: options.title
  };
  if (options.replyTo) payload.reply_to_message_id = options.replyTo;
  
  const response = await fetch(getApiUrl('sendAudio'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const result = await response.json();
  if (!result.ok) throw new Error(`Telegram API error: ${result.description}`);
  return result.result.message_id;
}

/**
 * Send video
 */
export async function sendVideo(
  chatId: string | number,
  video: string,
  caption?: string,
  options: { duration?: number; width?: number; height?: number; replyTo?: number } = {}
): Promise<number> {
  const payload: any = { chat_id: chatId, video, caption, ...options };
  
  const response = await fetch(getApiUrl('sendVideo'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const result = await response.json();
  if (!result.ok) throw new Error(`Telegram API error: ${result.description}`);
  return result.result.message_id;
}

/**
 * Send location
 */
export async function sendLocation(
  chatId: string | number,
  latitude: number,
  longitude: number,
  options: { replyTo?: number; keyboard?: TelegramKeyboard } = {}
): Promise<number> {
  const payload: any = { chat_id: chatId, latitude, longitude };
  if (options.replyTo) payload.reply_to_message_id = options.replyTo;
  if (options.keyboard) payload.reply_markup = options.keyboard;
  
  const response = await fetch(getApiUrl('sendLocation'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const result = await response.json();
  if (!result.ok) throw new Error(`Telegram API error: ${result.description}`);
  return result.result.message_id;
}

/**
 * Send chat action (typing indicator)
 */
export async function sendChatAction(
  chatId: string | number,
  action: 'typing' | 'upload_photo' | 'upload_video' | 'upload_document' = 'typing'
): Promise<void> {
  await fetch(getApiUrl('sendChatAction'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action })
  });
}

/**
 * Edit message text
 */
export async function editMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
  options: {
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    keyboard?: TelegramKeyboard;
  } = {}
): Promise<void> {
  const payload: any = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: options.parseMode || 'HTML'
  };
  
  if (options.keyboard) {
    payload.reply_markup = options.keyboard;
  }
  
  await fetch(getApiUrl('editMessageText'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

/**
 * Delete message
 */
export async function deleteMessage(
  chatId: string | number,
  messageId: number
): Promise<void> {
  await fetch(getApiUrl('deleteMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId })
  });
}

/**
 * Answer callback query
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  options: { text?: string; showAlert?: boolean } = {}
): Promise<void> {
  await fetch(getApiUrl('answerCallbackQuery'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: options.text,
      show_alert: options.showAlert
    })
  });
}

/**
 * Get file download URL
 */
export async function getFileUrl(fileId: string): Promise<string> {
  const config = getConfig();
  
  const response = await fetch(getApiUrl('getFile'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId })
  });
  
  const result = await response.json();
  if (!result.ok) throw new Error(`Telegram API error: ${result.description}`);
  
  return `${TELEGRAM_API_BASE}/file/bot${config.botToken}/${result.result.file_path}`;
}

/**
 * Set webhook
 */
export async function setWebhook(
  url: string,
  options: {
    secretToken?: string;
    maxConnections?: number;
    allowedUpdates?: string[];
  } = {}
): Promise<void> {
  const payload: any = {
    url,
    secret_token: options.secretToken,
    max_connections: options.maxConnections || 40,
    allowed_updates: options.allowedUpdates || ['message', 'callback_query']
  };
  
  const response = await fetch(getApiUrl('setWebhook'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const result = await response.json();
  if (!result.ok) throw new Error(`Telegram API error: ${result.description}`);
}

/**
 * Delete webhook
 */
export async function deleteWebhook(): Promise<void> {
  await fetch(getApiUrl('deleteWebhook'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drop_pending_updates: false })
  });
}

/**
 * Get bot info
 */
export async function getMe(): Promise<any> {
  const response = await fetch(getApiUrl('getMe'));
  const result = await response.json();
  if (!result.ok) throw new Error(`Telegram API error: ${result.description}`);
  return result.result;
}

/**
 * Verify webhook secret
 */
export function verifyWebhookSecret(
  secretToken: string,
  expectedSecret: string
): boolean {
  try {
    return crypto.timingSafeEqual(
      Buffer.from(secretToken),
      Buffer.from(expectedSecret)
    );
  } catch {
    return false;
  }
}

/**
 * Parse incoming webhook
 */
export function parseWebhook(payload: any): WebhookEvent[] {
  const events: WebhookEvent[] = [];
  
  // Message received
  if (payload.message) {
    const msg = payload.message;
    events.push({
      id: `tg_${msg.message_id}`,
      channel: 'telegram',
      type: 'message.received',
      data: {
        messageId: msg.message_id,
        chatId: msg.chat.id,
        from: {
          id: msg.from.id,
          username: msg.from.username,
          firstName: msg.from.first_name,
          lastName: msg.from.last_name
        },
        chat: {
          id: msg.chat.id,
          type: msg.chat.type,
          title: msg.chat.title
        },
        content: parseMessageContent(msg),
        replyTo: msg.reply_to_message?.message_id,
        timestamp: new Date(msg.date * 1000)
      },
      timestamp: new Date(),
      processed: false
    });
  }
  
  // Callback query (button press)
  if (payload.callback_query) {
    const cb = payload.callback_query;
    events.push({
      id: cb.id,
      channel: 'telegram',
      type: 'message.received',
      data: {
        callbackQueryId: cb.id,
        messageId: cb.message?.message_id,
        chatId: cb.message?.chat.id,
        from: {
          id: cb.from.id,
          username: cb.from.username,
          firstName: cb.from.first_name,
          lastName: cb.from.last_name
        },
        content: { text: cb.data },
        isCallback: true
      },
      timestamp: new Date(),
      processed: false
    });
  }
  
  return events;
}

/**
 * Parse message content from Telegram format
 */
function parseMessageContent(message: any): MessageContent {
  const content: MessageContent = {};
  
  if (message.text) {
    content.text = message.text;
  }
  
  if (message.photo) {
    const largest = message.photo[message.photo.length - 1];
    content.media = {
      type: 'image',
      url: largest.file_id
    };
    content.text = message.caption;
  }
  
  if (message.audio) {
    content.media = {
      type: 'audio',
      url: message.audio.file_id,
      duration: message.audio.duration,
      filename: message.audio.title
    };
  }
  
  if (message.video) {
    content.media = {
      type: 'video',
      url: message.video.file_id,
      duration: message.video.duration
    };
    content.text = message.caption;
  }
  
  if (message.document) {
    content.media = {
      type: 'document',
      url: message.document.file_id,
      filename: message.document.file_name,
      mimeType: message.document.mime_type
    };
    content.text = message.caption;
  }
  
  if (message.voice) {
    content.media = {
      type: 'audio',
      url: message.voice.file_id,
      duration: message.voice.duration,
      mimeType: 'audio/ogg'
    };
  }
  
  if (message.location) {
    content.location = {
      latitude: message.location.latitude,
      longitude: message.location.longitude
    };
  }
  
  if (message.contact) {
    content.contact = {
      name: `${message.contact.first_name || ''} ${message.contact.last_name || ''}`.trim(),
      phones: [{ type: 'mobile', phone: message.contact.phone_number }]
    };
  }
  
  if (message.sticker) {
    content.media = {
      type: 'sticker',
      url: message.sticker.file_id
    };
  }
  
  return content;
}

/**
 * Create inline keyboard
 */
export function createInlineKeyboard(
  buttons: Array<Array<{ text: string; callbackData?: string; url?: string }>>
): TelegramKeyboard {
  return {
    inline_keyboard: buttons.map(row =>
      row.map(btn => ({
        text: btn.text,
        callback_data: btn.callbackData,
        url: btn.url
      }))
    )
  };
}

/**
 * Create reply keyboard
 */
export function createReplyKeyboard(
  buttons: string[][],
  options: { resize?: boolean; oneTime?: boolean } = {}
): TelegramKeyboard {
  return {
    keyboard: buttons.map(row => row.map(text => ({ text }))),
    resize_keyboard: options.resize !== false,
    one_time_keyboard: options.oneTime
  };
}

/**
 * Remove reply keyboard
 */
export function removeKeyboard(): TelegramKeyboard {
  return { remove_keyboard: true };
}
