import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP Server Type Definitions
 * 
 * Shared types for the Model Context Protocol server infrastructure,
 * tool registry, and server management.
 */

// ================================
// MCP Tool System Types
// ================================

export interface MCPTool extends Tool {
  category: ToolCategory;
  requiresConnection: boolean;
  requiresVersion?: string;
  handler: ToolHandler;
}

export enum ToolCategory {
  CONNECTION = 'connection',
  DEVICES = 'devices',
  CLIENTS = 'clients',
  FIREWALL_LEGACY = 'firewall-legacy',
  FIREWALL_ZBF = 'firewall-zbf',
  NETWORKS = 'networks',
  GROUPS = 'groups',
  MONITORING = 'monitoring',
  AUTOMATION = 'automation'
}

export type ToolHandler = (params: Record<string, any>) => Promise<ToolResult>;

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  warnings?: string[];
  metadata?: {
    executionTime: number;
    timestamp: Date;
    version?: string;
  };
}

// ================================
// Server Configuration
// ================================

export const ServerConfigSchema = z.object({
  name: z.string().default('UniFi Network MCP Server'),
  version: z.string().default('1.0.0'),
  description: z.string().optional(),
  author: z.string().optional(),
  capabilities: z.object({
    tools: z.boolean().default(true),
    resources: z.boolean().default(false),
    prompts: z.boolean().default(false)
  }).default({}),
  features: z.object({
    enableZBFTools: z.boolean().default(true),
    enableLegacyFirewall: z.boolean().default(true),
    enableMonitoring: z.boolean().default(true),
    enableAutomation: z.boolean().default(true),
    enableCache: z.boolean().default(true)
  }).default({}),
  rateLimit: z.object({
    perMinute: z.number().min(1).max(1000).default(60),
    concurrent: z.number().min(1).max(20).default(5)
  }).default({}),
  cache: z.object({
    ttlSeconds: z.number().min(30).max(3600).default(300),
    maxSize: z.number().min(10).max(1000).default(100)
  }).default({})
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

// ================================
// Connection Management
// ================================

export interface ConnectionState {
  isConnected: boolean;
  isAuthenticated: boolean;
  lastConnected?: Date;
  lastError?: string;
  retryCount: number;
  gatewayInfo?: {
    ip: string;
    version: string;
    model: string;
    siteId: string;
  };
}

export interface ConnectionPool {
  primary: ConnectionState;
  backup?: ConnectionState;
  healthCheck: {
    lastCheck: Date;
    isHealthy: boolean;
    latency: number;
  };
}

// ================================
// Feature Detection
// ================================

export interface FeatureCapabilities {
  version: string;
  supportsZBF: boolean;
  supportsLegacyFirewall: boolean;
  supportedEndpoints: string[];
  deprecatedEndpoints: string[];
  hardwareCapabilities: {
    model: string;
    supportsAdvancedFirewall: boolean;
    maxFirewallRules: number;
    maxZones: number;
  };
}

export interface ToolAvailability {
  [toolName: string]: {
    available: boolean;
    reason?: string;
    alternativeTool?: string;
    minimumVersion?: string;
  };
}

// ================================
// Error Handling
// ================================

export enum ErrorCode {
  // Connection Errors
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  SSL_ERROR = 'SSL_ERROR',
  
  // API Errors
  API_KEY_INVALID = 'API_KEY_INVALID',
  API_RATE_LIMITED = 'API_RATE_LIMITED',
  API_ENDPOINT_NOT_FOUND = 'API_ENDPOINT_NOT_FOUND',
  API_PERMISSION_DENIED = 'API_PERMISSION_DENIED',
  
  // Feature Errors
  FEATURE_NOT_SUPPORTED = 'FEATURE_NOT_SUPPORTED',
  HARDWARE_INCOMPATIBLE = 'HARDWARE_INCOMPATIBLE',
  VERSION_INCOMPATIBLE = 'VERSION_INCOMPATIBLE',
  
  // Validation Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PARAMETER_MISSING = 'PARAMETER_MISSING',
  PARAMETER_INVALID = 'PARAMETER_INVALID',
  
  // Resource Errors
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  RESOURCE_LIMIT_EXCEEDED = 'RESOURCE_LIMIT_EXCEEDED',
  
  // Internal Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  INITIALIZATION_ERROR = 'INITIALIZATION_ERROR',
  TOOL_REGISTRATION_ERROR = 'TOOL_REGISTRATION_ERROR',
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_DISABLED = 'TOOL_DISABLED',
  CONNECTION_REQUIRED = 'CONNECTION_REQUIRED',
  FEATURE_NOT_AVAILABLE = 'FEATURE_NOT_AVAILABLE',
  EXECUTION_ERROR = 'EXECUTION_ERROR',
  UNKNOWN_FEATURE = 'UNKNOWN_FEATURE',
  CAPABILITY_DETECTION_FAILED = 'CAPABILITY_DETECTION_FAILED',
  INVALID_DATA = 'INVALID_DATA',
  SYSTEM_INFO_ERROR = 'SYSTEM_INFO_ERROR',
  RULE_CREATION_FAILED = 'RULE_CREATION_FAILED',
  RULE_UPDATE_FAILED = 'RULE_UPDATE_FAILED',
  RULE_DELETION_FAILED = 'RULE_DELETION_FAILED',
  RULE_TOGGLE_FAILED = 'RULE_TOGGLE_FAILED',
  BLOCK_FAILED = 'BLOCK_FAILED',
  UNBLOCK_FAILED = 'UNBLOCK_FAILED',
  KICK_FAILED = 'KICK_FAILED',
  RESTART_FAILED = 'RESTART_FAILED',
  ADOPTION_FAILED = 'ADOPTION_FAILED',
  UPGRADE_FAILED = 'UPGRADE_FAILED'
}



// ================================
// Caching System
// ================================

export interface CacheEntry<T = any> {
  key: string;
  data: T;
  createdAt: Date;
  expiresAt: Date;
  hits: number;
  category: string;
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  memoryUsage: number;
  categories: Record<string, number>;
}

export enum CacheCategory {
  SYSTEM_INFO = 'system_info',
  DEVICE_LIST = 'device_list',
  CLIENT_LIST = 'client_list',
  NETWORK_CONFIG = 'network_config',
  FIREWALL_RULES = 'firewall_rules',
  ZONE_POLICIES = 'zone_policies',
  STATISTICS = 'statistics'
}

// ================================
// Rate Limiting
// ================================

export interface RateLimitEntry {
  key: string;
  requests: number;
  resetTime: Date;
  category: string;
}

export interface RateLimitConfig {
  perMinute: number;
  concurrent: number;
  burstAllowance: number;
  backoffMultiplier: number;
}

// ================================
// Logging and Monitoring
// ================================

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace'
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  category: string;
  metadata?: Record<string, any>;
  error?: Error;
  requestId?: string;
  toolName?: string;
  executionTime?: number;
}

export interface ServerMetrics {
  uptime: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  activeConnections: number;
  cacheStats: CacheStats;
  toolUsage: Record<string, number>;
  errorCounts: Record<ErrorCode, number>;
  lastUpdated: Date;
}

// ================================
// Tool Registration System
// ================================

export interface ToolRegistryEntry {
  tool: MCPTool;
  registered: Date;
  enabled: boolean;
  usageCount: number;
  lastUsed?: Date;
  averageExecutionTime: number;
  errorCount: number;
  dependencies: string[];
}

export interface ToolRegistry {
  tools: Map<string, ToolRegistryEntry>;
  categories: Map<ToolCategory, string[]>;
  dependencies: Map<string, string[]>;
}

// ================================
// Health Monitoring
// ================================

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'warning' | 'unhealthy';
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  responseTime: number;
}

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'unhealthy';
  checks: HealthCheckResult[];
  uptime: number;
  version: string;
  timestamp: Date;
}

// ================================
// Plugin System (Future Extension)
// ================================

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  tools: string[];
  dependencies: string[];
  apiVersion: string;
}

export interface PluginContext {
  unifiClient: any;
  logger: any;
  config: ServerConfig;
  cache: any;
}

export interface Plugin {
  manifest: PluginManifest;
  initialize(context: PluginContext): Promise<void>;
  getTools(): MCPTool[];
  shutdown(): Promise<void>;
}

// ================================
// Validation Schemas
// ================================

const ToolResultSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional()
  }).optional(),
  warnings: z.array(z.string()).optional(),
  metadata: z.object({
    executionTime: z.number(),
    timestamp: z.date(),
    version: z.string().optional()
  }).optional()
});

const HealthCheckResultSchema = z.object({
  name: z.string(),
  status: z.enum(['healthy', 'warning', 'unhealthy']),
  message: z.string(),
  details: z.record(z.any()).optional(),
  timestamp: z.date(),
  responseTime: z.number()
});

// ================================
// Utility Types
// ================================

export type Awaitable<T> = T | Promise<T>;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// ================================
// Export Collections
// ================================

// Export schemas only
export {
  ToolResultSchema,
  HealthCheckResultSchema
};