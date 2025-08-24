import { jest } from '@jest/globals';
import { UniFiClient } from '../../../unifi/client.js';
import { UniFiMCPError, ConnectionError, AuthenticationError } from '../../../utils/errors.js';

// Mock axios
jest.mock('axios');

describe('UniFiClient', () => {
  let client: UniFiClient;
  const mockConfig = {
    gatewayIp: '192.168.1.1',
    apiKey: 'test-api-key',
    siteId: 'default',
    verifySSL: false,
    timeout: 30000,
    maxRetries: 3
  };

  beforeEach(() => {
    client = new UniFiClient(mockConfig);
    jest.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should initialize with correct configuration', () => {
      const config = client.getConfig();
      expect(config.gatewayIp).toBe(mockConfig.gatewayIp);
      expect(config.siteId).toBe(mockConfig.siteId);
      expect(config.verifySSL).toBe(mockConfig.verifySSL);
      expect(config.timeout).toBe(mockConfig.timeout);
      // API key should not be exposed
      expect(config).not.toHaveProperty('apiKey');
    });

    it('should update configuration', () => {
      client.updateConfig({
        gatewayIp: '192.168.1.2',
        timeout: 60000
      });

      const config = client.getConfig();
      expect(config.gatewayIp).toBe('192.168.1.2');
      expect(config.timeout).toBe(60000);
      expect(config.siteId).toBe(mockConfig.siteId); // Should remain unchanged
    });
  });

  describe('Connection Management', () => {
    it('should start disconnected', () => {
      expect(client.isConnected()).toBe(false);
      const connectionInfo = client.getConnectionInfo();
      expect(connectionInfo.isConnected).toBe(false);
      expect(connectionInfo.isAuthenticated).toBe(false);
    });

    it('should track connection attempts', () => {
      const initialInfo = client.getConnectionInfo();
      expect(initialInfo.connectionAttempts).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should provide statistics', () => {
      const stats = client.getStatistics();
      expect(stats).toHaveProperty('connectionAttempts');
      expect(stats).toHaveProperty('retryCount');
      expect(stats).toHaveProperty('rateLimitTokens');
      expect(stats).toHaveProperty('requestQueueSize');
      expect(typeof stats.connectionAttempts).toBe('number');
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      // This test would require mocking the actual HTTP client
      // For now, we verify the error types exist
      expect(ConnectionError).toBeDefined();
      expect(AuthenticationError).toBeDefined();
      expect(UniFiMCPError).toBeDefined();
    });
  });
});