import { MCPTool, ToolCategory, ToolResult, ErrorCode } from '../../server/types.js';
import { ToolRegistry } from '../../server/toolRegistry.js';
import { UniFiClient } from '../../unifi/client.js';
import { Device, DetailedDevice } from '../../unifi/types.js';
import { ValidationService } from '../../utils/validators.js';
import { createToolLogger } from '../../utils/logger.js';
import { UniFiMCPError, ResourceNotFoundError } from '../../utils/errors.js';
import { UNIFI_ENDPOINTS } from '../../config/constants.js';

/**
 * Device Management Tools
 * 
 * Comprehensive tools for managing UniFi devices including gateways,
 * switches, access points, and other network infrastructure.
 */

const logger = createToolLogger('device-tools');

// ================================
// Get Devices Tool
// ================================

const getDevicesTool: MCPTool = {
  name: 'unifi_get_devices',
  description: 'Get list of UniFi devices with optional filtering',
  category: ToolCategory.DEVICES,
  requiresConnection: true,
  inputSchema: {
    type: 'object',
    properties: {
      deviceType: {
        type: 'string',
        enum: ['ugw', 'usw', 'uap', 'protect', 'camera', 'doorbell', 'sensor'],
        description: 'Filter by device type'
      },
      status: {
        type: 'string',
        enum: ['online', 'offline', 'upgrading', 'provisioning', 'adopting'],
        description: 'Filter by device status'
      },
      includeStats: {
        type: 'boolean',
        description: 'Include device statistics',
        default: false
      },
      sortBy: {
        type: 'string',
        enum: ['name', 'type', 'status', 'lastSeen', 'uptime'],
        description: 'Sort devices by field'
      },
      sortOrder: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'Sort order',
        default: 'asc'
      }
    },
    additionalProperties: false
  },
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const client = params._client as UniFiClient;
      const validatedParams = await ValidationService.validateDeviceParams(params);
      
      logger.info('Retrieving UniFi devices', {
        deviceType: validatedParams.deviceType,
        status: validatedParams.status,
        includeStats: (validatedParams as any).includeStats
      });

      // Get devices from UniFi API
      const response = await client.get<Device[]>(UNIFI_ENDPOINTS.DEVICES);
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new UniFiMCPError('Invalid device data received', ErrorCode.INVALID_DATA);
      }

      let devices = response.data as unknown as Device[];

      // Apply filters
      if (validatedParams.deviceType) {
        devices = devices.filter(device => (device as any).type === validatedParams.deviceType);
      }

      if (validatedParams.status) {
        devices = devices.filter(device => (device as any).status === validatedParams.status);
      }

      // Sort devices
      if ((validatedParams as any).sortBy) {
        devices.sort((a, b) => {
          const field = (validatedParams as any).sortBy!;
          const aVal = (a as any)[field];
          const bVal = (b as any)[field];
          
          if (aVal < bVal) return (validatedParams as any).sortOrder === 'desc' ? 1 : -1;
          if (aVal > bVal) return (validatedParams as any).sortOrder === 'desc' ? -1 : 1;
          return 0;
        });
      }

      // Get additional stats if requested
      if ((validatedParams as any).includeStats) {
        for (const device of devices) {
          try {
            const statsResponse = await client.get(`${UNIFI_ENDPOINTS.DEVICE_STATS}/${(device as any).id}`);
            (device as any).stats = statsResponse.data?.[0] || null;
          } catch (error) {
            logger.warn(`Could not fetch stats for device ${(device as any).id}`, error as any);
          }
        }
      }

      const summary = {
        total: devices.length,
        online: devices.filter(d => (d as any).status === 'online').length,
        offline: devices.filter(d => (d as any).status === 'offline').length,
        byType: devices.reduce((acc, device) => {
          acc[(device as any).type] = (acc[(device as any).type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };

      return {
        success: true,
        data: {
          devices,
          summary,
          filters: {
            deviceType: validatedParams.deviceType,
            status: validatedParams.status
          }
        },
        metadata: {
          executionTime: 0,
          timestamp: new Date()
        }
      };

    } catch (error) {
      logger.error('Failed to retrieve devices', error);
      
      return {
        success: false,
        error: {
          code: error instanceof UniFiMCPError ? error.code : 'DEVICE_FETCH_ERROR',
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
// Get Device Details Tool
// ================================

const getDeviceDetailsTool: MCPTool = {
  name: 'unifi_get_device_details',
  description: 'Get detailed information for a specific device',
  category: ToolCategory.DEVICES,
  requiresConnection: true,
  inputSchema: {
    type: 'object',
    properties: {
      deviceId: {
        type: 'string',
        description: 'Device ID or MAC address',
        minLength: 1
      },
      includeStats: {
        type: 'boolean',
        description: 'Include detailed statistics',
        default: true
      },
      includeClients: {
        type: 'boolean', 
        description: 'Include connected clients',
        default: false
      }
    },
    required: ['deviceId'],
    additionalProperties: false
  },
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const client = params._client as UniFiClient;
      const { deviceId, includeStats = true, includeClients = false } = params;
      
      logger.info('Retrieving device details', { deviceId, includeStats, includeClients });

      // Get device details
      const response = await client.get<DetailedDevice>(`${UNIFI_ENDPOINTS.DEVICE_DETAILS.replace('{id}', deviceId)}`);
      
      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        throw new ResourceNotFoundError('Device', deviceId);
      }

      const device = response.data[0];
      const result: any = { device };

      // Get device statistics
      if (includeStats) {
        try {
          const statsResponse = await client.get(`${UNIFI_ENDPOINTS.DEVICE_STATS}/${deviceId}`);
          result.statistics = statsResponse.data?.[0] || null;
        } catch (error) {
          logger.warn('Could not fetch device statistics', error as any);
          result.statistics = null;
        }
      }

      // Get connected clients
      if (includeClients) {
        try {
          const clientsResponse = await client.get(UNIFI_ENDPOINTS.CLIENTS, {
            deviceMac: deviceId
          });
          result.connectedClients = clientsResponse.data || [];
        } catch (error) {
          logger.warn('Could not fetch connected clients', error as any);
          result.connectedClients = [];
        }
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
      logger.error('Failed to retrieve device details', error);
      
      return {
        success: false,
        error: {
          code: error instanceof UniFiMCPError ? error.code : 'DEVICE_DETAILS_ERROR',
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
// Restart Device Tool
// ================================

const restartDeviceTool: MCPTool = {
  name: 'unifi_restart_device',
  description: 'Restart a specific UniFi device',
  category: ToolCategory.DEVICES,
  requiresConnection: true,
  inputSchema: {
    type: 'object',
    properties: {
      deviceId: {
        type: 'string',
        description: 'Device ID or MAC address to restart',
        minLength: 1
      },
      force: {
        type: 'boolean',
        description: 'Force restart even if device is busy',
        default: false
      }
    },
    required: ['deviceId'],
    additionalProperties: false
  },
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const client = params._client as UniFiClient;
      const { deviceId, force = false } = params;
      
      logger.info('Restarting device', { deviceId, force });

      // Verify device exists first
      const deviceResponse = await client.get<Device>(`${UNIFI_ENDPOINTS.DEVICE_DETAILS.replace('{id}', deviceId)}`);
      
      if (!deviceResponse.data || !Array.isArray(deviceResponse.data) || deviceResponse.data.length === 0) {
        throw new ResourceNotFoundError('Device', deviceId);
      }

      const device = deviceResponse.data[0];

      // Send restart command
      const restartResponse = await client.post(UNIFI_ENDPOINTS.DEVICE_RESTART, {
        cmd: 'restart',
        mac: deviceId,
        reboot_type: force ? 'hard' : 'soft'
      });

      if (restartResponse.meta.rc !== 'ok') {
        throw new UniFiMCPError(
          `Device restart failed: ${restartResponse.meta.msg}`,
          ErrorCode.RESTART_FAILED
        );
      }

      return {
        success: true,
        data: {
          deviceId,
          deviceName: device.name,
          deviceType: device.type,
          restartInitiated: true,
          restartType: force ? 'hard' : 'soft',
          message: `Restart command sent to ${device.name || deviceId}`
        },
        warnings: [
          'Device will be temporarily unavailable during restart',
          'Connected clients may experience brief disconnection'
        ],
        metadata: {
          executionTime: 0,
          timestamp: new Date()
        }
      };

    } catch (error) {
      logger.error('Failed to restart device', error);
      
      return {
        success: false,
        error: {
          code: error instanceof UniFiMCPError ? error.code : 'DEVICE_RESTART_ERROR',
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
// Adopt Device Tool
// ================================

const adoptDeviceTool: MCPTool = {
  name: 'unifi_adopt_device',
  description: 'Adopt a pending UniFi device',
  category: ToolCategory.DEVICES,
  requiresConnection: true,
  inputSchema: {
    type: 'object',
    properties: {
      deviceId: {
        type: 'string',
        description: 'Device MAC address to adopt',
        minLength: 1
      },
      deviceName: {
        type: 'string',
        description: 'Custom name for the device',
        maxLength: 50
      }
    },
    required: ['deviceId'],
    additionalProperties: false
  },
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const client = params._client as UniFiClient;
      const { deviceId, deviceName } = params;
      
      logger.info('Adopting device', { deviceId, deviceName });

      // Send adopt command
      const adoptData: any = {
        cmd: 'adopt',
        mac: deviceId
      };

      if (deviceName) {
        adoptData.name = deviceName;
      }

      const adoptResponse = await client.post(UNIFI_ENDPOINTS.DEVICE_ADOPT, adoptData);

      if (adoptResponse.meta.rc !== 'ok') {
        throw new UniFiMCPError(
          `Device adoption failed: ${adoptResponse.meta.msg}`,
          ErrorCode.ADOPTION_FAILED
        );
      }

      return {
        success: true,
        data: {
          deviceId,
          deviceName: deviceName || 'Unnamed Device',
          adoptionInitiated: true,
          message: `Adoption command sent for device ${deviceId}`
        },
        warnings: [
          'Device adoption may take several minutes to complete',
          'Device will automatically download latest firmware if needed'
        ],
        metadata: {
          executionTime: 0,
          timestamp: new Date()
        }
      };

    } catch (error) {
      logger.error('Failed to adopt device', error);
      
      return {
        success: false,
        error: {
          code: error instanceof UniFiMCPError ? error.code : 'DEVICE_ADOPTION_ERROR',
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
// Upgrade Device Tool
// ================================

const upgradeDeviceTool: MCPTool = {
  name: 'unifi_upgrade_device',
  description: 'Upgrade firmware on a UniFi device',
  category: ToolCategory.DEVICES,
  requiresConnection: true,
  inputSchema: {
    type: 'object',
    properties: {
      deviceId: {
        type: 'string',
        description: 'Device ID or MAC address to upgrade',
        minLength: 1
      },
      firmwareUrl: {
        type: 'string',
        description: 'Custom firmware URL (optional)',
        format: 'uri'
      }
    },
    required: ['deviceId'],
    additionalProperties: false
  },
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const client = params._client as UniFiClient;
      const { deviceId, firmwareUrl } = params;
      
      logger.info('Upgrading device firmware', { deviceId, customFirmware: !!firmwareUrl });

      // Verify device exists and get current firmware info
      const deviceResponse = await client.get<Device>(`${UNIFI_ENDPOINTS.DEVICE_DETAILS.replace('{id}', deviceId)}`);
      
      if (!deviceResponse.data || !Array.isArray(deviceResponse.data) || deviceResponse.data.length === 0) {
        throw new ResourceNotFoundError('Device', deviceId);
      }

      const device = deviceResponse.data[0];

      // Send upgrade command
      const upgradeData: any = {
        cmd: 'upgrade',
        mac: deviceId
      };

      if (firmwareUrl) {
        upgradeData.url = firmwareUrl;
      }

      const upgradeResponse = await client.post(UNIFI_ENDPOINTS.DEVICE_UPGRADE, upgradeData);

      if (upgradeResponse.meta.rc !== 'ok') {
        throw new UniFiMCPError(
          `Device upgrade failed: ${upgradeResponse.meta.msg}`,
          ErrorCode.UPGRADE_FAILED
        );
      }

      return {
        success: true,
        data: {
          deviceId,
          deviceName: device.name,
          deviceType: device.type,
          currentVersion: device.version,
          upgradeInitiated: true,
          customFirmware: !!firmwareUrl,
          message: `Firmware upgrade initiated for ${device.name || deviceId}`
        },
        warnings: [
          'Device will be unavailable during firmware upgrade',
          'Upgrade process may take 10-30 minutes depending on device',
          'Do not power off device during upgrade process',
          'Connected clients will be disconnected temporarily'
        ],
        metadata: {
          executionTime: 0,
          timestamp: new Date()
        }
      };

    } catch (error) {
      logger.error('Failed to upgrade device', error);
      
      return {
        success: false,
        error: {
          code: error instanceof UniFiMCPError ? error.code : 'DEVICE_UPGRADE_ERROR',
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

export async function registerDeviceTools(
  registry: ToolRegistry,
  client: UniFiClient
): Promise<void> {
  // Add client to tools for access
  const enhancedTools = [
    getDevicesTool,
    getDeviceDetailsTool,
    restartDeviceTool,
    adoptDeviceTool,
    upgradeDeviceTool
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

  logger.info('Device management tools registered successfully', {
    count: enhancedTools.length,
    tools: enhancedTools.map(t => t.name)
  });
}

// Export individual tools for testing
export {
  getDevicesTool,
  getDeviceDetailsTool,
  restartDeviceTool,
  adoptDeviceTool,
  upgradeDeviceTool
};