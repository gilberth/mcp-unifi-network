/**
 * Jest Test Setup
 * 
 * Global test configuration and utilities for UniFi MCP Server tests.
 */

// Global test timeout
jest.setTimeout(30000);

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.UNIFI_GATEWAY_IP = '192.168.1.1';
process.env.UNIFI_API_KEY = 'test-api-key';
process.env.UNIFI_SITE_ID = 'default';
process.env.LOG_LEVEL = 'error';

// Suppress console output during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Declare global test utilities type
declare global {
  var testUtils: {
    mockUniFiResponse: (data: any) => any;
    mockErrorResponse: (message: string) => any;
  };
}

// Global test utilities
(global as any).testUtils = {
  mockUniFiResponse: (data: any) => ({
    meta: { rc: 'ok', msg: 'success' },
    data: Array.isArray(data) ? data : [data]
  }),
  
  mockErrorResponse: (message: string) => ({
    meta: { rc: 'error', msg: message },
    data: []
  })
};

export {};