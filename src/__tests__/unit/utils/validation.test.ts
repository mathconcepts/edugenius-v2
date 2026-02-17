/**
 * Unit Tests for Validation Utilities
 */

import { describe, it, expect } from 'vitest';
import {
  validateString,
  validateNumber,
  validateEmail,
  validateId,
  validateArray,
  validateObject,
  validateEnum,
  validateDate,
  sanitizeString,
  sanitizeHtml,
  ValidationError,
} from '../../../utils/validation';

describe('validateString', () => {
  it('should return valid string', () => {
    expect(validateString('hello')).toBe('hello');
  });

  it('should return undefined for null/undefined when not required', () => {
    expect(validateString(null)).toBeUndefined();
    expect(validateString(undefined)).toBeUndefined();
  });

  it('should throw for null/undefined when required', () => {
    expect(() => validateString(null, { required: true }))
      .toThrow(ValidationError);
    expect(() => validateString(undefined, { required: true }))
      .toThrow(ValidationError);
  });

  it('should throw for non-string', () => {
    expect(() => validateString(123)).toThrow(ValidationError);
    expect(() => validateString({})).toThrow(ValidationError);
    expect(() => validateString([])).toThrow(ValidationError);
  });

  it('should enforce minLength', () => {
    expect(() => validateString('hi', { minLength: 5 }))
      .toThrow(ValidationError);
    expect(validateString('hello', { minLength: 5 })).toBe('hello');
  });

  it('should enforce maxLength', () => {
    expect(() => validateString('hello world', { maxLength: 5 }))
      .toThrow(ValidationError);
    expect(validateString('hello', { maxLength: 5 })).toBe('hello');
  });

  it('should enforce pattern', () => {
    expect(() => validateString('abc', { pattern: /^[0-9]+$/ }))
      .toThrow(ValidationError);
    expect(validateString('123', { pattern: /^[0-9]+$/ })).toBe('123');
  });

  it('should handle empty strings', () => {
    expect(validateString('', { required: false })).toBeUndefined();
    expect(() => validateString('', { required: true }))
      .toThrow(ValidationError);
    expect(validateString('', { allowEmpty: true })).toBe('');
  });
});

describe('validateNumber', () => {
  it('should return valid number', () => {
    expect(validateNumber(42)).toBe(42);
    expect(validateNumber(3.14)).toBe(3.14);
  });

  it('should parse string numbers', () => {
    expect(validateNumber('42')).toBe(42);
    expect(validateNumber('3.14')).toBe(3.14);
  });

  it('should throw for invalid numbers', () => {
    expect(() => validateNumber('not a number')).toThrow(ValidationError);
    expect(() => validateNumber(NaN)).toThrow(ValidationError);
    expect(() => validateNumber(Infinity)).toThrow(ValidationError);
  });

  it('should enforce min', () => {
    expect(() => validateNumber(5, { min: 10 })).toThrow(ValidationError);
    expect(validateNumber(15, { min: 10 })).toBe(15);
  });

  it('should enforce max', () => {
    expect(() => validateNumber(15, { max: 10 })).toThrow(ValidationError);
    expect(validateNumber(5, { max: 10 })).toBe(5);
  });

  it('should enforce integer', () => {
    expect(() => validateNumber(3.14, { integer: true })).toThrow(ValidationError);
    expect(validateNumber(42, { integer: true })).toBe(42);
  });

  it('should enforce positive', () => {
    expect(() => validateNumber(-5, { positive: true })).toThrow(ValidationError);
    expect(() => validateNumber(0, { positive: true })).toThrow(ValidationError);
    expect(validateNumber(5, { positive: true })).toBe(5);
  });
});

describe('validateEmail', () => {
  it('should return valid email', () => {
    expect(validateEmail('test@example.com')).toBe('test@example.com');
  });

  it('should lowercase email', () => {
    expect(validateEmail('TEST@EXAMPLE.COM')).toBe('test@example.com');
  });

  it('should throw for invalid email', () => {
    expect(() => validateEmail('not-an-email')).toThrow(ValidationError);
    expect(() => validateEmail('missing@domain')).toThrow(ValidationError);
    expect(() => validateEmail('@missing-local.com')).toThrow(ValidationError);
  });
});

describe('validateId', () => {
  it('should return valid ID', () => {
    expect(validateId('user-123')).toBe('user-123');
    expect(validateId('user_123')).toBe('user_123');
    expect(validateId('abc123')).toBe('abc123');
  });

  it('should throw for invalid ID', () => {
    expect(() => validateId('has spaces', { required: true })).toThrow(ValidationError);
    expect(() => validateId('has@special', { required: true })).toThrow(ValidationError);
  });

  it('should enforce maxLength', () => {
    const longId = 'x'.repeat(300);
    expect(() => validateId(longId, { required: true })).toThrow(ValidationError);
  });
});

describe('validateArray', () => {
  it('should return valid array', () => {
    expect(validateArray([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('should throw for non-array', () => {
    expect(() => validateArray('not array', { required: true })).toThrow(ValidationError);
    expect(() => validateArray({}, { required: true })).toThrow(ValidationError);
  });

  it('should enforce minLength', () => {
    expect(() => validateArray([1], { minLength: 2 })).toThrow(ValidationError);
    expect(validateArray([1, 2], { minLength: 2 })).toEqual([1, 2]);
  });

  it('should enforce maxLength', () => {
    expect(() => validateArray([1, 2, 3], { maxLength: 2 })).toThrow(ValidationError);
    expect(validateArray([1, 2], { maxLength: 2 })).toEqual([1, 2]);
  });

  it('should validate items', () => {
    const result = validateArray(['1', '2', '3'], {
      itemValidator: (item) => parseInt(item as string, 10),
    });
    expect(result).toEqual([1, 2, 3]);
  });
});

describe('validateObject', () => {
  it('should return valid object', () => {
    expect(validateObject({ a: 1 })).toEqual({ a: 1 });
  });

  it('should throw for non-object', () => {
    expect(() => validateObject('string', { required: true })).toThrow(ValidationError);
    expect(() => validateObject([], { required: true })).toThrow(ValidationError);
  });

  it('should validate schema', () => {
    const result = validateObject(
      { name: 'test', count: '42' },
      {
        schema: {
          name: (v) => validateString(v, { required: true }),
          count: (v) => validateNumber(v, { required: true }),
        },
      }
    );

    expect(result).toEqual({ name: 'test', count: 42 });
  });
});

describe('validateEnum', () => {
  it('should return valid enum value', () => {
    const result = validateEnum('active', ['active', 'inactive']);
    expect(result).toBe('active');
  });

  it('should throw for invalid value', () => {
    expect(() => validateEnum('unknown', ['active', 'inactive'], { required: true }))
      .toThrow(ValidationError);
  });
});

describe('validateDate', () => {
  it('should return valid date', () => {
    const date = new Date('2024-01-01');
    expect(validateDate(date)).toEqual(date);
  });

  it('should parse date string', () => {
    const result = validateDate('2024-01-01');
    expect(result).toBeInstanceOf(Date);
  });

  it('should parse timestamp', () => {
    const timestamp = Date.now();
    const result = validateDate(timestamp);
    expect(result).toBeInstanceOf(Date);
  });

  it('should throw for invalid date', () => {
    expect(() => validateDate('not a date', { required: true })).toThrow(ValidationError);
  });

  it('should enforce future', () => {
    const pastDate = new Date(Date.now() - 86400000);
    expect(() => validateDate(pastDate, { future: true })).toThrow(ValidationError);
  });

  it('should enforce past', () => {
    const futureDate = new Date(Date.now() + 86400000);
    expect(() => validateDate(futureDate, { past: true })).toThrow(ValidationError);
  });
});

describe('sanitizeString', () => {
  it('should trim whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('should normalize whitespace', () => {
    expect(sanitizeString('hello   world')).toBe('hello world');
  });

  it('should remove control characters', () => {
    expect(sanitizeString('hello\x00world')).toBe('helloworld');
  });
});

describe('sanitizeHtml', () => {
  it('should escape HTML entities', () => {
    expect(sanitizeHtml('<script>alert("xss")</script>'))
      .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('should escape ampersands', () => {
    expect(sanitizeHtml('a & b')).toBe('a &amp; b');
  });
});

describe('ValidationError', () => {
  it('should have correct name', () => {
    const error = new ValidationError('test');
    expect(error.name).toBe('ValidationError');
  });

  it('should be instanceof Error', () => {
    const error = new ValidationError('test');
    expect(error).toBeInstanceOf(Error);
  });
});
