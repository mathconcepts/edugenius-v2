// @ts-nocheck
/**
 * Authentication Service
 * Core auth logic with multi-tenant support
 */

import * as crypto from 'crypto';
import {
  User, Session, Organization, Invite,
  SignUpRequest, SignInRequest, AuthResponse,
  UserRole, UserStatus, AuthAction, AuthAuditLog,
  PasswordPolicy, TokenPayload
} from './types';
import { hashPassword, verifyPassword, validatePassword, wasPasswordUsed } from './password';
import {
  generateSessionTokens, generateVerificationToken, generatePasswordResetToken,
  generateInviteCode, generateDeviceId, verifyToken, hashToken
} from './tokens';
import { EventBus } from '../events/event-bus';

// Default password policy
const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
  preventReuse: 5,
  expiryDays: 0
};

// In-memory stores (replace with database in production)
const users = new Map<string, User>();
const sessions = new Map<string, Session>();
const organizations = new Map<string, Organization>();
const invites = new Map<string, Invite>();
const passwordHistory = new Map<string, string[]>();
const verificationTokens = new Map<string, { userId: string; expiresAt: Date }>();
const resetTokens = new Map<string, { userId: string; expiresAt: Date }>();
const auditLogs: AuthAuditLog[] = [];

// Event bus instance
let eventBus: EventBus | null = null;

export function setEventBus(bus: EventBus): void {
  eventBus = bus;
}

/**
 * Generate unique ID
 */
function generateId(prefix: string = ''): string {
  return `${prefix}${crypto.randomBytes(12).toString('hex')}`;
}

/**
 * Log auth action
 */
async function logAuditAction(
  userId: string,
  action: AuthAction,
  ipAddress: string,
  userAgent: string,
  success: boolean,
  failureReason?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const log: AuthAuditLog = {
    id: generateId('log_'),
    userId,
    action,
    ipAddress,
    userAgent,
    metadata,
    success,
    failureReason,
    createdAt: new Date()
  };
  
  auditLogs.push(log);
  
  // Emit event
  if (eventBus) {
    await eventBus.publish({
      id: generateId('evt_'),
      type: 'auth.audit',
      source: 'auth-service',
      data: log,
      timestamp: Date.now(),
      version: '1.0'
    });
  }
}

/**
 * Sign up a new user
 */
export async function signUp(
  request: SignUpRequest,
  ipAddress: string = '0.0.0.0',
  userAgent: string = 'unknown'
): Promise<AuthResponse> {
  // Check if email already exists
  const existingUser = Array.from(users.values()).find(u => u.email === request.email);
  if (existingUser) {
    await logAuditAction('unknown', 'signup', ipAddress, userAgent, false, 'Email already exists');
    throw new Error('Email already registered');
  }
  
  // Get organization (create default if needed)
  let organization: Organization;
  if (request.organizationId) {
    const org = organizations.get(request.organizationId);
    if (!org) throw new Error('Organization not found');
    organization = org;
  } else if (request.inviteCode) {
    // Find invite by code
    const invite = Array.from(invites.values()).find(i => i.code === request.inviteCode);
    if (!invite || invite.expiresAt < new Date()) {
      throw new Error('Invalid or expired invite code');
    }
    const org = organizations.get(invite.organizationId);
    if (!org) throw new Error('Organization not found');
    organization = org;
    
    // Mark invite as used
    invite.acceptedAt = new Date();
    invites.set(invite.id, invite);
  } else {
    // Create personal organization
    organization = createOrganization({
      name: `${request.firstName}'s Workspace`,
      ownerId: 'pending'
    });
  }
  
  // Validate password
  const policy = organization.settings?.passwordPolicy || DEFAULT_PASSWORD_POLICY;
  const passwordValidation = validatePassword(request.password, policy);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.errors.join(', '));
  }
  
  // Hash password
  const passwordHash = await hashPassword(request.password);
  
  // Create user
  const userId = generateId('usr_');
  const user: User = {
    id: userId,
    email: request.email,
    emailVerified: false,
    phoneVerified: false,
    firstName: request.firstName,
    lastName: request.lastName,
    displayName: `${request.firstName} ${request.lastName}`,
    role: request.role || 'student',
    permissions: getDefaultPermissions(request.role || 'student'),
    organizationId: organization.id,
    status: 'pending',
    provider: 'email',
    mfaEnabled: false,
    mfaMethods: [],
    preferences: {
      language: 'en',
      timezone: 'UTC',
      theme: 'system',
      notifications: {
        email: true,
        push: true,
        sms: false,
        marketing: false,
        productUpdates: true,
        weeklyDigest: true
      }
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  // Store user and password
  users.set(userId, user);
  passwordHistory.set(userId, [passwordHash]);
  
  // Update organization owner if new
  if (organization.settings?.allowedDomains?.length === 0) {
    organization = { ...organization };
    organizations.set(organization.id, organization);
  }
  
  // Generate verification token
  const verificationToken = generateVerificationToken();
  verificationTokens.set(hashToken(verificationToken), {
    userId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  });
  
  // Create session
  const session = await createSession(user, ipAddress, userAgent);
  
  // Log success
  await logAuditAction(userId, 'signup', ipAddress, userAgent, true);
  
  // Emit event
  if (eventBus) {
    await eventBus.publish({
      id: generateId('evt_'),
      type: 'auth.user.created',
      source: 'auth-service',
      data: { userId, email: user.email, role: user.role },
      timestamp: Date.now(),
      version: '1.0'
    });
  }
  
  return {
    user,
    session,
    organization
  };
}

/**
 * Sign in an existing user
 */
export async function signIn(
  request: SignInRequest,
  ipAddress: string = '0.0.0.0',
  userAgent: string = 'unknown'
): Promise<AuthResponse> {
  // Find user by email
  const user = Array.from(users.values()).find(u => u.email === request.email);
  if (!user) {
    await logAuditAction('unknown', 'signin', ipAddress, userAgent, false, 'User not found');
    throw new Error('Invalid email or password');
  }
  
  // Check user status
  if (user.status === 'suspended') {
    await logAuditAction(user.id, 'signin', ipAddress, userAgent, false, 'Account suspended');
    throw new Error('Account suspended. Contact support.');
  }
  
  if (user.status === 'deleted') {
    await logAuditAction(user.id, 'signin', ipAddress, userAgent, false, 'Account deleted');
    throw new Error('Invalid email or password');
  }
  
  // Verify password
  const passwordHashes = passwordHistory.get(user.id) || [];
  if (passwordHashes.length === 0) {
    throw new Error('Invalid email or password');
  }
  
  const isValid = await verifyPassword(request.password, passwordHashes[0]);
  if (!isValid) {
    await logAuditAction(user.id, 'signin', ipAddress, userAgent, false, 'Invalid password');
    throw new Error('Invalid email or password');
  }
  
  // Check MFA if enabled
  if (user.mfaEnabled) {
    if (!request.mfaCode) {
      throw new Error('MFA code required');
    }
    // MFA verification would happen here
  }
  
  // Update user
  user.lastLoginAt = new Date();
  user.status = user.status === 'pending' ? 'active' : user.status;
  users.set(user.id, user);
  
  // Create session
  const session = await createSession(user, ipAddress, userAgent, request.rememberMe);
  
  // Get organization
  const organization = organizations.get(user.organizationId);
  
  // Log success
  await logAuditAction(user.id, 'signin', ipAddress, userAgent, true);
  
  return {
    user,
    session,
    organization
  };
}

/**
 * Sign out (revoke session)
 */
export async function signOut(
  sessionId: string,
  ipAddress: string = '0.0.0.0',
  userAgent: string = 'unknown'
): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;
  
  session.status = 'revoked';
  sessions.set(sessionId, session);
  
  await logAuditAction(session.userId, 'signout', ipAddress, userAgent, true);
}

/**
 * Refresh access token
 */
export async function refreshToken(
  refreshToken: string,
  ipAddress: string = '0.0.0.0',
  userAgent: string = 'unknown'
): Promise<{ accessToken: string; accessTokenExpiresAt: Date }> {
  // Find session by refresh token
  const session = Array.from(sessions.values()).find(
    s => s.refreshToken === refreshToken && s.status === 'active'
  );
  
  if (!session) {
    throw new Error('Invalid refresh token');
  }
  
  // Check if refresh token expired
  if (session.refreshTokenExpiresAt < new Date()) {
    session.status = 'expired';
    sessions.set(session.id, session);
    throw new Error('Refresh token expired');
  }
  
  // Get user
  const user = users.get(session.userId);
  if (!user || user.status !== 'active') {
    throw new Error('User not active');
  }
  
  // Generate new access token
  const tokens = generateSessionTokens(user, session.id);
  
  // Update session
  session.accessToken = tokens.accessToken;
  session.accessTokenExpiresAt = tokens.accessTokenExpiresAt;
  session.lastActivityAt = new Date();
  sessions.set(session.id, session);
  
  await logAuditAction(user.id, 'token_refresh', ipAddress, userAgent, true);
  
  return {
    accessToken: tokens.accessToken,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt
  };
}

/**
 * Verify email
 */
export async function verifyEmail(
  token: string,
  ipAddress: string = '0.0.0.0',
  userAgent: string = 'unknown'
): Promise<User> {
  const hashedToken = hashToken(token);
  const tokenData = verificationTokens.get(hashedToken);
  
  if (!tokenData || tokenData.expiresAt < new Date()) {
    throw new Error('Invalid or expired verification token');
  }
  
  const user = users.get(tokenData.userId);
  if (!user) throw new Error('User not found');
  
  user.emailVerified = true;
  user.status = 'active';
  user.updatedAt = new Date();
  users.set(user.id, user);
  
  // Remove token
  verificationTokens.delete(hashedToken);
  
  await logAuditAction(user.id, 'email_verify', ipAddress, userAgent, true);
  
  return user;
}

/**
 * Request password reset
 */
export async function requestPasswordReset(
  email: string,
  ipAddress: string = '0.0.0.0',
  userAgent: string = 'unknown'
): Promise<{ token: string }> {
  const user = Array.from(users.values()).find(u => u.email === email);
  
  // Always return success to prevent email enumeration
  if (!user) {
    return { token: '' };
  }
  
  const token = generatePasswordResetToken();
  resetTokens.set(hashToken(token), {
    userId: user.id,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
  });
  
  await logAuditAction(user.id, 'password_reset_request', ipAddress, userAgent, true);
  
  // In production, send email here
  return { token };
}

/**
 * Confirm password reset
 */
export async function confirmPasswordReset(
  token: string,
  newPassword: string,
  ipAddress: string = '0.0.0.0',
  userAgent: string = 'unknown'
): Promise<void> {
  const hashedToken = hashToken(token);
  const tokenData = resetTokens.get(hashedToken);
  
  if (!tokenData || tokenData.expiresAt < new Date()) {
    throw new Error('Invalid or expired reset token');
  }
  
  const user = users.get(tokenData.userId);
  if (!user) throw new Error('User not found');
  
  const organization = organizations.get(user.organizationId);
  const policy = organization?.settings?.passwordPolicy || DEFAULT_PASSWORD_POLICY;
  
  // Validate new password
  const validation = validatePassword(newPassword, policy);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }
  
  // Check password history
  const history = passwordHistory.get(user.id) || [];
  if (await wasPasswordUsed(newPassword, history.slice(0, policy.preventReuse))) {
    throw new Error(`Cannot reuse last ${policy.preventReuse} passwords`);
  }
  
  // Hash and store new password
  const hash = await hashPassword(newPassword);
  passwordHistory.set(user.id, [hash, ...history.slice(0, 9)]);
  
  user.passwordChangedAt = new Date();
  user.updatedAt = new Date();
  users.set(user.id, user);
  
  // Remove token
  resetTokens.delete(hashedToken);
  
  // Revoke all sessions
  Array.from(sessions.values())
    .filter(s => s.userId === user.id)
    .forEach(s => {
      s.status = 'revoked';
      sessions.set(s.id, s);
    });
  
  await logAuditAction(user.id, 'password_reset_confirm', ipAddress, userAgent, true);
}

/**
 * Change password (authenticated)
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  ipAddress: string = '0.0.0.0',
  userAgent: string = 'unknown'
): Promise<void> {
  const user = users.get(userId);
  if (!user) throw new Error('User not found');
  
  // Verify current password
  const history = passwordHistory.get(userId) || [];
  if (history.length === 0 || !(await verifyPassword(currentPassword, history[0]))) {
    await logAuditAction(userId, 'password_change', ipAddress, userAgent, false, 'Invalid current password');
    throw new Error('Invalid current password');
  }
  
  const organization = organizations.get(user.organizationId);
  const policy = organization?.settings?.passwordPolicy || DEFAULT_PASSWORD_POLICY;
  
  // Validate new password
  const validation = validatePassword(newPassword, policy);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }
  
  // Check password history
  if (await wasPasswordUsed(newPassword, history.slice(0, policy.preventReuse))) {
    throw new Error(`Cannot reuse last ${policy.preventReuse} passwords`);
  }
  
  // Hash and store
  const hash = await hashPassword(newPassword);
  passwordHistory.set(userId, [hash, ...history.slice(0, 9)]);
  
  user.passwordChangedAt = new Date();
  user.updatedAt = new Date();
  users.set(userId, user);
  
  await logAuditAction(userId, 'password_change', ipAddress, userAgent, true);
}

/**
 * Create a session
 */
async function createSession(
  user: User,
  ipAddress: string,
  userAgent: string,
  rememberMe: boolean = false
): Promise<Session> {
  const sessionId = generateId('sess_');
  const tokens = generateSessionTokens(user, sessionId);
  
  // Extend refresh token if remember me
  if (rememberMe) {
    tokens.refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  }
  
  const session: Session = {
    id: sessionId,
    userId: user.id,
    ...tokens,
    deviceId: generateDeviceId(),
    deviceType: 'web',
    userAgent,
    ipAddress,
    status: 'active',
    createdAt: new Date(),
    lastActivityAt: new Date()
  };
  
  sessions.set(sessionId, session);
  
  return session;
}

/**
 * Create organization
 */
function createOrganization(params: {
  name: string;
  ownerId: string;
  planId?: string;
}): Organization {
  const id = generateId('org_');
  const org: Organization = {
    id,
    name: params.name,
    slug: params.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    planId: params.planId || 'free',
    planName: 'Free',
    settings: {
      allowedDomains: [],
      requireMFA: false,
      sessionTimeout: 60,
      maxSessions: 5,
      passwordPolicy: DEFAULT_PASSWORD_POLICY
    },
    status: 'trial',
    createdAt: new Date(),
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  };
  
  organizations.set(id, org);
  return org;
}

/**
 * Get default permissions for role
 */
function getDefaultPermissions(role: UserRole): string[] {
  const permissions: Record<UserRole, string[]> = {
    ceo: ['*'],
    admin: [
      'users:read', 'users:write', 'users:delete',
      'content:read', 'content:write', 'content:delete',
      'analytics:read', 'settings:read', 'settings:write'
    ],
    teacher: [
      'students:read', 'students:write',
      'content:read', 'content:write',
      'analytics:read'
    ],
    student: [
      'content:read', 'progress:read', 'progress:write'
    ],
    parent: [
      'students:read', 'progress:read'
    ]
  };
  
  return permissions[role] || [];
}

/**
 * Create invite
 */
export async function createInvite(
  email: string,
  role: UserRole,
  organizationId: string,
  invitedBy: string
): Promise<Invite> {
  const invite: Invite = {
    id: generateId('inv_'),
    email,
    role,
    organizationId,
    invitedBy,
    code: generateInviteCode(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date()
  };
  
  invites.set(invite.id, invite);
  return invite;
}

/**
 * Validate token and get user
 */
export function validateAccessToken(token: string): { user: User; session: Session } | null {
  const payload = verifyToken(token);
  if (!payload) return null;
  
  const session = sessions.get(payload.sessionId);
  if (!session || session.status !== 'active') return null;
  
  const user = users.get(payload.sub);
  if (!user || user.status !== 'active') return null;
  
  return { user, session };
}

/**
 * Get user by ID
 */
export function getUserById(id: string): User | null {
  return users.get(id) || null;
}

/**
 * Get user sessions
 */
export function getUserSessions(userId: string): Session[] {
  return Array.from(sessions.values())
    .filter(s => s.userId === userId && s.status === 'active');
}

/**
 * Revoke session
 */
export async function revokeSession(
  sessionId: string,
  userId: string,
  ipAddress: string = '0.0.0.0',
  userAgent: string = 'unknown'
): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session || session.userId !== userId) {
    throw new Error('Session not found');
  }
  
  session.status = 'revoked';
  sessions.set(sessionId, session);
  
  await logAuditAction(userId, 'session_revoke', ipAddress, userAgent, true, undefined, { sessionId });
}

/**
 * Get audit logs for user
 */
export function getAuditLogs(userId: string, limit: number = 50): AuthAuditLog[] {
  return auditLogs
    .filter(log => log.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

// Export types
export * from './types';
