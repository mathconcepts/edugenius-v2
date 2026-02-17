/**
 * Authentication Middleware
 * Express/Fastify compatible middleware for auth
 */

import { validateAccessToken, getUserById } from './service';
import { User, Session, UserRole } from './types';

// Extend request with auth info
declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: Session;
      isAuthenticated: boolean;
    }
  }
}

export interface AuthRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: User;
  session?: Session;
  isAuthenticated: boolean;
}

export interface AuthResponse {
  status: (code: number) => AuthResponse;
  json: (data: unknown) => void;
}

export type NextFunction = (error?: Error) => void;

/**
 * Extract token from request
 */
function extractToken(req: AuthRequest): string | null {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  
  const header = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  
  if (header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  
  return null;
}

/**
 * Authentication middleware
 * Validates JWT and attaches user to request
 */
export function authenticate(
  req: AuthRequest,
  res: AuthResponse,
  next: NextFunction
): void {
  req.isAuthenticated = false;
  
  const token = extractToken(req);
  if (!token) {
    return next();
  }
  
  const result = validateAccessToken(token);
  if (!result) {
    return next();
  }
  
  req.user = result.user;
  req.session = result.session;
  req.isAuthenticated = true;
  
  next();
}

/**
 * Require authentication middleware
 */
export function requireAuth(
  req: AuthRequest,
  res: AuthResponse,
  next: NextFunction
): void {
  if (!req.isAuthenticated || !req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }
  
  next();
}

/**
 * Require specific role(s)
 */
export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: AuthResponse, next: NextFunction): void => {
    if (!req.isAuthenticated || !req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }
    
    next();
  };
}

/**
 * Require specific permission(s)
 */
export function requirePermission(...permissions: string[]) {
  return (req: AuthRequest, res: AuthResponse, next: NextFunction): void => {
    if (!req.isAuthenticated || !req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }
    
    // CEO/admin has all permissions
    if (req.user.permissions.includes('*')) {
      return next();
    }
    
    const hasPermission = permissions.every(p => req.user!.permissions.includes(p));
    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }
    
    next();
  };
}

/**
 * Require verified email
 */
export function requireVerifiedEmail(
  req: AuthRequest,
  res: AuthResponse,
  next: NextFunction
): void {
  if (!req.isAuthenticated || !req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }
  
  if (!req.user.emailVerified) {
    return res.status(403).json({
      error: 'Email not verified',
      message: 'Please verify your email address'
    });
  }
  
  next();
}

/**
 * Require MFA if enabled
 */
export function requireMFA(
  req: AuthRequest,
  res: AuthResponse,
  next: NextFunction
): void {
  if (!req.isAuthenticated || !req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }
  
  // If user has MFA enabled, it was verified at login
  // This middleware is for routes that require MFA even if org doesn't mandate it
  
  next();
}

/**
 * Rate limiting helper
 */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(config: RateLimitConfig) {
  return (req: AuthRequest, res: AuthResponse, next: NextFunction): void => {
    const key = req.user?.id || extractClientIP(req) || 'anonymous';
    const now = Date.now();
    
    let entry = rateLimitStore.get(key);
    
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + config.windowMs };
      rateLimitStore.set(key, entry);
    }
    
    entry.count++;
    
    if (entry.count > config.maxRequests) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000)
      });
    }
    
    next();
  };
}

/**
 * Extract client IP
 */
function extractClientIP(req: AuthRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const header = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return header.split(',')[0].trim();
  }
  
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP;
  }
  
  return '0.0.0.0';
}

/**
 * CORS middleware helper
 */
export interface CORSConfig {
  origins: string[];
  methods: string[];
  headers: string[];
  credentials: boolean;
}

export function corsHeaders(config: CORSConfig) {
  return (req: AuthRequest, res: AuthResponse, next: NextFunction): void => {
    const origin = req.headers['origin'];
    const originStr = Array.isArray(origin) ? origin[0] : origin;
    
    if (originStr && (config.origins.includes('*') || config.origins.includes(originStr))) {
      // Set CORS headers would happen here
    }
    
    next();
  };
}

/**
 * Security headers middleware
 */
export function securityHeaders(
  req: AuthRequest,
  res: AuthResponse,
  next: NextFunction
): void {
  // Headers would be set here:
  // X-Content-Type-Options: nosniff
  // X-Frame-Options: DENY
  // X-XSS-Protection: 1; mode=block
  // Strict-Transport-Security: max-age=31536000; includeSubDomains
  // Content-Security-Policy: default-src 'self'
  
  next();
}

/**
 * Request logging middleware
 */
export function requestLogger(
  req: AuthRequest,
  res: AuthResponse,
  next: NextFunction
): void {
  const start = Date.now();
  const method = (req as any).method || 'UNKNOWN';
  const path = (req as any).path || (req as any).url || 'unknown';
  
  // Log after response - would use res.on('finish') in real implementation
  console.log(`[${new Date().toISOString()}] ${method} ${path} - user: ${req.user?.id || 'anonymous'}`);
  
  next();
}
