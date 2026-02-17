/**
 * Unit Tests for Retry Utilities
 */

import { describe, it, expect, vi } from 'vitest';
import {
  retry,
  retryWithResult,
  withTimeout,
  withFallback,
  withFallbackChain,
  CircuitBreaker,
  TimeoutError,
  CircuitOpenError,
  isNetworkError,
  isRateLimitError,
  isTransientError,
} from '../../../utils/retry';

describe('retry', () => {
  it('should succeed on first try', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await retry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const result = await retry(fn, { maxAttempts: 3, initialDelayMs: 10 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fail'));

    await expect(
      retry(fn, { maxAttempts: 3, initialDelayMs: 10 })
    ).rejects.toThrow('always fail');

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should respect isRetryable', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('retryable'))
      .mockRejectedValueOnce(new Error('not retryable'));

    await expect(
      retry(fn, {
        maxAttempts: 3,
        initialDelayMs: 10,
        isRetryable: (error) => error.message === 'retryable',
      })
    ).rejects.toThrow('not retryable');

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should call onRetry callback', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    await retry(fn, { maxAttempts: 2, initialDelayMs: 10, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      expect.any(Error),
      1,
      expect.any(Number)
    );
  });

  it('should increase delay with backoff', async () => {
    const delays: number[] = [];
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    await retry(fn, {
      maxAttempts: 3,
      initialDelayMs: 100,
      backoffMultiplier: 2,
      jitter: false,
      onRetry: (_, __, delay) => delays.push(delay),
    });

    expect(delays[0]).toBe(100);
    expect(delays[1]).toBe(200);
  });
});

describe('retryWithResult', () => {
  it('should return success result', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await retryWithResult(fn);

    expect(result.success).toBe(true);
    expect(result.value).toBe('success');
    expect(result.attempts).toBe(1);
  });

  it('should return failure result without throwing', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    const result = await retryWithResult(fn, { maxAttempts: 2, initialDelayMs: 10 });

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('fail');
    expect(result.attempts).toBe(2);
  });

  it('should include totalTimeMs', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await retryWithResult(fn);

    expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
  });
});

describe('withTimeout', () => {
  it('should return result if fast enough', async () => {
    const fn = async () => {
      await new Promise(r => setTimeout(r, 10));
      return 'success';
    };

    const result = await withTimeout(fn(), 1000);
    expect(result).toBe('success');
  });

  it('should throw TimeoutError if too slow', async () => {
    const fn = async () => {
      await new Promise(r => setTimeout(r, 100));
      return 'success';
    };

    await expect(withTimeout(fn(), 10)).rejects.toThrow(TimeoutError);
  });

  it('should skip timeout if timeoutMs is 0', async () => {
    const fn = async () => 'success';

    const result = await withTimeout(fn(), 0);
    expect(result).toBe('success');
  });
});

describe('withFallback', () => {
  it('should return primary result on success', async () => {
    const primary = vi.fn().mockResolvedValue('primary');
    const fallback = vi.fn().mockResolvedValue('fallback');

    const result = await withFallback(primary, fallback);

    expect(result).toBe('primary');
    expect(fallback).not.toHaveBeenCalled();
  });

  it('should return fallback on primary failure', async () => {
    const primary = vi.fn().mockRejectedValue(new Error('fail'));
    const fallback = vi.fn().mockResolvedValue('fallback');

    const result = await withFallback(primary, fallback);

    expect(result).toBe('fallback');
  });

  it('should call onFallback callback', async () => {
    const onFallback = vi.fn();
    const primary = vi.fn().mockRejectedValue(new Error('fail'));
    const fallback = vi.fn().mockResolvedValue('fallback');

    await withFallback(primary, fallback, { onFallback });

    expect(onFallback).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should handle sync fallback', async () => {
    const primary = vi.fn().mockRejectedValue(new Error('fail'));
    const fallback = () => 'sync fallback';

    const result = await withFallback(primary, fallback);

    expect(result).toBe('sync fallback');
  });
});

describe('withFallbackChain', () => {
  it('should try each fallback in order', async () => {
    const fns = [
      vi.fn().mockRejectedValue(new Error('fail 1')),
      vi.fn().mockRejectedValue(new Error('fail 2')),
      vi.fn().mockResolvedValue('success'),
    ];

    const result = await withFallbackChain(fns);

    expect(result).toBe('success');
    expect(fns[0]).toHaveBeenCalled();
    expect(fns[1]).toHaveBeenCalled();
    expect(fns[2]).toHaveBeenCalled();
  });

  it('should throw last error if all fail', async () => {
    const fns = [
      vi.fn().mockRejectedValue(new Error('fail 1')),
      vi.fn().mockRejectedValue(new Error('fail 2')),
    ];

    await expect(withFallbackChain(fns)).rejects.toThrow('fail 2');
  });

  it('should call onFallback for each failure', async () => {
    const onFallback = vi.fn();
    const fns = [
      vi.fn().mockRejectedValue(new Error('fail')),
      vi.fn().mockResolvedValue('success'),
    ];

    await withFallbackChain(fns, { onFallback });

    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onFallback).toHaveBeenCalledWith(expect.any(Error), 0);
  });
});

describe('CircuitBreaker', () => {
  it('should start in closed state', () => {
    const breaker = new CircuitBreaker();
    expect(breaker.getState()).toBe('closed');
  });

  it('should execute function when closed', async () => {
    const breaker = new CircuitBreaker();
    const fn = vi.fn().mockResolvedValue('success');

    const result = await breaker.execute(fn);

    expect(result).toBe('success');
    expect(breaker.getState()).toBe('closed');
  });

  it('should open after threshold failures', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      failureWindowMs: 10000,
    });

    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(breaker.execute(fn)).rejects.toThrow();
    await expect(breaker.execute(fn)).rejects.toThrow();

    expect(breaker.getState()).toBe('open');
  });

  it('should throw CircuitOpenError when open', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeMs: 10000,
    });

    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    await expect(breaker.execute(fn)).rejects.toThrow();

    await expect(breaker.execute(() => Promise.resolve('test')))
      .rejects.toThrow(CircuitOpenError);
  });

  it('should transition to half-open after reset time', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeMs: 50,
    });

    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    await expect(breaker.execute(fn)).rejects.toThrow();
    expect(breaker.getState()).toBe('open');

    await new Promise(r => setTimeout(r, 60));

    const result = await breaker.execute(fn);
    expect(result).toBe('success');
    expect(breaker.getState()).toBe('closed');
  });

  it('should reset manually', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1 });

    // Force open
    breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});

    breaker.reset();

    expect(breaker.getState()).toBe('closed');
  });
});

describe('Error Detection', () => {
  describe('isNetworkError', () => {
    it('should detect network errors', () => {
      expect(isNetworkError(new Error('ECONNREFUSED'))).toBe(true);
      expect(isNetworkError(new Error('ETIMEDOUT'))).toBe(true);
      expect(isNetworkError(new Error('socket hang up'))).toBe(true);
      expect(isNetworkError(new Error('network error'))).toBe(true);
    });

    it('should not match non-network errors', () => {
      expect(isNetworkError(new Error('validation failed'))).toBe(false);
    });
  });

  describe('isRateLimitError', () => {
    it('should detect rate limit errors', () => {
      expect(isRateLimitError(new Error('rate limit exceeded'))).toBe(true);
      expect(isRateLimitError(new Error('429 Too Many Requests'))).toBe(true);
      expect(isRateLimitError(new Error('quota exceeded'))).toBe(true);
    });

    it('should not match non-rate-limit errors', () => {
      expect(isRateLimitError(new Error('validation failed'))).toBe(false);
    });
  });

  describe('isTransientError', () => {
    it('should detect transient errors', () => {
      expect(isTransientError(new Error('ECONNREFUSED'))).toBe(true);
      expect(isTransientError(new Error('503 Service Unavailable'))).toBe(true);
      expect(isTransientError(new Error('rate limit'))).toBe(true);
    });

    it('should not match permanent errors', () => {
      expect(isTransientError(new Error('validation failed'))).toBe(false);
    });
  });
});
