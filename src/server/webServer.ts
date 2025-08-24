import express, { Request, Response, NextFunction } from 'express';
import { UniFiMCPServer } from './mcpServer.js';
import { createComponentLogger } from '../utils/logger.js';
import { config } from '../config/environment.js';

/**
 * Web Server for OpenAPI Documentation
 * 
 * Provides HTTP endpoints for serving OpenAPI documentation and debugging
 * the UniFi MCP server tools and capabilities.
 */

const logger = createComponentLogger('web-server');

export class UniFiWebServer {
  private app: express.Application;
  private server: any;
  private mcpServer: UniFiMCPServer;
  private port: number;

  constructor(mcpServer: UniFiMCPServer, port: number = 8100) {
    this.app = express();
    this.mcpServer = mcpServer;
    this.port = port;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // CORS middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      const status = this.mcpServer.getStatus();
      res.json({
        status: 'healthy',
        server: status,
        timestamp: new Date().toISOString()
      });
    });

    // Debug information endpoint
    this.app.get('/debug', async (_req: Request, res: Response) => {
      try {
        const serverInfo = await this.mcpServer.getServerInfo();
        res.json(serverInfo);
      } catch (error) {
        res.status(500).json({
          error: 'Failed to get server info',
          message: (error as Error).message
        });
      }
    });

    // OpenAPI specification endpoint
    this.app.get('/unifi-network/openapi.json', async (_req: Request, res: Response) => {
      try {
        const openApiSpec = await this.generateOpenApiSpec();
        res.json(openApiSpec);
      } catch (error) {
        logger.error('Failed to generate OpenAPI spec', error);
        res.status(500).json({
          error: 'Failed to generate OpenAPI specification',
          message: (error as Error).message
        });
      }
    });

    // OpenAPI documentation UI
    this.app.get('/unifi-network/docs', async (_req: Request, res: Response) => {
      try {
        const openApiSpec = await this.generateOpenApiSpec();
        const html = this.generateSwaggerUI(openApiSpec);
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
      } catch (error) {
        logger.error('Failed to serve documentation', error);
        res.status(500).send(`
          <html>
            <head><title>Error</title></head>
            <body>
              <h1>Error</h1>
              <p>Failed to generate documentation: ${(error as Error).message}</p>
            </body>
          </html>
        `);
      }
    });

    // Tools listing endpoint
    this.app.get('/tools', async (_req: Request, res: Response) => {
      try {
        const tools = await this.mcpServer['toolRegistry'].getToolsForMCP();
        res.json({
          tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          })),
          count: tools.length
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to get tools',
          message: (error as Error).message
        });
      }
    });

    // Root redirect
    this.app.get('/', (_req: Request, res: Response) => {
      res.redirect('/unifi-network/docs');
    });
  }

  private async generateOpenApiSpec(): Promise<any> {
    try {
      const tools = await this.mcpServer['toolRegistry'].getToolsForMCP();
      
      logger.info('Generating OpenAPI spec', { toolCount: tools.length });
      
      const paths: any = {};

      // Generate paths for each tool
      for (const tool of tools) {
        const path = `/tools/${tool.name}`;
        paths[path] = {
          post: {
            summary: tool.description,
            description: tool.description,
            operationId: tool.name,
            tags: [this.getToolCategory(tool.name)],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: tool.inputSchema || {
                    type: 'object',
                    properties: {},
                    additionalProperties: true
                  }
                }
              }
            },
            responses: {
              '200': {
                description: 'Tool execution result',
                content: {
                  'application/json': {
                    schema: {
                      '$ref': '#/components/schemas/ToolResult'
                    }
                  }
                }
              },
              '400': {
                description: 'Bad request - invalid parameters'
              },
              '404': {
                description: 'Tool not found'
              },
              '412': {
                description: 'Precondition failed - connection required'
              },
              '500': {
                description: 'Internal server error'
              }
            }
          }
        };
      }

      // If no tools available, add a placeholder endpoint
      if (tools.length === 0) {
        paths['/status'] = {
          get: {
            summary: 'Get server status',
            description: 'Returns the current status of the UniFi MCP server. Tools will be available after connecting to UniFi.',
            operationId: 'getStatus',
            tags: ['System'],
            responses: {
              '200': {
                description: 'Server status information',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        initialized: { type: 'boolean' },
                        connected: { type: 'boolean' },
                        tools: {
                          type: 'object',
                          properties: {
                            total: { type: 'number' },
                            enabled: { type: 'number' },
                            available: { type: 'number' }
                          }
                        },
                        uptime: { type: 'number' },
                        version: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        };
      }

      const openApiSpec = {
        openapi: '3.0.3',
        info: {
          title: 'UniFi Network MCP Server',
          version: config.server.version,
          description: `
A comprehensive Model Context Protocol server for UniFi Network management.

This server provides access to UniFi Network API functionality through a standardized tool interface,
including device management, client monitoring, firewall configuration, and network administration.

## Connection Status

${tools.length > 0 ? '✅ **Connected** - All tools are available for use.' : '⚠️ **Not Connected** - Connect to UniFi first using the `unifi_connect` tool.'}

## Features

- **Device Management**: Monitor and control UniFi devices (UDM, USW, UAP, etc.)
- **Client Management**: Track and manage connected clients
- **Network Configuration**: Manage networks, VLANs, and routing
- **Firewall Management**: Configure both legacy and Zone-Based Firewall rules
- **Monitoring**: Real-time metrics and health monitoring
- **Automation**: Scheduled tasks and bulk operations

## Authentication

All tools require an active connection to a UniFi Network controller. Use the \`unifi_connect\` tool
to establish a connection before using other functionality.

## Tool Categories

- **Connection**: Authentication and connection management
- **Devices**: UniFi device monitoring and control
- **Clients**: Client device management
- **Networks**: Network and VLAN configuration
- **Firewall**: Security rule management
- **Monitoring**: System monitoring and metrics
- **Automation**: Scheduled operations and bulk actions
          `,
          contact: {
            name: 'UniFi MCP Server',
            url: 'https://github.com/your-repo/unifi-mcp-server'
          },
          license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT'
          }
        },
        servers: [
          {
            url: `http://localhost:${this.port}`,
            description: 'Local development server'
          }
        ],
        tags: this.generateTags(),
        paths,
        components: {
          schemas: {
            ToolResult: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: { type: 'object' },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string' },
                    message: { type: 'string' },
                    details: { type: 'object' }
                  }
                },
                warnings: {
                  type: 'array',
                  items: { type: 'string' }
                },
                metadata: {
                  type: 'object',
                  properties: {
                    executionTime: { type: 'number' },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      };

      logger.info('Generated OpenAPI specification', { 
        toolCount: tools.length,
        pathCount: Object.keys(paths).length
      });

      return openApiSpec;
    } catch (error) {
      logger.error('Failed to generate OpenAPI specification', error);
      throw error;
    }
  }

  private generateTags(): any[] {
    return [
      { name: 'System', description: 'System status and information' },
      { name: 'Connection', description: 'Connection and authentication tools' },
      { name: 'Devices', description: 'UniFi device management' },
      { name: 'Clients', description: 'Client device management' },
      { name: 'Networks', description: 'Network configuration' },
      { name: 'Firewall', description: 'Firewall rule management' },
      { name: 'Monitoring', description: 'System monitoring and metrics' },
      { name: 'Automation', description: 'Automation and bulk operations' }
    ];
  }

  private getToolCategory(toolName: string): string {
    if (toolName.includes('connect') || toolName.includes('test_connection') || toolName.includes('system_info')) {
      return 'Connection';
    } else if (toolName.includes('device')) {
      return 'Devices';
    } else if (toolName.includes('client')) {
      return 'Clients';
    } else if (toolName.includes('network')) {
      return 'Networks';
    } else if (toolName.includes('firewall') || toolName.includes('rule')) {
      return 'Firewall';
    } else if (toolName.includes('monitor') || toolName.includes('health')) {
      return 'Monitoring';
    } else if (toolName.includes('automation') || toolName.includes('bulk')) {
      return 'Automation';
    }
    return 'Other';
  }

  private generateSwaggerUI(openApiSpec: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>UniFi Network MCP Server - API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui.css" />
  <style>
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .scheme-container { display: none; }
    .connection-status {
      background: ${openApiSpec.paths && Object.keys(openApiSpec.paths).length > 1 ? '#d4edda' : '#fff3cd'};
      border: 1px solid ${openApiSpec.paths && Object.keys(openApiSpec.paths).length > 1 ? '#c3e6cb' : '#ffeaa7'};
      color: ${openApiSpec.paths && Object.keys(openApiSpec.paths).length > 1 ? '#155724' : '#856404'};
      padding: 12px;
      margin: 20px 0;
      border-radius: 4px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: './openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.presets.standalone
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        tryItOutEnabled: false,
        displayRequestDuration: true,
        docExpansion: 'list',
        defaultModelsExpandDepth: 2,
        showExtensions: true,
        showCommonExtensions: true
      });
    };
  </script>
</body>
</html>
    `;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          logger.info(`UniFi MCP Web Server started`, {
            port: this.port,
            docsUrl: `http://localhost:${this.port}/unifi-network/docs`,
            healthUrl: `http://localhost:${this.port}/health`
          });
          resolve();
        });

        this.server.on('error', (error: Error) => {
          logger.error('Web server error', error);
          reject(error);
        });
      } catch (error) {
        logger.error('Failed to start web server', error);
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('UniFi MCP Web Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getPort(): number {
    return this.port;
  }
}