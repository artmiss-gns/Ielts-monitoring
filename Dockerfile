# Multi-stage build for IELTS Appointment Monitor
# Stage 1: Build stage
FROM node:18-alpine AS builder

# Install build dependencies required for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --no-audit --no-fund

# Copy source code
COPY src/ ./src/

# Build TypeScript application
RUN npm run build:prod

# Stage 2: Production runtime
FROM node:18-alpine AS runtime

# Install Chrome dependencies for Puppeteer and system utilities
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S ielts -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy package files for production dependency installation
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create directories for volumes with proper permissions
RUN mkdir -p /app/config /app/logs /app/data && \
    chown -R ielts:nodejs /app

# Set Puppeteer environment variables for containerized Chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production \
    CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/bin/chromium-browser

# Switch to non-root user
USER ielts

# Health check to verify application can start
HEALTHCHECK --interval=120s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "console.log('Health check passed')" || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Default command - start monitoring
CMD ["node", "dist/index.js", "start"]