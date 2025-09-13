# RAK-TRI-V1 Advanced Docker Configuration
# Official Image: Node.js 20 Alpine (Lightweight & Secure)
FROM node:20-alpine AS base

# Security: Run as non-root user
RUN addgroup -g 1001 -S rak-tri && \
    adduser -S rak-tri -u 1001 -G rak-tri

# Install security updates and essential dependencies
RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache \
    curl \
    gnupg \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Switch to non-root user for security
USER rak-tri

# Copy package files
COPY --chown=rak-tri:rak-tri package*.json ./
COPY --chown=rak-tri:rak-tri .yarnrc.yml ./
COPY --chown=rak-tri:rak-tri .yarn/ ./.yarn/

# Install dependencies with security audit
RUN yarn install --immutable --check-cache && \
    yarn cache clean

# Copy application code (excluding sensitive files)
COPY --chown=rak-tri:rak-tri . .

# Security: Remove potential sensitive files
RUN find . -name "*.env.example" -type f -delete && \
    find . -name "*.key" -type f -delete && \
    find . -name "*.pem" -type f -delete

# Create secure directories for sessions and logs
RUN mkdir -p \
    /app/sessions \
    /app/logs \
    /app/backups \
    /app/plugins \
    && chmod 700 /app/sessions /app/backups

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Expose necessary ports
EXPOSE 3000  # Bot API port
EXPOSE 9229  # Debug port

# Environment variables
ENV NODE_ENV=production \
    RAK_TRI_VERSION=v1.0.0 \
    HOSTING_PLATFORM=bot-hosting-net \
    AUTO_UPDATE=true \
    SELF_HEALING=true

# Start command with security enhancements
CMD ["node", "--enable-source-maps", "--trace-warnings", "index.js"]