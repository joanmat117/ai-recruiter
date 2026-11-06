# ===========================================
# AI Recruiter - Multi-stage Docker Build
# ===========================================
FROM node:20-alpine AS base

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++ postgresql-client

# Set working directory
WORKDIR /app

# ===========================================
# Stage 1: Install dependencies
# ===========================================
FROM base AS deps

# Copy package files
COPY package*.json ./

# Install dependencies (use legacy-peer-deps for LangChain compatibility)
RUN npm ci --legacy-peer-deps

# ===========================================
# Stage 2: Build application
# ===========================================
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install AWS SDK and pg for entrypoint
RUN npm install @aws-sdk/client-s3 pg --legacy-peer-deps

# Build NestJS application
RUN npm run build && ls -la /app/dist

# ===========================================
# Stage 3: Production runner
# ===========================================
FROM base AS runner

ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/dist/src ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/drizzle.config.ts ./
COPY --from=builder --chown=nestjs:nodejs /app/src/db ./src/db

# Copy entrypoint script
COPY --from=builder --chown=nestjs:nodejs /app/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start via entrypoint (runs migrations, creates bucket, then starts app)
ENTRYPOINT ["./entrypoint.sh"]