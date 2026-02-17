/**
 * Authentication Types
 * State-of-the-art auth with multi-tenant user management
 */

// User roles in the system
export type UserRole = 'ceo' | 'admin' | 'teacher' | 'student' | 'parent';

// Auth providers
export type AuthProvider = 'email' | 'google' | 'microsoft' | 'apple' | 'phone';

// User status
export type UserStatus = 'pending' | 'active' | 'suspended' | 'deleted';

// Session status
export type SessionStatus = 'active' | 'expired' | 'revoked';

// User profile
export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  phone?: string;
  phoneVerified: boolean;
  
  // Profile
  firstName: string;
  lastName: string;
  displayName: string;
  avatar?: string;
  
  // Role & permissions
  role: UserRole;
  permissions: string[];
  
  // Organization (multi-tenant)
  organizationId: string;
  organizationRole?: string;
  
  // Status
  status: UserStatus;
  
  // Auth metadata
  provider: AuthProvider;
  providerId?: string;
  
  // MFA
  mfaEnabled: boolean;
  mfaMethods: MFAMethod[];
  
  // Preferences
  preferences: UserPreferences;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
}

export interface MFAMethod {
  type: 'totp' | 'sms' | 'email' | 'backup_codes';
  enabled: boolean;
  verifiedAt?: Date;
  lastUsedAt?: Date;
}

export interface UserPreferences {
  language: string;
  timezone: string;
  theme: 'light' | 'dark' | 'system';
  notifications: NotificationPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  marketing: boolean;
  productUpdates: boolean;
  weeklyDigest: boolean;
}

// Session
export interface Session {
  id: string;
  userId: string;
  
  // Token info
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  
  // Device info
  deviceId: string;
  deviceType: 'web' | 'mobile' | 'desktop' | 'api';
  deviceName?: string;
  userAgent?: string;
  
  // Location
  ipAddress: string;
  country?: string;
  city?: string;
  
  // Status
  status: SessionStatus;
  
  // Timestamps
  createdAt: Date;
  lastActivityAt: Date;
}

// Organization (multi-tenant)
export interface Organization {
  id: string;
  name: string;
  slug: string;
  
  // Branding
  logo?: string;
  primaryColor?: string;
  domain?: string;
  
  // Plan
  planId: string;
  planName: string;
  
  // Settings
  settings: OrganizationSettings;
  
  // Status
  status: 'trial' | 'active' | 'suspended' | 'cancelled';
  
  // Timestamps
  createdAt: Date;
  trialEndsAt?: Date;
}

export interface OrganizationSettings {
  allowedDomains: string[];
  requireMFA: boolean;
  sessionTimeout: number; // minutes
  maxSessions: number;
  passwordPolicy: PasswordPolicy;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventReuse: number; // last N passwords
  expiryDays: number; // 0 = never
}

// Auth requests/responses
export interface SignUpRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  organizationId?: string;
  inviteCode?: string;
}

export interface SignInRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
  mfaCode?: string;
}

export interface AuthResponse {
  user: User;
  session: Session;
  organization?: Organization;
}

export interface TokenPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
  orgId: string;
  permissions: string[];
  sessionId: string;
  iat: number;
  exp: number;
}

// Password reset
export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}

// Email verification
export interface EmailVerifyRequest {
  token: string;
}

// OAuth
export interface OAuthState {
  provider: AuthProvider;
  redirectUrl: string;
  nonce: string;
  createdAt: number;
}

// Invite
export interface Invite {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
  invitedBy: string;
  code: string;
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
}

// Audit log
export interface AuthAuditLog {
  id: string;
  userId: string;
  action: AuthAction;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, unknown>;
  success: boolean;
  failureReason?: string;
  createdAt: Date;
}

export type AuthAction =
  | 'signup'
  | 'signin'
  | 'signout'
  | 'password_reset_request'
  | 'password_reset_confirm'
  | 'password_change'
  | 'email_verify'
  | 'mfa_enable'
  | 'mfa_disable'
  | 'mfa_verify'
  | 'session_revoke'
  | 'token_refresh'
  | 'oauth_link'
  | 'oauth_unlink';
