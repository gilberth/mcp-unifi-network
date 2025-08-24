import { ValidationService } from '../../../utils/validators.js';

describe('ValidationService', () => {
  describe('IP Address Validation', () => {
    it('should validate correct IPv4 addresses', () => {
      expect(ValidationService.validateIPAddress('192.168.1.1')).toBe(true);
      expect(ValidationService.validateIPAddress('10.0.0.1')).toBe(true);
      expect(ValidationService.validateIPAddress('172.16.0.1')).toBe(true);
      expect(ValidationService.validateIPAddress('8.8.8.8')).toBe(true);
    });

    it('should reject invalid IPv4 addresses', () => {
      expect(ValidationService.validateIPAddress('256.1.1.1')).toBe(false);
      expect(ValidationService.validateIPAddress('192.168.1')).toBe(false);
      expect(ValidationService.validateIPAddress('192.168.1.1.1')).toBe(false);
      expect(ValidationService.validateIPAddress('invalid')).toBe(false);
    });
  });

  describe('MAC Address Validation', () => {
    it('should validate correct MAC addresses', () => {
      expect(ValidationService.validateMACAddress('00:11:22:33:44:55')).toBe(true);
      expect(ValidationService.validateMACAddress('AA:BB:CC:DD:EE:FF')).toBe(true);
      expect(ValidationService.validateMACAddress('00-11-22-33-44-55')).toBe(true);
    });

    it('should reject invalid MAC addresses', () => {
      expect(ValidationService.validateMACAddress('00:11:22:33:44')).toBe(false);
      expect(ValidationService.validateMACAddress('00:11:22:33:44:55:66')).toBe(false);
      expect(ValidationService.validateMACAddress('invalid')).toBe(false);
    });
  });

  describe('CIDR Validation', () => {
    it('should validate correct CIDR notation', () => {
      expect(ValidationService.validateCIDR('192.168.1.0/24')).toBe(true);
      expect(ValidationService.validateCIDR('10.0.0.0/8')).toBe(true);
      expect(ValidationService.validateCIDR('172.16.0.0/16')).toBe(true);
    });

    it('should reject invalid CIDR notation', () => {
      expect(ValidationService.validateCIDR('192.168.1.0/33')).toBe(false);
      expect(ValidationService.validateCIDR('192.168.1.0')).toBe(false);
      expect(ValidationService.validateCIDR('invalid/24')).toBe(false);
    });
  });

  describe('Port Validation', () => {
    it('should validate correct ports', () => {
      expect(ValidationService.validatePort(80)).toBe(true);
      expect(ValidationService.validatePort(443)).toBe(true);
      expect(ValidationService.validatePort('22')).toBe(true);
      expect(ValidationService.validatePort('80-443')).toBe(true);
    });

    it('should reject invalid ports', () => {
      expect(ValidationService.validatePort(0)).toBe(false);
      expect(ValidationService.validatePort(65536)).toBe(false);
      expect(ValidationService.validatePort('invalid')).toBe(false);
    });
  });

  describe('VLAN ID Validation', () => {
    it('should validate correct VLAN IDs', () => {
      expect(ValidationService.validateVLANId(1)).toBe(true);
      expect(ValidationService.validateVLANId(100)).toBe(true);
      expect(ValidationService.validateVLANId(4094)).toBe(true);
    });

    it('should reject invalid VLAN IDs', () => {
      expect(ValidationService.validateVLANId(0)).toBe(false);
      expect(ValidationService.validateVLANId(4095)).toBe(false);
      expect(ValidationService.validateVLANId(-1)).toBe(false);
    });
  });

  describe('Connection Parameters Validation', () => {
    it('should validate correct connection parameters', async () => {
      const validParams = {
        gatewayIp: '192.168.1.1',
        apiKey: 'test-key',
        siteId: 'default'
      };

      const result = await ValidationService.validateConnectionParams(validParams);
      expect(result.gatewayIp).toBe(validParams.gatewayIp);
      expect(result.apiKey).toBe(validParams.apiKey);
      expect(result.siteId).toBe(validParams.siteId);
    });

    it('should reject invalid connection parameters', async () => {
      const invalidParams = {
        gatewayIp: 'invalid-ip',
        apiKey: '',
        siteId: 'default'
      };

      await expect(ValidationService.validateConnectionParams(invalidParams))
        .rejects.toThrow();
    });
  });

  describe('Network Range Validation', () => {
    it('should check if IP is in range', () => {
      expect(ValidationService.isIPInRange('192.168.1.100', '192.168.1.0/24')).toBe(true);
      expect(ValidationService.isIPInRange('192.168.2.100', '192.168.1.0/24')).toBe(false);
      expect(ValidationService.isIPInRange('10.0.0.100', '10.0.0.0/8')).toBe(true);
    });
  });

  describe('String Sanitization', () => {
    it('should sanitize strings correctly', () => {
      expect(ValidationService.sanitizeString('  test  ')).toBe('test');
      expect(ValidationService.sanitizeString('very long string', 5)).toBe('very ');
      expect(ValidationService.sanitizeString('')).toBe('');
    });
  });
});