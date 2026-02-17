/**
 * Input Validation Utilities
 * Provides robust validation for all user inputs
 */

// ============================================================================
// String Validation
// ============================================================================

export function validateString(
  value: unknown,
  options: {
    name?: string;
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    allowEmpty?: boolean;
  } = {}
): string | undefined {
  const {
    name = 'value',
    required = false,
    minLength,
    maxLength,
    pattern,
    allowEmpty = false,
  } = options;

  // Handle null/undefined
  if (value === null || value === undefined) {
    if (required) {
      throw new ValidationError(`${name} is required`);
    }
    return undefined;
  }

  // Type check
  if (typeof value !== 'string') {
    throw new ValidationError(`${name} must be a string`);
  }

  // Empty check
  if (!allowEmpty && value.trim() === '') {
    if (required) {
      throw new ValidationError(`${name} cannot be empty`);
    }
    return undefined;
  }

  // Length checks
  if (minLength !== undefined && value.length < minLength) {
    throw new ValidationError(`${name} must be at least ${minLength} characters`);
  }

  if (maxLength !== undefined && value.length > maxLength) {
    throw new ValidationError(`${name} must be at most ${maxLength} characters`);
  }

  // Pattern check
  if (pattern && !pattern.test(value)) {
    throw new ValidationError(`${name} has invalid format`);
  }

  return value;
}

// ============================================================================
// Number Validation
// ============================================================================

export function validateNumber(
  value: unknown,
  options: {
    name?: string;
    required?: boolean;
    min?: number;
    max?: number;
    integer?: boolean;
    positive?: boolean;
  } = {}
): number | undefined {
  const {
    name = 'value',
    required = false,
    min,
    max,
    integer = false,
    positive = false,
  } = options;

  // Handle null/undefined
  if (value === null || value === undefined) {
    if (required) {
      throw new ValidationError(`${name} is required`);
    }
    return undefined;
  }

  // Type check and conversion
  let num: number;
  if (typeof value === 'number') {
    num = value;
  } else if (typeof value === 'string') {
    num = parseFloat(value);
  } else {
    throw new ValidationError(`${name} must be a number`);
  }

  // NaN check
  if (isNaN(num)) {
    throw new ValidationError(`${name} must be a valid number`);
  }

  // Infinity check
  if (!isFinite(num)) {
    throw new ValidationError(`${name} must be a finite number`);
  }

  // Integer check
  if (integer && !Number.isInteger(num)) {
    throw new ValidationError(`${name} must be an integer`);
  }

  // Positive check
  if (positive && num <= 0) {
    throw new ValidationError(`${name} must be positive`);
  }

  // Range checks
  if (min !== undefined && num < min) {
    throw new ValidationError(`${name} must be at least ${min}`);
  }

  if (max !== undefined && num > max) {
    throw new ValidationError(`${name} must be at most ${max}`);
  }

  return num;
}

// ============================================================================
// Email Validation
// ============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(
  value: unknown,
  options: { name?: string; required?: boolean } = {}
): string | undefined {
  const { name = 'email', required = false } = options;

  const str = validateString(value, { name, required });
  if (str === undefined) return undefined;

  if (!EMAIL_REGEX.test(str)) {
    throw new ValidationError(`${name} must be a valid email address`);
  }

  return str.toLowerCase();
}

// ============================================================================
// ID Validation
// ============================================================================

const ID_REGEX = /^[a-zA-Z0-9_-]+$/;

export function validateId(
  value: unknown,
  options: { name?: string; required?: boolean; maxLength?: number } = {}
): string | undefined {
  const { name = 'id', required = false, maxLength = 256 } = options;

  const str = validateString(value, { name, required, maxLength });
  if (str === undefined) return undefined;

  if (!ID_REGEX.test(str)) {
    throw new ValidationError(`${name} must contain only alphanumeric characters, underscores, and hyphens`);
  }

  return str;
}

// ============================================================================
// Array Validation
// ============================================================================

export function validateArray<T>(
  value: unknown,
  options: {
    name?: string;
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    itemValidator?: (item: unknown, index: number) => T;
  } = {}
): T[] | undefined {
  const {
    name = 'array',
    required = false,
    minLength,
    maxLength,
    itemValidator,
  } = options;

  // Handle null/undefined
  if (value === null || value === undefined) {
    if (required) {
      throw new ValidationError(`${name} is required`);
    }
    return undefined;
  }

  // Type check
  if (!Array.isArray(value)) {
    throw new ValidationError(`${name} must be an array`);
  }

  // Length checks
  if (minLength !== undefined && value.length < minLength) {
    throw new ValidationError(`${name} must have at least ${minLength} items`);
  }

  if (maxLength !== undefined && value.length > maxLength) {
    throw new ValidationError(`${name} must have at most ${maxLength} items`);
  }

  // Validate items
  if (itemValidator) {
    return value.map((item, index) => {
      try {
        return itemValidator(item, index);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new ValidationError(`${name}[${index}]: ${error.message}`);
        }
        throw error;
      }
    });
  }

  return value as T[];
}

// ============================================================================
// Object Validation
// ============================================================================

export function validateObject<T extends Record<string, unknown>>(
  value: unknown,
  options: {
    name?: string;
    required?: boolean;
    schema?: Record<string, (value: unknown) => unknown>;
  } = {}
): T | undefined {
  const { name = 'object', required = false, schema } = options;

  // Handle null/undefined
  if (value === null || value === undefined) {
    if (required) {
      throw new ValidationError(`${name} is required`);
    }
    return undefined;
  }

  // Type check
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${name} must be an object`);
  }

  // Validate schema
  if (schema) {
    const result: Record<string, unknown> = {};
    const obj = value as Record<string, unknown>;

    for (const [key, validator] of Object.entries(schema)) {
      try {
        result[key] = validator(obj[key]);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new ValidationError(`${name}.${key}: ${error.message}`);
        }
        throw error;
      }
    }

    return result as T;
  }

  return value as T;
}

// ============================================================================
// Enum Validation
// ============================================================================

export function validateEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  options: { name?: string; required?: boolean } = {}
): T | undefined {
  const { name = 'value', required = false } = options;

  const str = validateString(value, { name, required });
  if (str === undefined) return undefined;

  if (!allowedValues.includes(str as T)) {
    throw new ValidationError(
      `${name} must be one of: ${allowedValues.join(', ')}`
    );
  }

  return str as T;
}

// ============================================================================
// Date Validation
// ============================================================================

export function validateDate(
  value: unknown,
  options: {
    name?: string;
    required?: boolean;
    min?: Date;
    max?: Date;
    future?: boolean;
    past?: boolean;
  } = {}
): Date | undefined {
  const { name = 'date', required = false, min, max, future, past } = options;

  // Handle null/undefined
  if (value === null || value === undefined) {
    if (required) {
      throw new ValidationError(`${name} is required`);
    }
    return undefined;
  }

  // Convert to Date
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value);
  } else {
    throw new ValidationError(`${name} must be a valid date`);
  }

  // Valid date check
  if (isNaN(date.getTime())) {
    throw new ValidationError(`${name} must be a valid date`);
  }

  const now = new Date();

  // Future check
  if (future && date <= now) {
    throw new ValidationError(`${name} must be in the future`);
  }

  // Past check
  if (past && date >= now) {
    throw new ValidationError(`${name} must be in the past`);
  }

  // Range checks
  if (min && date < min) {
    throw new ValidationError(`${name} must be after ${min.toISOString()}`);
  }

  if (max && date > max) {
    throw new ValidationError(`${name} must be before ${max.toISOString()}`);
  }

  return date;
}

// ============================================================================
// Sanitization
// ============================================================================

export function sanitizeString(value: string): string {
  return value
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}

export function sanitizeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ============================================================================
// Error Class
// ============================================================================

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ============================================================================
// Composite Validators
// ============================================================================

export function validateStudentId(value: unknown): string {
  return validateId(value, { name: 'studentId', required: true, maxLength: 128 })!;
}

export function validateSessionId(value: unknown): string {
  return validateId(value, { name: 'sessionId', required: true, maxLength: 64 })!;
}

export function validateTopic(value: unknown): string | undefined {
  return validateString(value, { name: 'topic', maxLength: 512 });
}

export function validateQuestion(value: unknown): string {
  return validateString(value, {
    name: 'question',
    required: true,
    maxLength: 10000,
  })!;
}

export function validateMetricName(value: unknown): string {
  return validateString(value, {
    name: 'metric',
    required: true,
    maxLength: 256,
    pattern: /^[a-zA-Z][a-zA-Z0-9._-]*$/,
  })!;
}

export function validateMetricValue(value: unknown): number {
  return validateNumber(value, { name: 'value', required: true })!;
}
