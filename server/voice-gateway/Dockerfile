# ==============================================================================
# EduManage Voice Gateway - Multi-stage Production Dockerfile
# Optimized for Render Web Services & Docker hosting
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build TypeScript to JavaScript
# ------------------------------------------------------------------------------
FROM --platform=linux/amd64 node:22-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime
# ------------------------------------------------------------------------------
FROM --platform=linux/amd64 node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
# Render overrides PORT (typically 10000); default to 8088 locally
ENV PORT=8088 \
    HOST=0.0.0.0

COPY package.json ./
RUN npm install --omit=dev

# Copy compiled JavaScript output
COPY --from=builder /app/dist ./dist

# Use non-root user
USER node

EXPOSE 8088 10000

# Container healthcheck against /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e 'const http = require("http"); const port = process.env.PORT || 8088; http.get(`http://127.0.0.1:${port}/health`, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on("error", () => process.exit(1));'

# Handle rootDir variations: start dist/index.js if present, otherwise dist/src/index.js
CMD ["sh", "-c", "if [ -f dist/index.js ]; then node dist/index.js; else node dist/src/index.js; fi"]
