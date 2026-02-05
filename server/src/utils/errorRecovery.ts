/**
 * Error Recovery Mechanisms
 * 
 * Provides utilities for:
 * - Automatic retry logic for transient failures
 * - Graceful degradation for non-critical operations
 * - Error logging and monitoring
 * 
 * Requirements: 9.2
 */

/**
 * Retry configuration options
 */
export interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
  retryableErrors?: string[];
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  delayMs: 100,
  backoffMultiplier: 2,
  maxDelayMs: 5000,
  retryableErrors: [
    'SQLITE_BUSY',
    'SQLITE_LOCKED',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'locked',
    'busy',
    'timeout',
    'connection',
  ],
};

/**
 * Error log entry
 */
export interface ErrorLogEntry {
  timestamp: Date;
  error: Error;
  context: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: any;
}

/**
 * Error logger singleton
 */
class ErrorLogger {
  private logs: ErrorLogEntry[] = [];
  private maxLogs = 1000;

  /**
   * Log an error
   */
  log(
    error: Error,
    context: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    metadata?: any
  ): void {
    const entry: ErrorLogEntry = {
      timestamp: new Date(),
      error,
      context,
      severity,
      metadata,
    };

    this.logs.push(entry);

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console log based on severity
    const logMethod = severity === 'critical' || severity === 'high' ? console.error : console.warn;
    logMethod(`[${severity.toUpperCase()}] ${context}:`, error.message, metadata || '');
  }

  /**
   * Get recent error logs
   */
  getRecentLogs(count: number = 100): ErrorLogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Get logs by severity
   */
  getLogsBySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): ErrorLogEntry[] {
    return this.logs.filter((log) => log.severity === severity);
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Get error statistics
   */
  getStatistics(): {
    total: number;
    bySeverity: Record<string, number>;
    byContext: Record<string, number>;
  } {
    const bySeverity: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    const byContext: Record<string, number> = {};

    for (const log of this.logs) {
      bySeverity[log.severity]++;
      byContext[log.context] = (byContext[log.context] || 0) + 1;
    }

    return {
      total: this.logs.length,
      bySeverity,
      byContext,
    };
  }
}

// Singleton instance
export const errorLogger = new ErrorLogger();

/**
 * Check if an error is retryable
 */
function isRetryableError(error: Error, retryableErrors: string[]): boolean {
  const errorMessage = error.message.toLowerCase();
  return retryableErrors.some((pattern) => errorMessage.includes(pattern.toLowerCase()));
}

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  multiplier: number,
  maxDelay: number
): number {
  const delay = baseDelay * Math.pow(multiplier, attempt - 1);
  return Math.min(delay, maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an operation with exponential backoff
 * 
 * @param operation - The operation to retry
 * @param options - Retry configuration options
 * @returns Result of the operation
 * @throws Error if all retry attempts fail
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      if (!isRetryableError(error, config.retryableErrors || [])) {
        // Not retryable, throw immediately
        throw error;
      }

      // Log retry attempt
      errorLogger.log(
        error,
        'Retry attempt',
        'low',
        { attempt, maxAttempts: config.maxAttempts }
      );

      // If this was the last attempt, throw
      if (attempt === config.maxAttempts) {
        throw error;
      }

      // Calculate delay and wait
      const delay = calculateDelay(
        attempt,
        config.delayMs,
        config.backoffMultiplier,
        config.maxDelayMs
      );

      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Retry failed');
}

/**
 * Execute operation with graceful degradation
 * Returns a default value if the operation fails
 * 
 * @param operation - The operation to execute
 * @param defaultValue - Default value to return on failure
 * @param context - Context for error logging
 * @returns Result of operation or default value
 */
export async function withGracefulDegradation<T>(
  operation: () => Promise<T>,
  defaultValue: T,
  context: string = 'Operation'
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    errorLogger.log(error, `Graceful degradation: ${context}`, 'medium');
    return defaultValue;
  }
}

/**
 * Execute operation with timeout
 * 
 * @param operation - The operation to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutMessage - Custom timeout error message
 * @returns Result of operation
 * @throws Error if operation times out
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Execute operation with circuit breaker pattern
 * Prevents cascading failures by stopping requests after threshold
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime: Date | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private failureThreshold: number = 5,
    private resetTimeoutMs: number = 60000
  ) {}

  /**
   * Execute operation with circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit should be reset
    if (
      this.state === 'open' &&
      this.lastFailureTime &&
      Date.now() - this.lastFailureTime.getTime() > this.resetTimeoutMs
    ) {
      this.state = 'half-open';
      this.failureCount = 0;
    }

    // If circuit is open, reject immediately
    if (this.state === 'open') {
      throw new Error('Circuit breaker is open. Service temporarily unavailable.');
    }

    try {
      const result = await operation();

      // Success - reset if in half-open state
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failureCount = 0;
      }

      return result;
    } catch (error: any) {
      this.failureCount++;
      this.lastFailureTime = new Date();

      // Open circuit if threshold reached
      if (this.failureCount >= this.failureThreshold) {
        this.state = 'open';
        errorLogger.log(
          error,
          'Circuit breaker opened',
          'high',
          { failureCount: this.failureCount }
        );
      }

      throw error;
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = null;
  }
}

/**
 * Batch operation with partial success handling
 * Continues processing even if some items fail
 * 
 * @param items - Items to process
 * @param operation - Operation to perform on each item
 * @param options - Batch options
 * @returns Results with successes and failures
 */
export async function batchWithPartialSuccess<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  options: {
    continueOnError?: boolean;
    logErrors?: boolean;
  } = {}
): Promise<{
  successes: Array<{ item: T; result: R }>;
  failures: Array<{ item: T; error: Error }>;
}> {
  const { continueOnError = true, logErrors = true } = options;
  const successes: Array<{ item: T; result: R }> = [];
  const failures: Array<{ item: T; error: Error }> = [];

  for (const item of items) {
    try {
      const result = await operation(item);
      successes.push({ item, result });
    } catch (error: any) {
      failures.push({ item, error });

      if (logErrors) {
        errorLogger.log(error, 'Batch operation failure', 'low', { item });
      }

      if (!continueOnError) {
        throw error;
      }
    }
  }

  return { successes, failures };
}

/**
 * Fallback chain - try multiple operations in sequence
 * Returns result of first successful operation
 * 
 * @param operations - Array of operations to try
 * @param context - Context for error logging
 * @returns Result of first successful operation
 * @throws Error if all operations fail
 */
export async function fallbackChain<T>(
  operations: Array<() => Promise<T>>,
  context: string = 'Fallback chain'
): Promise<T> {
  const errors: Error[] = [];

  for (let i = 0; i < operations.length; i++) {
    try {
      return await operations[i]();
    } catch (error: any) {
      errors.push(error);
      errorLogger.log(
        error,
        `${context} - attempt ${i + 1} failed`,
        'low'
      );
    }
  }

  // All operations failed
  const combinedError = new Error(
    `All fallback operations failed: ${errors.map((e) => e.message).join(', ')}`
  );
  errorLogger.log(combinedError, context, 'high');
  throw combinedError;
}
