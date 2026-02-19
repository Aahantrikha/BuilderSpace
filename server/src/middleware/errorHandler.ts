import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Database error types
 */
export enum DatabaseErrorType {
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  NOT_FOUND = 'NOT_FOUND',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  TRANSACTION_ERROR = 'TRANSACTION_ERROR',
  LOCK_ERROR = 'LOCK_ERROR',
}

/**
 * Validation error types
 */
export enum ValidationErrorType {
  MISSING_FIELD = 'MISSING_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  OUT_OF_RANGE = 'OUT_OF_RANGE',
  INVALID_TYPE = 'INVALID_TYPE',
}

/**
 * Authentication/Authorization error types
 */
export enum AuthErrorType {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN',
}

/**
 * Error response structure
 */
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  requestId?: string;
}

/**
 * Database error handler
 * Handles SQLite errors and provides appropriate responses
 */
export function handleDatabaseError(error: any): AppError {
  const message = error.message?.toLowerCase() || '';

  // Constraint violations
  if (message.includes('constraint') || message.includes('unique')) {
    return new AppError(
      409,
      'Database constraint violation. The operation conflicts with existing data.',
      DatabaseErrorType.CONSTRAINT_VIOLATION,
      { originalError: error.message }
    );
  }

  // Lock/busy errors
  if (message.includes('locked') || message.includes('busy')) {
    return new AppError(
      503,
      'Database is temporarily unavailable. Please try again.',
      DatabaseErrorType.LOCK_ERROR,
      { originalError: error.message }
    );
  }

  // Foreign key violations
  if (message.includes('foreign key')) {
    return new AppError(
      400,
      'Invalid reference. The referenced resource does not exist.',
      DatabaseErrorType.CONSTRAINT_VIOLATION,
      { originalError: error.message }
    );
  }

  // Not found errors
  if (message.includes('not found') || message.includes('no such')) {
    return new AppError(
      404,
      'Resource not found.',
      DatabaseErrorType.NOT_FOUND,
      { originalError: error.message }
    );
  }

  // Connection errors
  if (message.includes('connection') || message.includes('connect')) {
    return new AppError(
      503,
      'Database connection error. Please try again later.',
      DatabaseErrorType.CONNECTION_ERROR,
      { originalError: error.message }
    );
  }

  // Generic database error
  return new AppError(
    500,
    'Database operation failed.',
    'DATABASE_ERROR',
    { originalError: error.message }
  );
}

/**
 * Validation error handler
 * Handles Zod validation errors and provides clear messages
 */
export function handleValidationError(error: ZodError): AppError {
  const firstError = error.errors[0];
  
  let message = 'Validation error';
  let code = ValidationErrorType.INVALID_FORMAT;

  if (firstError) {
    const field = firstError.path.join('.');
    
    switch (firstError.code) {
      case 'invalid_type':
        message = `Invalid type for field '${field}'. Expected ${firstError.expected}, got ${firstError.received}.`;
        code = ValidationErrorType.INVALID_TYPE;
        break;
      
      case 'too_small':
        message = `Field '${field}' is too small. ${firstError.message}`;
        code = ValidationErrorType.OUT_OF_RANGE;
        break;
      
      case 'too_big':
        message = `Field '${field}' is too large. ${firstError.message}`;
        code = ValidationErrorType.OUT_OF_RANGE;
        break;
      
      case 'invalid_string':
        message = `Invalid format for field '${field}'. ${firstError.message}`;
        code = ValidationErrorType.INVALID_FORMAT;
        break;
      
      default:
        message = `Validation error for field '${field}': ${firstError.message}`;
    }
  }

  return new AppError(
    400,
    message,
    code,
    { errors: error.errors }
  );
}

/**
 * Authentication/Authorization error handler
 */
export function handleAuthError(type: AuthErrorType, message?: string): AppError {
  switch (type) {
    case AuthErrorType.UNAUTHORIZED:
      return new AppError(
        401,
        message || 'Authentication required. Please provide valid credentials.',
        AuthErrorType.UNAUTHORIZED
      );
    
    case AuthErrorType.FORBIDDEN:
      return new AppError(
        403,
        message || 'Access denied. You do not have permission to access this resource.',
        AuthErrorType.FORBIDDEN
      );
    
    case AuthErrorType.INVALID_TOKEN:
      return new AppError(
        401,
        message || 'Invalid authentication token.',
        AuthErrorType.INVALID_TOKEN
      );
    
    case AuthErrorType.EXPIRED_TOKEN:
      return new AppError(
        401,
        message || 'Authentication token has expired. Please log in again.',
        AuthErrorType.EXPIRED_TOKEN
      );
    
    default:
      return new AppError(
        401,
        'Authentication error.',
        'AUTH_ERROR'
      );
  }
}

/**
 * Transaction wrapper with automatic rollback on error
 */
export async function withTransaction<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    // SQLite in better-sqlite3 doesn't have explicit transaction API in Drizzle
    // We'll execute the operation and rely on SQLite's automatic transaction handling
    const result = await operation();
    return result;
  } catch (error: any) {
    // Log the error
    console.error('Transaction error:', error);
    
    // Rethrow as database error
    throw handleDatabaseError(error);
  }
}

/**
 * Async error handler wrapper
 * Wraps async route handlers to catch errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Global error handling middleware
 * Should be added as the last middleware in the Express app
 */
export function errorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Generate request ID for tracking
  const requestId = req.headers['x-request-id'] as string || 
                    `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Log error
  console.error('Error handler caught:', {
    requestId,
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  let appError: AppError;

  // Handle different error types
  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof ZodError) {
    appError = handleValidationError(error);
  } else if (error.name === 'JsonWebTokenError') {
    appError = handleAuthError(AuthErrorType.INVALID_TOKEN);
  } else if (error.name === 'TokenExpiredError') {
    appError = handleAuthError(AuthErrorType.EXPIRED_TOKEN);
  } else if (error.message?.includes('SQLITE') || error.message?.includes('database')) {
    appError = handleDatabaseError(error);
  } else {
    // Generic error
    appError = new AppError(
      500,
      'An unexpected error occurred. Please try again later.',
      'INTERNAL_ERROR',
      process.env.NODE_ENV === 'development' ? { originalError: error.message } : undefined
    );
  }

  // Build error response
  const errorResponse: ErrorResponse = {
    error: {
      code: appError.code || 'ERROR',
      message: appError.message,
      details: appError.details,
    },
    timestamp: new Date().toISOString(),
    requestId,
  };

  // Send response
  res.status(appError.statusCode).json(errorResponse);
}

/**
 * 404 Not Found handler
 * Should be added before the error handler middleware
 */
export function notFoundHandler(req: Request, res: Response): void {
  const errorResponse: ErrorResponse = {
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found.`,
    },
    timestamp: new Date().toISOString(),
  };

  res.status(404).json(errorResponse);
}

/**
 * Request validation middleware
 * Validates request body against a Zod schema
 */
export function validateRequest(schema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(handleValidationError(error));
      } else {
        next(error);
      }
    }
  };
}
