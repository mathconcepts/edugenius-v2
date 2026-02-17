/**
 * Retry and Error Recovery Utilities
 * Provides robust retry logic with exponential backoff
 */

// ============================================================================
// Types
// ============================================================================

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  /** Initial delay in milliseconds */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds */
  maxDelayMs?: number;
  /** Backoff multiplier (e.g., 2 for exponential) */
  backoffMultiplier?: number;
  /** Add jitter to prevent thundering herd */
  jitter?: boolean;
  /** Function to determine if error is retryable */
  isRetryable?: (error: Error) => boolean;
  /** Callback on each retry attempt */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
  /** Timeout for each attempt in milliseconds */
  timeoutMs?: number;
}

export interface RetryResult<T> {
  success: boolean;
  value?: T;
  error?: Error;
  attempts: number;
  totalTimeMs: number;
}

// ============================================================================
// Default Retry Options
// ============================================================================

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  isRetryable: () => true,
  timeoutMs: 30000,
};

// ============================================================================
// Retry Function
// ============================================================================

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  let lastError: Error | undefined;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      // Execute with timeout
      const result = await withTimeout(fn(), opts.timeoutMs);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (attempt === opts.maxAttempts || !opts.isRetryable(lastError)) {
        throw lastError;
      }

      // Calculate delay with jitter
      let waitTime = Math.min(delay, opts.maxDelayMs);
      if (opts.jitter) {
        waitTime = waitTime * (0.5 + Math.random() * 0.5);
      }

      // Notify retry callback
      opts.onRetry?.(lastError, attempt, waitTime);

      // Wait before retrying
      await sleep(waitTime);

      // Increase delay for next attempt
      delay = delay * opts.backoffMultiplier;
    }
  }

  throw lastError || new Error('Retry failed');
}

// ============================================================================
// Retry with Result (Non-throwing)
// ============================================================================

export async function retryWithResult<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let attempts = 0;

  try {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: Error | undefined;
    let delay = opts.initialDelayMs;

    for (attempts = 1; attempts <= opts.maxAttempts; attempts++) {
      try {
        const value = await withTimeout(fn(), opts.timeoutMs);
        return {
          success: true,
          value,
          attempts,
          totalTimeMs: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempts === opts.maxAttempts || !opts.isRetryable(lastError)) {
          return {
            success: false,
            error: lastError,
            attempts,
            totalTimeMs: Date.now() - startTime,
          };
        }

        let waitTime = Math.min(delay, opts.maxDelayMs);
        if (opts.jitter) {
          waitTime = waitTime * (0.5 + Math.random() * 0.5);
        }

        opts.onRetry?.(lastError, attempts, waitTime);
        await sleep(waitTime);
        delay = delay * opts.backoffMultiplier;
      }
    }

    return {
      success: false,
      error: lastError,
      attempts,
      totalTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      attempts,
      totalTimeMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Timeout Wrapper
// ============================================================================

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  if (timeoutMs <= 0) {
    return promise;
  }

  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

// ============================================================================
// Circuit Breaker
// ============================================================================

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit */
  failureThreshold?: number;
  /** Time in milliseconds before attempting to close circuit */
  resetTimeMs?: number;
  /** Time window for counting failures */
  failureWindowMs?: number;
}

type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: number[] = [];
  private lastFailure: number = 0;
  private options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      resetTimeMs: options.resetTimeMs ?? 30000,
      failureWindowMs: options.failureWindowMs ?? 60000,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure >= this.options.resetTimeMs) {
        this.state = 'half-open';
      } else {
        throw new CircuitOpenError('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();

      // Reset on success
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = [];
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    const now = Date.now();
    this.lastFailure = now;

    // Add failure timestamp
    this.failures.push(now);

    // Remove old failures outside window
    const windowStart = now - this.options.failureWindowMs;
    this.failures = this.failures.filter(t => t >= windowStart);

    // Check if threshold exceeded
    if (this.failures.length >= this.options.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = 'closed';
    this.failures = [];
    this.lastFailure = 0;
  }
}

// ============================================================================
// Fallback
// ============================================================================

export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T> | T,
  options: { onFallback?: (error: Error) => void } = {}
): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    options.onFallback?.(error instanceof Error ? error : new Error(String(error)));
    const fallbackResult = fallback();
    return fallbackResult instanceof Promise ? await fallbackResult : fallbackResult;
  }
}

export async function withFallbackChain<T>(
  fns: Array<() => Promise<T>>,
  options: { onFallback?: (error: Error, index: number) => void } = {}
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < fns.length; i++) {
    try {
      return await fns[i]();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      options.onFallback?.(lastError, i);
    }
  }

  throw lastError || new Error('All fallbacks failed');
}

// ============================================================================
// Error Classes
// ============================================================================

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Retryable Error Detection
// ============================================================================

export function isNetworkError(error: Error): boolean {
  const networkErrorMessages = [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ENETUNREACH',
    'EAI_AGAIN',
    'socket hang up',
    'network error',
    'fetch failed',
  ];

  return networkErrorMessages.some(msg =>
    error.message.toLowerCase().includes(msg.toLowerCase())
  );
}

export function isRateLimitError(error: Error): boolean {
  const rateLimitPatterns = [
    /rate limit/i,
    /too many requests/i,
    /429/,
    /quota exceeded/i,
    /throttl/i,
  ];

  return rateLimitPatterns.some(pattern => pattern.test(error.message));
}

export function isTransientError(error: Error): boolean {
  return (
    isNetworkError(error) ||
    isRateLimitError(error) ||
    error.message.includes('503') ||
    error.message.includes('502') ||
    error.message.includes('504')
  );
}
