import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  AppError,
  handleDatabaseError,
  handleValidationError,
  handleAuthError,
  errorHandler,
  asyncHandler,
  DatabaseErrorType,
  ValidationErrorType,
  AuthErrorType,
} from './errorHandler.js';
import { ZodError, z } from 'zod';

describe('Error Handler Middleware', () => {
  describe('AppError', () => {
    it('should create an AppError with correct properties', () => {
      const error = new AppError(400, 'Test error', 'TEST_CODE', { detail: 'test' });

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ detail: 'test' });
      expect(error.name).toBe('AppError');
    });
  });

  describe('handleDatabaseError', () => {
    it('should handle constraint violations', () => {
      const error = new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed');
      const appError = handleDatabaseError(error);

      expect(appError.statusCode).toBe(409);
      expect(appError.code).toBe(DatabaseErrorType.CONSTRAINT_VIOLATION);
      expect(appError.message).toContain('constraint violation');
    });

    it('should handle lock errors', () => {
      const error = new Error('database is locked');
      const appError = handleDatabaseError(error);

      expect(appError.statusCode).toBe(503);
      expect(appError.code).toBe(DatabaseErrorType.LOCK_ERROR);
      expect(appError.message).toContain('temporarily unavailable');
    });

    it('should handle foreign key violations', () => {
      const error = new Error('FOREIGN KEY constraint failed');
      const appError = handleDatabaseError(error);

      expect(appError.statusCode).toBe(400);
      expect(appError.code).toBe(DatabaseErrorType.CONSTRAINT_VIOLATION);
      expect(appError.message).toContain('Invalid reference');
    });

    it('should handle not found errors', () => {
      const error = new Error('not found');
      const appError = handleDatabaseError(error);

      expect(appError.statusCode).toBe(404);
      expect(appError.code).toBe(DatabaseErrorType.NOT_FOUND);
    });

    it('should handle connection errors', () => {
      const error = new Error('connection failed');
      const appError = handleDatabaseError(error);

      expect(appError.statusCode).toBe(503);
      expect(appError.code).toBe(DatabaseErrorType.CONNECTION_ERROR);
    });

    it('should handle generic database errors', () => {
      const error = new Error('unknown database error');
      const appError = handleDatabaseError(error);

      expect(appError.statusCode).toBe(500);
      expect(appError.message).toContain('Database operation failed');
    });
  });

  describe('handleValidationError', () => {
    it('should handle invalid type errors', () => {
      const schema = z.object({ age: z.number() });
      
      try {
        schema.parse({ age: 'not a number' });
      } catch (error) {
        if (error instanceof ZodError) {
          const appError = handleValidationError(error);
          
          expect(appError.statusCode).toBe(400);
          expect(appError.code).toBe(ValidationErrorType.INVALID_TYPE);
          expect(appError.message).toContain('Invalid type');
        }
      }
    });

    it('should handle too small errors', () => {
      const schema = z.object({ name: z.string().min(5) });
      
      try {
        schema.parse({ name: 'abc' });
      } catch (error) {
        if (error instanceof ZodError) {
          const appError = handleValidationError(error);
          
          expect(appError.statusCode).toBe(400);
          expect(appError.code).toBe(ValidationErrorType.OUT_OF_RANGE);
          expect(appError.message).toContain('too small');
        }
      }
    });

    it('should handle too big errors', () => {
      const schema = z.object({ name: z.string().max(5) });
      
      try {
        schema.parse({ name: 'abcdefgh' });
      } catch (error) {
        if (error instanceof ZodError) {
          const appError = handleValidationError(error);
          
          expect(appError.statusCode).toBe(400);
          expect(appError.code).toBe(ValidationErrorType.OUT_OF_RANGE);
          expect(appError.message).toContain('too large');
        }
      }
    });

    it('should handle invalid string format errors', () => {
      const schema = z.object({ email: z.string().email() });
      
      try {
        schema.parse({ email: 'not-an-email' });
      } catch (error) {
        if (error instanceof ZodError) {
          const appError = handleValidationError(error);
          
          expect(appError.statusCode).toBe(400);
          expect(appError.code).toBe(ValidationErrorType.INVALID_FORMAT);
        }
      }
    });
  });

  describe('handleAuthError', () => {
    it('should handle unauthorized errors', () => {
      const error = handleAuthError(AuthErrorType.UNAUTHORIZED);

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(AuthErrorType.UNAUTHORIZED);
      expect(error.message).toContain('Authentication required');
    });

    it('should handle forbidden errors', () => {
      const error = handleAuthError(AuthErrorType.FORBIDDEN);

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe(AuthErrorType.FORBIDDEN);
      expect(error.message).toContain('Access denied');
    });

    it('should handle invalid token errors', () => {
      const error = handleAuthError(AuthErrorType.INVALID_TOKEN);

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(AuthErrorType.INVALID_TOKEN);
      expect(error.message).toContain('Invalid authentication token');
    });

    it('should handle expired token errors', () => {
      const error = handleAuthError(AuthErrorType.EXPIRED_TOKEN);

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(AuthErrorType.EXPIRED_TOKEN);
      expect(error.message).toContain('expired');
    });

    it('should accept custom messages', () => {
      const error = handleAuthError(AuthErrorType.FORBIDDEN, 'Custom message');

      expect(error.message).toBe('Custom message');
    });
  });

  describe('asyncHandler', () => {
    it('should catch async errors and pass to next', async () => {
      const mockNext = vi.fn();
      const mockReq = {} as Request;
      const mockRes = {} as Response;

      const handler = asyncHandler(async (req, res, next) => {
        throw new Error('Test error');
      });

      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should not call next if no error', async () => {
      const mockNext = vi.fn();
      const mockReq = {} as Request;
      const mockRes = { json: vi.fn() } as any;

      const handler = asyncHandler(async (req, res, next) => {
        res.json({ success: true });
      });

      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('errorHandler', () => {
    it('should handle AppError correctly', () => {
      const mockReq = { path: '/test', method: 'GET', headers: {} } as Request;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;
      const mockNext = vi.fn();

      const error = new AppError(400, 'Test error', 'TEST_CODE');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'TEST_CODE',
            message: 'Test error',
          }),
          timestamp: expect.any(String),
        })
      );
    });

    it('should handle ZodError correctly', () => {
      const mockReq = { path: '/test', method: 'GET', headers: {} } as Request;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;
      const mockNext = vi.fn();

      const schema = z.object({ name: z.string() });
      let zodError: ZodError | null = null;

      try {
        schema.parse({ name: 123 });
      } catch (error) {
        if (error instanceof ZodError) {
          zodError = error;
        }
      }

      if (zodError) {
        errorHandler(zodError, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              message: expect.stringContaining('Invalid type'),
            }),
          })
        );
      }
    });

    it('should handle JWT errors correctly', () => {
      const mockReq = { path: '/test', method: 'GET', headers: {} } as Request;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;
      const mockNext = vi.fn();

      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: AuthErrorType.INVALID_TOKEN,
          }),
        })
      );
    });

    it('should handle generic errors', () => {
      const mockReq = { path: '/test', method: 'GET', headers: {} } as Request;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;
      const mockNext = vi.fn();

      const error = new Error('Unknown error');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INTERNAL_ERROR',
            message: expect.stringContaining('unexpected error'),
          }),
        })
      );
    });

    it('should include request ID in response', () => {
      const mockReq = { 
        path: '/test', 
        method: 'GET', 
        headers: { 'x-request-id': 'test-request-123' } 
      } as any;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;
      const mockNext = vi.fn();

      const error = new AppError(400, 'Test error');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'test-request-123',
        })
      );
    });
  });
});
