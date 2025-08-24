import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { 
  MCPTool, 
  ToolCategory, 
  ToolResult, 
  ToolRegistryEntry,
  ErrorCode
} from './types.js';
import { UniFiClient } from '../unifi/client.js';
import { VersionDetector } from '../unifi/versionDetector.js';
import { createComponentLogger } from '../utils/logger.js';
import { UniFiMCPError } from '../utils/errors.js';

/**
 * Tool Registry System
 * 
 * Manages registration, discovery, and execution of MCP tools.
 * Handles tool categorization, dependency management, and feature availability.
 */

export class ToolRegistry {
  private tools: Map<string, ToolRegistryEntry> = new Map();
  private categories: Map<ToolCategory, string[]> = new Map();
  private dependencies: Map<string, string[]> = new Map();
  private logger = createComponentLogger('tool-registry');
  private unifiClient: UniFiClient;
  private versionDetector: VersionDetector;

  constructor(unifiClient: UniFiClient, versionDetector: VersionDetector) {
    this.unifiClient = unifiClient;
    this.versionDetector = versionDetector;
    this.initializeCategories();
  }

  // ================================
  // Tool Registration
  // ================================

  /**
   * Register a new tool
   */
  register(tool: MCPTool): void {
    const existing = this.tools.get(tool.name);
    if (existing) {
      this.logger.warn(`Tool '${tool.name}' already registered, replacing`, {
        previousVersion: existing.registered,
        category: tool.category
      });
    }

    const entry: ToolRegistryEntry = {
      tool,
      registered: new Date(),
      enabled: true,
      usageCount: 0,
      averageExecutionTime: 0,
      errorCount: 0,
      dependencies: this.extractDependencies(tool)
    };

    this.tools.set(tool.name, entry);
    this.addToCategory(tool.category, tool.name);
    this.updateDependencies(tool.name, entry.dependencies);

    this.logger.info(`Tool '${tool.name}' registered successfully`, {
      category: tool.category,
      requiresConnection: tool.requiresConnection,
      dependencies: entry.dependencies
    });
  }

  /**
   * Register multiple tools at once
   */
  registerBatch(tools: MCPTool[]): void {
    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;

    for (const tool of tools) {
      try {
        this.register(tool);
        successCount++;
      } catch (error) {
        errorCount++;
        this.logger.error(`Failed to register tool '${tool.name}'`, error);
      }
    }

    const duration = Date.now() - startTime;
    this.logger.info('Batch tool registration completed', {
      total: tools.length,
      successful: successCount,
      failed: errorCount,
      duration: `${duration}ms`
    });
  }

  /**
   * Unregister a tool
   */
  unregister(toolName: string): boolean {
    const entry = this.tools.get(toolName);
    if (!entry) {
      return false;
    }

    // Remove from category
    this.removeFromCategory(entry.tool.category, toolName);
    
    // Remove dependencies
    this.dependencies.delete(toolName);
    
    // Remove the tool
    this.tools.delete(toolName);

    this.logger.info(`Tool '${toolName}' unregistered`);
    return true;
  }

  // ================================
  // Tool Discovery and Access
  // ================================

  /**
   * Get all registered tools
   */
  getAllTools(): MCPTool[] {
    return Array.from(this.tools.values())
      .filter(entry => entry.enabled)
      .map(entry => entry.tool);
  }

  /**
   * Get all registered tools (including disabled ones) for documentation
   */
  getAllToolsForDocumentation(): MCPTool[] {
    return Array.from(this.tools.values())
      .map(entry => entry.tool);
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: ToolCategory): MCPTool[] {
    const toolNames = this.categories.get(category) || [];
    return toolNames
      .map(name => this.tools.get(name))
      .filter((entry): entry is ToolRegistryEntry => entry !== undefined && entry.enabled)
      .map(entry => entry.tool);
  }

  /**
   * Get tool by name
   */
  getTool(name: string): MCPTool | undefined {
    const entry = this.tools.get(name);
    return entry?.enabled ? entry.tool : undefined;
  }

  /**
   * Get available tools based on current UniFi capabilities
   */
  async getAvailableTools(): Promise<MCPTool[]> {
    try {
      const toolAvailability = await this.versionDetector.getToolAvailability();
      const availableTools: MCPTool[] = [];

      for (const [toolName, entry] of this.tools) {
        if (!entry.enabled) continue;

        const availability = toolAvailability[toolName];
        if (availability?.available) {
          availableTools.push(entry.tool);
        } else {
          this.logger.debug(`Tool '${toolName}' not available`, {
            reason: availability?.reason,
            alternativeTool: availability?.alternativeTool
          });
        }
      }

      return availableTools;
    } catch (error) {
      this.logger.error('Failed to get available tools', error);
      return this.getAllTools(); // Fallback to all tools
    }
  }

  /**
   * Get tools for MCP server (filtered and formatted)
   */
  async getToolsForMCP(): Promise<Tool[]> {
    let toolsToReturn: MCPTool[];
    
    // If not connected to UniFi, return all registered tools for documentation
    if (!this.unifiClient.isConnected()) {
      this.logger.debug('UniFi not connected, returning all registered tools for documentation');
      toolsToReturn = this.getAllToolsForDocumentation();
    } else {
      // If connected, return only available tools based on capabilities
      toolsToReturn = await this.getAvailableTools();
    }
    
    return toolsToReturn.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  }

  // ================================
  // Tool Execution
  // ================================

  /**
   * Execute a tool by name
   */
  async executeTool(toolName: string, params: Record<string, any>): Promise<ToolResult> {
    const entry = this.tools.get(toolName);
    if (!entry) {
      throw new UniFiMCPError(
        `Tool '${toolName}' not found`,
        ErrorCode.TOOL_NOT_FOUND,
        404
      );
    }

    if (!entry.enabled) {
      throw new UniFiMCPError(
        `Tool '${toolName}' is disabled`,
        ErrorCode.TOOL_DISABLED,
        403
      );
    }

    // Check if tool requires connection
    if (entry.tool.requiresConnection && !this.unifiClient.isConnected()) {
      throw new UniFiMCPError(
        `Tool '${toolName}' requires an active UniFi connection`,
        ErrorCode.CONNECTION_REQUIRED,
        412
      );
    }

    // Check feature availability
    if (entry.tool.requiresVersion) {
      try {
        await this.versionDetector.validateFeature(this.getCategoryFeature(entry.tool.category));
      } catch (error) {
        throw new UniFiMCPError(
          `Tool '${toolName}' requires features not available in current UniFi version`,
          ErrorCode.FEATURE_NOT_AVAILABLE,
          501,
          { originalError: (error as Error).message }
        );
      }
    }

    const startTime = Date.now();
    let success = false;
    let result: ToolResult;

    try {
      // Validate dependencies
      await this.validateDependencies(toolName);

      // Execute the tool
      result = await entry.tool.handler(params);
      success = result.success;

      // Update usage statistics
      this.updateUsageStats(toolName, Date.now() - startTime, success);

      this.logger.toolExecution(toolName, Date.now() - startTime, success, {
        category: entry.tool.category,
        hasWarnings: result.warnings && result.warnings.length > 0
      });

      return result;

    } catch (error) {
      // Update error statistics
      entry.errorCount++;
      this.updateUsageStats(toolName, Date.now() - startTime, false);

      this.logger.toolExecution(toolName, Date.now() - startTime, false, {
        category: entry.tool.category,
        error: (error as Error).message
      });

      // Return structured error result
      return {
        success: false,
        error: {
          code: error instanceof UniFiMCPError ? error.code : ErrorCode.EXECUTION_ERROR,
          message: (error as Error).message,
          details: error instanceof UniFiMCPError ? error.details : undefined
        },
        metadata: {
          executionTime: Date.now() - startTime,
          timestamp: new Date()
        }
      };
    }
  }

  // ================================
  // Tool Management
  // ================================

  /**
   * Enable/disable a tool
   */
  setToolEnabled(toolName: string, enabled: boolean): boolean {
    const entry = this.tools.get(toolName);
    if (!entry) {
      return false;
    }

    entry.enabled = enabled;
    this.logger.info(`Tool '${toolName}' ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  }

  /**
   * Get tool statistics
   */
  getToolStats(toolName: string): ToolRegistryEntry | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Get registry statistics
   */
  getRegistryStats(): {
    totalTools: number;
    enabledTools: number;
    disabledTools: number;
    categoryCounts: Record<ToolCategory, number>;
    totalUsage: number;
    averageExecutionTime: number;
  } {
    const entries = Array.from(this.tools.values());
    const enabledEntries = entries.filter(entry => entry.enabled);

    const categoryCounts = {} as Record<ToolCategory, number>;
    for (const category of Object.values(ToolCategory)) {
      categoryCounts[category] = this.categories.get(category)?.length || 0;
    }

    const totalUsage = entries.reduce((sum, entry) => sum + entry.usageCount, 0);
    const totalExecutionTime = entries.reduce(
      (sum, entry) => sum + (entry.averageExecutionTime * entry.usageCount), 
      0
    );

    return {
      totalTools: entries.length,
      enabledTools: enabledEntries.length,
      disabledTools: entries.length - enabledEntries.length,
      categoryCounts,
      totalUsage,
      averageExecutionTime: totalUsage > 0 ? totalExecutionTime / totalUsage : 0
    };
  }

  // ================================
  // Feature Filtering
  // ================================

  /**
   * Filter tools based on feature availability
   */
  async filterToolsByFeatures(): Promise<{
    available: string[];
    unavailable: string[];
    deprecated: string[];
  }> {
    const toolAvailability = await this.versionDetector.getToolAvailability();
    const available: string[] = [];
    const unavailable: string[] = [];
    const deprecated: string[] = [];

    for (const [toolName, entry] of this.tools) {
      if (!entry.enabled) continue;

      const availability = toolAvailability[toolName];
      if (availability?.available) {
        if (availability.reason?.includes('deprecated')) {
          deprecated.push(toolName);
        } else {
          available.push(toolName);
        }
      } else {
        unavailable.push(toolName);
      }
    }

    return { available, unavailable, deprecated };
  }

  // ================================
  // Private Helper Methods
  // ================================

  /**
   * Initialize tool categories
   */
  private initializeCategories(): void {
    for (const category of Object.values(ToolCategory)) {
      this.categories.set(category, []);
    }
  }

  /**
   * Add tool to category
   */
  private addToCategory(category: ToolCategory, toolName: string): void {
    const tools = this.categories.get(category) || [];
    if (!tools.includes(toolName)) {
      tools.push(toolName);
      this.categories.set(category, tools);
    }
  }

  /**
   * Remove tool from category
   */
  private removeFromCategory(category: ToolCategory, toolName: string): void {
    const tools = this.categories.get(category) || [];
    const index = tools.indexOf(toolName);
    if (index > -1) {
      tools.splice(index, 1);
      this.categories.set(category, tools);
    }
  }

  /**
   * Extract dependencies from tool definition
   */
  private extractDependencies(tool: MCPTool): string[] {
    const dependencies: string[] = [];
    
    // Connection dependency
    if (tool.requiresConnection) {
      dependencies.push('unifi_connect');
    }

    // Version-specific dependencies
    if (tool.requiresVersion) {
      dependencies.push('version_check');
    }

    // Category-specific dependencies
    switch (tool.category) {
      case ToolCategory.FIREWALL_ZBF:
        dependencies.push('zbf_support');
        break;
      case ToolCategory.FIREWALL_LEGACY:
        dependencies.push('legacy_firewall_support');
        break;
    }

    return dependencies;
  }

  /**
   * Update tool dependencies
   */
  private updateDependencies(toolName: string, dependencies: string[]): void {
    this.dependencies.set(toolName, dependencies);
  }

  /**
   * Validate tool dependencies
   */
  private async validateDependencies(toolName: string): Promise<void> {
    const dependencies = this.dependencies.get(toolName) || [];
    
    for (const dependency of dependencies) {
      switch (dependency) {
        case 'unifi_connect':
          if (!this.unifiClient.isConnected()) {
            throw new UniFiMCPError('UniFi connection required', ErrorCode.CONNECTION_REQUIRED);
          }
          break;
        case 'zbf_support':
          await this.versionDetector.validateFeature('zbf');
          break;
        case 'legacy_firewall_support':
          await this.versionDetector.validateFeature('legacy-firewall');
          break;
      }
    }
  }

  /**
   * Update usage statistics
   */
  private updateUsageStats(toolName: string, executionTime: number, success: boolean): void {
    const entry = this.tools.get(toolName);
    if (!entry) return;

    entry.usageCount++;
    entry.lastUsed = new Date();

    // Update average execution time
    const totalTime = entry.averageExecutionTime * (entry.usageCount - 1) + executionTime;
    entry.averageExecutionTime = totalTime / entry.usageCount;

    if (!success) {
      entry.errorCount++;
    }
  }

  /**
   * Get feature name for category
   */
  private getCategoryFeature(category: ToolCategory): string {
    switch (category) {
      case ToolCategory.FIREWALL_ZBF:
        return 'zbf';
      case ToolCategory.FIREWALL_LEGACY:
        return 'legacy-firewall';
      case ToolCategory.MONITORING:
        return 'monitoring';
      case ToolCategory.AUTOMATION:
        return 'automation';
      default:
        return 'basic';
    }
  }

  /**
   * Clean up registry
   */
  cleanup(): void {
    this.tools.clear();
    this.categories.clear();
    this.dependencies.clear();
    this.logger.info('Tool registry cleaned up');
  }
}