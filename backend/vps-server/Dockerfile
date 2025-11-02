# VoiceNote API - Dockerfile
# Multi-stage build for optimized production image

FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install since package-lock.json may not exist)
RUN npm install --omit=dev --prefer-offline --no-audit

# Production stage
FROM node:20-alpine

# Install better-sqlite3 dependencies
RUN apk add --no-cache python3 make g++ sqlite

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application files
COPY --chown=nodejs:nodejs . .

# Create directories for database and uploads
# Note: These will be overridden by volume mounts, but ensure they exist
RUN mkdir -p /app/data /app/uploads

# Switch to non-root user
USER nodejs

# Create directories as nodejs user (will be used if volumes are empty)
# This is a workaround for volume permission issues
RUN mkdir -p /app/data /app/uploads || true

# Expose port
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3333/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "server.js"]

