import winston from 'winston';
import { config } from '../config/environment.js';
import { LogLevel } from '../server/types.js';

/**
 * Comprehensive Logging System for UniFi MCP Server
 * 
 * Provides structured logging with multiple transports, formatting options,
 * and context-aware logging for debugging and monitoring.
 */

// ================================
// Custom Log Formats
// ================================

const customFormat = winston.format.printf(({ timestamp, level, message, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
});

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const simpleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  customFormat
);

const combinedFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ timestamp, level, message, requestId, toolName, executionTime, ...meta }) => {
    let logLine = `${timestamp} [${level.toUpperCase()}]`;
    
    if (requestId) logLine += ` [${requestId}]`;
    if (toolName) logLine += ` [${toolName}]`;
    if (executionTime) logLine += ` (${executionTime}ms)`;
    
    logLine += ` ${message}`;
    
    if (Object.keys(meta).length > 0) {
      logLine += ` ${JSON.stringify(meta)}`;
    }
    
    return logLine;
  })
);

// ================================
// Transport Configuration
// ================================

const createTransports = (): winston.transport[] => {
  const transports: winston.transport[] = [];

  // Console transport
  if (config.logging.console) {
    transports.push(
      new winston.transports.Console({
        level: config.logging.level,
        format: config.logging.format === 'json' ? jsonFormat : 
                config.logging.format === 'simple' ? simpleFormat : combinedFormat
      })
    );
  }

  // File transport
  if (config.logging.file) {
    transports.push(
      new winston.transports.File({
        filename: config.logging.file,
        level: config.logging.level,
        format: jsonFormat,
        maxsize: parseFileSize(config.logging.maxSize),
        maxFiles: config.logging.maxFiles,
        tailable: true
      })
    );

    // Separate error log file
    transports.push(
      new winston.transports.File({
        filename: config.logging.file.replace('.log', '.error.log'),
        level: 'error',
        format: jsonFormat,
        maxsize: parseFileSize(config.logging.maxSize),
        maxFiles: config.logging.maxFiles,
        tailable: true
      })
    );
  }

  return transports;
};

// ================================
// Logger Instance
// ================================

const logger = winston.createLogger({
  level: config.logging.level,
  format: combinedFormat,
  transports: createTransports(),
  exitOnError: false,
  silent: process.env.NODE_ENV === 'test'
});

// ================================
// Enhanced Logger Class
// ================================

export class Logger {
  private baseLogger: winston.Logger;
  private context: Record<string, any> = {};

  constructor(baseLogger: winston.Logger) {
    this.baseLogger = baseLogger;
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, any>): Logger {
    const childLogger = new Logger(this.baseLogger);
    childLogger.context = { ...this.context, ...context };
    return childLogger;
  }

  /**
   * Set persistent context for this logger instance
   */
  setContext(context: Record<string, any>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear all context
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Log error with stack trace
   */
  error(message: string, error?: Error | any, meta?: Record<string, any>): void {
    const logMeta = { ...this.context, ...meta };
    
    if (error) {
      if (error instanceof Error) {
        logMeta.error = {
          name: error.name,
          message: error.message,
          stack: error.stack
        };
      } else {
        logMeta.error = error;
      }
    }

    this.baseLogger.error(message, logMeta);
  }

  /**
   * Log warning
   */
  warn(message: string, meta?: Record<string, any>): void {
    this.baseLogger.warn(message, { ...this.context, ...meta });
  }

  /**
   * Log info
   */
  info(message: string, meta?: Record<string, any>): void {
    this.baseLogger.info(message, { ...this.context, ...meta });
  }

  /**
   * Log debug information
   */
  debug(message: string, meta?: Record<string, any>): void {
    this.baseLogger.debug(message, { ...this.context, ...meta });
  }

  /**
   * Log trace information
   */
  trace(message: string, meta?: Record<string, any>): void {
    this.baseLogger.silly(message, { ...this.context, ...meta });
  }

  /**
   * Log API request
   */
  apiRequest(method: string, url: string, duration?: number, status?: number): void {
    this.info('API Request', {
      method,
      url,
      duration: duration ? `${duration}ms` : undefined,
      status,
      type: 'api_request'
    });
  }

  /**
   * Log API response
   */
  apiResponse(method: string, url: string, status: number, duration: number, size?: number): void {
    const level = status >= 400 ? 'warn' : 'info';
    this[level]('API Response', {
      method,
      url,
      status,
      duration: `${duration}ms`,
      size: size ? `${size} bytes` : undefined,
      type: 'api_response'
    });
  }

  /**
   * Log tool execution
   */
  toolExecution(toolName: string, duration: number, success: boolean, meta?: Record<string, any>): void {
    const level = success ? 'info' : 'error';
    this[level](`Tool ${success ? 'completed' : 'failed'}`, {
      toolName,
      duration: `${duration}ms`,
      success,
      type: 'tool_execution',
      ...meta
    });
  }

  /**
   * Log connection events
   */
  connection(event: 'connected' | 'disconnected' | 'reconnecting' | 'failed', details?: Record<string, any>): void {
    const level = event === 'failed' ? 'error' : 'info';
    this[level](`Connection ${event}`, {
      event,
      type: 'connection',
      ...details
    });
  }

  /**
   * Log performance metrics
   */
  performance(metric: string, value: number, unit: string = 'ms', meta?: Record<string, any>): void {
    this.info('Performance metric', {
      metric,
      value,
      unit,
      type: 'performance',
      ...meta
    });
  }

  /**
   * Log security events
   */
  security(event: string, severity: 'low' | 'medium' | 'high' | 'critical', details?: Record<string, any>): void {
    const level = severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'info';
    this[level](`Security event: ${event}`, {
      event,
      severity,
      type: 'security',
      ...details
    });
  }

  /**
   * Log with custom level
   */
  log(level: LogLevel, message: string, meta?: Record<string, any>): void {
    this.baseLogger.log(level, message, { ...this.context, ...meta });
  }

  /**
   * Create a timer function for measuring execution time
   */
  timer(label: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.debug(`Timer: ${label}`, { duration: `${duration}ms`, type: 'timer' });
      return duration;
    };
  }

  /**
   * Log with profiling information
   */
  profile(id: string): void {
    this.baseLogger.profile(id);
  }

  /**
   * Start profiling
   */
  startTimer(id: string): void {
    this.baseLogger.profile(id);
  }

  /**
   * End profiling
   */
  endTimer(id: string): void {
    this.baseLogger.profile(id);
  }
}

// ================================
// Utility Functions
// ================================

/**
 * Parse file size string to bytes
 */
function parseFileSize(sizeStr: string): number {
  const units = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/i);
  
  if (!match) return 10 * 1024 * 1024; // Default 10MB
  
  const value = parseFloat(match[1]);
  const unit = (match[2] || 'B').toUpperCase() as keyof typeof units;
  
  return Math.floor(value * units[unit]);
}

/**
 * Create a request ID for tracking
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a correlation ID for distributed tracing
 */
export function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ================================
// Specialized Loggers
// ================================

/**
 * Create logger for specific component
 */
export function createComponentLogger(component: string): Logger {
  return new Logger(logger).child({ component });
}

/**
 * Create logger for API operations
 */
export function createAPILogger(): Logger {
  return new Logger(logger).child({ component: 'api' });
}

/**
 * Create logger for tool operations
 */
export function createToolLogger(toolName: string): Logger {
  return new Logger(logger).child({ component: 'tool', toolName });
}

/**
 * Create logger for connection operations
 */
export function createConnectionLogger(): Logger {
  return new Logger(logger).child({ component: 'connection' });
}

// ================================
// Log Analysis Helpers
// ================================

export class LogAnalyzer {
  /**
   * Extract error patterns from logs
   */
  static extractErrorPatterns(logs: string[]): Record<string, number> {
    const patterns: Record<string, number> = {};
    
    logs.forEach(log => {
      if (log.includes('[ERROR]')) {
        // Simple pattern extraction - in production you might want more sophisticated analysis
        const errorMatch = log.match(/\[ERROR\]\s+(.+?)(?:\s+\{|$)/);
        if (errorMatch) {
          const pattern = errorMatch[1].substring(0, 100); // Limit pattern length
          patterns[pattern] = (patterns[pattern] || 0) + 1;
        }
      }
    });
    
    return patterns;
  }

  /**
   * Calculate performance metrics from logs
   */
  static calculatePerformanceMetrics(logs: string[]): {
    averageResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
    requestCount: number;
  } {
    const responseTimes: number[] = [];
    
    logs.forEach(log => {
      const timeMatch = log.match(/\((\d+)ms\)/);
      if (timeMatch) {
        responseTimes.push(parseInt(timeMatch[1], 10));
      }
    });
    
    if (responseTimes.length === 0) {
      return { averageResponseTime: 0, maxResponseTime: 0, minResponseTime: 0, requestCount: 0 };
    }
    
    return {
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      maxResponseTime: Math.max(...responseTimes),
      minResponseTime: Math.min(...responseTimes),
      requestCount: responseTimes.length
    };
  }
}

// ================================
// Export Main Logger Instance
// ================================

export { logger };
export default new Logger(logger);