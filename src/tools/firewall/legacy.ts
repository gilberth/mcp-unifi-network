import { MCPTool, ToolCategory, ToolResult, ErrorCode } from '../../server/types.js';
import { ToolRegistry } from '../../server/toolRegistry.js';
import { UniFiClient } from '../../unifi/client.js';
import { VersionDetector } from '../../unifi/versionDetector.js';
import { FirewallRule } from '../../unifi/types.js';
import { CreateFirewallRuleParamsSchema } from '../../utils/validators.js';
import { createToolLogger } from '../../utils/logger.js';
import { UniFiMCPError, ResourceNotFoundError } from '../../utils/errors.js';
import { UNIFI_ENDPOINTS } from '../../config/constants.js';

/**
 * Legacy Firewall Management Tools
 * 
 * Tools for managing traditional firewall rules (pre-UniFi 9.0).
 * These tools work with the classic firewall rule system that was
 * deprecated in favor of Zone-Based Firewall in UniFi 9.0+.
 */

const logger = createToolLogger('legacy-firewall-tools');

// ================================
// Get Firewall Rules Tool
// ================================

const getFirewallRulesTool: MCPTool = {
  name: 'unifi_get_firewall_rules',
  description: 'Get list of legacy firewall rules (pre-9.0)',
  category: ToolCategory.FIREWALL_LEGACY,
  requiresConnection: true,
  inputSchema: {
    type: 'object',
    properties: {
      enabled: {
        type: 'boolean',
        description: 'Filter by enabled status'
      },
      ruleSet: {
        type: 'string',
        enum: ['WAN_IN', 'WAN_OUT', 'WAN_LOCAL', 'LAN_IN', 'LAN_OUT', 'LAN_LOCAL', 'GUEST_IN', 'GUEST_OUT', 'GUEST_LOCAL'],
        description: 'Filter by rule set'
      },
      action: {
        type: 'string',
        enum: ['allow', 'deny', 'reject', 'drop'],
        description: 'Filter by action'
      },
      sortBy: {
        type: 'string',
        enum: ['name', 'priority', 'action', 'protocol'],
        description: 'Sort rules by field',
        default: 'priority'
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
      const versionDetector = params._versionDetector as VersionDetector;
      
      // Check if legacy firewall is supported
      await versionDetector.validateFeature('legacy-firewall');
      
      logger.info('Retrieving legacy firewall rules', {
        enabled: params.enabled,
        ruleSet: params.ruleSet,
        action: params.action
      });

      // Get firewall rules from UniFi API
      const response = await client.get<FirewallRule[]>(UNIFI_ENDPOINTS.FIREWALL_RULES);
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new UniFiMCPError('Invalid firewall rule data received', ErrorCode.INVALID_DATA);
      }

      let rules = response.data as unknown as FirewallRule[];

      // Apply filters
      if (params.enabled !== undefined) {
        rules = rules.filter(rule => (rule as any).enabled === params.enabled);
      }

      if (params.ruleSet) {
        rules = rules.filter(rule => (rule as any).ruleset === params.ruleSet);
      }

      if (params.action) {
        rules = rules.filter(rule => (rule as any).action === params.action);
      }

      // Sort rules
      if (params.sortBy) {
        rules.sort((a, b) => {
          const field = params.sortBy;
          const aVal = (a as any)[field];
          const bVal = (b as any)[field];
          
          if (aVal < bVal) return params.sortOrder === 'desc' ? 1 : -1;
          if (aVal > bVal) return params.sortOrder === 'desc' ? -1 : 1;
          return 0;
        });
      }

      const summary = {
        total: rules.length,
        enabled: rules.filter(r => (r as any).enabled).length,
        disabled: rules.filter(r => !(r as any).enabled).length,
        byAction: rules.reduce((acc, rule) => {
          acc[(rule as any).action] = (acc[(rule as any).action] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byProtocol: rules.reduce((acc, rule) => {
          acc[(rule as any).protocol] = (acc[(rule as any).protocol] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };

      return {
        success: true,
        data: {
          rules,
          summary,
          filters: {
            enabled: params.enabled,
            ruleSet: params.ruleSet,
            action: params.action
          }
        },
        warnings: [
          'Legacy firewall rules are deprecated in UniFi 9.0+',
          'Consider migrating to Zone-Based Firewall for enhanced security'
        ],
        metadata: {
          executionTime: 0,
          timestamp: new Date()
        }
      };

    } catch (error) {
      logger.error('Failed to retrieve firewall rules', error);
      
      return {
        success: false,
        error: {
          code: error instanceof UniFiMCPError ? error.code : 'FIREWALL_RULES_ERROR',
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
// Create Firewall Rule Tool
// ================================

const createFirewallRuleTool: MCPTool = {
  name: 'unifi_create_firewall_rule',
  description: 'Create a new legacy firewall rule',
  category: ToolCategory.FIREWALL_LEGACY,
  requiresConnection: true,
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Rule name',
        minLength: 1,
        maxLength: 100
      },
      enabled: {
        type: 'boolean',
        description: 'Enable the rule',
        default: true
      },
      action: {
        type: 'string',
        enum: ['allow', 'deny', 'reject'],
        description: 'Action to take when rule matches'
      },
      protocol: {
        type: 'string',
        enum: ['tcp', 'udp', 'icmp', 'any'],
        description: 'Protocol to match'
      },
      source: {
        type: 'string',
        description: 'Source IP/CIDR or "any"',
        minLength: 1
      },
      destination: {
        type: 'string',
        description: 'Destination IP/CIDR or "any"',
        minLength: 1
      },
      sourcePort: {
        type: 'string',
        description: 'Source port(s) or range (e.g., "80", "80-443")',
        pattern: '^(\\d+(-\\d+)?|any)$'
      },
      destinationPort: {
        type: 'string',
        description: 'Destination port(s) or range (e.g., "80", "80-443")',
        pattern: '^(\\d+(-\\d+)?|any)$'
      },
      priority: {
        type: 'number',
        description: 'Rule priority (lower numbers = higher priority)',
        minimum: 1,
        maximum: 9999,
        default: 2000
      },
      logging: {
        type: 'boolean',
        description: 'Enable logging for this rule',
        default: false
      },
      ruleSet: {
        type: 'string',
        enum: ['WAN_IN', 'WAN_OUT', 'WAN_LOCAL', 'LAN_IN', 'LAN_OUT', 'LAN_LOCAL', 'GUEST_IN', 'GUEST_OUT', 'GUEST_LOCAL'],
        description: 'Rule set to apply this rule to',
        default: 'LAN_IN'
      },
      description: {
        type: 'string',
        description: 'Rule description',
        maxLength: 255
      }
    },
    required: ['name', 'action', 'protocol', 'source', 'destination'],
    additionalProperties: false
  },
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const client = params._client as UniFiClient;
      const versionDetector = params._versionDetector as VersionDetector;
      
      // Check if legacy firewall is supported
      await versionDetector.validateFeature('legacy-firewall');
      
      // Validate parameters using Zod schema directly
      const validatedParams = await CreateFirewallRuleParamsSchema.parseAsync(params);
      
      logger.info('Creating legacy firewall rule', {
        name: validatedParams.name,
        action: validatedParams.action,
        protocol: validatedParams.protocol
      });

      // Prepare rule data for UniFi API
      const ruleData: any = {
        name: validatedParams.name,
        enabled: validatedParams.enabled,
        action: validatedParams.action,
        protocol_match_excepted: false,
        logging: validatedParams.logging,
        state_established: true,
        state_invalid: false,
        state_new: true,
        state_related: true,
        rule_index: validatedParams.priority,
        ruleset: params.ruleSet || 'LAN_IN',
        src_firewallgroup_ids: [],
        dst_firewallgroup_ids: [],
        src_mac_address: '',
        protocol: validatedParams.protocol === 'any' ? 'all' : validatedParams.protocol,
        icmp_typename: '',
        src_address: validatedParams.source,
        src_port: validatedParams.sourcePort || '',
        dst_address: validatedParams.destination,
        dst_port: validatedParams.destinationPort || '',
        ipsec: ''
      };

      if (params.description) {
        ruleData.description = params.description;
      }

      // Create the firewall rule
      const response = await client.post<FirewallRule>(UNIFI_ENDPOINTS.FIREWALL_RULES, ruleData);
      
      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        throw new UniFiMCPError('Failed to create firewall rule', ErrorCode.RULE_CREATION_FAILED);
      }

      const createdRule = response.data[0];

      return {
        success: true,
        data: {
          rule: createdRule,
          ruleId: createdRule.id,
          message: `Firewall rule '${validatedParams.name}' created successfully`
        },
        warnings: [
          'Legacy firewall rules are deprecated in UniFi 9.0+',
          'Rule changes may take a few moments to take effect',
          'Consider using Zone-Based Firewall for new deployments'
        ],
        metadata: {
          executionTime: 0,
          timestamp: new Date()
        }
      };

    } catch (error) {
      logger.error('Failed to create firewall rule', error);
      
      return {
        success: false,
        error: {
          code: error instanceof UniFiMCPError ? error.code : 'FIREWALL_RULE_CREATE_ERROR',
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
// Update Firewall Rule Tool
// ================================

const updateFirewallRuleTool: MCPTool = {
  name: 'unifi_update_firewall_rule',
  description: 'Update an existing legacy firewall rule',
  category: ToolCategory.FIREWALL_LEGACY,
  requiresConnection: true,
  inputSchema: {
    type: 'object',
    properties: {
      ruleId: {
        type: 'string',
        description: 'Rule ID to update',
        minLength: 1
      },
      name: {
        type: 'string',
        description: 'New rule name',
        minLength: 1,
        maxLength: 100
      },
      enabled: {
        type: 'boolean',
        description: 'Enable/disable the rule'
      },
      action: {
        type: 'string',
        enum: ['allow', 'deny', 'reject'],
        description: 'Action to take when rule matches'
      },
      protocol: {
        type: 'string',
        enum: ['tcp', 'udp', 'icmp', 'any'],
        description: 'Protocol to match'
      },
      source: {
        type: 'string',
        description: 'Source IP/CIDR or "any"'
      },
      destination: {
        type: 'string',
        description: 'Destination IP/CIDR or "any"'
      },
      sourcePort: {
        type: 'string',
        description: 'Source port(s) or range'
      },
      destinationPort: {
        type: 'string',
        description: 'Destination port(s) or range'
      },
      priority: {
        type: 'number',
        description: 'Rule priority',
        minimum: 1,
        maximum: 9999
      },
      logging: {
        type: 'boolean',
        description: 'Enable logging for this rule'
      },
      description: {
        type: 'string',
        description: 'Rule description',
        maxLength: 255
      }
    },
    required: ['ruleId'],
    additionalProperties: false
  },
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const client = params._client as UniFiClient;
      const versionDetector = params._versionDetector as VersionDetector;
      const { ruleId, ...updates } = params;
      
      // Check if legacy firewall is supported
      await versionDetector.validateFeature('legacy-firewall');
      
      logger.info('Updating legacy firewall rule', { ruleId, updates: Object.keys(updates) });

      // Get existing rule first
      const existingResponse = await client.get<FirewallRule>(`${UNIFI_ENDPOINTS.FIREWALL_RULE_DETAILS.replace('{id}', ruleId)}`);
      
      if (!existingResponse.data || !Array.isArray(existingResponse.data) || existingResponse.data.length === 0) {
        throw new ResourceNotFoundError('Firewall Rule', ruleId);
      }

      const existingRule = existingResponse.data[0] as any;

      // Prepare updated rule data
      const updatedRuleData = { ...existingRule };
      
      if (updates.name !== undefined) updatedRuleData.name = updates.name;
      if (updates.enabled !== undefined) updatedRuleData.enabled = updates.enabled;
      if (updates.action !== undefined) updatedRuleData.action = updates.action;
      if (updates.protocol !== undefined) {
        updatedRuleData.protocol = updates.protocol === 'any' ? 'all' : updates.protocol;
      }
      if (updates.source !== undefined) updatedRuleData.src_address = updates.source;
      if (updates.destination !== undefined) updatedRuleData.dst_address = updates.destination;
      if (updates.sourcePort !== undefined) updatedRuleData.src_port = updates.sourcePort;
      if (updates.destinationPort !== undefined) updatedRuleData.dst_port = updates.destinationPort;
      if (updates.priority !== undefined) updatedRuleData.rule_index = updates.priority;
      if (updates.logging !== undefined) updatedRuleData.logging = updates.logging;
      if (updates.description !== undefined) updatedRuleData.description = updates.description;

      // Update the firewall rule
      const response = await client.put<FirewallRule>(
        `${UNIFI_ENDPOINTS.FIREWALL_RULE_DETAILS.replace('{id}', ruleId)}`,
        updatedRuleData
      );
      
      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        throw new UniFiMCPError('Failed to update firewall rule', ErrorCode.RULE_UPDATE_FAILED);
      }

      const updatedRule = response.data[0];

      return {
        success: true,
        data: {
          rule: updatedRule,
          ruleId: updatedRule.id,
          updatedFields: Object.keys(updates),
          message: `Firewall rule '${updatedRule.name}' updated successfully`
        },
        warnings: [
          'Rule changes may take a few moments to take effect'
        ],
        metadata: {
          executionTime: 0,
          timestamp: new Date()
        }
      };

    } catch (error) {
      logger.error('Failed to update firewall rule', error);
      
      return {
        success: false,
        error: {
          code: error instanceof UniFiMCPError ? error.code : 'FIREWALL_RULE_UPDATE_ERROR',
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
// Delete Firewall Rule Tool
// ================================

const deleteFirewallRuleTool: MCPTool = {
  name: 'unifi_delete_firewall_rule',
  description: 'Delete a legacy firewall rule',
  category: ToolCategory.FIREWALL_LEGACY,
  requiresConnection: true,
  inputSchema: {
    type: 'object',
    properties: {
      ruleId: {
        type: 'string',
        description: 'Rule ID to delete',
        minLength: 1
      },
      force: {
        type: 'boolean',
        description: 'Force deletion without confirmation',
        default: false
      }
    },
    required: ['ruleId'],
    additionalProperties: false
  },
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const client = params._client as UniFiClient;
      const versionDetector = params._versionDetector as VersionDetector;
      const { ruleId, force = false } = params;
      
      // Check if legacy firewall is supported
      await versionDetector.validateFeature('legacy-firewall');
      
      logger.info('Deleting legacy firewall rule', { ruleId, force });

      // Get existing rule first for confirmation
      const existingResponse = await client.get<FirewallRule>(`${UNIFI_ENDPOINTS.FIREWALL_RULE_DETAILS.replace('{id}', ruleId)}`);
      
      if (!existingResponse.data || !Array.isArray(existingResponse.data) || existingResponse.data.length === 0) {
        throw new ResourceNotFoundError('Firewall Rule', ruleId);
      }

      const existingRule = existingResponse.data[0];

      // Delete the firewall rule
      const response = await client.delete(`${UNIFI_ENDPOINTS.FIREWALL_RULE_DETAILS.replace('{id}', ruleId)}`);
      
      if (response.meta.rc !== 'ok') {
        throw new UniFiMCPError(
          `Failed to delete firewall rule: ${response.meta.msg}`,
          ErrorCode.RULE_DELETION_FAILED
        );
      }

      return {
        success: true,
        data: {
          deletedRule: {
            id: existingRule.id,
            name: existingRule.name,
            action: existingRule.action,
            protocol: existingRule.protocol
          },
          message: `Firewall rule '${existingRule.name}' deleted successfully`
        },
        warnings: [
          'Rule deletion is permanent and cannot be undone',
          'Changes may take a few moments to take effect'
        ],
        metadata: {
          executionTime: 0,
          timestamp: new Date()
        }
      };

    } catch (error) {
      logger.error('Failed to delete firewall rule', error);
      
      return {
        success: false,
        error: {
          code: error instanceof UniFiMCPError ? error.code : 'FIREWALL_RULE_DELETE_ERROR',
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
// Toggle Firewall Rule Tool
// ================================

const toggleFirewallRuleTool: MCPTool = {
  name: 'unifi_toggle_firewall_rule',
  description: 'Enable or disable a legacy firewall rule',
  category: ToolCategory.FIREWALL_LEGACY,
  requiresConnection: true,
  inputSchema: {
    type: 'object',
    properties: {
      ruleId: {
        type: 'string',
        description: 'Rule ID to toggle',
        minLength: 1
      },
      enabled: {
        type: 'boolean',
        description: 'Enable (true) or disable (false) the rule'
      }
    },
    required: ['ruleId', 'enabled'],
    additionalProperties: false
  },
  handler: async (params: any): Promise<ToolResult> => {
    try {
      const client = params._client as UniFiClient;
      const versionDetector = params._versionDetector as VersionDetector;
      const { ruleId, enabled } = params;
      
      // Check if legacy firewall is supported
      await versionDetector.validateFeature('legacy-firewall');
      
      logger.info('Toggling legacy firewall rule', { ruleId, enabled });

      // Get existing rule first
      const existingResponse = await client.get<FirewallRule>(`${UNIFI_ENDPOINTS.FIREWALL_RULE_DETAILS.replace('{id}', ruleId)}`);
      
      if (!existingResponse.data || !Array.isArray(existingResponse.data) || existingResponse.data.length === 0) {
        throw new ResourceNotFoundError('Firewall Rule', ruleId);
      }

      const existingRule = existingResponse.data[0] as any;

      // Update only the enabled status
      const updatedRuleData = { ...existingRule, enabled };

      // Update the firewall rule
      const response = await client.put<FirewallRule>(
        `${UNIFI_ENDPOINTS.FIREWALL_RULE_DETAILS.replace('{id}', ruleId)}`,
        updatedRuleData
      );
      
      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        throw new UniFiMCPError('Failed to toggle firewall rule', ErrorCode.RULE_TOGGLE_FAILED);
      }

      const updatedRule = response.data[0];

      return {
        success: true,
        data: {
          rule: {
            id: updatedRule.id,
            name: updatedRule.name,
            enabled: updatedRule.enabled,
            action: updatedRule.action,
            protocol: updatedRule.protocol
          },
          previousState: existingRule.enabled,
          newState: enabled,
          message: `Firewall rule '${updatedRule.name}' ${enabled ? 'enabled' : 'disabled'} successfully`
        },
        metadata: {
          executionTime: 0,
          timestamp: new Date()
        }
      };

    } catch (error) {
      logger.error('Failed to toggle firewall rule', error);
      
      return {
        success: false,
        error: {
          code: error instanceof UniFiMCPError ? error.code : 'FIREWALL_RULE_TOGGLE_ERROR',
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

export async function registerLegacyFirewallTools(
  registry: ToolRegistry,
  client: UniFiClient,
  versionDetector: VersionDetector
): Promise<void> {
  // Add client and version detector to tools for access
  const enhancedTools = [
    getFirewallRulesTool,
    createFirewallRuleTool,
    updateFirewallRuleTool,
    deleteFirewallRuleTool,
    toggleFirewallRuleTool
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

  logger.info('Legacy firewall tools registered successfully', {
    count: enhancedTools.length,
    tools: enhancedTools.map(t => t.name)
  });
}

// Export individual tools for testing
export {
  getFirewallRulesTool,
  createFirewallRuleTool,
  updateFirewallRuleTool,
  deleteFirewallRuleTool,
  toggleFirewallRuleTool
};