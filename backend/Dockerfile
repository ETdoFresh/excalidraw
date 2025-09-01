FROM --platform=${BUILDPLATFORM} node:18-alpine AS deps

WORKDIR /opt/node_app

# Install only production dependencies with cache
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

FROM --platform=${TARGETPLATFORM} node:18-alpine

WORKDIR /opt/node_app

ENV NODE_ENV=production

# Copy installed deps from deps stage
COPY --from=deps /opt/node_app/node_modules ./node_modules

# Copy application source
COPY . .

EXPOSE 3001

HEALTHCHECK CMD wget -q -O /dev/null http://localhost:3001/api/health || exit 1

CMD ["node", "src/server.js"]
