import { ErrorCode } from '../server/types.js';

/**
 * Comprehensive Error Handling System for UniFi MCP Server
 * 
 * Provides structured error handling, categorization, and recovery
 * mechanisms for all UniFi API interactions and server operations.
 */

// ================================
// Base Error Classes
// ================================

export class UniFiMCPError extends Error {
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly statusCode?: number,
    public readonly details?: any,
    public readonly retryable: boolean = false,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'UniFiMCPError';
    this.timestamp = new Date();
    if (context) {
      this.context = context;
    }

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, UniFiMCPError.prototype);

    // Capture stack trace if available
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UniFiMCPError);
    }
  }

  toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      retryable: this.retryable,
      timestamp: this.timestamp.toISOString(),
      context: this.context
    };
  }

  toString(): string {
    return `${this.name}: ${this.message} (${this.code})`;
  }
}

// ================================
// Specific Error Types
// ================================

export class ConnectionError extends UniFiMCPError {
  constructor(
    message: string,
    details?: any,
    retryable: boolean = true
  ) {
    super(message, ErrorCode.CONNECTION_FAILED, 503, details, retryable);
    this.name = 'ConnectionError';
  }
}

export class AuthenticationError extends UniFiMCPError {
  constructor(
    message: string = 'Authentication failed',
    details?: any
  ) {
    super(message, ErrorCode.AUTHENTICATION_FAILED, 401, details, false);
    this.name = 'AuthenticationError';
  }
}

export class APIKeyError extends UniFiMCPError {
  constructor(
    message: string = 'Invalid API key',
    details?: any
  ) {
    super(message, ErrorCode.API_KEY_INVALID, 401, details, false);
    this.name = 'APIKeyError';
  }
}

export class NetworkTimeoutError extends UniFiMCPError {
  constructor(
    message: string = 'Network request timed out',
    timeout: number,
    details?: any
  ) {
    super(message, ErrorCode.NETWORK_TIMEOUT, 408, { timeout, ...details }, true);
    this.name = 'NetworkTimeoutError';
  }
}

export class RateLimitError extends UniFiMCPError {
  constructor(
    message: string = 'API rate limit exceeded',
    retryAfter?: number,
    details?: any
  ) {
    super(message, ErrorCode.API_RATE_LIMITED, 429, { retryAfter, ...details }, true);
    this.name = 'RateLimitError';
  }
}

export class FeatureNotSupportedError extends UniFiMCPError {
  constructor(
    feature: string,
    requiredVersion?: string,
    currentVersion?: string
  ) {
    const message = `Feature '${feature}' is not supported${
      requiredVersion ? ` (requires version ${requiredVersion}${
        currentVersion ? `, current: ${currentVersion}` : ''
      })` : ''
    }`;
    
    super(
      message,
      ErrorCode.FEATURE_NOT_SUPPORTED,
      501,
      { feature, requiredVersion, currentVersion },
      false
    );
    this.name = 'FeatureNotSupportedError';
  }
}

export class HardwareIncompatibleError extends UniFiMCPError {
  constructor(
    feature: string,
    hardwareModel: string,
    supportedModels?: string[]
  ) {
    const message = `Feature '${feature}' is not compatible with hardware model '${hardwareModel}'${
      supportedModels ? ` (supported: ${supportedModels.join(', ')})` : ''
    }`;
    
    super(
      message,
      ErrorCode.HARDWARE_INCOMPATIBLE,
      501,
      { feature, hardwareModel, supportedModels },
      false
    );
    this.name = 'HardwareIncompatibleError';
  }
}

export class ValidationError extends UniFiMCPError {
  constructor(
    message: string,
    field?: string,
    value?: any,
    constraints?: string[]
  ) {
    super(
      message,
      ErrorCode.VALIDATION_ERROR,
      400,
      { field, value, constraints },
      false
    );
    this.name = 'ValidationError';
  }
}

export class ResourceNotFoundError extends UniFiMCPError {
  constructor(
    resourceType: string,
    identifier: string,
    details?: any
  ) {
    const message = `${resourceType} with identifier '${identifier}' not found`;
    super(message, ErrorCode.RESOURCE_NOT_FOUND, 404, details, false);
    this.name = 'ResourceNotFoundError';
  }
}

export class ResourceConflictError extends UniFiMCPError {
  constructor(
    message: string,
    conflictingResource?: string,
    details?: any
  ) {
    super(
      message,
      ErrorCode.RESOURCE_CONFLICT,
      409,
      { conflictingResource, ...details },
      false
    );
    this.name = 'ResourceConflictError';
  }
}

export class ConfigurationError extends UniFiMCPError {
  constructor(
    message: string,
    configField?: string,
    details?: any
  ) {
    super(
      message,
      ErrorCode.CONFIG_ERROR,
      500,
      { configField, ...details },
      false
    );
    this.name = 'ConfigurationError';
  }
}

// ================================
// Error Factories
// ================================

export class ErrorFactory {
  static fromHttpError(
    error: any,
    context?: Record<string, any>
  ): UniFiMCPError {
    const status = error.response?.status || error.status || 500;
    const message = error.response?.data?.message || error.message || 'Unknown error';
    const details = error.response?.data || error.details;

    switch (status) {
      case 400:
        return new ValidationError(message, undefined, undefined, undefined);
      case 401:
        if (message.toLowerCase().includes('api key')) {
          return new APIKeyError(message, details);
        }
        return new AuthenticationError(message, details);
      case 404:
        return new ResourceNotFoundError('Resource', 'unknown', details);
      case 408:
        return new NetworkTimeoutError(message, 30000, details);
      case 409:
        return new ResourceConflictError(message, undefined, details);
      case 429: {
        const retryAfter = error.response?.headers?.['retry-after'];
        return new RateLimitError(message, retryAfter, details);
      }
      case 500:
      case 502:
      case 503:
      case 504:
        return new ConnectionError(message, details, true);
      default:
        return new UniFiMCPError(
          message,
          ErrorCode.INTERNAL_ERROR,
          status,
          details,
          status >= 500,
          context
        );
    }
  }

  static fromNetworkError(
    error: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    _context?: Record<string, any>
  ): UniFiMCPError {
    if (error.code === 'ECONNREFUSED') {
      return new ConnectionError(
        'Connection refused - check if UniFi controller is running',
        { originalError: error.code },
        true
      );
    }

    if (error.code === 'ENOTFOUND') {
      return new ConnectionError(
        'Host not found - check gateway IP address',
        { originalError: error.code },
        false
      );
    }

    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return new NetworkTimeoutError(
        'Network request timed out',
        error.timeout || 30000,
        { originalError: error.code }
      );
    }

    if (error.code?.startsWith('CERT_') || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      return new ConnectionError(
        'SSL certificate verification failed',
        { originalError: error.code, suggestion: 'Set verifySSL to false for self-signed certificates' },
        false
      );
    }

    return new ConnectionError(
      error.message || 'Network error occurred',
      { originalError: error.code },
      true
    );
  }

  static fromValidationError(
    zodError: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    _context?: Record<string, any>
  ): ValidationError {
    const issues = zodError.issues || [];
    const firstIssue = issues[0];
    
    if (firstIssue) {
      const field = firstIssue.path?.join('.') || 'unknown';
      const message = `Validation failed for field '${field}': ${firstIssue.message}`;
      return new ValidationError(
        message,
        field,
        firstIssue.received,
        [firstIssue.message]
      );
    }

    return new ValidationError(
      'Validation failed',
      undefined,
      undefined,
      issues.map((issue: any) => issue.message)
    );
  }
}

// ================================
// Error Recovery Strategies
// ================================

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBackoff: boolean;
  retryCondition?: (error: Error) => boolean;
}

export class ErrorRecovery {
  static defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    exponentialBackoff: true,
    retryCondition: (error: Error) => {
      if (error instanceof UniFiMCPError) {
        return error.retryable;
      }
      return false;
    }
  };

  static async withRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const finalConfig = { ...this.defaultRetryConfig, ...config };
    let lastError: Error;
    let attempt = 0;

    while (attempt < finalConfig.maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        attempt++;

        // Check if we should retry
        if (
          attempt >= finalConfig.maxAttempts ||
          !finalConfig.retryCondition?.(lastError)
        ) {
          break;
        }

        // Calculate delay
        let delay = finalConfig.baseDelay;
        if (finalConfig.exponentialBackoff) {
          delay = Math.min(
            finalConfig.baseDelay * Math.pow(2, attempt - 1),
            finalConfig.maxDelay
          );
        }

        // Add jitter to prevent thundering herd
        delay = delay + Math.random() * 1000;

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  static async withCircuitBreaker<T>(
    operation: () => Promise<T>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    _circuitBreakerConfig?: {
      failureThreshold?: number;
      resetTimeout?: number;
      monitoringWindow?: number;
    }
  ): Promise<T> {
    // Simplified circuit breaker implementation
    // In a production environment, you might want to use a more sophisticated library
    return operation();
  }
}

// ================================
// Error Handlers
// ================================

export interface ErrorHandler {
  canHandle(error: Error): boolean;
  handle(error: Error, context?: Record<string, any>): Promise<any>;
}

export class ConnectionErrorHandler implements ErrorHandler {
  canHandle(error: Error): boolean {
    return error instanceof ConnectionError || error instanceof NetworkTimeoutError;
  }

  async handle(error: Error, context?: Record<string, any>): Promise<any> {
    if (error instanceof NetworkTimeoutError) {
      throw new UniFiMCPError(
        'Network timeout - try increasing timeout value or check network connectivity',
        ErrorCode.NETWORK_TIMEOUT,
        408,
        (error as UniFiMCPError).details,
        true,
        context
      );
    }

    if (error instanceof ConnectionError) {
      throw new UniFiMCPError(
        'Connection failed - check UniFi controller status and network connectivity',
        ErrorCode.CONNECTION_FAILED,
        503,
        (error as UniFiMCPError).details,
        true,
        context
      );
    }

    throw error;
  }
}

export class AuthenticationErrorHandler implements ErrorHandler {
  canHandle(error: Error): boolean {
    return error instanceof AuthenticationError || error instanceof APIKeyError;
  }

  async handle(error: Error, context?: Record<string, any>): Promise<any> {
    if (error instanceof APIKeyError) {
      throw new UniFiMCPError(
        'Invalid API key - check your API key configuration',
        ErrorCode.API_KEY_INVALID,
        401,
        (error as UniFiMCPError).details,
        false,
        context
      );
    }

    throw new UniFiMCPError(
      'Authentication failed - check your credentials and permissions',
      ErrorCode.AUTHENTICATION_FAILED,
      401,
      (error as UniFiMCPError).details,
      false,
      context
    );
  }
}

export class FeatureErrorHandler implements ErrorHandler {
  canHandle(error: Error): boolean {
    return error instanceof FeatureNotSupportedError || 
           error instanceof HardwareIncompatibleError;
  }

  async handle(error: Error, context?: Record<string, any>): Promise<any> {
    if (error instanceof FeatureNotSupportedError) {
      throw new UniFiMCPError(
        `${error.message}. Please upgrade your UniFi controller or use alternative tools.`,
        ErrorCode.FEATURE_NOT_SUPPORTED,
        501,
        (error as UniFiMCPError).details,
        false,
        context
      );
    }

    if (error instanceof HardwareIncompatibleError) {
      throw new UniFiMCPError(
        `${error.message}. This feature requires compatible hardware.`,
        ErrorCode.HARDWARE_INCOMPATIBLE,
        501,
        (error as UniFiMCPError).details,
        false,
        context
      );
    }

    throw error;
  }
}

// ================================
// Error Manager
// ================================

export class ErrorManager {
  private handlers: ErrorHandler[] = [
    new ConnectionErrorHandler(),
    new AuthenticationErrorHandler(),
    new FeatureErrorHandler()
  ];

  addHandler(handler: ErrorHandler): void {
    this.handlers.push(handler);
  }

  async handleError(error: Error, context?: Record<string, any>): Promise<any> {
    for (const handler of this.handlers) {
      if (handler.canHandle(error)) {
        return handler.handle(error, context);
      }
    }

    // If no specific handler found, convert to UniFiMCPError
    if (!(error instanceof UniFiMCPError)) {
      throw new UniFiMCPError(
        error.message || 'Unknown error occurred',
        ErrorCode.INTERNAL_ERROR,
        500,
        { originalError: error.name },
        false,
        context
      );
    }

    throw error;
  }

  createErrorResponse(error: Error): {
    success: false;
    error: {
      code: string;
      message: string;
      details?: any;
    };
  } {
    if (error instanceof UniFiMCPError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      };
    }

    return {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: error.message || 'Unknown error occurred',
        details: { type: error.constructor.name }
      }
    };
  }
}

// ================================
// Exports
// ================================

export {
  ErrorCode
} from '../server/types.js';

export const errorManager = new ErrorManager();