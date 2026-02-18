/**
 * Authentication Module
 * Export all auth functionality
 */

// Core service
export {
  signUp,
  signIn,
  signOut,
  refreshToken,
  verifyEmail,
  requestPasswordReset,
  confirmPasswordReset,
  changePassword,
  createInvite,
  validateAccessToken,
  getUserById,
  getUserSessions,
  revokeSession,
  getAuditLogs,
  setEventBus
} from './service';

// Types
export * from './types';

// Password utilities
export {
  hashPassword,
  verifyPassword,
  validatePassword,
  generatePassword,
  calculatePasswordStrength
} from './password';

// Token utilities
export {
  generateToken,
  verifyToken,
  generateAccessToken,
  generateRefreshToken,
  generateVerificationToken,
  generatePasswordResetToken,
  generateInviteCode,
  generateBackupCodes,
  generateTOTPSecret,
  verifyTOTPCode
} from './tokens';

// Middleware
export {
  authenticate,
  requireAuth,
  requireRole,
  requirePermission,
  requireVerifiedEmail,
  requireMFA,
  rateLimit,
  securityHeaders,
  requestLogger
} from './middleware';

// OAuth
export {
  getAuthorizationUrl,
  exchangeCode,
  getUserInfo,
  handleOAuthCallback,
  refreshOAuthTokens,
  isOAuthConfigured,
  getConfiguredProviders,
  decodeAppleIdToken
} from './oauth';

// WebAuthn / Passkeys
export {
  configureWebAuthn,
  setWebAuthnEventBus,
  generateRegistrationOptions,
  verifyRegistration,
  generateAuthenticationOptions,
  verifyAuthentication,
  getUserCredentials,
  renameCredential,
  deleteCredential,
  userHasPasskeys,
  getUserPasskeyCount,
  webAuthnRoutes,
  generateChallenge,
  toBase64URL,
  fromBase64URL,
  parseAuthenticatorData,
  parseClientData,
  formatAAGUID,
  getAuthenticatorName,
  getDeviceType
} from './webauthn';

export type {
  PasskeyCredential,
  RegistrationOptions,
  AuthenticationOptions,
  RegistrationResponse,
  AuthenticationResponse,
  VerificationResult,
  WebAuthnConfig,
  AuthenticatorTransport,
  AttestationConveyancePreference,
  UserVerificationRequirement,
  COSEAlgorithmIdentifier
} from './webauthn';
