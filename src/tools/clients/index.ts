import { MCPTool, ToolCategory, ToolResult, ErrorCode } from '../../server/types.js';
import { ToolRegistry } from '../../server/toolRegistry.js';
import { UniFiClient } from '../../unifi/client.js';
import { Client, DetailedClient } from '../../unifi/types.js';
import { ValidationService } from '../../utils/validators.js';
import { createToolLogger } from '../../utils/logger.js';
import { UniFiMCPError, ResourceNotFoundError } from '../../utils/errors.js';
import { UNIFI_ENDPOINTS } from '../../config/constants.js';

/**
 * Client Management Tools
 * 
 * Comprehensive tools for managing connected clients including
 * listing, blocking, unblocking, and monitoring client activities.
 */

const logger = createToolLogger('client-tools');

// ================================
// Get Clients Tool
// ================================

const getClientsTool: MCPTool = {
  name: 'unifi_get_clients',
  description: 'Get list of connected clients with optional filtering',
  category: ToolCategory.CLIENTS,
  requiresConnection: true,
  inputSchema: {
    type: 'object',
    properties: {
      activeOnly: {
        type: 'boolean',
        description: 'Show only currently connected clients',
        default: false
      },
      networkId: {
        type: 'string',
        description: 'Filter by network/VLAN ID'
      },
      clientType: {
        type: 'string',
        enum: ['wired', 'wireless', 'vpn'],
        description: 'Filter by connection type'
      },
      blocked: {
        type: 'boolean',
        description: 'Filter by blocked status'
      },
      includeTraffic: {
        type: 'boolean',
        description: 'Include traffic statistics',
        default: false
      },
      sortBy: {
        type: 'string',
        enum: ['name', 'ip', 'mac', 'lastSeen', 'rxBytes', 'txBytes'],
        description: 'Sort clients by field'
      },
      sortOrder: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'Sort order',
        default: 'desc'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of clients to return',
        minimum: 1,
        maximum: 1000,
        default: 100
      }
    },
    additionalProperties: false
  },
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const client = params._client as UniFiClient;
      const validatedParams = await ValidationService.validateClientParams(params);
      
      logger.info('Retrieving UniFi clients', {
        activeOnly: validatedParams.activeOnly,
        networkId: validatedParams.networkId,
        clientType: validatedParams.clientType,
        includeTraffic: validatedParams.includeTraffic
      });

      // Build query parameters
      const queryParams: any = {};
      if (validatedParams.activeOnly) {
        queryParams.connected = true;
      }
      if (validatedParams.networkId) {
        queryParams.network_id = validatedParams.networkId;
      }

      // Get clients from UniFi API
      const response = await client.get<Client[]>(UNIFI_ENDPOINTS.CLIENTS, queryParams);
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new UniFiMCPError('Invalid client data received', ErrorCode.INVALID_DATA);
      }

      let clients = response.data as unknown as Client[];

      // Apply additional filters
      if (validatedParams.clientType) {
        clients = clients.filter(c => c.type === validatedParams.clientType);
      }

      if (validatedParams.blocked !== undefined) {
        clients = clients.filter(c => c.blocked === validatedParams.blocked);
      }

      // Sort clients
      if (validatedParams.sortBy) {
        clients.sort((a, b) => {
          const field = validatedParams.sortBy!;
          const aVal = (a as any)[field];
          const bVal = (b as any)[field];
          
          if (aVal < bVal) return validatedParams.sortOrder === 'desc' ? 1 : -1;
          if (aVal > bVal) return validatedParams.sortOrder === 'desc' ? -1 : 1;
          return 0;
        });
      }

      // Limit results
      if (validatedParams.limit) {
        clients = clients.slice(0, validatedParams.limit);
      }

      // Get additional traffic stats if requested
      if (validatedParams.includeTraffic) {
        for (const clientData of clients) {
          try {
            const statsResponse = await client.get(`${UNIFI_ENDPOINTS.CLIENT_STATS}/${clientData.id}`);
            (clientData as any).trafficStats = statsResponse.data?.[0] || null;
          } catch (error) {
            logger.warn(`Could not fetch traffic stats for client ${clientData.id}`, error as any);
          }
        }
      }

      const summary = {
        total: clients.length,
        connected: clients.filter(c => c.connected).length,
        blocked: clients.filter(c => c.blocked).length,
        byType: clients.reduce((acc, c) => {
          acc[c.type] = (acc[c.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        totalTraffic: {
          rxBytes: clients.reduce((sum, c) => sum + (c.rxBytes || 0), 0),
          txBytes: clients.reduce((sum, c) => sum + (c.txBytes || 0), 0)
        }
      };

      return {
        success: true,
        data: {
          clients,
          summary,
          filters: {
            activeOnly: validatedParams.activeOnly,
            networkId: validatedParams.networkId,
            clientType: validatedParams.clientType,
            blocked: validatedParams.blocked
          }
        },
        metadata: {
          executionTime: 0,
          timestamp: new Date()
        }
      };

    } catch (error) {
      logger.error('Failed to retrieve clients', error);
      
      return {
        success: false,
        error: {
          code: error instanceof UniFiMCPError ? error.code : 'CLIENT_FETCH_ERROR',
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
// Get Client Details Tool
// ================================

const getClientDetailsTool: MCPTool = {
  name: 'unifi_get_client_details',
  description: 'Get detailed information for a specific client',
  category: ToolCategory.CLIENTS,
  requiresConnection: true,
  inputSchema: {
    type: 'object',
    properties: {
      clientId: {
        type: 'string',
        description: 'Client ID or MAC address',
        minLength: 1
      },
      includeHistory: {
        type: 'boolean',
        description: 'Include connection history',
        default: false
      },
      includeStats: {
        type: 'boolean',
        description: 'Include detailed statistics',
        default: true
      }
    },
    required: ['clientId'],
    additionalProperties: false
  },
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const client = params._client as UniFiClient;
      const { clientId, includeHistory = false, includeStats = true } = params;
      
      logger.info('Retrieving client details', { clientId, includeHistory, includeStats });

      // Get client details
      const response = await client.get<DetailedClient>(`${UNIFI_ENDPOINTS.CLIENT_DETAILS.replace('{id}', clientId)}`);
      
      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        throw new ResourceNotFoundError('Client', clientId);
      }

      const clientData = response.data[0];
      const result: any = { client: clientData };

      // Get detailed statistics
      if (includeStats) {
        try {
          const statsResponse = await client.get(`${UNIFI_ENDPOINTS.CLIENT_STATS}/${clientId}`);
          result.statistics = statsResponse.data?.[0] || null;
        } catch (error) {
          logger.warn('Could not fetch client statistics', error as any);
          result.statistics = null;
        }
      }

      // Get connection history
      if (includeHistory) {
        try {
          const historyResponse = await client.get(`${UNIFI_ENDPOINTS.EVENTS}`, {
            mac: clientId,
            limit: 50
          });
          result.connectionHistory = historyResponse.data || [];
        } catch (error) {
          logger.warn('Could not fetch connection history', error as any);
          result.connectionHistory = [];
        }
      }

      // Calculate connection quality metrics
      if (clientData.type === 'wireless' && clientData.signal !== undefined) {
        result.qualityMetrics = {
          signalStrength: clientData.signal,
          signalQuality: clientData.signal > -50 ? 'excellent' : 
                        clientData.signal > -60 ? 'good' : 
                        clientData.signal > -70 ? 'fair' : 'poor',
          ccq: clientData.ccq || 0,
          satisfaction: clientData.satisfaction || 0
        };
      }

      return {
        success: true,
        data: result,
        metadata: {
          executionTime: 0,
          timestamp: new Date()
        }
      };

    } catch (error) {
      logger.error('Failed to retrieve client details', error);
      
      return {
        success: false,
        error: {
          code: error instanceof UniFiMCPError ? error.code : 'CLIENT_DETAILS_ERROR',
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
// Block Client Tool
// ================================

const blockClientTool: MCPTool = {
  name: 'unifi_block_client',
  description: 'Block a client from network access',
  category: ToolCategory.CLIENTS,
  requiresConnection: true,
  inputSchema: {
    type: 'object',
    properties: {
      clientId: {
        type: 'string',
        description: 'Client ID or MAC address to block',
        minLength: 1
      },
      duration: {
        type: 'number',
        description: 'Block duration in minutes (0 for permanent)',
        minimum: 0,
        maximum: 43200, // 30 days
        default: 0
      },
      reason: {
        type: 'string',
        description: 'Reason for blocking',
        maxLength: 255
      }
    },
    required: ['clientId'],
    additionalProperties: false
  },
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const client = params._client as UniFiClient;
      const { clientId, duration = 0, reason } = params;
      
      logger.info('Blocking client', { clientId, duration, reason });

      // Verify client exists first
      const clientResponse = await client.get<Client>(`${UNIFI_ENDPOINTS.CLIENT_DETAILS.replace('{id}', clientId)}`);
      
      if (!clientResponse.data || !Array.isArray(clientResponse.data) || clientResponse.data.length === 0) {
        throw new ResourceNotFoundError('Client', clientId);
      }

      const clientData = clientResponse.data[0];

      // Send block command
      const blockData: any = {
        cmd: 'block-sta',
        mac: clientId
      };

      if (duration > 0) {
        blockData.duration = duration * 60; // Convert to seconds
      }

      const blockResponse = await client.post(UNIFI_ENDPOINTS.CLIENT_BLOCK, blockData);

      if (blockResponse.meta.rc !== 'ok') {
        throw new UniFiMCPError(
          `Client blocking failed: ${blockResponse.meta.msg}`,
          ErrorCode.BLOCK_FAILED
        );
      }

      return {
        success: true,
        data: {
          clientId,
          clientName: clientData.name || clientData.hostname || 'Unknown Client',
          blocked: true,
          duration: duration,
          permanent: duration === 0,
          reason: reason || 'No reason specified',
          blockedAt: new Date(),
          unblockAt: duration > 0 ? new Date(Date.now() + duration * 60 * 1000) : null,
          message: `Client ${clientData.name || clientId} has been blocked`
        },
        warnings: duration === 0 ? [
          'Client is permanently blocked until manually unblocked'
        ] : [
          `Client will be automatically unblocked after ${duration} minutes`
        ],
        metadata: {
          executionTime: 0,
          timestamp: new Date()
        }
      };

    } catch (error) {
      logger.error('Failed to block client', error);
      
      return {
        success: false,
        error: {
          code: error instanceof UniFiMCPError ? error.code : 'CLIENT_BLOCK_ERROR',
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
// Unblock Client Tool
// ================================

const unblockClientTool: MCPTool = {
  name: 'unifi_unblock_client',
  description: 'Unblock a previously blocked client',
  category: ToolCategory.CLIENTS,
  requiresConnection: true,
  inputSchema: {
    type: 'object',
    properties: {
      clientId: {
        type: 'string',
        description: 'Client ID or MAC address to unblock',
        minLength: 1
      }
    },
    required: ['clientId'],
    additionalProperties: false
  },
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const client = params._client as UniFiClient;
      const { clientId } = params;
      
      logger.info('Unblocking client', { clientId });

      // Verify client exists first
      const clientResponse = await client.get<Client>(`${UNIFI_ENDPOINTS.CLIENT_DETAILS.replace('{id}', clientId)}`);
      
      if (!clientResponse.data || !Array.isArray(clientResponse.data) || clientResponse.data.length === 0) {
        throw new ResourceNotFoundError('Client', clientId);
      }

      const clientData = clientResponse.data[0];

      // Send unblock command
      const unblockResponse = await client.post(UNIFI_ENDPOINTS.CLIENT_UNBLOCK, {
        cmd: 'unblock-sta',
        mac: clientId
      });

      if (unblockResponse.meta.rc !== 'ok') {
        throw new UniFiMCPError(
          `Client unblocking failed: ${unblockResponse.meta.msg}`,
          ErrorCode.UNBLOCK_FAILED
        );
      }

      return {
        success: true,
        data: {
          clientId,
          clientName: clientData.name || clientData.hostname || 'Unknown Client',
          blocked: false,
          unblockedAt: new Date(),
          message: `Client ${clientData.name || clientId} has been unblocked`
        },
        metadata: {
          executionTime: 0,
          timestamp: new Date()
        }
      };

    } catch (error) {
      logger.error('Failed to unblock client', error);
      
      return {
        success: false,
        error: {
          code: error instanceof UniFiMCPError ? error.code : 'CLIENT_UNBLOCK_ERROR',
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
// Reconnect Client Tool
// ================================

const reconnectClientTool: MCPTool = {
  name: 'unifi_reconnect_client',
  description: 'Force a client to reconnect (disconnect and allow reconnection)',
  category: ToolCategory.CLIENTS,
  requiresConnection: true,
  inputSchema: {
    type: 'object',
    properties: {
      clientId: {
        type: 'string',
        description: 'Client ID or MAC address to reconnect',
        minLength: 1
      }
    },
    required: ['clientId'],
    additionalProperties: false
  },
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const client = params._client as UniFiClient;
      const { clientId } = params;
      
      logger.info('Forcing client reconnection', { clientId });

      // Verify client exists and is connected
      const clientResponse = await client.get<Client>(`${UNIFI_ENDPOINTS.CLIENT_DETAILS.replace('{id}', clientId)}`);
      
      if (!clientResponse.data || !Array.isArray(clientResponse.data) || clientResponse.data.length === 0) {
        throw new ResourceNotFoundError('Client', clientId);
      }

      const clientData = clientResponse.data[0];

      if (!clientData.connected) {
        return {
          success: true,
          data: {
            clientId,
            clientName: clientData.name || clientData.hostname || 'Unknown Client',
            message: 'Client is already disconnected',
            reconnectionNeeded: false
          },
          metadata: {
            executionTime: 0,
            timestamp: new Date()
          }
        };
      }

      // Send kick command (force disconnect)
      const kickResponse = await client.post(UNIFI_ENDPOINTS.CLIENT_BLOCK, {
        cmd: 'kick-sta',
        mac: clientId
      });

      if (kickResponse.meta.rc !== 'ok') {
        throw new UniFiMCPError(
          `Client kick failed: ${kickResponse.meta.msg}`,
          ErrorCode.KICK_FAILED
        );
      }

      return {
        success: true,
        data: {
          clientId,
          clientName: clientData.name || clientData.hostname || 'Unknown Client',
          kicked: true,
          message: `Client ${clientData.name || clientId} has been kicked and will reconnect automatically`
        },
        warnings: [
          'Client will be temporarily disconnected',
          'Automatic reconnection should occur within seconds'
        ],
        metadata: {
          executionTime: 0,
          timestamp: new Date()
        }
      };

    } catch (error) {
      logger.error('Failed to reconnect client', error);
      
      return {
        success: false,
        error: {
          code: error instanceof UniFiMCPError ? error.code : 'CLIENT_RECONNECT_ERROR',
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

export async function registerClientTools(
  registry: ToolRegistry,
  client: UniFiClient
): Promise<void> {
  // Add client to tools for access
  const enhancedTools = [
    getClientsTool,
    getClientDetailsTool,
    blockClientTool,
    unblockClientTool,
    reconnectClientTool
  ].map(tool => ({
    ...tool,
    handler: async (params: any) => {
      // Inject dependencies
      const enhancedParams = {
        ...params,
        _client: client
      };
      return tool.handler(enhancedParams);
    }
  }));

  // Register all tools
  registry.registerBatch(enhancedTools);

  logger.info('Client management tools registered successfully', {
    count: enhancedTools.length,
    tools: enhancedTools.map(t => t.name)
  });
}

// Export individual tools for testing
export {
  getClientsTool,
  getClientDetailsTool,
  blockClientTool,
  unblockClientTool,
  reconnectClientTool
};