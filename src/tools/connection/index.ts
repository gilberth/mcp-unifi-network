import { MCPTool, ToolCategory, ToolResult } from '../../server/types.js';
import { ToolRegistry } from '../../server/toolRegistry.js';
import { UniFiClient } from '../../unifi/client.js';
import { VersionDetector } from '../../unifi/versionDetector.js';
import { ConnectToolParamsSchema } from '../../utils/validators.js';
import { createToolLogger } from '../../utils/logger.js';
import { UniFiMCPError } from '../../utils/errors.js';

/**
 * Connection and Authentication Tools
 * 
 * Core tools for establishing and managing connections to UniFi controllers,
 * authentication, and system information retrieval.
 */

const logger = createToolLogger('connection-tools');

// ================================
// UniFi Connect Tool
// ================================

const unifiConnectTool: MCPTool = {
  name: 'unifi_connect',
  description: 'Establish connection to UniFi Network controller',
  category: ToolCategory.CONNECTION,
  requiresConnection: false,
  inputSchema: {
    type: 'object',
    properties: {
      gatewayIp: {
        type: 'string',
        description: 'IP address of the UniFi controller/gateway',
        pattern: '^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$'
      },
      apiKey: {
        type: 'string',
        description: 'API key for authentication',
        minLength: 1
      },
      siteId: {
        type: 'string',
        description: 'Site identifier (default: "default")',
        default: 'default'
      },
      verifySSL: {
        type: 'boolean',
        description: 'Whether to verify SSL certificates (default: false for self-signed)',
        default: false
      },
      timeout: {
        type: 'number',
        description: 'Request timeout in milliseconds (default: 30000)',
        minimum: 1000,
        maximum: 300000,
        default: 30000
      }
    },
    required: ['gatewayIp', 'apiKey'],
    additionalProperties: false
  },
  handler: async (params: any): Promise<ToolResult> => {
    try {
      logger.info('Connecting to UniFi controller', { 
        gatewayIp: params.gatewayIp,
        siteId: params.siteId || 'default'
      });

      // Validate input parameters using Zod schema directly
      const validatedParams = await ConnectToolParamsSchema.parseAsync(params);

      // Update client configuration
      const client = params._client as UniFiClient;
      client.updateConfig({
        gatewayIp: validatedParams.gatewayIp,
        apiKey: validatedParams.apiKey,
        siteId: validatedParams.siteId,
        verifySSL: validatedParams.verifySSL,
        timeout: validatedParams.timeout
      });

      // Attempt connection
      await client.connect();

      const connectionInfo = client.getConnectionInfo();
      
      logger.info('Successfully connected to UniFi controller', {
        gatewayInfo: connectionInfo.gatewayInfo
      });

      return {
        success: true,
        data: {
          connected: true,
          gatewayInfo: connectionInfo.gatewayInfo,
          connectedAt: connectionInfo.lastConnected,
          message: 'Successfully connected to UniFi controller'
        },
        metadata: {
          executionTime: 0, // Will be set by registry
          timestamp: new Date()
        }
      };

    } catch (error) {
      logger.error('Failed to connect to UniFi controller', error);
      
      return {
        success: false,
        error: {
          code: error instanceof UniFiMCPError ? error.code : 'CONNECTION_ERROR',
          message: (error as Error).message,
          details: error instanceof UniFiMCPError ? error.details : undefined
        },
        metadata: {
          executionTime: 0,
          timestamp: new Date()
        }
      };
    }
  }
};

// ================================
// Test Connection Tool
// ================================

const testConnectionTool: MCPTool = {
  name: 'unifi_test_connection',
  description: 'Test connectivity and authentication to UniFi controller',
  category: ToolCategory.CONNECTION,
  requiresConnection: false,
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false
  },
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const client = params._client as UniFiClient;
      
      logger.info('Testing UniFi connection');

      // Perform health check
      const healthCheck = await client.healthCheck();
      const connectionInfo = client.getConnectionInfo();
      const stats = client.getStatistics();

      const result: ToolResult = {
        success: true,
        data: {
          status: healthCheck.status,
          connected: connectionInfo.isConnected,
          authenticated: connectionInfo.isAuthenticated,
          lastConnected: connectionInfo.lastConnected,
          responseTime: healthCheck.details.responseTime,
          connectionAttempts: stats.connectionAttempts,
          rateLimitTokens: stats.rateLimitTokens,
          gatewayInfo: connectionInfo.gatewayInfo,
          message: healthCheck.status === 'healthy' ? 
            'Connection test successful' : 
            'Connection test failed'
        },
        metadata: {
          executionTime: 0,
          timestamp: new Date()
        }
      };

      if (healthCheck.status !== 'healthy') {
        result.warnings = ['Connection health check indicates issues. Check network connectivity and credentials.'];
      }

      return result;

    } catch (error) {
      logger.error('Connection test failed', error);
      
      return {
        success: false,
        error: {
          code: error instanceof UniFiMCPError ? error.code : 'CONNECTION_TEST_ERROR',
          message: (error as Error).message,
          details: error instanceof UniFiMCPError ? error.details : undefined
        },
        metadata: {
          executionTime: 0,
          timestamp: new Date()
        }
      };
    }
  }
};

// ================================
// Get System Info Tool
// ================================

const getSystemInfoTool: MCPTool = {
  name: 'unifi_get_system_info',
  description: 'Retrieve UniFi controller system information and version details',
  category: ToolCategory.CONNECTION,
  requiresConnection: true,
  inputSchema: {
    type: 'object',
    properties: {
      includeCapabilities: {
        type: 'boolean',
        description: 'Include feature capabilities and version compatibility info',
        default: true
      }
    },
    additionalProperties: false
  },
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const client = params._client as UniFiClient;
      const versionDetector = params._versionDetector as VersionDetector;
      
      logger.info('Retrieving system information');

      // Get basic system info
      const systemInfo = await client.getSystemInfo();
      
      let capabilities = null;
      if (params.includeCapabilities !== false) {
        try {
          capabilities = await versionDetector.detectCapabilities();
        } catch (error) {
          logger.warn('Could not detect capabilities', error as any);
        }
      }

      const result = {
        systemInfo: {
          version: systemInfo.version,
          buildNumber: systemInfo.buildNumber,
          hostname: systemInfo.hostname,
          uptime: systemInfo.uptime,
          timezone: systemInfo.timezone,
          hardwareModel: systemInfo.hardwareModel,
          hardwareRevision: systemInfo.hardwareRevision
        },
        capabilities: capabilities ? {
          version: capabilities.version,
          supportsZBF: capabilities.supportsZBF,
          supportsLegacyFirewall: capabilities.supportsLegacyFirewall,
          hardwareCapabilities: capabilities.hardwareCapabilities,
          supportedEndpoints: capabilities.supportedEndpoints.length,
          deprecatedEndpoints: capabilities.deprecatedEndpoints.length
        } : null,
        connection: {
          gatewayIp: client.getConfig().gatewayIp,
          siteId: client.getConfig().siteId,
          connected: client.isConnected()
        }
      };

      return {
        success: true,
        data: result,
        metadata: {
          executionTime: 0,
          timestamp: new Date(),
          version: systemInfo.version
        }
      };

    } catch (error) {
      logger.error('Failed to retrieve system information', error);
      
      return {
        success: false,
        error: {
          code: error instanceof UniFiMCPError ? error.code : 'SYSTEM_INFO_ERROR',
          message: (error as Error).message,
          details: error instanceof UniFiMCPError ? error.details : undefined
        },
        metadata: {
          executionTime: 0,
          timestamp: new Date()
        }
      };
    }
  }
};

// ================================
// Disconnect Tool
// ================================

const disconnectTool: MCPTool = {
  name: 'unifi_disconnect',
  description: 'Disconnect from UniFi controller',
  category: ToolCategory.CONNECTION,
  requiresConnection: false,
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false
  },
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const client = params._client as UniFiClient;
      
      logger.info('Disconnecting from UniFi controller');

      const wasConnected = client.isConnected();
      await client.disconnect();

      return {
        success: true,
        data: {
          disconnected: true,
          wasConnected,
          message: wasConnected ? 
            'Successfully disconnected from UniFi controller' : 
            'Already disconnected'
        },
        metadata: {
          executionTime: 0,
          timestamp: new Date()
        }
      };

    } catch (error) {
      logger.error('Failed to disconnect from UniFi controller', error);
      
      return {
        success: false,
        error: {
          code: error instanceof UniFiMCPError ? error.code : 'DISCONNECT_ERROR',
          message: (error as Error).message,
          details: error instanceof UniFiMCPError ? error.details : undefined
        },
        metadata: {
          executionTime: 0,
          timestamp: new Date()
        }
      };
    }
  }
};

// ================================
// Get Connection Status Tool
// ================================

const getConnectionStatusTool: MCPTool = {
  name: 'unifi_get_connection_status',
  description: 'Get detailed connection status and statistics',
  category: ToolCategory.CONNECTION,
  requiresConnection: false,
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false
  },
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const client = params._client as UniFiClient;
      
      logger.debug('Getting connection status');

      const connectionInfo = client.getConnectionInfo();
      const stats = client.getStatistics();
      const config = client.getConfig();

      return {
        success: true,
        data: {
          connection: {
            isConnected: connectionInfo.isConnected,
            isAuthenticated: connectionInfo.isAuthenticated,
            lastConnected: connectionInfo.lastConnected,
            lastError: connectionInfo.lastError,
            connectionAttempts: connectionInfo.connectionAttempts
          },
          statistics: {
            connectionAttempts: stats.connectionAttempts,
            retryCount: stats.retryCount,
            rateLimitTokens: stats.rateLimitTokens,
            requestQueueSize: stats.requestQueueSize
          },
          configuration: {
            gatewayIp: config.gatewayIp,
            siteId: config.siteId,
            timeout: config.timeout,
            maxRetries: config.maxRetries,
            verifySSL: config.verifySSL
          },
          gatewayInfo: connectionInfo.gatewayInfo
        },
        metadata: {
          executionTime: 0,
          timestamp: new Date()
        }
      };

    } catch (error) {
      logger.error('Failed to get connection status', error);
      
      return {
        success: false,
        error: {
          code: error instanceof UniFiMCPError ? error.code : 'STATUS_ERROR',
          message: (error as Error).message,
          details: error instanceof UniFiMCPError ? error.details : undefined
        },
        metadata: {
          executionTime: 0,
          timestamp: new Date()
        }
      };
    }
  }
};

// ================================
// Tool Registration Function
// ================================

export async function registerConnectionTools(
  registry: ToolRegistry,
  client: UniFiClient,
  versionDetector: VersionDetector
): Promise<void> {
  // Add client and version detector to tools for access
  const enhancedTools = [
    unifiConnectTool,
    testConnectionTool,
    getSystemInfoTool,
    disconnectTool,
    getConnectionStatusTool
  ].map(tool => ({
    ...tool,
    handler: async (params: any) => {
      // Inject dependencies
      const enhancedParams = {
        ...params,
        _client: client,
        _versionDetector: versionDetector
      };
      return tool.handler(enhancedParams);
    }
  }));

  // Register all tools
  registry.registerBatch(enhancedTools);

  logger.info('Connection tools registered successfully', {
    count: enhancedTools.length,
    tools: enhancedTools.map(t => t.name)
  });
}

// Export individual tools for testing
export {
  unifiConnectTool,
  testConnectionTool,
  getSystemInfoTool,
  disconnectTool,
  getConnectionStatusTool
};