# ==============================================================================
# EduManage Web Application - Multi-stage Production Dockerfile
# Optimized for Render Web Services & Docker hosting
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Vite Production Assets
# ------------------------------------------------------------------------------
FROM --platform=linux/amd64 node:20-alpine AS builder

WORKDIR /app

# Install build dependencies required if any native packages run gyp
RUN apk add --no-cache python3 make g++

# Copy dependency manifests first for layer caching
COPY package.json package-lock.json ./

# Install npm dependencies (ignore Electron/Capacitor postinstall scripts)
RUN npm install --ignore-scripts

# Copy application source code
COPY . .

# Build-time environment variables inlined by Vite during build
# Defaults allow runtime injection via docker-entrypoint.sh if not provided at build time
ARG VITE_SUPABASE_URL=__VITE_SUPABASE_URL__
ARG VITE_SUPABASE_PUBLISHABLE_KEY=__VITE_SUPABASE_PUBLISHABLE_KEY__
ARG VITE_SUPABASE_PROJECT_ID=__VITE_SUPABASE_PROJECT_ID__
ARG VITE_GOOGLE_SITE_VERIFICATION=""
ARG VITE_PUBLIC_APP_URL=""

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID \
    VITE_GOOGLE_SITE_VERIFICATION=$VITE_GOOGLE_SITE_VERIFICATION \
    VITE_PUBLIC_APP_URL=$VITE_PUBLIC_APP_URL \
    NODE_ENV=production

# Compile production bundle into /app/dist
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Nginx Server
# ------------------------------------------------------------------------------
FROM --platform=linux/amd64 nginx:1.27-alpine AS runner

# Install curl for health checking
RUN apk add --no-cache curl

# Remove default nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy built application assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx configuration and dynamic port entrypoint script
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Render assigns dynamic PORT (typically 10000); default to 80 for local docker
ENV PORT=80

EXPOSE 80 10000

# Health check against the /healthz endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://127.0.0.1:${PORT}/healthz || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
