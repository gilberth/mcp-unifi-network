# UniFi Network MCP Server

A comprehensive Model Context Protocol (MCP) server for UniFi Network API integration, supporting both legacy firewall rules and the new Zone-Based Firewall (ZBF) system introduced in UniFi Network 9.0+.

## Features

### Core Capabilities

- **Dual Firewall Support**: Legacy firewall rules and Zone-Based Firewall (ZBF)
- **Automatic Version Detection**: Detects UniFi controller capabilities
- **Comprehensive Device Management**: Gateways, switches, access points, and clients
- **Network Administration**: VLANs, networks, and IP groups
- **Real-time Monitoring**: Statistics, events, and health monitoring
- **Automation Tools**: Scheduling, bulk operations, and emergency lockdown

### Technical Features

- **TypeScript Implementation**: Full type safety and IntelliSense support
- **Robust Error Handling**: Structured error recovery and retry mechanisms
- **Rate Limiting**: Built-in API rate limiting to prevent controller overload
- **Caching System**: Configurable caching for performance optimization
- **Health Monitoring**: Continuous health checks and metrics collection
- **SSL Support**: Handles self-signed certificates common in UniFi deployments

## Quick Start

### Prerequisites

- Node.js 18+
- UniFi Network Application 6.0+ (9.0+ for ZBF features)
- UniFi Gateway with API access enabled
- Valid API key

### Installation

#### Option 1: npm Installation (Recommended)

**Global Installation:**

```bash
# Install globally to use as a CLI tool
npm install -g @thelord/unifi-mcp-server

# Run the server
unifi-mcp-server
```

**Local Installation:**

```bash
# Install in your project
npm install @thelord/unifi-mcp-server

# Run with npx
npx @thelord/unifi-mcp-server
```

**Direct Execution:**

```bash
# Run without installing
npx @thelord/unifi-mcp-server
```

#### Option 2: Source Installation

1. **Clone and Install**

   ```bash
   git clone <repository>
   cd unifi-mcp-server
   npm install
   ```

2. **Configure Environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your UniFi settings:

   ```env
   UNIFI_GATEWAY_IP=192.168.1.1
   UNIFI_API_KEY=your_api_key_here
   UNIFI_SITE_ID=default
   UNIFI_VERIFY_SSL=false
   ```

3. **Build and Run**
   ```bash
   npm run build
   npm start
   ```

### Development Mode

```bash
npm run dev
```

## MCP Client Configuration

### Claude Desktop Configuration

To use this MCP server with Claude Desktop, add the following configuration to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

#### For npm Installation:

```json
{
  "mcpServers": {
    "unifi-network": {
      "command": "npx",
      "args": ["@thelord/unifi-mcp-server"],
      "env": {
        "UNIFI_GATEWAY_IP": "192.168.1.1",
        "UNIFI_API_KEY": "your_api_key_here",
        "UNIFI_SITE_ID": "default",
        "UNIFI_VERIFY_SSL": "false"
      }
    }
  }
}
```

#### For Global Installation:

```json
{
  "mcpServers": {
    "unifi-network": {
      "command": "unifi-mcp-server",
      "env": {
        "UNIFI_GATEWAY_IP": "192.168.1.1",
        "UNIFI_API_KEY": "your_api_key_here",
        "UNIFI_SITE_ID": "default",
        "UNIFI_VERIFY_SSL": "false"
      }
    }
  }
}
```

#### For Source Installation:

```json
{
  "mcpServers": {
    "unifi-network": {
      "command": "node",
      "args": ["/path/to/unifi-mcp-server/dist/index.js"],
      "env": {
        "UNIFI_GATEWAY_IP": "192.168.1.1",
        "UNIFI_API_KEY": "your_api_key_here",
        "UNIFI_SITE_ID": "default",
        "UNIFI_VERIFY_SSL": "false"
      }
    }
  }
}
```

### Environment Configuration

You can configure the server using environment variables in the MCP client configuration:

```json
{
  "mcpServers": {
    "unifi-network": {
      "command": "npx",
      "args": ["@thelord/unifi-mcp-server"],
      "env": {
        "UNIFI_GATEWAY_IP": "10.0.1.1",
        "UNIFI_API_KEY": "your_32_char_api_key",
        "UNIFI_SITE_ID": "default",
        "UNIFI_VERIFY_SSL": "false",
        "UNIFI_TIMEOUT": "30000",
        "LOG_LEVEL": "info",
        "ENABLE_ZBF_TOOLS": "true",
        "ENABLE_LEGACY_FIREWALL": "true",
        "API_RATE_LIMIT_PER_MINUTE": "60"
      }
    }
  }
}
```

### Other MCP Clients

For other MCP clients, use the appropriate command based on your installation method:

**npm/npx:**

```bash
npx @thelord/unifi-mcp-server
```

**Global installation:**

```bash
unifi-mcp-server
```

**Source installation:**

```bash
node /path/to/dist/index.js
```

### Verification

After configuring your MCP client:

1. **Restart Claude Desktop** (or your MCP client)
2. **Test the connection** by asking Claude: "Can you connect to my UniFi network and show me the devices?"
3. **Verify tools are loaded** by asking: "What UniFi tools are available?"

### Troubleshooting MCP Configuration

**Claude Desktop not detecting the server:**

- Verify the JSON syntax is correct
- Check file path: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Restart Claude Desktop completely
- Check Claude Desktop logs for errors

**Connection issues:**

- Verify `UNIFI_GATEWAY_IP` is correct and accessible
- Ensure `UNIFI_API_KEY` is valid and has proper permissions
- Set `UNIFI_VERIFY_SSL=false` if using self-signed certificates
- Check network connectivity to the UniFi controller

## Configuration

### Environment Variables

#### UniFi Connection

- `UNIFI_GATEWAY_IP`: IP address of your UniFi controller/gateway
- `UNIFI_API_KEY`: API key for authentication
- `UNIFI_SITE_ID`: Site identifier (default: "default")
- `UNIFI_VERIFY_SSL`: Verify SSL certificates (default: false)
- `UNIFI_TIMEOUT`: Request timeout in milliseconds (default: 30000)
- `UNIFI_MAX_RETRIES`: Maximum retry attempts (default: 3)

#### Feature Flags

- `ENABLE_ZBF_TOOLS`: Enable Zone-Based Firewall tools (default: true)
- `ENABLE_LEGACY_FIREWALL`: Enable legacy firewall tools (default: true)
- `ENABLE_MONITORING`: Enable monitoring tools (default: true)
- `ENABLE_AUTOMATION`: Enable automation tools (default: true)

#### Performance

- `API_RATE_LIMIT_PER_MINUTE`: API requests per minute (default: 60)
- `CONCURRENT_REQUESTS_LIMIT`: Concurrent requests (default: 5)
- `CACHE_TTL_SECONDS`: Cache time-to-live (default: 300)

#### Logging

- `LOG_LEVEL`: Logging level (error, warn, info, debug, trace)
- `LOG_FILE`: Log file path (optional)
- `LOG_FORMAT`: Log format (json, simple, combined)

## Available Tools

### Connection Management

- `unifi_connect`: Establish connection to UniFi controller
- `unifi_test_connection`: Test connectivity and authentication
- `unifi_get_system_info`: Retrieve system information and version
- `unifi_disconnect`: Disconnect from controller
- `unifi_get_connection_status`: Get detailed connection status

### Device Management

- `unifi_get_devices`: List all UniFi devices
- `unifi_get_device_details`: Get detailed device information
- `unifi_restart_device`: Restart specific device
- `unifi_adopt_device`: Adopt pending device
- `unifi_get_device_stats`: Get device performance statistics

### Client Management

- `unifi_get_clients`: List connected clients
- `unifi_get_client_details`: Get detailed client information
- `unifi_block_client`: Block client access
- `unifi_unblock_client`: Unblock client access
- `unifi_get_client_stats`: Get client usage statistics

### Legacy Firewall (Pre-9.0)

- `unifi_get_firewall_rules`: Get traditional firewall rules
- `unifi_create_firewall_rule`: Create new firewall rule
- `unifi_update_firewall_rule`: Update existing rule
- `unifi_delete_firewall_rule`: Delete firewall rule
- `unifi_toggle_firewall_rule`: Enable/disable rule

### Zone-Based Firewall (9.0+)

- `unifi_get_zones`: List firewall zones
- `unifi_create_zone`: Create custom zone
- `unifi_update_zone`: Update zone configuration
- `unifi_delete_zone`: Delete custom zone
- `unifi_get_zone_policies`: Get policies between zones
- `unifi_create_zone_policy`: Create zone-to-zone policy
- `unifi_update_zone_policy`: Update existing policy
- `unifi_delete_zone_policy`: Delete zone policy
- `unifi_get_zone_matrix`: Get visual policy matrix
- `unifi_block_app_in_zone`: Simple application blocking

### Network Management

- `unifi_get_networks`: List configured networks/VLANs
- `unifi_create_network`: Create new network/VLAN
- `unifi_update_network`: Update network configuration
- `unifi_delete_network`: Delete network/VLAN
- `unifi_get_network_stats`: Get network usage statistics

### IP/MAC Group Management

- `unifi_get_ip_groups`: Get IP/MAC address groups
- `unifi_create_ip_group`: Create address group
- `unifi_update_ip_group`: Update group configuration
- `unifi_delete_ip_group`: Delete address group
- `unifi_add_to_ip_group`: Add address to group
- `unifi_remove_from_ip_group`: Remove address from group

### Monitoring and Statistics

- `unifi_get_site_stats`: Get general site statistics
- `unifi_get_bandwidth_usage`: Get bandwidth usage by client/device
- `unifi_get_events`: Get system events and logs
- `unifi_get_alerts`: Get active system alerts
- `unifi_get_topology`: Get network topology
- `unifi_get_interference`: Get WiFi interference data

### Automation Tools

- `unifi_schedule_device_block`: Schedule device blocking
- `unifi_emergency_lockdown`: Activate emergency network lockdown
- `unifi_bulk_device_management`: Perform bulk operations on devices
- `unifi_auto_backup_config`: Backup configuration automatically
- `unifi_health_check`: Perform comprehensive health check

## Usage Examples

### Basic Connection

```typescript
// Connect to UniFi controller
await mcp.callTool("unifi_connect", {
  gatewayIp: "192.168.1.1",
  apiKey: "your-api-key",
  siteId: "default",
});

// Test connection
const status = await mcp.callTool("unifi_test_connection", {});
console.log("Connection status:", status.data.status);
```

### Device Management

```typescript
// Get all devices
const devices = await mcp.callTool("unifi_get_devices", {});

// Get specific device details
const device = await mcp.callTool("unifi_get_device_details", {
  deviceId: "device-mac-address",
});

// Restart a device
await mcp.callTool("unifi_restart_device", {
  deviceId: "device-mac-address",
});
```

### Zone-Based Firewall (UniFi 9.0+)

```typescript
// Create IoT zone
await mcp.callTool("unifi_create_zone", {
  name: "iot_zone",
  description: "IoT devices zone",
  networks: ["iot_network_id"],
});

// Create policy: IoT zone cannot access Internal zone
await mcp.callTool("unifi_create_zone_policy", {
  sourceZone: "iot_zone",
  targetZone: "internal",
  action: "deny",
  logging: true,
});

// Allow IoT zone to access external (internet)
await mcp.callTool("unifi_create_zone_policy", {
  sourceZone: "iot_zone",
  targetZone: "external",
  action: "allow",
});
```

### Legacy Firewall

```typescript
// Create firewall rule
await mcp.callTool("unifi_create_firewall_rule", {
  name: "Block_SSH_External",
  action: "deny",
  protocol: "tcp",
  source: "any",
  destination: "192.168.1.0/24",
  destinationPort: "22",
  priority: 2000,
});
```

### Network Management

```typescript
// Create guest network
await mcp.callTool("unifi_create_network", {
  name: "Guest_Network",
  purpose: "guest",
  vlanId: 100,
  subnet: "192.168.100.0/24",
  gateway: "192.168.100.1",
  dhcpEnabled: true,
  dhcpRange: {
    start: "192.168.100.10",
    end: "192.168.100.100",
  },
});
```

### Monitoring

```typescript
// Get site statistics
const stats = await mcp.callTool("unifi_get_site_stats", {
  timeframe: "day",
});

// Get bandwidth usage for specific client
const usage = await mcp.callTool("unifi_get_bandwidth_usage", {
  entityType: "client",
  entityId: "client-mac-address",
  timeframe: "hour",
});
```

### Automation

```typescript
// Schedule device blocking during school hours
await mcp.callTool("unifi_schedule_device_block", {
  deviceId: "kid-device-mac",
  schedule: {
    days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    startTime: "08:00",
    endTime: "15:00",
  },
});

// Emergency lockdown
await mcp.callTool("unifi_emergency_lockdown", {
  blockAllClients: true,
  allowedDevices: ["admin-device-mac"],
  autoDisableAfter: 60, // minutes
});
```

## Version Compatibility

### UniFi Network Application Versions

| Version | Legacy Firewall | Zone-Based Firewall | Advanced Stats | Notes               |
| ------- | --------------- | ------------------- | -------------- | ------------------- |
| 6.0-8.5 | ✅ Full         | ❌ Not Available    | ⚠️ Limited     | Basic functionality |
| 9.0+    | ⚠️ Deprecated   | ✅ Full             | ✅ Full        | ZBF recommended     |

### Hardware Compatibility

| Device    | Legacy Firewall | Zone-Based Firewall | Advanced Features |
| --------- | --------------- | ------------------- | ----------------- |
| UCG-Ultra | ✅              | ✅                  | ✅                |
| UCG-Max   | ✅              | ✅                  | ✅                |
| UDM-Pro   | ✅              | ✅                  | ⚠️ Limited        |
| UDM-Base  | ✅              | ✅                  | ⚠️ Limited        |
| USG-Pro-4 | ✅              | ❌                  | ❌                |
| USG-3P    | ✅              | ❌                  | ❌                |

## Error Handling

The server provides comprehensive error handling with structured error responses:

```typescript
// Example error response
{
  "success": false,
  "error": {
    "code": "FEATURE_NOT_SUPPORTED",
    "message": "Zone-Based Firewall requires UniFi Network 9.0+",
    "details": {
      "feature": "zbf",
      "currentVersion": "8.5.6",
      "requiredVersion": "9.0.0"
    }
  }
}
```

### Common Error Codes

- `CONNECTION_FAILED`: Unable to connect to UniFi controller
- `AUTHENTICATION_FAILED`: Invalid API key or permissions
- `FEATURE_NOT_SUPPORTED`: Feature not available in current version
- `HARDWARE_INCOMPATIBLE`: Feature requires different hardware
- `VALIDATION_ERROR`: Invalid input parameters
- `RATE_LIMIT_EXCEEDED`: API rate limit exceeded

## Development

### Project Structure

```
src/
├── index.ts                 # Main entry point
├── server/                  # MCP server implementation
│   ├── mcpServer.ts        # Main server class
│   ├── toolRegistry.ts     # Tool management
│   └── types.ts            # Server types
├── unifi/                  # UniFi API client
│   ├── client.ts           # HTTP client
│   ├── versionDetector.ts  # Version detection
│   └── types.ts            # UniFi types
├── tools/                  # Tool implementations
│   ├── connection/         # Connection tools
│   ├── devices/            # Device management
│   ├── firewall/           # Firewall tools
│   ├── networks/           # Network management
│   ├── monitoring/         # Statistics and monitoring
│   └── automation/         # Automation tools
├── utils/                  # Utilities
│   ├── errors.ts           # Error handling
│   ├── validators.ts       # Input validation
│   ├── logger.ts           # Logging system
│   └── helpers.ts          # Helper functions
└── config/                 # Configuration
    ├── environment.ts      # Environment config
    └── constants.ts        # System constants
```

### Building

```bash
npm run build
```

### Testing

```bash
npm test
npm run test:watch
npm run test:coverage
```

### Linting

```bash
npm run lint
npm run lint:fix
```

## Troubleshooting

### Common Issues

#### Connection Problems

1. **Certificate Errors**: Set `UNIFI_VERIFY_SSL=false` for self-signed certificates
2. **Network Timeout**: Increase `UNIFI_TIMEOUT` value
3. **API Key Invalid**: Verify API key is correct and has proper permissions

#### Feature Availability

1. **ZBF Tools Unavailable**: Check UniFi version is 9.0+ and hardware supports ZBF
2. **Legacy Tools Deprecated**: Consider migrating to ZBF for new UniFi versions
3. **Limited Statistics**: Advanced stats require UniFi 8.5+

#### Performance Issues

1. **Rate Limiting**: Reduce `API_RATE_LIMIT_PER_MINUTE` if needed
2. **Slow Responses**: Enable caching with appropriate `CACHE_TTL_SECONDS`
3. **Memory Usage**: Monitor and adjust cache settings

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm start
```

### Health Check

The server provides health check endpoints for monitoring:

```bash
# Check server status
curl http://localhost:9090/health

# Get detailed debug info
curl http://localhost:9090/debug
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Add comprehensive tests for new features
- Update documentation for API changes
- Use conventional commit messages
- Ensure all tests pass before submitting

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: GitHub Issues
- **Documentation**: This README and inline code documentation
- **Examples**: See `examples/` directory for complete usage examples

## Changelog

### v1.0.0

- Initial release
- Full UniFi Network API support
- Zone-Based Firewall integration
- Comprehensive tool set
- Production-ready error handling and logging
