// errorHandler.js — Centralized error handling and logging
// ---------------------------------------------------------

import { writeDebugLogLine, writeUserLog } from './logger.js';

// ---------------------------
// Error Types and Codes
// ---------------------------
export const ERROR_TYPES = {
  VALIDATION: 'VALIDATION_ERROR',
  AUTHENTICATION: 'AUTHENTICATION_ERROR',
  AUTHORIZATION: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND_ERROR',
  INTERNAL: 'INTERNAL_SERVER_ERROR',
  EXTERNAL_API: 'EXTERNAL_API_ERROR',
  FILE_SYSTEM: 'FILE_SYSTEM_ERROR',
  CHROME_PROCESS: 'CHROME_PROCESS_ERROR',
  DATABASE: 'DATABASE_ERROR',
  NETWORK: 'NETWORK_ERROR'
};

export const ERROR_CODES = {
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_EMAIL_FORMAT: 'INVALID_EMAIL_FORMAT',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCESS_DENIED: 'ACCESS_DENIED',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  PROCESS_FAILED: 'PROCESS_FAILED',
  TIMEOUT: 'TIMEOUT',
  CONNECTION_FAILED: 'CONNECTION_FAILED'
};

// ---------------------------
// Custom Error Classes
// ---------------------------
export class AppError extends Error {
  constructor(message, type = ERROR_TYPES.INTERNAL, code = null, statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, ERROR_TYPES.VALIDATION, ERROR_CODES.INVALID_INPUT, 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, ERROR_TYPES.AUTHENTICATION, ERROR_CODES.INVALID_CREDENTIALS, 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, ERROR_TYPES.AUTHORIZATION, ERROR_CODES.ACCESS_DENIED, 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, ERROR_TYPES.NOT_FOUND, ERROR_CODES.USER_NOT_FOUND, 404);
    this.name = 'NotFoundError';
  }
}

export class ChromeProcessError extends AppError {
  constructor(message, details = null) {
    super(message, ERROR_TYPES.CHROME_PROCESS, ERROR_CODES.PROCESS_FAILED, 500, details);
    this.name = 'ChromeProcessError';
  }
}

export class FileSystemError extends AppError {
  constructor(message, details = null) {
    super(message, ERROR_TYPES.FILE_SYSTEM, ERROR_CODES.FILE_NOT_FOUND, 500, details);
    this.name = 'FileSystemError';
  }
}

// ---------------------------
// Error Handler Functions
// ---------------------------
export function handleError(error, context = {}) {
  const errorInfo = {
    message: error.message,
    type: error.type || ERROR_TYPES.INTERNAL,
    code: error.code,
    statusCode: error.statusCode || 500,
    details: error.details,
    timestamp: error.timestamp || new Date().toISOString(),
    stack: error.stack,
    context
  };

  // Log error based on severity
  if (error.statusCode >= 500) {
    writeDebugLogLine(`[ERROR] ${JSON.stringify(errorInfo)}`);
  } else {
    writeDebugLogLine(`[WARN] ${JSON.stringify(errorInfo)}`);
  }

  return errorInfo;
}

export function handleUserError(error, userId = null) {
  const errorInfo = handleError(error, { userId });
  
  if (userId) {
    writeUserLog(userId, `[ERROR] ${error.message}`);
  }
  
  return errorInfo;
}

// ---------------------------
// Express Error Middleware
// ---------------------------
export function errorMiddleware(error, req, res, next) {
  const errorInfo = handleError(error, {
    url: req.url,
    method: req.method,
    ip: req.clientIp,
    userAgent: req.userAgent
  });

  // Don't expose internal errors to client
  const clientMessage = error.statusCode < 500 ? error.message : 'Internal server error';
  
  res.status(error.statusCode || 500).json({
    error: {
      message: clientMessage,
      type: error.type || ERROR_TYPES.INTERNAL,
      code: error.code,
      timestamp: errorInfo.timestamp
    }
  });
}

// ---------------------------
// Async Error Wrapper
// ---------------------------
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ---------------------------
// Validation Helpers
// ---------------------------
export function validateRequired(value, fieldName) {
  if (!value || (typeof value === 'string' && value.trim().length === 0)) {
    throw new ValidationError(`${fieldName} is required`);
  }
  return value;
}

export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format', { field: 'email', value: email });
  }
  return email;
}

export function validateUserId(userId) {
  const id = parseInt(userId);
  if (isNaN(id) || id <= 0) {
    throw new ValidationError('Invalid user ID', { field: 'userId', value: userId });
  }
  return id;
}

// ---------------------------
// Chrome Process Error Helpers
// ---------------------------
export function handleChromeError(error, userId = null) {
  if (error.message.includes('DevTools not listening')) {
    throw new ChromeProcessError('Chrome debugger port not available', { userId });
  }
  
  if (error.message.includes('Process failed')) {
    throw new ChromeProcessError('Chrome process failed to start', { userId });
  }
  
  throw new ChromeProcessError('Chrome process error', { userId, originalError: error.message });
}

// ---------------------------
// File System Error Helpers
// ---------------------------
export function handleFileSystemError(error, filePath = null) {
  if (error.code === 'ENOENT') {
    throw new FileSystemError('File or directory not found', { filePath });
  }
  
  if (error.code === 'EACCES') {
    throw new FileSystemError('Permission denied', { filePath });
  }
  
  throw new FileSystemError('File system error', { filePath, originalError: error.message });
}
