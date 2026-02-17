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
