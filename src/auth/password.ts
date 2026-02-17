/**
 * Password Utilities
 * Secure password hashing and validation
 */

import * as crypto from 'crypto';
import { PasswordPolicy } from './types';

// Argon2-like parameters (using PBKDF2 as fallback for Node.js compatibility)
const HASH_ITERATIONS = 100000;
const HASH_KEY_LENGTH = 64;
const HASH_ALGORITHM = 'sha512';
const SALT_LENGTH = 32;

/**
 * Hash a password securely
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      salt,
      HASH_ITERATIONS,
      HASH_KEY_LENGTH,
      HASH_ALGORITHM,
      (err, derivedKey) => {
        if (err) reject(err);
        
        // Format: $pbkdf2-sha512$iterations$salt$hash
        const hash = `$pbkdf2-sha512$${HASH_ITERATIONS}$${salt.toString('base64')}$${derivedKey.toString('base64')}`;
        resolve(hash);
      }
    );
  });
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const parts = hash.split('$');
  if (parts.length !== 5 || parts[1] !== 'pbkdf2-sha512') {
    throw new Error('Invalid hash format');
  }
  
  const iterations = parseInt(parts[2], 10);
  const salt = Buffer.from(parts[3], 'base64');
  const storedKey = Buffer.from(parts[4], 'base64');
  
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      salt,
      iterations,
      storedKey.length,
      HASH_ALGORITHM,
      (err, derivedKey) => {
        if (err) reject(err);
        resolve(crypto.timingSafeEqual(derivedKey, storedKey));
      }
    );
  });
}

/**
 * Validate password against policy
 */
export function validatePassword(password: string, policy: PasswordPolicy): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters`);
  }
  
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Check for common weak passwords
  const weakPasswords = ['password', '123456', 'qwerty', 'letmein', 'welcome'];
  if (weakPasswords.some(weak => password.toLowerCase().includes(weak))) {
    errors.push('Password is too common');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate a secure random password
 */
export function generatePassword(length: number = 16): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=';
  
  const allChars = lowercase + uppercase + numbers + special;
  
  let password = '';
  
  // Ensure at least one of each type
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];
  password += special[crypto.randomInt(special.length)];
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[crypto.randomInt(allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => crypto.randomInt(3) - 1).join('');
}

/**
 * Check if password was previously used (for password history)
 */
export async function wasPasswordUsed(
  password: string,
  previousHashes: string[]
): Promise<boolean> {
  for (const hash of previousHashes) {
    if (await verifyPassword(password, hash)) {
      return true;
    }
  }
  return false;
}

/**
 * Calculate password strength (0-100)
 */
export function calculatePasswordStrength(password: string): {
  score: number;
  level: 'weak' | 'fair' | 'good' | 'strong' | 'excellent';
  feedback: string[];
} {
  let score = 0;
  const feedback: string[] = [];
  
  // Length scoring
  if (password.length >= 8) score += 10;
  if (password.length >= 12) score += 15;
  if (password.length >= 16) score += 15;
  if (password.length >= 20) score += 10;
  
  // Character variety
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 10;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 15;
  
  // Bonus for mixed characters
  const charTypes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^a-zA-Z0-9]/.test(password)
  ].filter(Boolean).length;
  
  if (charTypes >= 3) score += 10;
  if (charTypes === 4) score += 5;
  
  // Penalties
  if (/(.)\1{2,}/.test(password)) {
    score -= 10;
    feedback.push('Avoid repeating characters');
  }
  
  if (/^[a-zA-Z]+$/.test(password)) {
    score -= 5;
    feedback.push('Add numbers or symbols');
  }
  
  if (/^[0-9]+$/.test(password)) {
    score -= 20;
    feedback.push('Add letters and symbols');
  }
  
  // Common patterns
  if (/^(qwerty|asdf|zxcv)/i.test(password)) {
    score -= 15;
    feedback.push('Avoid keyboard patterns');
  }
  
  // Clamp score
  score = Math.max(0, Math.min(100, score));
  
  // Determine level
  let level: 'weak' | 'fair' | 'good' | 'strong' | 'excellent';
  if (score < 20) level = 'weak';
  else if (score < 40) level = 'fair';
  else if (score < 60) level = 'good';
  else if (score < 80) level = 'strong';
  else level = 'excellent';
  
  // Add feedback for weak passwords
  if (password.length < 12) {
    feedback.push('Use 12+ characters for better security');
  }
  
  return { score, level, feedback };
}
