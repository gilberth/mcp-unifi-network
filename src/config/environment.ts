import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { ConfigurationError } from '../utils/errors.js';
import { ServerConfigSchema } from '../server/types.js';
import { UniFiConfigSchema } from '../unifi/types.js';

/**
 * Environment Configuration Management
 * 
 * Centralized configuration system with environment variable loading,
 * validation, and default value management for the UniFi MCP server.
 */

// Load environment variables from .env file
loadDotenv();

// ================================
// Configuration Schemas
// ================================

const LogConfigSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
  file: z.string().optional(),
  console: z.boolean().default(true),
  maxFiles: z.number().min(1).max(100).default(10),
  maxSize: z.string().default('10MB'),
  format: z.enum(['json', 'simple', 'combined']).default('combined')
});

const CacheConfigSchema = z.object({
  enabled: z.boolean().default(true),
  ttlSeconds: z.number().min(30).max(3600).default(300),
  maxSize: z.number().min(10).max(10000).default(1000),
  checkPeriod: z.number().min(60).max(3600).default(600)
});

const RateLimitConfigSchema = z.object({
  enabled: z.boolean().default(true),
  perMinute: z.number().min(1).max(1000).default(60),
  concurrent: z.number().min(1).max(50).default(10),
  burstAllowance: z.number().min(1).max(100).default(20),
  backoffMultiplier: z.number().min(1).max(10).default(2)
});

const SecurityConfigSchema = z.object({
  validateSSL: z.boolean().default(false),
  allowInsecureConnections: z.boolean().default(true),
  apiKeyRotationDays: z.number().min(1).max(365).default(90),
  sessionTimeoutMinutes: z.number().min(5).max(1440).default(60),
  maxFailedAttempts: z.number().min(1).max(100).default(5)
});

const FeatureFlagsSchema = z.object({
  enableZBFTools: z.boolean().default(true),
  enableLegacyFirewall: z.boolean().default(true),
  enableMonitoring: z.boolean().default(true),
  enableAutomation: z.boolean().default(true),
  enableAdvancedStats: z.boolean().default(false),
  enablePluginSystem: z.boolean().default(false),
  enableHealthChecks: z.boolean().default(true),
  enableMetricsCollection: z.boolean().default(true)
});

const PerformanceConfigSchema = z.object({
  connectionPoolSize: z.number().min(1).max(20).default(5),
  requestTimeoutMs: z.number().min(1000).max(300000).default(30000),
  retryAttempts: z.number().min(1).max(10).default(3),
  retryDelayMs: z.number().min(100).max(60000).default(1000),
  maxConcurrentRequests: z.number().min(1).max(100).default(20),
  healthCheckIntervalMs: z.number().min(5000).max(300000).default(30000)
});

const MonitoringConfigSchema = z.object({
  enabled: z.boolean().default(true),
  collectMetrics: z.boolean().default(true),
  metricsPort: z.number().min(1024).max(65535).default(9090),
  alertWebhook: z.string().url().optional(),
  alertThresholds: z.object({
    errorRate: z.number().min(0).max(1).default(0.1),
    responseTime: z.number().min(100).max(60000).default(5000),
    memoryUsage: z.number().min(0).max(1).default(0.8),
    diskUsage: z.number().min(0).max(1).default(0.9)
  }).default({})
});

// ================================
// Main Configuration Schema
// ================================

const EnvironmentConfigSchema = z.object({
  // Environment
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  
  // Server Configuration
  server: ServerConfigSchema,
  
  // UniFi Configuration
  unifi: UniFiConfigSchema.extend({
    port: z.number().min(1).max(65535).optional(),
    useHTTPS: z.boolean().default(true),
    retryConfig: z.object({
      maxAttempts: z.number().min(1).max(10).default(3),
      baseDelay: z.number().min(100).max(10000).default(1000),
      maxDelay: z.number().min(1000).max(60000).default(10000)
    }).default({})
  }),
  
  // Logging Configuration
  logging: LogConfigSchema,
  
  // Cache Configuration
  cache: CacheConfigSchema,
  
  // Rate Limiting
  rateLimit: RateLimitConfigSchema,
  
  // Security Settings
  security: SecurityConfigSchema,
  
  // Feature Flags
  features: FeatureFlagsSchema,
  
  // Performance Settings
  performance: PerformanceConfigSchema,
  
  // Monitoring Settings
  monitoring: MonitoringConfigSchema
});

export type EnvironmentConfig = z.infer<typeof EnvironmentConfigSchema>;

// ================================
// Configuration Builder
// ================================

class ConfigurationBuilder {
  private static instance: ConfigurationBuilder;
  private _config: EnvironmentConfig | null = null;

  private constructor() {}

  static getInstance(): ConfigurationBuilder {
    if (!ConfigurationBuilder.instance) {
      ConfigurationBuilder.instance = new ConfigurationBuilder();
    }
    return ConfigurationBuilder.instance;
  }

  /**
   * Build configuration from environment variables
   */
  build(): EnvironmentConfig {
    if (this._config) {
      return this._config;
    }

    try {
      const rawConfig = this.extractFromEnvironment();
      this._config = EnvironmentConfigSchema.parse(rawConfig);
      this.validateConfiguration(this._config);
      return this._config;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(issue => 
          `${issue.path.join('.')}: ${issue.message}`
        ).join(', ');
        throw new ConfigurationError(
          `Configuration validation failed: ${issues}`,
          'environment_validation'
        );
      }
      throw new ConfigurationError(
        `Failed to build configuration: ${(error as Error).message}`,
        'build_error'
      );
    }
  }

  /**
   * Extract configuration from environment variables
   */
  private extractFromEnvironment(): any {
    const env = process.env;

    return {
      nodeEnv: env.NODE_ENV || 'development',
      
      server: {
        name: env.MCP_SERVER_NAME || 'UniFi Network MCP Server',
        version: env.MCP_SERVER_VERSION || '1.0.0',
        description: env.MCP_SERVER_DESCRIPTION,
        author: env.MCP_SERVER_AUTHOR,
        capabilities: {
          tools: this.parseBoolean(env.MCP_ENABLE_TOOLS, true),
          resources: this.parseBoolean(env.MCP_ENABLE_RESOURCES, false),
          prompts: this.parseBoolean(env.MCP_ENABLE_PROMPTS, false)
        }
      },
      
      unifi: {
        gatewayIp: env.UNIFI_GATEWAY_IP || this.requireEnvVar('UNIFI_GATEWAY_IP'),
        apiKey: env.UNIFI_API_KEY || this.requireEnvVar('UNIFI_API_KEY'),
        siteId: env.UNIFI_SITE_ID || 'default',
        verifySSL: this.parseBoolean(env.UNIFI_VERIFY_SSL, false),
        timeout: this.parseNumber(env.UNIFI_TIMEOUT, 30000),
        maxRetries: this.parseNumber(env.UNIFI_MAX_RETRIES, 3),
        port: env.UNIFI_PORT ? this.parseNumber(env.UNIFI_PORT) : undefined,
        useHTTPS: this.parseBoolean(env.UNIFI_USE_HTTPS, true)
      },
      
      logging: {
        level: env.LOG_LEVEL || 'info',
        file: env.LOG_FILE,
        console: this.parseBoolean(env.LOG_CONSOLE, true),
        maxFiles: this.parseNumber(env.LOG_MAX_FILES, 10),
        maxSize: env.LOG_MAX_SIZE || '10MB',
        format: env.LOG_FORMAT || 'combined'
      },
      
      cache: {
        enabled: this.parseBoolean(env.ENABLE_CACHE, true),
        ttlSeconds: this.parseNumber(env.CACHE_TTL_SECONDS, 300),
        maxSize: this.parseNumber(env.CACHE_MAX_SIZE, 1000),
        checkPeriod: this.parseNumber(env.CACHE_CHECK_PERIOD, 600)
      },
      
      rateLimit: {
        enabled: this.parseBoolean(env.ENABLE_RATE_LIMIT, true),
        perMinute: this.parseNumber(env.API_RATE_LIMIT_PER_MINUTE, 60),
        concurrent: this.parseNumber(env.CONCURRENT_REQUESTS_LIMIT, 10),
        burstAllowance: this.parseNumber(env.RATE_LIMIT_BURST, 20),
        backoffMultiplier: this.parseNumber(env.RATE_LIMIT_BACKOFF, 2)
      },
      
      security: {
        validateSSL: this.parseBoolean(env.SECURITY_VALIDATE_SSL, false),
        allowInsecureConnections: this.parseBoolean(env.SECURITY_ALLOW_INSECURE, true),
        apiKeyRotationDays: this.parseNumber(env.SECURITY_API_KEY_ROTATION_DAYS, 90),
        sessionTimeoutMinutes: this.parseNumber(env.SECURITY_SESSION_TIMEOUT, 60),
        maxFailedAttempts: this.parseNumber(env.SECURITY_MAX_FAILED_ATTEMPTS, 5)
      },
      
      features: {
        enableZBFTools: this.parseBoolean(env.ENABLE_ZBF_TOOLS, true),
        enableLegacyFirewall: this.parseBoolean(env.ENABLE_LEGACY_FIREWALL, true),
        enableMonitoring: this.parseBoolean(env.ENABLE_MONITORING, true),
        enableAutomation: this.parseBoolean(env.ENABLE_AUTOMATION, true),
        enableAdvancedStats: this.parseBoolean(env.ENABLE_ADVANCED_STATS, false),
        enablePluginSystem: this.parseBoolean(env.ENABLE_PLUGIN_SYSTEM, false),
        enableHealthChecks: this.parseBoolean(env.ENABLE_HEALTH_CHECKS, true),
        enableMetricsCollection: this.parseBoolean(env.ENABLE_METRICS_COLLECTION, true)
      },
      
      performance: {
        connectionPoolSize: this.parseNumber(env.PERFORMANCE_CONNECTION_POOL_SIZE, 5),
        requestTimeoutMs: this.parseNumber(env.PERFORMANCE_REQUEST_TIMEOUT, 30000),
        retryAttempts: this.parseNumber(env.PERFORMANCE_RETRY_ATTEMPTS, 3),
        retryDelayMs: this.parseNumber(env.PERFORMANCE_RETRY_DELAY, 1000),
        maxConcurrentRequests: this.parseNumber(env.PERFORMANCE_MAX_CONCURRENT, 20),
        healthCheckIntervalMs: this.parseNumber(env.PERFORMANCE_HEALTH_CHECK_INTERVAL, 30000)
      },
      
      monitoring: {
        enabled: this.parseBoolean(env.MONITORING_ENABLED, true),
        collectMetrics: this.parseBoolean(env.MONITORING_COLLECT_METRICS, true),
        metricsPort: this.parseNumber(env.MONITORING_METRICS_PORT, 9090),
        alertWebhook: env.MONITORING_ALERT_WEBHOOK,
        alertThresholds: {
          errorRate: this.parseNumber(env.MONITORING_ERROR_RATE_THRESHOLD, 0.1),
          responseTime: this.parseNumber(env.MONITORING_RESPONSE_TIME_THRESHOLD, 5000),
          memoryUsage: this.parseNumber(env.MONITORING_MEMORY_THRESHOLD, 0.8),
          diskUsage: this.parseNumber(env.MONITORING_DISK_THRESHOLD, 0.9)
        }
      }
    };
  }

  /**
   * Validate the complete configuration
   */
  private validateConfiguration(config: EnvironmentConfig): void {
    // Validate UniFi connection settings
    if (!config.unifi.gatewayIp) {
      throw new ConfigurationError('UniFi gateway IP is required', 'unifi.gatewayIp');
    }

    if (!config.unifi.apiKey) {
      throw new ConfigurationError('UniFi API key is required', 'unifi.apiKey');
    }

    // Validate port ranges
    if (config.unifi.port && (config.unifi.port < 1 || config.unifi.port > 65535)) {
      throw new ConfigurationError('UniFi port must be between 1 and 65535', 'unifi.port');
    }

    // Validate timeout values
    if (config.unifi.timeout < 1000) {
      throw new ConfigurationError('UniFi timeout must be at least 1000ms', 'unifi.timeout');
    }

    // Validate feature flag combinations
    if (!config.features.enableZBFTools && !config.features.enableLegacyFirewall) {
      throw new ConfigurationError(
        'At least one firewall system must be enabled (ZBF or Legacy)',
        'features'
      );
    }

    // Validate performance settings
    if (config.performance.maxConcurrentRequests > 100) {
      throw new ConfigurationError(
        'Maximum concurrent requests should not exceed 100',
        'performance.maxConcurrentRequests'
      );
    }

    // Validate rate limiting
    if (config.rateLimit.enabled && config.rateLimit.perMinute < 1) {
      throw new ConfigurationError(
        'Rate limit per minute must be at least 1',
        'rateLimit.perMinute'
      );
    }
  }

  /**
   * Parse boolean from string
   */
  private parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
  }

  /**
   * Parse number from string
   */
  private parseNumber(value: string | undefined, defaultValue?: number): number {
    if (value === undefined) {
      if (defaultValue === undefined) {
        throw new ConfigurationError('Required numeric configuration missing');
      }
      return defaultValue;
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new ConfigurationError(`Invalid numeric value: ${value}`);
    }
    return parsed;
  }

  /**
   * Require environment variable
   */
  private requireEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new ConfigurationError(
        `Required environment variable ${name} is not set`,
        name
      );
    }
    return value;
  }

  /**
   * Get current configuration
   */
  getConfig(): EnvironmentConfig {
    if (!this._config) {
      return this.build();
    }
    return this._config;
  }

  /**
   * Reload configuration
   */
  reload(): EnvironmentConfig {
    this._config = null;
    return this.build();
  }

  /**
   * Update specific configuration values
   */
  updateConfig(updates: Partial<EnvironmentConfig>): EnvironmentConfig {
    if (!this._config) {
      this.build();
    }
    
    this._config = { ...this._config!, ...updates };
    this.validateConfiguration(this._config);
    return this._config;
  }
}

// ================================
// Configuration Utilities
// ================================

export class ConfigUtils {
  /**
   * Check if running in development mode
   */
  static isDevelopment(): boolean {
    return config.nodeEnv === 'development';
  }

  /**
   * Check if running in production mode
   */
  static isProduction(): boolean {
    return config.nodeEnv === 'production';
  }

  /**
   * Check if running in test mode
   */
  static isTest(): boolean {
    return config.nodeEnv === 'test';
  }

  /**
   * Get log file path with timestamp
   */
  static getLogFilePath(): string | undefined {
    if (!config.logging.file) return undefined;
    
    const timestamp = new Date().toISOString().split('T')[0];
    return config.logging.file.replace('{date}', timestamp);
  }

  /**
   * Get UniFi controller URL
   */
  static getUniFiURL(): string {
    const protocol = config.unifi.useHTTPS ? 'https' : 'http';
    const port = config.unifi.port ? `:${config.unifi.port}` : '';
    return `${protocol}://${config.unifi.gatewayIp}${port}`;
  }

  /**
   * Get feature-specific configuration
   */
  static getFeatureConfig(feature: keyof EnvironmentConfig['features']): boolean {
    return config.features[feature];
  }

  /**
   * Get performance configuration
   */
  static getPerformanceConfig(): EnvironmentConfig['performance'] {
    return config.performance;
  }

  /**
   * Get security configuration
   */
  static getSecurityConfig(): EnvironmentConfig['security'] {
    return config.security;
  }

  /**
   * Generate connection string for logging (without sensitive data)
   */
  static getConnectionString(): string {
    const url = this.getUniFiURL();
    const siteId = config.unifi.siteId;
    return `${url}/api/s/${siteId}`;
  }

  /**
   * Validate environment for specific features
   */
  static validateFeatureEnvironment(feature: string): void {
    switch (feature) {
      case 'zbf':
        if (!config.features.enableZBFTools) {
          throw new ConfigurationError(
            'Zone-Based Firewall tools are disabled in configuration',
            'features.enableZBFTools'
          );
        }
        break;
      case 'legacy-firewall':
        if (!config.features.enableLegacyFirewall) {
          throw new ConfigurationError(
            'Legacy firewall tools are disabled in configuration',
            'features.enableLegacyFirewall'
          );
        }
        break;
      case 'monitoring':
        if (!config.features.enableMonitoring) {
          throw new ConfigurationError(
            'Monitoring tools are disabled in configuration',
            'features.enableMonitoring'
          );
        }
        break;
      case 'automation':
        if (!config.features.enableAutomation) {
          throw new ConfigurationError(
            'Automation tools are disabled in configuration',
            'features.enableAutomation'
          );
        }
        break;
    }
  }
}

// ================================
// Export Configuration Instance
// ================================

const configBuilder = ConfigurationBuilder.getInstance();
export const config = configBuilder.build();

// Export types and utilities
export { ConfigurationBuilder };