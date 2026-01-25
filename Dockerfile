# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
# Dummy env vars for build time (real values injected at runtime)
ENV NEXT_TELEMETRY_DISABLED=1
ENV MONGODB_URI="mongodb://localhost:27017/placeholder"
ENV AUTH_SECRET="placeholder-secret-key-at-least-32-chars"
ENV NEXTAUTH_URL="http://localhost:3000"
ENV OPENAI_API_KEY="sk-placeholder"
ENV S3_ENDPOINT="http://localhost:9000"
ENV S3_ACCESS_KEY="placeholder"
ENV S3_SECRET_KEY="placeholder"
ENV S3_BUCKET="placeholder"
ENV LINKEDIN_CLIENT_ID="placeholder"
ENV LINKEDIN_CLIENT_SECRET="placeholder"
ENV CRON_SECRET="placeholder"

RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install ffmpeg for video processing
RUN apk add --no-cache ffmpeg

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
