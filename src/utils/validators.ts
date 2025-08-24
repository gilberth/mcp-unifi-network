import { z } from 'zod';
import { 
  ValidationError,
  ErrorFactory
} from './errors.js';
import {
  ConnectionParamsSchema,
  DeviceParamsSchema,
  ClientParamsSchema,
  MonitoringParamsSchema,
  FirewallRuleParamsSchema,
  ZoneParamsSchema
} from '../unifi/types.js';

/**
 * Comprehensive Validation System for UniFi MCP Server
 * 
 * Provides input validation, schema validation, and data sanitization
 * for all UniFi API interactions and tool parameters.
 */

// ================================
// Common Validation Schemas
// ================================

export const IPAddressSchema = z.string().refine(
  (ip) => {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  },
  { message: 'Invalid IP address format' }
);

export const MACAddressSchema = z.string().refine(
  (mac) => {
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    return macRegex.test(mac);
  },
  { message: 'Invalid MAC address format' }
);

export const PortSchema = z.union([
  z.number().int().min(1).max(65535),
  z.string().refine(
    (port) => {
      // Handle port ranges like "80-443" or single ports
      const rangeRegex = /^\d+(-\d+)?$/;
      return rangeRegex.test(port);
    },
    { message: 'Invalid port format. Use single port (80) or range (80-443)' }
  )
]);

export const PortRangeSchema = z.string().refine(
  (range) => {
    const parts = range.split('-');
    if (parts.length === 1) {
      const port = parseInt(parts[0]);
      return port >= 1 && port <= 65535;
    }
    if (parts.length === 2) {
      const start = parseInt(parts[0]);
      const end = parseInt(parts[1]);
      return start >= 1 && end <= 65535 && start <= end;
    }
    return false;
  },
  { message: 'Invalid port range format' }
);

export const CIDRSchema = z.string().refine(
  (cidr) => {
    const cidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:[0-9]|[1-2][0-9]|3[0-2])$/;
    return cidrRegex.test(cidr);
  },
  { message: 'Invalid CIDR notation' }
);

export const VLANIdSchema = z.number().int().min(1).max(4094);

export const ScheduleTimeSchema = z.string().refine(
  (time) => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  },
  { message: 'Invalid time format. Use HH:mm (24-hour format)' }
);

export const DayOfWeekSchema = z.enum([
  'monday', 'tuesday', 'wednesday', 'thursday', 
  'friday', 'saturday', 'sunday'
]);

// ================================
// Tool Parameter Validation Schemas
// ================================

export const ConnectToolParamsSchema = ConnectionParamsSchema.extend({
  verifySSL: z.boolean().default(false),
  timeout: z.number().positive().default(30000),
  maxRetries: z.number().min(1).max(10).default(3)
});

export const DeviceManagementParamsSchema = DeviceParamsSchema.extend({
  includeStats: z.boolean().default(false),
  includeClients: z.boolean().default(false)
});

export const ClientManagementParamsSchema = ClientParamsSchema.extend({
  includeTraffic: z.boolean().default(false),
  sortBy: z.enum(['name', 'ip', 'mac', 'lastSeen', 'rxBytes', 'txBytes']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const CreateFirewallRuleParamsSchema = z.object({
  name: z.string().min(1).max(100),
  enabled: z.boolean().default(true),
  action: z.enum(['allow', 'deny', 'reject']),
  protocol: z.enum(['tcp', 'udp', 'icmp', 'any']),
  source: z.union([IPAddressSchema, CIDRSchema, z.literal('any')]),
  destination: z.union([IPAddressSchema, CIDRSchema, z.literal('any')]),
  sourcePort: PortRangeSchema.optional(),
  destinationPort: PortRangeSchema.optional(),
  priority: z.number().min(1).max(9999).default(2000),
  logging: z.boolean().default(false),
  description: z.string().max(255).optional()
});

export const CreateZoneParamsSchema = z.object({
  name: z.string().min(1).max(50).refine(
    (name) => !/\s/.test(name),
    { message: 'Zone name cannot contain spaces' }
  ),
  description: z.string().max(255).optional(),
  networks: z.array(z.string()).min(1),
  interfaces: z.array(z.string()).default([]),
  enabled: z.boolean().default(true)
});

export const CreateZonePolicyParamsSchema = z.object({
  sourceZone: z.string().min(1),
  targetZone: z.string().min(1),
  action: z.enum(['allow', 'deny', 'reject']),
  applications: z.array(z.string()).optional(),
  ports: z.array(PortRangeSchema).optional(),
  logging: z.boolean().default(false),
  enabled: z.boolean().default(true),
  priority: z.number().min(1).max(9999).default(2000),
  description: z.string().max(255).optional()
}).refine(
  (data) => data.sourceZone !== data.targetZone,
  { message: 'Source and target zones must be different' }
);

export const CreateNetworkParamsSchema = z.object({
  name: z.string().min(1).max(50),
  purpose: z.enum(['corporate', 'guest', 'wan', 'vlan-only', 'vpn']),
  vlanId: VLANIdSchema.optional(),
  subnet: CIDRSchema,
  gateway: IPAddressSchema,
  dhcpEnabled: z.boolean().default(true),
  dhcpRange: z.object({
    start: IPAddressSchema,
    end: IPAddressSchema
  }).optional(),
  domainName: z.string().max(100).optional(),
  enabled: z.boolean().default(true)
});

export const CreateIPGroupParamsSchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(['address-group', 'port-group', 'ipv6-address-group']),
  members: z.array(z.string()).min(1),
  description: z.string().max(255).optional()
});

export const ScheduleParamsSchema = z.object({
  days: z.array(DayOfWeekSchema).min(1),
  startTime: ScheduleTimeSchema,
  endTime: ScheduleTimeSchema,
  timezone: z.string().optional()
}).refine(
  (schedule) => {
    const start = schedule.startTime.split(':').map(Number);
    const end = schedule.endTime.split(':').map(Number);
    const startMinutes = start[0] * 60 + start[1];
    const endMinutes = end[0] * 60 + end[1];
    return startMinutes < endMinutes;
  },
  { message: 'Start time must be before end time' }
);

export const BulkOperationParamsSchema = z.object({
  operation: z.enum(['restart', 'adopt', 'upgrade', 'block', 'unblock']),
  deviceIds: z.array(z.string()).min(1).max(50),
  force: z.boolean().default(false),
  description: z.string().max(255).optional()
});

// ================================
// Validation Service
// ================================

export class ValidationService {
  /**
   * Validate and parse input data using a Zod schema
   */
  static async validate<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    context?: string
  ): Promise<T> {
    try {
      return await schema.parseAsync(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ErrorFactory.fromValidationError(error, { context });
      }
      throw error;
    }
  }

  /**
   * Validate connection parameters
   */
  static async validateConnectionParams(params: unknown): Promise<z.infer<typeof ConnectionParamsSchema>> {
    const result = await this.validate(ConnectionParamsSchema, params, 'connection');
    return {
      ...result,
      siteId: result.siteId ?? 'default'
    };
  }

  /**
   * Validate device management parameters
   */
  static async validateDeviceParams(params: unknown): Promise<z.infer<typeof DeviceParamsSchema>> {
    return this.validate(DeviceParamsSchema, params, 'device management');
  }

  /**
   * Validate client management parameters
   */
  static async validateClientParams(params: unknown): Promise<z.infer<typeof ClientParamsSchema>> {
    const result = await this.validate(ClientParamsSchema, params, 'client management');
    return {
      ...result,
      activeOnly: result.activeOnly ?? false,
      includeTraffic: result.includeTraffic ?? false,
      sortOrder: result.sortOrder ?? 'desc',
      limit: result.limit ?? 100
    };
  }

  /**
   * Validate firewall rule creation parameters
   */
  static async validateCreateFirewallRuleParams(params: unknown): Promise<z.infer<typeof FirewallRuleParamsSchema>> {
    const result = await this.validate(FirewallRuleParamsSchema, params, 'firewall rule creation');
    return {
      ...result,
      enabledOnly: result.enabledOnly ?? false
    };
  }

  /**
   * Validate zone creation parameters
   */
  static async validateCreateZoneParams(params: unknown): Promise<z.infer<typeof ZoneParamsSchema>> {
    return this.validate(ZoneParamsSchema, params, 'zone creation');
  }

  /**
   * Validate zone policy creation parameters
   */
  static async validateCreateZonePolicyParams(params: unknown): Promise<z.infer<typeof CreateZonePolicyParamsSchema>> {
    const result = await this.validate(CreateZonePolicyParamsSchema, params, 'zone policy creation');
    return {
      ...result,
      enabled: result.enabled ?? true,
      priority: result.priority ?? 2000,
      logging: result.logging ?? false
    };
  }

  /**
   * Validate network creation parameters
   */
  static async validateCreateNetworkParams(params: unknown): Promise<z.infer<typeof CreateNetworkParamsSchema>> {
    const result = await this.validate(CreateNetworkParamsSchema, params, 'network creation');
    return {
      ...result,
      dhcpEnabled: result.dhcpEnabled ?? true,
      enabled: result.enabled ?? true
    };
  }

  /**
   * Validate IP group creation parameters
   */
  static async validateCreateIPGroupParams(params: unknown): Promise<z.infer<typeof CreateIPGroupParamsSchema>> {
    return this.validate(CreateIPGroupParamsSchema, params, 'IP group creation');
  }

  /**
   * Validate schedule parameters
   */
  static async validateScheduleParams(params: unknown): Promise<z.infer<typeof ScheduleParamsSchema>> {
    return this.validate(ScheduleParamsSchema, params, 'schedule');
  }

  /**
   * Validate bulk operation parameters
   */
  static async validateBulkOperationParams(params: unknown): Promise<z.infer<typeof BulkOperationParamsSchema>> {
    const result = await this.validate(BulkOperationParamsSchema, params, 'bulk operation');
    return {
      ...result,
      force: result.force ?? false
    };
  }

  /**
   * Validate monitoring parameters
   */
  static async validateMonitoringParams(params: unknown): Promise<z.infer<typeof MonitoringParamsSchema>> {
    const result = await this.validate(MonitoringParamsSchema, params, 'monitoring');
    return {
      ...result,
      timeframe: result.timeframe ?? 'day'
    };
  }

  /**
   * Sanitize string input
   */
  static sanitizeString(input: string, maxLength: number = 255): string {
    return input.trim().slice(0, maxLength);
  }

  /**
   * Validate IP address
   */
  static validateIPAddress(ip: string): boolean {
    try {
      IPAddressSchema.parse(ip);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate MAC address
   */
  static validateMACAddress(mac: string): boolean {
    try {
      MACAddressSchema.parse(mac);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate CIDR notation
   */
  static validateCIDR(cidr: string): boolean {
    try {
      CIDRSchema.parse(cidr);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate port or port range
   */
  static validatePort(port: string | number): boolean {
    try {
      PortSchema.parse(port);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate VLAN ID
   */
  static validateVLANId(vlanId: number): boolean {
    try {
      VLANIdSchema.parse(vlanId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a network range contains an IP address
   */
  static isIPInRange(ip: string, cidr: string): boolean {
    try {
      const [network, prefixStr] = cidr.split('/');
      const prefix = parseInt(prefixStr, 10);
      
      const ipNum = this.ipToNumber(ip);
      const networkNum = this.ipToNumber(network);
      const mask = ((0xffffffff << (32 - prefix)) >>> 0);
      
      return (ipNum & mask) === (networkNum & mask);
    } catch {
      return false;
    }
  }

  /**
   * Convert IP address to number for calculations
   */
  private static ipToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  /**
   * Validate multiple items at once
   */
  static async validateMany<T>(
    schema: z.ZodSchema<T>,
    items: unknown[],
    context?: string
  ): Promise<T[]> {
    const results: T[] = [];
    const errors: string[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const result = await this.validate(schema, items[i], `${context}[${i}]`);
        results.push(result);
      } catch (error) {
        if (error instanceof ValidationError) {
          errors.push(`Item ${i}: ${error.message}`);
        } else {
          errors.push(`Item ${i}: Unknown validation error`);
        }
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(
        `Validation failed for multiple items: ${errors.join(', ')}`,
        'multiple',
        items,
        errors
      );
    }

    return results;
  }

  /**
   * Create a conditional validator that checks dependencies
   */
  static createConditionalValidator<T>(
    baseSchema: z.ZodSchema<T>,
    conditions: Array<{
      when: (data: any) => boolean;
      then: z.ZodSchema<any>;
      message?: string;
    }>
  ): z.ZodSchema<T> {
    return baseSchema.refine(
      (data) => {
        for (const condition of conditions) {
          if (condition.when(data)) {
            try {
              condition.then.parse(data);
            } catch {
              return false;
            }
          }
        }
        return true;
      },
      {
        message: 'Conditional validation failed'
      }
    );
  }
}

// ================================
// Helper Functions
// ================================

export function isValidIPv4(ip: string): boolean {
  return ValidationService.validateIPAddress(ip);
}

export function isValidMAC(mac: string): boolean {
  return ValidationService.validateMACAddress(mac);
}

export function isValidCIDR(cidr: string): boolean {
  return ValidationService.validateCIDR(cidr);
}

export function isValidPort(port: string | number): boolean {
  return ValidationService.validatePort(port);
}

export function isValidVLAN(vlanId: number): boolean {
  return ValidationService.validateVLANId(vlanId);
}

export function normalizeMAC(mac: string): string {
  return mac.toLowerCase().replace(/[:-]/g, ':');
}

export function normalizeIP(ip: string): string {
  return ip.trim();
}

// Schemas and validators are exported inline above