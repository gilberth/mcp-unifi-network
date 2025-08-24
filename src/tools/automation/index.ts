import { MCPTool, ToolCategory, ToolResult } from '../../server/types.js';
import { ToolRegistry } from '../../server/toolRegistry.js';
import { UniFiClient } from '../../unifi/client.js';
import { createToolLogger } from '../../utils/logger.js';

/**
 * Automation Tools (Stub Implementation)
 * 
 * Tools for automation and scheduling
 */

const logger = createToolLogger('automation-tools');

// Placeholder tool
const scheduleDeviceBlockTool: MCPTool = {
  name: 'unifi_schedule_device_block',
  description: 'Schedule device blocking',
  category: ToolCategory.AUTOMATION,
  requiresConnection: true,
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  handler: async (_params: any): Promise<ToolResult> => {
    return {
      success: true,
      data: { message: 'Automation tools not yet implemented' },
      metadata: { executionTime: 0, timestamp: new Date() }
    };
  }
};

export async function registerAutomationTools(
  registry: ToolRegistry,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  _client: UniFiClient
): Promise<void> {
  registry.register(scheduleDeviceBlockTool);
  logger.info('Automation tools registered (stub implementation)');
}