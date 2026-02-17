/**
 * JWT Token Management
 * Secure token generation and validation
 */

import * as crypto from 'crypto';
import { TokenPayload, User, Session } from './types';

// Token configuration (use env vars in production)
const JWT_SECRET = process.env.JWT_SECRET || 'PLACEHOLDER_JWT_SECRET_CHANGE_IN_PRODUCTION';
const JWT_ACCESS_EXPIRY = 15 * 60; // 15 minutes
const JWT_REFRESH_EXPIRY = 7 * 24 * 60 * 60; // 7 days
const JWT_ALGORITHM = 'HS256';

/**
 * Base64URL encode
 */
function base64UrlEncode(str: string | Buffer): string {
  const base64 = Buffer.isBuffer(str) 
    ? str.toString('base64') 
    : Buffer.from(str).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64URL decode
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString();
}

/**
 * Create HMAC signature
 */
function createSignature(data: string, secret: string): string {
  return base64UrlEncode(
    crypto.createHmac('sha256', secret).update(data).digest()
  );
}

/**
 * Generate JWT token
 */
export function generateToken(payload: Omit<TokenPayload, 'iat' | 'exp'>, expirySeconds: number): string {
  const header = {
    alg: JWT_ALGORITHM,
    typ: 'JWT'
  };
  
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: TokenPayload = {
    ...payload,
    iat: now,
    exp: now + expirySeconds
  } as TokenPayload;
  
  const headerBase64 = base64UrlEncode(JSON.stringify(header));
  const payloadBase64 = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = createSignature(`${headerBase64}.${payloadBase64}`, JWT_SECRET);
  
  return `${headerBase64}.${payloadBase64}.${signature}`;
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [headerBase64, payloadBase64, signature] = parts;
    
    // Verify signature
    const expectedSignature = createSignature(`${headerBase64}.${payloadBase64}`, JWT_SECRET);
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }
    
    // Decode payload
    const payload: TokenPayload = JSON.parse(base64UrlDecode(payloadBase64));
    
    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
}

/**
 * Generate access token for user
 */
export function generateAccessToken(user: User, sessionId: string): string {
  return generateToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    orgId: user.organizationId,
    permissions: user.permissions,
    sessionId
  }, JWT_ACCESS_EXPIRY);
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('base64url');
}

/**
 * Generate session tokens
 */
export function generateSessionTokens(user: User, sessionId: string): {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
} {
  const accessToken = generateAccessToken(user, sessionId);
  const refreshToken = generateRefreshToken();
  
  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: new Date(Date.now() + JWT_ACCESS_EXPIRY * 1000),
    refreshTokenExpiresAt: new Date(Date.now() + JWT_REFRESH_EXPIRY * 1000)
  };
}

/**
 * Generate email verification token
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate password reset token
 */
export function generatePasswordResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate invite code
 */
export function generateInviteCode(): string {
  // 8-character alphanumeric code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[crypto.randomInt(chars.length)];
  }
  return code;
}

/**
 * Generate device ID
 */
export function generateDeviceId(): string {
  return `dev_${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Generate MFA backup codes
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // 8-digit codes in format XXXX-XXXX
    const code = crypto.randomInt(10000000, 99999999).toString();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

/**
 * Generate TOTP secret for MFA
 */
export function generateTOTPSecret(): string {
  // 20-byte secret for TOTP
  return crypto.randomBytes(20).toString('base32');
}

/**
 * Verify TOTP code (basic implementation)
 */
export function verifyTOTPCode(secret: string, code: string, window: number = 1): boolean {
  const now = Math.floor(Date.now() / 30000); // 30-second intervals
  
  for (let i = -window; i <= window; i++) {
    const expectedCode = generateTOTPCodeForTime(secret, now + i);
    if (expectedCode === code) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate TOTP code for a given time window
 */
function generateTOTPCodeForTime(secret: string, counter: number): string {
  // Convert counter to 8-byte buffer
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));
  
  // HMAC-SHA1
  const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'base32'));
  hmac.update(counterBuffer);
  const hash = hmac.digest();
  
  // Dynamic truncation
  const offset = hash[hash.length - 1] & 0x0f;
  const code = (
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  ) % 1000000;
  
  return code.toString().padStart(6, '0');
}

/**
 * Hash sensitive token for storage
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
