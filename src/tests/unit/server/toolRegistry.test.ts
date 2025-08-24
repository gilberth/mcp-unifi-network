import { jest } from '@jest/globals';
import { ToolRegistry } from '../../../server/toolRegistry.js';
import { MCPTool, ToolCategory } from '../../../server/types.js';

// Mock dependencies
const mockUniFiClient = {
  isConnected: jest.fn(() => true),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
} as any;

const mockVersionDetector = {
  validateFeature: jest.fn(),
  getToolAvailability: jest.fn(() => Promise.resolve({}))
} as any;

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let mockTool: MCPTool;

  beforeEach(() => {
    registry = new ToolRegistry(mockUniFiClient, mockVersionDetector);
    mockTool = {
      name: 'test_tool',
      description: 'Test tool for unit testing',
      category: ToolCategory.CONNECTION,
      requiresConnection: false,
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      handler: jest.fn(() => Promise.resolve({
        success: true,
        data: { message: 'Test successful' },
        metadata: { executionTime: 0, timestamp: new Date() }
      }))
    };
    jest.clearAllMocks();
  });

  describe('Tool Registration', () => {
    it('should register a tool successfully', () => {
      registry.register(mockTool);
      
      const registeredTool = registry.getTool('test_tool');
      expect(registeredTool).toBeDefined();
      expect(registeredTool?.name).toBe('test_tool');
    });

    it('should register multiple tools', () => {
      const tool2: MCPTool = {
        ...mockTool,
        name: 'test_tool_2'
      };

      registry.registerBatch([mockTool, tool2]);
      
      expect(registry.getTool('test_tool')).toBeDefined();
      expect(registry.getTool('test_tool_2')).toBeDefined();
    });

    it('should handle duplicate registration', () => {
      registry.register(mockTool);
      registry.register(mockTool); // Register again
      
      const tools = registry.getAllTools();
      expect(tools.filter(t => t.name === 'test_tool')).toHaveLength(1);
    });
  });

  describe('Tool Discovery', () => {
    beforeEach(() => {
      registry.register(mockTool);
    });

    it('should get all tools', () => {
      const tools = registry.getAllTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test_tool');
    });

    it('should get tools by category', () => {
      const connectionTools = registry.getToolsByCategory(ToolCategory.CONNECTION);
      expect(connectionTools).toHaveLength(1);
      expect(connectionTools[0].name).toBe('test_tool');

      const deviceTools = registry.getToolsByCategory(ToolCategory.DEVICES);
      expect(deviceTools).toHaveLength(0);
    });

    it('should get tool by name', () => {
      const tool = registry.getTool('test_tool');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('test_tool');

      const nonExistentTool = registry.getTool('non_existent');
      expect(nonExistentTool).toBeUndefined();
    });
  });

  describe('Tool Management', () => {
    beforeEach(() => {
      registry.register(mockTool);
    });

    it('should enable/disable tools', () => {
      expect(registry.setToolEnabled('test_tool', false)).toBe(true);
      expect(registry.getTool('test_tool')).toBeUndefined(); // Disabled tools are not returned

      expect(registry.setToolEnabled('test_tool', true)).toBe(true);
      expect(registry.getTool('test_tool')).toBeDefined();
    });

    it('should handle enabling non-existent tool', () => {
      expect(registry.setToolEnabled('non_existent', true)).toBe(false);
    });

    it('should unregister tools', () => {
      expect(registry.unregister('test_tool')).toBe(true);
      expect(registry.getTool('test_tool')).toBeUndefined();

      expect(registry.unregister('non_existent')).toBe(false);
    });
  });

  describe('Tool Execution', () => {
    beforeEach(() => {
      registry.register(mockTool);
    });

    it('should execute tool successfully', async () => {
      const result = await registry.executeTool('test_tool', {});
      
      expect(result.success).toBe(true);
      expect(result.data?.message).toBe('Test successful');
      expect(mockTool.handler).toHaveBeenCalled();
    });

    it('should handle non-existent tool execution', async () => {
      const result = await registry.executeTool('non_existent', {});
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TOOL_NOT_FOUND');
    });

    it('should handle disabled tool execution', async () => {
      registry.setToolEnabled('test_tool', false);
      
      const result = await registry.executeTool('test_tool', {});
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TOOL_DISABLED');
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      registry.register(mockTool);
    });

    it('should provide registry statistics', () => {
      const stats = registry.getRegistryStats();
      
      expect(stats.totalTools).toBe(1);
      expect(stats.enabledTools).toBe(1);
      expect(stats.disabledTools).toBe(0);
      expect(stats.categoryCounts[ToolCategory.CONNECTION]).toBe(1);
    });

    it('should track tool usage', async () => {
      await registry.executeTool('test_tool', {});
      
      const toolStats = registry.getToolStats('test_tool');
      expect(toolStats?.usageCount).toBe(1);
      expect(toolStats?.lastUsed).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup registry', () => {
      registry.register(mockTool);
      expect(registry.getAllTools()).toHaveLength(1);
      
      registry.cleanup();
      expect(registry.getAllTools()).toHaveLength(0);
    });
  });
});