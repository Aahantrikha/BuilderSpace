import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  withRetry,
  withGracefulDegradation,
  withTimeout,
  CircuitBreaker,
  batchWithPartialSuccess,
  fallbackChain,
  errorLogger,
} from './errorRecovery.js';

describe('Error Recovery Mechanisms', () => {
  beforeEach(() => {
    errorLogger.clearLogs();
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await withRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('SQLITE_BUSY'))
        .mockResolvedValue('success');

      const result = await withRetry(operation, { delayMs: 10 });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Invalid input'));

      await expect(withRetry(operation)).rejects.toThrow('Invalid input');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should fail after max attempts', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('database locked'));

      await expect(
        withRetry(operation, { maxAttempts: 3, delayMs: 10 })
      ).rejects.toThrow('database locked');

      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('locked'))
        .mockRejectedValueOnce(new Error('locked'))
        .mockResolvedValue('success');

      const startTime = Date.now();
      await withRetry(operation, {
        maxAttempts: 3,
        delayMs: 50,
        backoffMultiplier: 2,
      });
      const duration = Date.now() - startTime;

      // Should have delays of ~50ms and ~100ms
      expect(duration).toBeGreaterThanOrEqual(100);
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('withGracefulDegradation', () => {
    it('should return operation result on success', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await withGracefulDegradation(operation, 'default');

      expect(result).toBe('success');
    });

    it('should return default value on failure', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Failed'));

      const result = await withGracefulDegradation(operation, 'default');

      expect(result).toBe('default');
    });

    it('should log errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Failed'));

      await withGracefulDegradation(operation, 'default', 'Test operation');

      const logs = errorLogger.getRecentLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[logs.length - 1].context).toContain('Test operation');
    });
  });

  describe('withTimeout', () => {
    it('should return result if operation completes in time', async () => {
      const operation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'success';
      };

      const result = await withTimeout(operation, 100);

      expect(result).toBe('success');
    });

    it('should throw timeout error if operation takes too long', async () => {
      const operation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 'success';
      };

      await expect(withTimeout(operation, 50)).rejects.toThrow('timed out');
    });

    it('should use custom timeout message', async () => {
      const operation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 'success';
      };

      await expect(
        withTimeout(operation, 50, 'Custom timeout')
      ).rejects.toThrow('Custom timeout');
    });
  });

  describe('CircuitBreaker', () => {
    it('should allow operations when circuit is closed', async () => {
      const breaker = new CircuitBreaker(3, 1000);
      const operation = vi.fn().mockResolvedValue('success');

      const result = await breaker.execute(operation);

      expect(result).toBe('success');
      expect(breaker.getState()).toBe('closed');
    });

    it('should open circuit after threshold failures', async () => {
      const breaker = new CircuitBreaker(3, 1000);
      const operation = vi.fn().mockRejectedValue(new Error('Failed'));

      // Fail 3 times to open circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(operation)).rejects.toThrow('Failed');
      }

      expect(breaker.getState()).toBe('open');

      // Next call should fail immediately without calling operation
      await expect(breaker.execute(operation)).rejects.toThrow('Circuit breaker is open');
      expect(operation).toHaveBeenCalledTimes(3); // Not called again
    });

    it('should transition to half-open after timeout', async () => {
      const breaker = new CircuitBreaker(2, 100);
      const operation = vi.fn().mockRejectedValue(new Error('Failed'));

      // Open circuit
      await expect(breaker.execute(operation)).rejects.toThrow();
      await expect(breaker.execute(operation)).rejects.toThrow();
      expect(breaker.getState()).toBe('open');

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be half-open now
      operation.mockResolvedValue('success');
      const result = await breaker.execute(operation);

      expect(result).toBe('success');
      expect(breaker.getState()).toBe('closed');
    });

    it('should reset circuit breaker', async () => {
      const breaker = new CircuitBreaker(2, 1000);
      const operation = vi.fn().mockRejectedValue(new Error('Failed'));

      // Open circuit
      await expect(breaker.execute(operation)).rejects.toThrow();
      await expect(breaker.execute(operation)).rejects.toThrow();
      expect(breaker.getState()).toBe('open');

      // Reset
      breaker.reset();
      expect(breaker.getState()).toBe('closed');

      // Should work now
      operation.mockResolvedValue('success');
      const result = await breaker.execute(operation);
      expect(result).toBe('success');
    });
  });

  describe('batchWithPartialSuccess', () => {
    it('should process all items successfully', async () => {
      const items = [1, 2, 3];
      const operation = vi.fn().mockImplementation((x: number) => Promise.resolve(x * 2));

      const result = await batchWithPartialSuccess(items, operation);

      expect(result.successes).toHaveLength(3);
      expect(result.failures).toHaveLength(0);
      expect(result.successes.map((s) => s.result)).toEqual([2, 4, 6]);
    });

    it('should continue on errors by default', async () => {
      const items = [1, 2, 3];
      const operation = vi.fn().mockImplementation((x: number) => {
        if (x === 2) throw new Error('Failed');
        return Promise.resolve(x * 2);
      });

      const result = await batchWithPartialSuccess(items, operation);

      expect(result.successes).toHaveLength(2);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].item).toBe(2);
    });

    it('should stop on first error if continueOnError is false', async () => {
      const items = [1, 2, 3];
      const operation = vi.fn().mockImplementation((x: number) => {
        if (x === 2) throw new Error('Failed');
        return Promise.resolve(x * 2);
      });

      await expect(
        batchWithPartialSuccess(items, operation, { continueOnError: false })
      ).rejects.toThrow('Failed');

      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('fallbackChain', () => {
    it('should return result of first successful operation', async () => {
      const op1 = vi.fn().mockResolvedValue('success1');
      const op2 = vi.fn().mockResolvedValue('success2');

      const result = await fallbackChain([op1, op2]);

      expect(result).toBe('success1');
      expect(op1).toHaveBeenCalledTimes(1);
      expect(op2).not.toHaveBeenCalled();
    });

    it('should try next operation if first fails', async () => {
      const op1 = vi.fn().mockRejectedValue(new Error('Failed'));
      const op2 = vi.fn().mockResolvedValue('success2');

      const result = await fallbackChain([op1, op2]);

      expect(result).toBe('success2');
      expect(op1).toHaveBeenCalledTimes(1);
      expect(op2).toHaveBeenCalledTimes(1);
    });

    it('should throw if all operations fail', async () => {
      const op1 = vi.fn().mockRejectedValue(new Error('Failed1'));
      const op2 = vi.fn().mockRejectedValue(new Error('Failed2'));

      await expect(fallbackChain([op1, op2])).rejects.toThrow('All fallback operations failed');
    });
  });

  describe('errorLogger', () => {
    it('should log errors', () => {
      const error = new Error('Test error');
      errorLogger.log(error, 'Test context', 'medium');

      const logs = errorLogger.getRecentLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].error.message).toBe('Test error');
      expect(logs[0].context).toBe('Test context');
      expect(logs[0].severity).toBe('medium');
    });

    it('should filter logs by severity', () => {
      errorLogger.log(new Error('Low'), 'Context1', 'low');
      errorLogger.log(new Error('High'), 'Context2', 'high');
      errorLogger.log(new Error('Critical'), 'Context3', 'critical');

      const highLogs = errorLogger.getLogsBySeverity('high');
      expect(highLogs).toHaveLength(1);
      expect(highLogs[0].error.message).toBe('High');
    });

    it('should provide statistics', () => {
      errorLogger.clearLogs();
      errorLogger.log(new Error('Error1'), 'Context1', 'low');
      errorLogger.log(new Error('Error2'), 'Context1', 'high');
      errorLogger.log(new Error('Error3'), 'Context2', 'medium');

      const stats = errorLogger.getStatistics();
      expect(stats.total).toBe(3);
      expect(stats.bySeverity.low).toBe(1);
      expect(stats.bySeverity.high).toBe(1);
      expect(stats.byContext.Context1).toBe(2);
      expect(stats.byContext.Context2).toBe(1);
    });

    it('should limit log size', () => {
      errorLogger.clearLogs();

      // Log more than max (1000)
      for (let i = 0; i < 1100; i++) {
        errorLogger.log(new Error(`Error ${i}`), 'Test', 'low');
      }

      const logs = errorLogger.getRecentLogs(2000);
      expect(logs.length).toBeLessThanOrEqual(1000);
    });
  });
});
