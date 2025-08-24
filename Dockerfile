# Multi-stage build for UniFi MCP Server
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S unifi -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist/

# Copy environment example (will be overridden by docker-compose or runtime)
COPY .env.example ./.env

# Change ownership to app user
RUN chown -R unifi:nodejs /app
USER unifi

# Expose port (if needed for health checks)
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]