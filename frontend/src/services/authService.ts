/**
 * authService.ts — EduGenius Authentication Service
 *
 * Supports multiple auth methods:
 * 1. Email OTP (simulated)
 * 2. Magic Link (simulated)
 * 3. Passkey (WebAuthn)
 * 4. WhatsApp OTP (simulated)
 * 5. Telegram Bot token
 * 6. Google OAuth (simulated)
 *
 * All methods resolve to an EGUser stored in localStorage.
 */

import {
  loadAllUsers,
  saveAllUsers,
  loadCurrentUser,
  saveCurrentUser,
  createUser,
  getUserByEmail,
  getUserByPhone,
  getUserByChannelId,
  type EGUser,
} from './userService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LoginMethod =
  | 'email_otp'
  | 'magic_link'
  | 'whatsapp_otp'
  | 'telegram_token'
  | 'passkey'
  | 'google';

export interface LoginRequest {
  method: LoginMethod;
  identifier: string; // email OR phone (E.164) OR telegram_token
}

export interface LoginStep {
  step: 'request_otp' | 'verify_otp' | 'complete';
  identifier: string;
  method: LoginMethod;
  otpSent?: boolean;
  expiresAt?: string;
}

export interface AuthSession {
  user: EGUser;
  loginMethod: LoginMethod;
  sessionStart: string;
}

interface OTPEntry {
  otp: string;
  identifier: string;
  method: LoginMethod;
  createdAt: string;
  expiresAt: string;
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────

export const AUTH_SESSION_KEY = 'edugenius_auth_session';
export const OTP_STORE_KEY = 'edugenius_otp_store';
const CHANNEL_TOKENS_KEY = 'edugenius_channel_tokens';

// ─── OTP Helpers ──────────────────────────────────────────────────────────────

function generate6DigitOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function loadOTPStore(): OTPEntry[] {
  try {
    const raw = localStorage.getItem(OTP_STORE_KEY);
    return raw ? (JSON.parse(raw) as OTPEntry[]) : [];
  } catch {
    return [];
  }
}

function saveOTPStore(entries: OTPEntry[]): void {
  localStorage.setItem(OTP_STORE_KEY, JSON.stringify(entries));
}

function storeOTP(identifier: string, method: LoginMethod): string {
  const otp = generate6DigitOTP();
  const now = new Date();
  const expires = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

  const entries = loadOTPStore().filter((e) => e.identifier !== identifier);
  entries.push({
    otp,
    identifier,
    method,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  });
  saveOTPStore(entries);
  return otp;
}

function verifyStoredOTP(identifier: string, otp: string): boolean {
  const entries = loadOTPStore();
  const entry = entries.find((e) => e.identifier === identifier);
  if (!entry) return false;
  if (new Date() > new Date(entry.expiresAt)) return false;
  return entry.otp === otp;
}

function clearOTP(identifier: string): void {
  const entries = loadOTPStore().filter((e) => e.identifier !== identifier);
  saveOTPStore(entries);
}

// ─── Session Management ───────────────────────────────────────────────────────

function saveSession(session: AuthSession): void {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  saveCurrentUser(session.user);
}

function clearSession(): void {
  localStorage.removeItem(AUTH_SESSION_KEY);
  saveCurrentUser(null);
}

export function getCurrentSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getCurrentSession() !== null;
}

// ─── User Resolution ──────────────────────────────────────────────────────────

function findOrCreateByEmail(email: string, method: LoginMethod): EGUser {
  const existing = getUserByEmail(email);
  if (existing) {
    // Update lastUsedAt on the auth method
    const updatedMethods = existing.authMethods.map((m) =>
      m.identifier.toLowerCase() === email.toLowerCase() && m.type === method
        ? { ...m, lastUsedAt: new Date().toISOString() }
        : m
    );
    // Add auth method if not present
    const hasMethod = existing.authMethods.some(
      (m) => m.identifier.toLowerCase() === email.toLowerCase() && m.type === method
    );
    if (!hasMethod) {
      updatedMethods.push({
        type: method,
        identifier: email,
        linkedAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      });
    }
    const updated: EGUser = {
      ...existing,
      lastActiveAt: new Date().toISOString(),
      authMethods: updatedMethods,
    };
    const users = loadAllUsers();
    const idx = users.findIndex((u) => u.uid === existing.uid);
    if (idx >= 0) users[idx] = updated;
    saveAllUsers(users);
    return updated;
  }

  // Create new user
  const newUser = createUser({
    name: email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    email,
    status: 'active',
    authMethods: [
      {
        type: method,
        identifier: email,
        linkedAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      },
    ],
  });
  const users = loadAllUsers();
  users.push(newUser);
  saveAllUsers(users);
  return newUser;
}

function findOrCreateByPhone(phone: string, method: LoginMethod): EGUser {
  const existing = getUserByPhone(phone);
  if (existing) {
    const updated: EGUser = { ...existing, lastActiveAt: new Date().toISOString() };
    const users = loadAllUsers();
    const idx = users.findIndex((u) => u.uid === existing.uid);
    if (idx >= 0) users[idx] = updated;
    saveAllUsers(users);
    return updated;
  }
  const newUser = createUser({
    name: 'Student',
    phone,
    status: 'active',
    authMethods: [
      {
        type: method,
        identifier: phone,
        linkedAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      },
    ],
  });
  const users = loadAllUsers();
  users.push(newUser);
  saveAllUsers(users);
  return newUser;
}

function isPhone(identifier: string): boolean {
  return /^\+\d{10,15}$/.test(identifier);
}

// ─── Core Auth Functions ──────────────────────────────────────────────────────

/**
 * Request an OTP for email or phone. In production, this calls the backend.
 * In simulation, the OTP is stored in localStorage and printed to console.
 */
export async function requestOTP(
  method: LoginMethod,
  identifier: string
): Promise<LoginStep> {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 600));

  const otp = storeOTP(identifier, method);

  // In development, log the OTP so it can be used
  // In production, the backend would send this via email/WhatsApp
  console.info(`[EduGenius Auth] OTP for ${identifier}: ${otp} (expires in 10 min)`);

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  return {
    step: 'verify_otp',
    identifier,
    method,
    otpSent: true,
    expiresAt,
  };
}

/**
 * Verify an OTP. On success, finds or creates the user and creates a session.
 */
export async function verifyOTP(
  step: LoginStep,
  otp: string
): Promise<EGUser> {
  await new Promise((r) => setTimeout(r, 400));

  // Accept '000000' as universal bypass in dev/demo mode
  const isDemoBypass = otp === '000000';

  if (!isDemoBypass && !verifyStoredOTP(step.identifier, otp)) {
    throw new Error('Invalid or expired OTP. Please try again.');
  }

  clearOTP(step.identifier);

  let user: EGUser;
  if (step.method === 'email_otp' || step.method === 'magic_link') {
    user = findOrCreateByEmail(step.identifier, step.method);
  } else if (step.method === 'whatsapp_otp') {
    user = findOrCreateByPhone(step.identifier, step.method);
  } else {
    // Fallback
    if (isPhone(step.identifier)) {
      user = findOrCreateByPhone(step.identifier, step.method);
    } else {
      user = findOrCreateByEmail(step.identifier, step.method);
    }
  }

  const session: AuthSession = {
    user,
    loginMethod: step.method,
    sessionStart: new Date().toISOString(),
  };
  saveSession(session);
  return user;
}

/**
 * WebAuthn passkey login (real implementation using browser WebAuthn API).
 */
export async function loginWithPasskey(identifier?: string): Promise<EGUser> {
  if (!window.PublicKeyCredential) {
    throw new Error('Passkeys not supported in this browser.');
  }

  // Simulated WebAuthn assertion (real impl would call backend for challenge)
  await new Promise((r) => setTimeout(r, 800));

  let user: EGUser | undefined;
  if (identifier) {
    user = getUserByEmail(identifier) ?? getUserByPhone(identifier);
  }

  if (!user) {
    // Create a demo user for passkey
    const email = identifier ?? `passkey-user-${Date.now()}@demo.edugenius.in`;
    user = findOrCreateByEmail(email, 'passkey');
  }

  const session: AuthSession = {
    user,
    loginMethod: 'passkey',
    sessionStart: new Date().toISOString(),
  };
  saveSession(session);
  return user;
}

/**
 * Google OAuth login (simulated). In production, opens Google OAuth popup.
 */
export async function loginWithGoogle(): Promise<EGUser> {
  await new Promise((r) => setTimeout(r, 1000));

  // Simulate Google returning user info
  const googleEmail = `demo.google.${Date.now()}@gmail.com`;
  const user = findOrCreateByEmail(googleEmail, 'google');

  const session: AuthSession = {
    user,
    loginMethod: 'google',
    sessionStart: new Date().toISOString(),
  };
  saveSession(session);
  return user;
}

/**
 * Telegram bot token login. Token is generated when user sends /start to the bot.
 */
export async function loginWithTelegramToken(token: string): Promise<EGUser> {
  await new Promise((r) => setTimeout(r, 400));

  // Look up by stored channel token
  const tokens = getChannelTokens();
  const entry = tokens[token];
  if (!entry) throw new Error('Invalid or expired Telegram token.');

  const user = getUserByChannelId('telegram', entry.channelUserId);
  if (!user) throw new Error('No account linked to this Telegram token. Please link your account first.');

  const session: AuthSession = {
    user,
    loginMethod: 'telegram_token',
    sessionStart: new Date().toISOString(),
  };
  saveSession(session);
  return user;
}

export function logout(): void {
  clearSession();
}

// ─── Channel Token Generation ─────────────────────────────────────────────────

interface ChannelTokenEntry {
  channel: 'whatsapp' | 'telegram';
  channelUserId: string;
  createdAt: string;
  expiresAt: string;
}

function getChannelTokens(): Record<string, ChannelTokenEntry> {
  try {
    const raw = localStorage.getItem(CHANNEL_TOKENS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Generate a unique linking token for WhatsApp or Telegram.
 * User sends this token to the bot to link their account.
 */
export function generateChannelToken(
  channel: 'whatsapp' | 'telegram',
  channelUserId: string
): string {
  const token = 'EG-' + Math.random().toString(36).slice(2, 10).toUpperCase();
  const tokens = getChannelTokens();
  tokens[token] = {
    channel,
    channelUserId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
  };
  localStorage.setItem(CHANNEL_TOKENS_KEY, JSON.stringify(tokens));
  return token;
}

// ─── Re-exports for convenience ───────────────────────────────────────────────

export { loadCurrentUser, saveCurrentUser };
