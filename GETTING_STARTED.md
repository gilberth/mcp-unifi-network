# Getting Started with UniFi MCP Server

This guide will help you get the UniFi MCP Server up and running quickly.

## Prerequisites

### System Requirements
- **Node.js**: Version 18.0 or higher
- **npm**: Version 8.0 or higher (comes with Node.js)
- **Operating System**: Windows, macOS, or Linux

### UniFi Requirements
- **UniFi Network Application**: Version 6.0+ (9.0+ recommended for ZBF features)
- **UniFi Gateway**: Any UniFi gateway with API access enabled
- **API Key**: Valid API key with appropriate permissions

## Installation Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy the example environment file and edit it with your settings:
```bash
cp .env.example .env
```

Edit `.env` file:
```env
# UniFi Controller Settings (REQUIRED)
UNIFI_GATEWAY_IP=192.168.1.1          # Your UniFi gateway IP
UNIFI_API_KEY=your_api_key_here       # Your API key
UNIFI_SITE_ID=default                 # Usually 'default'
UNIFI_VERIFY_SSL=false                # false for self-signed certs

# Optional Settings
UNIFI_TIMEOUT=30000                   # Request timeout (ms)
UNIFI_MAX_RETRIES=3                   # Max retry attempts
LOG_LEVEL=info                        # Logging level
```

### 3. Build the Project
```bash
npm run build
```

### 4. Start the Server
```bash
npm start
```

## Quick Test

After starting the server, you can test the connection using the MCP protocol:

### Test Connection
```json
{
  "method": "tools/call",
  "params": {
    "name": "unifi_connect",
    "arguments": {
      "gatewayIp": "192.168.1.1",
      "apiKey": "your-api-key",
      "siteId": "default"
    }
  }
}
```

### Get System Information
```json
{
  "method": "tools/call",
  "params": {
    "name": "unifi_get_system_info",
    "arguments": {
      "includeCapabilities": true
    }
  }
}
```

## API Key Setup

### For UniFi Dream Machine/Gateway
1. Access your UniFi controller web interface
2. Go to **Settings** → **Admins & Users**
3. Click **Add Admin**
4. Choose **Local Admin** type
5. Generate an API key or note the existing one

### For Cloud Key or Self-Hosted
1. Access UniFi Network Application
2. Navigate to **Settings** → **System** → **Admins**
3. Edit your admin user or create new one
4. Generate API key in the user settings

## Common Issues & Solutions

### Connection Issues

**Problem**: `CONNECTION_FAILED` error
```
Solution:
1. Verify UNIFI_GATEWAY_IP is correct
2. Ensure UniFi controller is running
3. Check network connectivity
4. Verify port 443 (or custom port) is accessible
```

**Problem**: `AUTHENTICATION_FAILED` error
```
Solution:
1. Verify API key is correct
2. Check API key permissions
3. Ensure API key hasn't expired
4. Try regenerating the API key
```

**Problem**: `SSL certificate verification failed`
```
Solution:
1. Set UNIFI_VERIFY_SSL=false in .env file
2. This is normal for self-signed certificates
```

### Feature Issues

**Problem**: Zone-Based Firewall tools not available
```
Solution:
1. Verify UniFi version is 9.0+
2. Check hardware compatibility
3. Ensure ZBF is enabled in controller
4. Set ENABLE_ZBF_TOOLS=true in .env
```

**Problem**: Legacy firewall tools not working
```
Solution:
1. Check if controller migrated to ZBF
2. Set ENABLE_LEGACY_FIREWALL=true in .env
3. Verify controller version compatibility
```

## Development Mode

For development and testing:

```bash
# Install development dependencies
npm install

# Run in development mode with hot reload
npm run dev

# Run tests
npm test

# Run linting
npm run lint
```

## Debugging

Enable debug logging:
```env
LOG_LEVEL=debug
LOG_FILE=./logs/unifi-mcp.log
```

Check logs:
```bash
tail -f ./logs/unifi-mcp.log
```

## Next Steps

1. **Test Basic Functionality**: Try connection and system info tools
2. **Explore Available Tools**: Use `tools/list` to see all available tools
3. **Review Examples**: Check `examples/usage-examples.ts` for practical use cases
4. **Customize Configuration**: Adjust settings in `.env` for your environment
5. **Set Up Monitoring**: Configure health checks and alerting

## Support

- **Documentation**: See README.md for comprehensive documentation
- **Examples**: Check the `examples/` directory
- **Issues**: Report issues on GitHub
- **Configuration**: Review all environment variables in `.env.example`

## Security Notes

⚠️ **Important Security Considerations**:
- Store API keys securely (never commit to version control)
- Use appropriate firewall rules for the MCP server
- Regularly rotate API keys
- Monitor access logs
- Run the server in a secure environment

## Verification Checklist

Before considering your setup complete, verify:

- [ ] Server starts without errors
- [ ] Connection to UniFi controller succeeds
- [ ] System information retrieval works
- [ ] Appropriate tools are available based on your UniFi version
- [ ] Logging is working as expected
- [ ] Environment variables are properly configured

Congratulations! Your UniFi MCP Server is now ready for use. 🎉