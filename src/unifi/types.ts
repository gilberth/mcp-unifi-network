import { z } from 'zod';

/**
 * UniFi Network API Type Definitions
 * 
 * Comprehensive TypeScript types for UniFi Network Application API,
 * supporting both legacy firewall and Zone-Based Firewall (ZBF) systems.
 */

// ================================
// Base Types and Enums
// ================================

export enum DeviceType {
  GATEWAY = 'ugw',
  SWITCH = 'usw',
  ACCESS_POINT = 'uap',
  PROTECT = 'protect',
  CAMERA = 'camera',
  DOORBELL = 'doorbell',
  SENSOR = 'sensor'
}

export enum DeviceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  UPGRADING = 'upgrading',
  PROVISIONING = 'provisioning',
  ADOPTING = 'adopting',
  HEARTBEAT_MISSED = 'heartbeat_missed'
}

export enum ClientType {
  WIRED = 'wired',
  WIRELESS = 'wireless',
  VPN = 'vpn'
}

export enum FirewallAction {
  ALLOW = 'allow',
  DENY = 'deny',
  REJECT = 'reject',
  DROP = 'drop'
}

export enum Protocol {
  TCP = 'tcp',
  UDP = 'udp',
  ICMP = 'icmp',
  ANY = 'any',
  ALL = 'all'
}

export enum NetworkPurpose {
  CORPORATE = 'corporate',
  GUEST = 'guest',
  WAN = 'wan',
  VLAN_ONLY = 'vlan-only',
  VPN = 'vpn'
}

// ================================
// Configuration and Authentication
// ================================

export const UniFiConfigSchema = z.object({
  gatewayIp: z.string().ip(),
  apiKey: z.string().min(1),
  siteId: z.string().default('default'),
  verifySSL: z.boolean().default(false),
  timeout: z.number().positive().default(30000),
  maxRetries: z.number().min(1).max(10).default(3),
  port: z.number().min(1).max(65535).optional()
});

export type UniFiConfig = z.infer<typeof UniFiConfigSchema>;

export interface AuthenticationHeaders {
  'X-API-KEY': string;
  'Content-Type': 'application/json';
  'Accept': 'application/json';
  [key: string]: string;
}

// ================================
// System Information
// ================================

export interface SystemInfo {
  version: string;
  buildNumber: string;
  buildTimestamp: number;
  hostname: string;
  timezone: string;
  uptime: number;
  firewallMode: 'legacy' | 'zbf';
  zbfSupported: boolean;
  hardwareModel: string;
  hardwareRevision: string;
  ubntNetworkApplicationVersion: string;
}

export interface VersionInfo {
  version: string;
  supportsZBF: boolean;
  supportedFeatures: string[];
  deprecatedEndpoints: string[];
  newEndpoints: string[];
}

// ================================
// Device Management
// ================================

export const DeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.nativeEnum(DeviceType),
  model: z.string(),
  version: z.string(),
  status: z.nativeEnum(DeviceStatus),
  ipAddress: z.string().ip().optional(),
  macAddress: z.string(),
  adopted: z.boolean(),
  lastSeen: z.date(),
  uptime: z.number().optional(),
  bytes: z.number().optional(),
  txBytes: z.number().optional(),
  rxBytes: z.number().optional(),
  totalBytes: z.number().optional()
});

export type Device = z.infer<typeof DeviceSchema>;

export interface DeviceStats {
  cpuUsage: number;
  memoryUsage: number;
  temperature: number;
  uptime: number;
  bytesReceived: number;
  bytesTransmitted: number;
  packetsReceived: number;
  packetsTransmitted: number;
  lastUpdated: Date;
}

export interface DetailedDevice extends Device {
  serialNumber: string;
  firmwareVersion: string;
  configuredAt: Date;
  provisionedAt?: Date;
  connectedVia?: string;
  ports?: DevicePort[];
  radioTable?: RadioInfo[];
  stats?: DeviceStats;
}

export interface DevicePort {
  portIdx: number;
  name: string;
  enable: boolean;
  portPoe: boolean;
  poeMode: string;
  speed: number;
  fullDuplex: boolean;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
}

export interface RadioInfo {
  name: string;
  radio: string;
  channel: number;
  ht: number;
  txPower: number;
  minRssi: number;
  maxRssi: number;
  nss: number;
}

// ================================
// Client Management
// ================================

export const ClientSchema = z.object({
  id: z.string(),
  mac: z.string(),
  name: z.string().optional(),
  hostname: z.string().optional(),
  ip: z.string().ip().optional(),
  networkId: z.string(),
  deviceMac: z.string().optional(),
  type: z.nativeEnum(ClientType),
  connected: z.boolean(),
  firstSeen: z.date(),
  lastSeen: z.date(),
  rxBytes: z.number(),
  txBytes: z.number(),
  blocked: z.boolean().default(false),
  noted: z.boolean().default(false)
});

export type Client = z.infer<typeof ClientSchema>;

export interface DetailedClient extends Client {
  oui: string;
  os: string;
  osName: string;
  deviceName: string;
  usergroup: string;
  use_fixedip: boolean;
  fixed_ip: string;
  network: string;
  essid?: string;
  channel?: number;
  radio?: string;
  signal?: number;
  noise?: number;
  rssi?: number;
  ccq?: number;
  satisfaction?: number;
  anomalies?: number;
  uptime?: number;
  txRate?: number;
  rxRate?: number;
  powersave_enabled?: boolean;
  is_11r?: boolean;
  user_id?: string;
  vlan?: number;
}

// ================================
// Network Management
// ================================

export const NetworkSchema = z.object({
  id: z.string(),
  name: z.string(),
  purpose: z.nativeEnum(NetworkPurpose),
  vlanId: z.number().min(1).max(4094).optional(),
  subnet: z.string(),
  gateway: z.string().ip(),
  dhcpEnabled: z.boolean().default(true),
  dhcpRange: z.object({
    start: z.string().ip(),
    end: z.string().ip()
  }).optional(),
  enabled: z.boolean().default(true),
  isNat: z.boolean().default(true),
  domainName: z.string().optional(),
  networkGroup: z.string().optional()
});

export type Network = z.infer<typeof NetworkSchema>;

export interface DetailedNetwork extends Network {
  upProfile?: string;
  wanNetworkgroup?: string;
  wanType?: string;
  wanIp?: string;
  wanGateway?: string;
  wanDns1?: string;
  wanDns2?: string;
  wanUsername?: string;
  vpnType?: string;
  radiusProfile?: string;
  xWanPassword?: string;
  lteApn?: string;
  internetAccessEnabled?: boolean;
  intraNetworkAccessEnabled?: boolean;
  dhcpServerEnabled?: boolean;
  dhcpLeaseTime?: number;
  dhcpDns1?: string;
  dhcpDns2?: string;
  dhcpNtp?: string;
  dhcpLeasetime?: number;
  ipv6InterfaceType?: string;
  ipv6RaEnabled?: boolean;
  dhcpv6Enabled?: boolean;
}

// ================================
// Legacy Firewall Types
// ================================

export const FirewallRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean().default(true),
  action: z.nativeEnum(FirewallAction),
  protocol: z.nativeEnum(Protocol),
  src: z.string(),
  dst: z.string(),
  srcPort: z.string().optional(),
  dstPort: z.string().optional(),
  priority: z.number().min(1).max(9999).default(2000),
  logging: z.boolean().default(false),
  state: z.enum(['new', 'established', 'related', 'invalid']).optional()
});

export type FirewallRule = z.infer<typeof FirewallRuleSchema>;

export interface DetailedFirewallRule extends FirewallRule {
  ruleIndex: number;
  ipsec: string;
  srcFirewallgroupIds: string[];
  dstFirewallgroupIds: string[];
  srcMacAddress: string;
  protocolMatchExcepted: boolean;
  icmpTypename: string;
  srcNetworkconfId: string;
  srcNetworkconfType: string;
  dstNetworkconfId: string;
  dstNetworkconfType: string;
  ruleSet: string;
}

// ================================
// Zone-Based Firewall Types (UniFi 9.0+)
// ================================

export const FirewallZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  predefined: z.boolean().default(false),
  networks: z.array(z.string()),
  interfaces: z.array(z.string()),
  enabled: z.boolean().default(true),
  localUser: z.boolean().default(false)
});

export type FirewallZone = z.infer<typeof FirewallZoneSchema>;

export enum PredefinedZone {
  EXTERNAL = 'external',
  INTERNAL = 'internal',
  GATEWAY = 'gateway',
  VPN = 'vpn',
  HOTSPOT = 'hotspot',
  DMZ = 'dmz'
}

export const ZonePolicySchema = z.object({
  id: z.string(),
  sourceZone: z.string(),
  targetZone: z.string(),
  action: z.nativeEnum(FirewallAction),
  applications: z.array(z.string()).optional(),
  ports: z.array(z.string()).optional(),
  logging: z.boolean().default(false),
  enabled: z.boolean().default(true),
  priority: z.number().min(1).max(9999).default(2000)
});

export type ZonePolicy = z.infer<typeof ZonePolicySchema>;

export interface ZonePolicyMatrix {
  zones: string[];
  policies: Record<string, Record<string, 'allow' | 'deny' | 'custom'>>;
}

export interface SimpleAppBlock {
  id: string;
  zoneId: string;
  appCategory: string;
  enabled: boolean;
  schedule?: {
    days: string[];
    startTime: string;
    endTime: string;
  };
}

// ================================
// IP/MAC Group Management
// ================================

export enum GroupType {
  ADDRESS_GROUP = 'address-group',
  PORT_GROUP = 'port-group',
  IPV6_ADDRESS_GROUP = 'ipv6-address-group'
}

export const IPGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.nativeEnum(GroupType),
  members: z.array(z.string()),
  description: z.string().optional()
});

export type IPGroup = z.infer<typeof IPGroupSchema>;

// ================================
// Monitoring and Statistics
// ================================

export interface SiteStats {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  totalClients: number;
  wiredClients: number;
  wirelessClients: number;
  guestClients: number;
  totalBytes: number;
  totalPackets: number;
  totalUptime: number;
  internetLatency: number;
  internetDropRate: number;
  lastUpdated: Date;
}

export interface BandwidthUsage {
  entityId: string;
  entityType: 'client' | 'device' | 'network';
  entityName: string;
  rxBytes: number;
  txBytes: number;
  rxRate: number;
  txRate: number;
  period: string;
  timestamp: Date;
}

export interface SystemEvent {
  id: string;
  timestamp: Date;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  deviceId?: string;
  clientId?: string;
  key: string;
  subsystem: string;
  details?: Record<string, any>;
}

export interface SystemAlert {
  id: string;
  timestamp: Date;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  acknowledged: boolean;
  deviceId?: string;
  source: string;
  details?: Record<string, any>;
}

export interface NetworkTopology {
  devices: Array<{
    id: string;
    name: string;
    type: DeviceType;
    connections: Array<{
      deviceId: string;
      port: string;
      linkSpeed: number;
    }>;
  }>;
  clients: Array<{
    id: string;
    connectedTo: string;
    connectionType: ClientType;
  }>;
}

export interface WiFiInterference {
  apId: string;
  apName: string;
  radio: string;
  channel: number;
  utilization: number;
  interference: number;
  neighbors: Array<{
    ssid: string;
    channel: number;
    signal: number;
  }>;
  timestamp: Date;
}

// ================================
// Automation and Scheduling
// ================================

export interface ScheduleConfig {
  days: Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>;
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
  timezone?: string;
}

export interface DeviceBlockSchedule {
  id: string;
  deviceId: string;
  schedule: ScheduleConfig;
  enabled: boolean;
  description?: string;
  createdAt: Date;
  lastExecuted?: Date;
}

export interface EmergencyLockdown {
  id: string;
  enabled: boolean;
  activatedAt?: Date;
  activatedBy?: string;
  restrictions: {
    blockAllClients: boolean;
    blockInternetAccess: boolean;
    allowedDevices: string[];
    allowedNetworks: string[];
    customRules?: string[];
  };
  autoDisableAfter?: number; // minutes
}

export interface BulkOperation {
  id: string;
  operation: 'restart' | 'adopt' | 'upgrade' | 'block' | 'unblock';
  deviceIds: string[];
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  results: Array<{
    deviceId: string;
    success: boolean;
    error?: string;
  }>;
  startedAt: Date;
  completedAt?: Date;
}

export interface HealthCheck {
  timestamp: Date;
  overall: 'healthy' | 'warning' | 'critical';
  checks: Array<{
    name: string;
    status: 'pass' | 'warning' | 'fail';
    message: string;
    details?: Record<string, any>;
  }>;
}

// ================================
// API Response Types
// ================================

export interface APIResponse<T = any> {
  meta: {
    msg: string;
    rc: 'ok' | 'error';
  };
  data: T[];
}

export interface APIError {
  meta: {
    msg: string;
    rc: 'error';
  };
  data: never[];
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// ================================
// Tool Parameter Schemas
// ================================

export const ConnectionParamsSchema = z.object({
  gatewayIp: z.string().ip(),
  apiKey: z.string().min(1),
  siteId: z.string().default('default')
});

export const DeviceParamsSchema = z.object({
  deviceId: z.string().optional(),
  deviceType: z.nativeEnum(DeviceType).optional(),
  status: z.nativeEnum(DeviceStatus).optional()
});

export const ClientParamsSchema = z.object({
  clientId: z.string().optional(),
  activeOnly: z.boolean().default(false),
  networkId: z.string().optional(),
  clientType: z.nativeEnum(ClientType).optional(),
  blocked: z.boolean().optional(),
  includeTraffic: z.boolean().default(false),
  sortBy: z.enum(['name', 'ip', 'mac', 'lastSeen', 'rxBytes', 'txBytes']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.number().min(1).max(1000).default(100)
});

export const FirewallRuleParamsSchema = z.object({
  ruleId: z.string().optional(),
  enabledOnly: z.boolean().default(false)
});

export const ZoneParamsSchema = z.object({
  zoneId: z.string().optional(),
  sourceZone: z.string().optional(),
  targetZone: z.string().optional()
});

export const NetworkParamsSchema = z.object({
  networkId: z.string().optional(),
  networkType: z.nativeEnum(NetworkPurpose).optional()
});

export const MonitoringParamsSchema = z.object({
  timeframe: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  entityType: z.enum(['client', 'device', 'network']).optional(),
  entityId: z.string().optional()
});

// ================================
// All types and interfaces are exported inline above
// ================================

// Enums and schemas are exported inline above
// No additional export collection needed