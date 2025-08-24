import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { UniFiClient, createUniFiClient } from '../unifi/client.js';
import { VersionDetector } from '../unifi/versionDetector.js';
import { ToolRegistry } from './toolRegistry.js';
import { createComponentLogger } from '../utils/logger.js';
import { config, ConfigUtils } from '../config/environment.js';
import { UniFiMCPError, errorManager } from '../utils/errors.js';
import { ErrorCode } from './types.js';

// Import tool implementations
import { registerConnectionTools } from '../tools/connection/index.js';
import { registerDeviceTools } from '../tools/devices/index.js';
import { registerClientTools } from '../tools/clients/index.js';
import { registerLegacyFirewallTools } from '../tools/firewall/legacy.js';
import { registerZBFTools } from '../tools/firewall/zbf.js';
import { registerNetworkTools } from '../tools/networks/index.js';
import { registerMonitoringTools } from '../tools/monitoring/index.js';
import { registerAutomationTools } from '../tools/automation/index.js';

/**
 * UniFi Network MCP Server
 * 
 * Main MCP server implementation that orchestrates all UniFi Network API
 * functionality through a comprehensive tool registry system.
 */

export class UniFiMCPServer {
  private server: Server;
  private unifiClient: UniFiClient;
  private versionDetector: VersionDetector;
  private toolRegistry: ToolRegistry;
  private logger = createComponentLogger('mcp-server');
  private isInitialized = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(server: Server) {
    this.server = server;
    
    // Initialize UniFi client
    this.unifiClient = createUniFiClient({
      gatewayIp: config.unifi.gatewayIp,
      apiKey: config.unifi.apiKey,
      siteId: config.unifi.siteId,
      verifySSL: config.unifi.verifySSL,
      timeout: config.unifi.timeout,
      maxRetries: config.unifi.maxRetries,
      port: config.unifi.port,
      enableRetry: true,
      retryConfig: config.unifi.retryConfig,
      rateLimit: {
        requestsPerMinute: config.rateLimit.perMinute,
        burstLimit: config.rateLimit.burstAllowance
      }
    });

    // Initialize version detector
    this.versionDetector = new VersionDetector(this.unifiClient);

    // Initialize tool registry
    this.toolRegistry = new ToolRegistry(this.unifiClient, this.versionDetector);
  }

  // ================================
  // Server Initialization
  // ================================

  /**
   * Initialize the MCP server
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing UniFi MCP Server', {
        version: config.server.version,
        unifiGateway: ConfigUtils.getConnectionString()
      });

      // Setup MCP server handlers
      this.setupServerHandlers();

      // Register all tools
      await this.registerAllTools();

      // Start health monitoring if enabled
      if (config.features.enableHealthChecks) {
        this.startHealthMonitoring();
      }

      this.isInitialized = true;
      
      this.logger.info('UniFi MCP Server initialized successfully', {
        totalTools: this.toolRegistry.getRegistryStats().totalTools,
        enabledTools: this.toolRegistry.getRegistryStats().enabledTools
      });

    } catch (error) {
      this.logger.error('Failed to initialize MCP server', error);
      throw new UniFiMCPError(
        'Server initialization failed',
        ErrorCode.INITIALIZATION_ERROR,
        500,
        { originalError: (error as Error).message }
      );
    }
  }

  /**
   * Setup MCP server request handlers
   */
  private setupServerHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        const tools = await this.toolRegistry.getToolsForMCP();
        
        this.logger.debug('Listed tools', { count: tools.length });
        
        return { tools };
      } catch (error) {
        this.logger.error('Failed to list tools', error);
        throw error;
      }
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: params } = request.params;
      
      try {
        this.logger.info('Executing tool', { 
          toolName: name, 
          hasParams: Object.keys(params || {}).length > 0 
        });

        const result = await this.toolRegistry.executeTool(name, params || {});
        
        if (result.success) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result.data, null, 2)
              }
            ]
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${result.error?.message || 'Unknown error occurred'}`
              }
            ],
            isError: true
          };
        }
      } catch (error) {
        this.logger.error('Tool execution failed', error, { toolName: name });
        
        const errorResponse = errorManager.createErrorResponse(error as Error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorResponse.error.message}`
            }
          ],
          isError: true
        };
      }
    });

    this.logger.debug('MCP server handlers configured');
  }

  // ================================
  // Tool Registration
  // ================================

  /**
   * Register all available tools
   */
  private async registerAllTools(): Promise<void> {
    this.logger.info('Registering tools...');

    try {
      // Always register connection tools (core functionality)
      await registerConnectionTools(this.toolRegistry, this.unifiClient, this.versionDetector);

      // Register device and client management tools (always available)
      await registerDeviceTools(this.toolRegistry, this.unifiClient);
      await registerClientTools(this.toolRegistry, this.unifiClient);

      // Register network management tools (always available)
      await registerNetworkTools(this.toolRegistry, this.unifiClient);

      // Register firewall tools based on feature flags and capabilities
      if (config.features.enableLegacyFirewall) {
        await registerLegacyFirewallTools(this.toolRegistry, this.unifiClient, this.versionDetector);
      }

      if (config.features.enableZBFTools) {
        await registerZBFTools(this.toolRegistry, this.unifiClient, this.versionDetector);
      }

      // Register monitoring tools if enabled
      if (config.features.enableMonitoring) {
        await registerMonitoringTools(this.toolRegistry, this.unifiClient);
      }

      // Register automation tools if enabled
      if (config.features.enableAutomation) {
        await registerAutomationTools(this.toolRegistry, this.unifiClient);
      }

      const stats = this.toolRegistry.getRegistryStats();
      this.logger.info('Tool registration completed', {
        totalTools: stats.totalTools,
        enabledTools: stats.enabledTools,
        categories: stats.categoryCounts
      });

    } catch (error) {
      this.logger.error('Failed to register tools', error);
      throw new UniFiMCPError(
        'Tool registration failed',
        ErrorCode.TOOL_REGISTRATION_ERROR,
        500,
        { originalError: (error as Error).message }
      );
    }
  }

  // ================================
  // Health Monitoring
  // ================================

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    const interval = config.performance.healthCheckIntervalMs;
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        this.logger.error('Health check failed', error);
      }
    }, interval);

    this.logger.info('Health monitoring started', { 
      intervalMs: interval 
    });
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      // Check UniFi client health
      const clientHealth = await this.unifiClient.healthCheck();
      
      if (clientHealth.status === 'unhealthy') {
        this.logger.warn('UniFi client health check failed', clientHealth.details);
      }

      // Check tool registry health
      const registryStats = this.toolRegistry.getRegistryStats();
      const errorRate = registryStats.totalUsage > 0 ? 
        registryStats.enabledTools / registryStats.totalUsage : 0;

      if (errorRate > config.monitoring.alertThresholds.errorRate) {
        this.logger.warn('High tool error rate detected', { 
          errorRate: (errorRate * 100).toFixed(2) + '%',
          threshold: (config.monitoring.alertThresholds.errorRate * 100).toFixed(2) + '%'
        });
      }

      // Log health metrics
      this.logger.debug('Health check completed', {
        unifiHealth: clientHealth.status,
        toolsEnabled: registryStats.enabledTools,
        totalUsage: registryStats.totalUsage,
        avgExecutionTime: registryStats.averageExecutionTime.toFixed(2) + 'ms'
      });

    } catch (error) {
      this.logger.error('Health check execution failed', error);
    }
  }

  // ================================
  // Server Management
  // ================================

  /**
   * Get server status
   */
  getStatus(): {
    initialized: boolean;
    connected: boolean;
    tools: {
      total: number;
      enabled: number;
      available: number;
    };
    uptime: number;
    version: string;
  } {
    const registryStats = this.toolRegistry.getRegistryStats();
    
    return {
      initialized: this.isInitialized,
      connected: this.unifiClient.isConnected(),
      tools: {
        total: registryStats.totalTools,
        enabled: registryStats.enabledTools,
        available: registryStats.enabledTools // Simplified for now
      },
      uptime: process.uptime(),
      version: config.server.version
    };
  }

  /**
   * Get detailed server information
   */
  async getServerInfo(): Promise<{
    server: any;
    unifi: any;
    tools: any;
    capabilities: any;
  }> {
    const connectionInfo = this.unifiClient.getConnectionInfo();
    const registryStats = this.toolRegistry.getRegistryStats();
    const clientStats = this.unifiClient.getStatistics();

    let capabilities = null;
    try {
      capabilities = await this.versionDetector.detectCapabilities();
    } catch (error) {
      this.logger.warn('Could not detect capabilities', error as Error);
    }

    return {
      server: {
        name: config.server.name,
        version: config.server.version,
        initialized: this.isInitialized,
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform
      },
      unifi: {
        connected: connectionInfo.isConnected,
        authenticated: connectionInfo.isAuthenticated,
        gatewayInfo: connectionInfo.gatewayInfo,
        connectionAttempts: clientStats.connectionAttempts,
        lastConnected: connectionInfo.lastConnected,
        rateLimitTokens: clientStats.rateLimitTokens
      },
      tools: {
        ...registryStats,
        requestQueueSize: clientStats.requestQueueSize
      },
      capabilities
    };
  }

  /**
   * Reload tools based on current capabilities
   */
  async reloadTools(): Promise<void> {
    this.logger.info('Reloading tools...');
    
    try {
      // Clear version detector cache
      this.versionDetector.clearCache();
      
      // Re-register tools
      await this.registerAllTools();
      
      this.logger.info('Tools reloaded successfully');
    } catch (error) {
      this.logger.error('Failed to reload tools', error);
      throw error;
    }
  }

  /**
   * Shutdown the server gracefully
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down UniFi MCP Server...');

    try {
      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // Disconnect from UniFi
      if (this.unifiClient.isConnected()) {
        await this.unifiClient.disconnect();
      }

      // Clean up tool registry
      this.toolRegistry.cleanup();

      this.isInitialized = false;
      
      this.logger.info('UniFi MCP Server shutdown completed');
    } catch (error) {
      this.logger.error('Error during shutdown', error);
      throw error;
    }
  }

  // ================================
  // Configuration Management
  // ================================

  /**
   * Update server configuration
   */
  updateConfiguration(updates: any): void {
    try {
      // Update UniFi client configuration if needed
      if (updates.unifi) {
        this.unifiClient.updateConfig(updates.unifi);
      }

      this.logger.info('Configuration updated', {
        sections: Object.keys(updates)
      });
    } catch (error) {
      this.logger.error('Failed to update configuration', error);
      throw error;
    }
  }

  // ================================
  // Debugging and Diagnostics
  // ================================

  /**
   * Get debug information
   */
  async getDebugInfo(): Promise<any> {
    const serverInfo = await this.getServerInfo();
    const toolAvailability = await this.versionDetector.getToolAvailability();
    const toolFilter = await this.toolRegistry.filterToolsByFeatures();

    return {
      ...serverInfo,
      environment: {
        nodeEnv: config.nodeEnv,
        features: config.features,
        performance: config.performance
      },
      toolAvailability,
      toolFilter,
      lastErrors: [] // Could implement error tracking
    };
  }

  /**
   * Test UniFi connection
   */
  async testConnection(): Promise<{
    success: boolean;
    details: any;
    error?: string;
  }> {
    try {
      const healthCheck = await this.unifiClient.healthCheck();
      return {
        success: healthCheck.status === 'healthy',
        details: healthCheck.details
      };
    } catch (error) {
      return {
        success: false,
        details: {},
        error: (error as Error).message
      };
    }
  }
}