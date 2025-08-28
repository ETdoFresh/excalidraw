# Multi-stage build for Excalidraw with backend server

# Stage 1: Build Excalidraw frontend
FROM --platform=${BUILDPLATFORM} node:18 AS frontend-build

WORKDIR /opt/app

# Copy the entire excalidraw source (context is parent directory)
COPY . .

# Install dependencies and build
RUN --mount=type=cache,target=/root/.cache/yarn \
    npm_config_target_arch=${TARGETARCH} yarn --network-timeout 600000

ARG NODE_ENV=production
RUN npm_config_target_arch=${TARGETARCH} yarn build:app:docker

# Stage 2: Setup backend server
FROM --platform=${TARGETPLATFORM} node:18-alpine

WORKDIR /app

# Copy server files from excalidraw-server subdirectory
COPY excalidraw-server/package*.json ./
COPY excalidraw-server/server.js ./

# Install production dependencies
RUN npm ci --only=production || npm install --production

# Copy built frontend from stage 1
COPY --from=frontend-build /opt/app/excalidraw-app/build ./public

# Create saves directory
RUN mkdir -p /app/saves

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)}).on('error', () => process.exit(1))"

# Start server
CMD ["node", "server.js"]