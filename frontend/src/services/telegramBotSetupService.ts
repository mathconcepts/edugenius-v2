/**
 * telegramBotSetupService.ts — Telegram Bot Setup State Machine
 *
 * Handles the full bot lifecycle:
 *   token validation → webhook configuration → command setup → test → live
 *
 * State is persisted to localStorage under key EG_TELEGRAM_SETUP_KEY.
 * Token is stored XOR-obfuscated (not plaintext, not real crypto).
 */

// ─── Constants ────────────────────────────────────────────────────────────────

export const EG_TELEGRAM_SETUP_KEY = 'eg_telegram_setup';
const TELEGRAM_API = 'https://api.telegram.org/bot';
const FETCH_TIMEOUT_MS = 10_000;
const XOR_SALT = 'EduGenius2026!TelegramBotKey';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SetupStep =
  | 'not_started'
  | 'token_entry'
  | 'validating_token'
  | 'token_valid'
  | 'webhook_config'
  | 'setting_webhook'
  | 'webhook_live'
  | 'send_test'
  | 'live'
  | 'error'
  | 'paused';

export interface BotCommandSpec {
  command: string;   // without slash, e.g. 'start'
  description: string;
  enabled: boolean;
}

export interface ExamBotEntry {
  examId: string;
  examName: string;
  botToken: string;        // obfuscated
  botUsername: string;
  webhookUrl: string;
  isLive: boolean;
}

export interface TelegramBotConfig {
  botToken: string;         // XOR-obfuscated; use deobfuscateToken() to read
  botId: number;
  botUsername: string;      // without @
  botName: string;
  webhookUrl: string;
  webhookSecret: string;
  setupStep: SetupStep;
  isLive: boolean;
  lastHealthCheck?: string; // ISO timestamp
  lastError?: string;
  testChatId?: string;
  botCommands: BotCommandSpec[];
  examBots: ExamBotEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface SetupDiagnostic {
  check: string;
  status: 'pass' | 'fail' | 'warn' | 'checking';
  detail: string;
  fix?: string;
}

// ─── Internal Telegram API response shapes ────────────────────────────────────

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
}

interface TelegramGetMeResult {
  ok: boolean;
  result?: TelegramUser;
  description?: string;
  error_code?: number;
}

interface TelegramWebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
}

interface TelegramGetWebhookResult {
  ok: boolean;
  result?: TelegramWebhookInfo;
  description?: string;
  error_code?: number;
}

interface TelegramSetWebhookResult {
  ok: boolean;
  description?: string;
  error_code?: number;
}

interface TelegramSendMessageResult {
  ok: boolean;
  result?: { message_id: number };
  description?: string;
  error_code?: number;
}

interface TelegramSetCommandsResult {
  ok: boolean;
  description?: string;
  error_code?: number;
}

// ─── Encryption helpers (XOR obfuscation) ────────────────────────────────────

export function obfuscateToken(token: string): string {
  const salt = XOR_SALT;
  let result = '';
  for (let i = 0; i < token.length; i++) {
    result += String.fromCharCode(token.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
  }
  return btoa(result);
}

export function deobfuscateToken(obfuscated: string): string {
  try {
    const decoded = atob(obfuscated);
    const salt = XOR_SALT;
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
    }
    return result;
  } catch {
    return '';
  }
}

// ─── Config CRUD ──────────────────────────────────────────────────────────────

export function loadBotConfig(): TelegramBotConfig | null {
  try {
    const raw = localStorage.getItem(EG_TELEGRAM_SETUP_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TelegramBotConfig;
  } catch {
    return null;
  }
}

export function saveBotConfig(config: TelegramBotConfig): void {
  const updated = { ...config, updatedAt: new Date().toISOString() };
  localStorage.setItem(EG_TELEGRAM_SETUP_KEY, JSON.stringify(updated));
}

export function resetSetup(): void {
  localStorage.removeItem(EG_TELEGRAM_SETUP_KEY);
}

// ─── Step navigation ──────────────────────────────────────────────────────────

export function advanceStep(config: TelegramBotConfig, nextStep: SetupStep): TelegramBotConfig {
  return { ...config, setupStep: nextStep, lastError: undefined };
}

export function setError(config: TelegramBotConfig, error: string): TelegramBotConfig {
  return { ...config, setupStep: 'error', lastError: error };
}

// ─── Token validation ─────────────────────────────────────────────────────────

/** Validate token format: must match Telegram's known pattern */
export function isValidTokenFormat(token: string): boolean {
  return /^[0-9]+:[A-Za-z0-9_-]{35,}$/.test(token.trim());
}

export async function validateBotToken(
  token: string
): Promise<{ valid: boolean; botInfo?: { id: number; username: string; name: string }; error?: string; privacyMode?: boolean }> {
  const trimmed = token.trim();

  // Format check first — avoids a pointless network call
  if (!isValidTokenFormat(trimmed)) {
    return {
      valid: false,
      error: 'Token format is invalid. It should look like: 123456789:ABCdefGhijklmnopqrstuvwxyz_1234567',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${TELEGRAM_API}${trimmed}/getMe`, { signal: controller.signal });
    clearTimeout(timeout);

    const data = (await res.json()) as TelegramGetMeResult;

    if (!data.ok) {
      if (data.error_code === 401) {
        return { valid: false, error: 'Unauthorized — this token is invalid or revoked. Re-create the bot in BotFather.' };
      }
      return { valid: false, error: data.description ?? 'Telegram returned an error.' };
    }

    const bot = data.result!;

    if (!bot.is_bot) {
      return { valid: false, error: 'This token belongs to a user account, not a bot. Create a bot via @BotFather.' };
    }

    const privacyMode = bot.can_read_all_group_messages === false;

    return {
      valid: true,
      botInfo: {
        id: bot.id,
        username: bot.username ?? '',
        name: bot.first_name + (bot.last_name ? ` ${bot.last_name}` : ''),
      },
      privacyMode,
    };
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      return { valid: false, error: 'Request timed out. Check your internet connection.' };
    }
    return { valid: false, error: 'Network error — could not reach Telegram API.' };
  }
}

// ─── Webhook URL helpers ──────────────────────────────────────────────────────

export function generateWebhookSecret(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

export function suggestWebhookUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (base && base.startsWith('https://')) {
    const clean = base.replace(/\/$/, '');
    return `${clean}/webhook/telegram`;
  }
  // Netlify Functions fallback pattern
  return '/.netlify/functions/telegram-webhook';
}

// ─── Webhook management ───────────────────────────────────────────────────────

export async function setTelegramWebhook(
  token: string,
  webhookUrl: string,
  secret: string
): Promise<{ success: boolean; error?: string }> {
  // Must be HTTPS
  if (!webhookUrl.startsWith('https://') && !webhookUrl.startsWith('/.netlify/')) {
    return { success: false, error: 'Webhook URL must use HTTPS. Telegram will not accept plain HTTP URLs.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${TELEGRAM_API}${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secret,
        allowed_updates: ['message', 'callback_query', 'inline_query'],
        drop_pending_updates: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = (await res.json()) as TelegramSetWebhookResult;

    if (!data.ok) {
      if (data.error_code === 409) {
        return { success: false, error: 'Conflict: another process is polling this bot. Delete the existing webhook first, then re-set.' };
      }
      if (data.description?.includes('HTTPS')) {
        return { success: false, error: 'Telegram rejected the URL: must be HTTPS with a valid certificate.' };
      }
      if (data.description?.includes('Bad Request')) {
        return { success: false, error: `Telegram rejected the webhook: ${data.description}` };
      }
      return { success: false, error: data.description ?? 'Failed to set webhook.' };
    }

    return { success: true };
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: 'Request timed out while setting webhook.' };
    }
    return { success: false, error: 'Network error — could not reach Telegram API.' };
  }
}

export async function deleteTelegramWebhook(
  token: string
): Promise<{ success: boolean; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${TELEGRAM_API}${token}/deleteWebhook`, {
      method: 'POST',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = (await res.json()) as TelegramSetWebhookResult;
    if (!data.ok) {
      return { success: false, error: data.description ?? 'Failed to delete webhook.' };
    }
    return { success: true };
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: 'Request timed out.' };
    }
    return { success: false, error: 'Network error.' };
  }
}

export async function checkWebhookStatus(
  token: string
): Promise<{ url: string; isSet: boolean; pendingCount: number; lastError?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${TELEGRAM_API}${token}/getWebhookInfo`, { signal: controller.signal });
    clearTimeout(timeout);

    const data = (await res.json()) as TelegramGetWebhookResult;

    if (!data.ok || !data.result) {
      return { url: '', isSet: false, pendingCount: 0 };
    }

    return {
      url: data.result.url,
      isSet: !!data.result.url,
      pendingCount: data.result.pending_update_count,
      lastError: data.result.last_error_message,
    };
  } catch {
    clearTimeout(timeout);
    return { url: '', isSet: false, pendingCount: 0 };
  }
}

// ─── Bot commands ─────────────────────────────────────────────────────────────

export function getDefaultCommands(): BotCommandSpec[] {
  return [
    { command: 'start',   description: 'Start using EduGenius on Telegram', enabled: true },
    { command: 'help',    description: 'Show available commands and tips', enabled: true },
    { command: 'exam',    description: 'Switch or view your active exam', enabled: true },
    { command: 'status',  description: 'Check your study progress', enabled: true },
    { command: 'link',    description: 'Link your EduGenius account', enabled: true },
    { command: 'brief',   description: 'Get your daily study brief', enabled: false },
    { command: 'pause',   description: 'Pause notifications', enabled: false },
  ];
}

export async function setBotCommands(
  token: string,
  commands: BotCommandSpec[]
): Promise<{ success: boolean; error?: string }> {
  const enabled = commands
    .filter(c => c.enabled)
    .map(c => ({ command: c.command, description: c.description }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${TELEGRAM_API}${token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands: enabled }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = (await res.json()) as TelegramSetCommandsResult;
    if (!data.ok) {
      return { success: false, error: data.description ?? 'Failed to set bot commands.' };
    }
    return { success: true };
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: 'Request timed out.' };
    }
    return { success: false, error: 'Network error.' };
  }
}

// ─── Test message ─────────────────────────────────────────────────────────────

export async function sendTestMessage(
  token: string,
  chatId: string
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  if (!chatId.trim()) {
    return { success: false, error: 'Please enter your Telegram chat ID.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const text =
    '🎉 *EduGenius Bot is live!*\n\n' +
    'Your Telegram bot is connected and working correctly.\n\n' +
    '✅ Token valid\n✅ Webhook active\n✅ Test message delivered\n\n' +
    'Type /help to see available commands.';

  try {
    const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text,
        parse_mode: 'Markdown',
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = (await res.json()) as TelegramSendMessageResult;

    if (!data.ok) {
      if (data.error_code === 400 && data.description?.includes('chat not found')) {
        return { success: false, error: 'Chat not found. Make sure you have sent /start to your bot first, then double-check your chat ID.' };
      }
      if (data.error_code === 403) {
        return { success: false, error: 'Bot was blocked by the user. Please /start the bot first, then try again.' };
      }
      return { success: false, error: data.description ?? 'Failed to send test message.' };
    }

    return { success: true, messageId: data.result?.message_id };
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: 'Request timed out.' };
    }
    return { success: false, error: 'Network error — could not reach Telegram API.' };
  }
}

// ─── Health check ─────────────────────────────────────────────────────────────

export async function runHealthCheck(config: TelegramBotConfig): Promise<SetupDiagnostic[]> {
  const diagnostics: SetupDiagnostic[] = [];
  const token = deobfuscateToken(config.botToken);

  // 1. Token format
  diagnostics.push({
    check: 'Token format',
    status: 'checking',
    detail: 'Validating token format…',
  });

  const formatOk = isValidTokenFormat(token);
  diagnostics[0] = {
    check: 'Token format',
    status: formatOk ? 'pass' : 'fail',
    detail: formatOk ? 'Token format is valid.' : 'Token format is invalid.',
    fix: formatOk ? undefined : 'Re-generate the bot token in @BotFather using /token.',
  };

  // 2. Token alive (getMe)
  diagnostics.push({ check: 'Token reachable', status: 'checking', detail: 'Calling Telegram getMe…' });
  const tokenCheck = await validateBotToken(token);
  diagnostics[1] = {
    check: 'Token reachable',
    status: tokenCheck.valid ? 'pass' : 'fail',
    detail: tokenCheck.valid
      ? `Bot @${config.botUsername} is alive.`
      : (tokenCheck.error ?? 'Token check failed.'),
    fix: tokenCheck.valid ? undefined : 'Re-create the bot in @BotFather and update the token here.',
  };

  // 3. Webhook set
  diagnostics.push({ check: 'Webhook configured', status: 'checking', detail: 'Checking webhook info…' });
  const webhookInfo = await checkWebhookStatus(token);
  const webhookOk = webhookInfo.isSet && webhookInfo.url === config.webhookUrl;
  diagnostics[2] = {
    check: 'Webhook configured',
    status: webhookOk ? 'pass' : webhookInfo.isSet ? 'warn' : 'fail',
    detail: webhookInfo.isSet
      ? `Webhook set to: ${webhookInfo.url}`
      : 'No webhook configured.',
    fix: webhookOk
      ? undefined
      : webhookInfo.isSet
        ? 'Webhook URL mismatch — re-set webhook with the correct URL.'
        : 'Set the webhook using the Webhook Configuration step.',
  };

  // 4. Pending update count
  const pendingWarn = webhookInfo.pendingCount > 100;
  diagnostics.push({
    check: 'Pending updates',
    status: pendingWarn ? 'warn' : 'pass',
    detail: `${webhookInfo.pendingCount} pending updates in queue.`,
    fix: pendingWarn
      ? 'High backlog suggests webhook is not receiving updates. Check your backend is online and the URL is reachable.'
      : undefined,
  });

  // 5. Webhook last error
  if (webhookInfo.lastError) {
    diagnostics.push({
      check: 'Webhook last error',
      status: 'warn',
      detail: webhookInfo.lastError,
      fix: getWebhookErrorFix(webhookInfo.lastError),
    });
  } else {
    diagnostics.push({
      check: 'Webhook last error',
      status: 'pass',
      detail: 'No errors reported by Telegram.',
    });
  }

  // 6. Webhook URL HTTPS
  const isHttps = config.webhookUrl.startsWith('https://') || config.webhookUrl.startsWith('/.netlify/');
  diagnostics.push({
    check: 'HTTPS endpoint',
    status: isHttps ? 'pass' : 'fail',
    detail: isHttps ? 'Webhook URL uses HTTPS.' : 'Webhook URL must use HTTPS.',
    fix: isHttps ? undefined : 'Update webhook URL to use HTTPS. For local dev, use ngrok: ngrok http 3000',
  });

  // 7. Bot commands
  diagnostics.push({
    check: 'Bot commands',
    status: config.botCommands.some(c => c.enabled) ? 'pass' : 'warn',
    detail: config.botCommands.filter(c => c.enabled).length + ' commands enabled.',
    fix: config.botCommands.some(c => c.enabled)
      ? undefined
      : 'Enable at least /start and /help commands.',
  });

  return diagnostics;
}

// ─── Webhook error fix helper ─────────────────────────────────────────────────

function getWebhookErrorFix(errorMsg: string): string {
  const e = errorMsg.toLowerCase();
  if (e.includes('ssl') || e.includes('certificate')) {
    return 'SSL certificate issue. Use a valid certificate from a trusted CA or upload a self-signed cert to Telegram.';
  }
  if (e.includes('connection refused') || e.includes('timeout')) {
    return 'Server is not reachable. Check your backend is running and ports 80/443/8443 are open.';
  }
  if (e.includes('404') || e.includes('not found')) {
    return 'Webhook URL returns 404. Verify the route /webhook/telegram exists in your backend.';
  }
  if (e.includes('401') || e.includes('403')) {
    return 'Authentication error on webhook. Check your backend is not requiring auth on the webhook route.';
  }
  return 'Check your backend logs for more details. Ensure the webhook URL is publicly reachable.';
}
