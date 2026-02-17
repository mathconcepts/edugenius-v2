/**
 * OAuth Provider Integration
 * Google, Microsoft, Apple OAuth flows
 */

import * as crypto from 'crypto';
import { AuthProvider, User, OAuthState } from './types';

// OAuth configuration (use env vars in production)
export interface OAuthConfig {
  provider: AuthProvider;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
}

// Provider configs (placeholders)
const OAUTH_CONFIGS: Record<string, OAuthConfig> = {
  google: {
    provider: 'google',
    clientId: process.env.GOOGLE_CLIENT_ID || 'PLACEHOLDER_GOOGLE_CLIENT_ID',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'PLACEHOLDER_GOOGLE_CLIENT_SECRET',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
    scopes: ['openid', 'email', 'profile'],
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo'
  },
  microsoft: {
    provider: 'microsoft',
    clientId: process.env.MICROSOFT_CLIENT_ID || 'PLACEHOLDER_MICROSOFT_CLIENT_ID',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || 'PLACEHOLDER_MICROSOFT_CLIENT_SECRET',
    redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3000/auth/microsoft/callback',
    scopes: ['openid', 'email', 'profile', 'User.Read'],
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me'
  },
  apple: {
    provider: 'apple',
    clientId: process.env.APPLE_CLIENT_ID || 'PLACEHOLDER_APPLE_CLIENT_ID',
    clientSecret: process.env.APPLE_CLIENT_SECRET || 'PLACEHOLDER_APPLE_CLIENT_SECRET',
    redirectUri: process.env.APPLE_REDIRECT_URI || 'http://localhost:3000/auth/apple/callback',
    scopes: ['name', 'email'],
    authUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    userInfoUrl: '' // Apple doesn't have userinfo endpoint
  }
};

// State store (use Redis in production)
const stateStore = new Map<string, OAuthState>();

/**
 * Generate OAuth state
 */
function generateState(provider: AuthProvider, redirectUrl: string): string {
  const nonce = crypto.randomBytes(32).toString('hex');
  const stateId = crypto.randomBytes(16).toString('hex');
  
  const state: OAuthState = {
    provider,
    redirectUrl,
    nonce,
    createdAt: Date.now()
  };
  
  stateStore.set(stateId, state);
  
  // Clean up old states (5 min expiry)
  setTimeout(() => stateStore.delete(stateId), 5 * 60 * 1000);
  
  return stateId;
}

/**
 * Validate OAuth state
 */
function validateState(stateId: string): OAuthState | null {
  const state = stateStore.get(stateId);
  if (!state) return null;
  
  // Check expiry (5 min)
  if (Date.now() - state.createdAt > 5 * 60 * 1000) {
    stateStore.delete(stateId);
    return null;
  }
  
  stateStore.delete(stateId);
  return state;
}

/**
 * Get OAuth authorization URL
 */
export function getAuthorizationUrl(
  provider: string,
  redirectUrl: string = '/'
): { url: string; state: string } {
  const config = OAUTH_CONFIGS[provider];
  if (!config) {
    throw new Error(`Unknown OAuth provider: ${provider}`);
  }
  
  const state = generateState(config.provider, redirectUrl);
  
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
    access_type: 'offline',
    prompt: 'consent'
  });
  
  // Apple requires response_mode
  if (provider === 'apple') {
    params.set('response_mode', 'form_post');
  }
  
  return {
    url: `${config.authUrl}?${params.toString()}`,
    state
  };
}

/**
 * Exchange code for tokens
 */
export async function exchangeCode(
  provider: string,
  code: string,
  state: string
): Promise<OAuthTokens> {
  const config = OAUTH_CONFIGS[provider];
  if (!config) {
    throw new Error(`Unknown OAuth provider: ${provider}`);
  }
  
  // Validate state
  const stateData = validateState(state);
  if (!stateData || stateData.provider !== provider) {
    throw new Error('Invalid OAuth state');
  }
  
  // Exchange code for tokens
  const tokenResponse = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri
    }).toString()
  });
  
  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${error}`);
  }
  
  const tokens = await tokenResponse.json() as OAuthTokens;
  
  return {
    ...tokens,
    redirectUrl: stateData.redirectUrl
  };
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  redirectUrl?: string;
}

/**
 * Get user info from provider
 */
export async function getUserInfo(
  provider: string,
  accessToken: string
): Promise<OAuthUserInfo> {
  const config = OAUTH_CONFIGS[provider];
  if (!config) {
    throw new Error(`Unknown OAuth provider: ${provider}`);
  }
  
  // Apple doesn't have userinfo endpoint - decode id_token instead
  if (provider === 'apple') {
    throw new Error('Use decodeAppleIdToken for Apple');
  }
  
  const response = await fetch(config.userInfoUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to get user info');
  }
  
  const data = await response.json();
  
  return normalizeUserInfo(provider, data);
}

export interface OAuthUserInfo {
  provider: AuthProvider;
  providerId: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  displayName: string;
  avatar?: string;
}

/**
 * Normalize user info across providers
 */
function normalizeUserInfo(provider: string, data: any): OAuthUserInfo {
  switch (provider) {
    case 'google':
      return {
        provider: 'google',
        providerId: data.sub,
        email: data.email,
        emailVerified: data.email_verified,
        firstName: data.given_name || '',
        lastName: data.family_name || '',
        displayName: data.name,
        avatar: data.picture
      };
      
    case 'microsoft':
      return {
        provider: 'microsoft',
        providerId: data.id,
        email: data.mail || data.userPrincipalName,
        emailVerified: true, // Microsoft accounts are always verified
        firstName: data.givenName || '',
        lastName: data.surname || '',
        displayName: data.displayName,
        avatar: undefined // Requires separate API call
      };
      
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Decode Apple ID token
 */
export function decodeAppleIdToken(idToken: string): OAuthUserInfo {
  // Decode JWT payload (without verification - should verify in production)
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid ID token');
  }
  
  const payload = JSON.parse(
    Buffer.from(parts[1], 'base64').toString()
  );
  
  return {
    provider: 'apple',
    providerId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === 'true' || payload.email_verified === true,
    firstName: '', // Apple sends name only on first auth
    lastName: '',
    displayName: payload.email.split('@')[0],
    avatar: undefined
  };
}

/**
 * Handle OAuth callback - complete flow
 */
export async function handleOAuthCallback(
  provider: string,
  code: string,
  state: string
): Promise<{ userInfo: OAuthUserInfo; tokens: OAuthTokens }> {
  const tokens = await exchangeCode(provider, code, state);
  
  let userInfo: OAuthUserInfo;
  
  if (provider === 'apple' && tokens.id_token) {
    userInfo = decodeAppleIdToken(tokens.id_token);
  } else {
    userInfo = await getUserInfo(provider, tokens.access_token);
  }
  
  return { userInfo, tokens };
}

/**
 * Refresh OAuth tokens
 */
export async function refreshOAuthTokens(
  provider: string,
  refreshToken: string
): Promise<OAuthTokens> {
  const config = OAUTH_CONFIGS[provider];
  if (!config) {
    throw new Error(`Unknown OAuth provider: ${provider}`);
  }
  
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }).toString()
  });
  
  if (!response.ok) {
    throw new Error('Token refresh failed');
  }
  
  return await response.json();
}

/**
 * Check if OAuth is configured for a provider
 */
export function isOAuthConfigured(provider: string): boolean {
  const config = OAUTH_CONFIGS[provider];
  if (!config) return false;
  
  return !config.clientId.startsWith('PLACEHOLDER_');
}

/**
 * Get configured OAuth providers
 */
export function getConfiguredProviders(): string[] {
  return Object.keys(OAUTH_CONFIGS).filter(isOAuthConfigured);
}
