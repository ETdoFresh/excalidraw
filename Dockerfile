# syntax=docker/dockerfile:1.6

########## FRONTEND (build + final) ##########
FROM --platform=${BUILDPLATFORM} node:18 AS fe-build
WORKDIR /opt/node_app/frontend

# Copy only the frontend workspace
COPY frontend/ .

# do not ignore optional dependencies:
# Error: Cannot find module @rollup/rollup-linux-x64-gnu
RUN --mount=type=cache,target=/root/.cache/yarn \
    npm_config_target_arch=${TARGETARCH} yarn --network-timeout 600000

ARG NODE_ENV=production
RUN npm_config_target_arch=${TARGETARCH} yarn build:app:docker

FROM --platform=${TARGETPLATFORM} nginx:1.27-alpine AS frontend
COPY --from=fe-build /opt/node_app/frontend/excalidraw-app/build /usr/share/nginx/html
HEALTHCHECK CMD wget -q -O /dev/null http://localhost || exit 1


########## BACKEND (deps + final) ##########
FROM --platform=${BUILDPLATFORM} node:18-alpine AS be-deps
WORKDIR /opt/node_app/backend
COPY backend/package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

FROM --platform=${TARGETPLATFORM} node:18-alpine AS backend
WORKDIR /opt/node_app/backend
ENV NODE_ENV=production
COPY --from=be-deps /opt/node_app/backend/node_modules ./node_modules
COPY backend/ .
EXPOSE 3001
HEALTHCHECK CMD wget -q -O /dev/null http://localhost:3001/api/health || exit 1
CMD ["node", "src/server.js"]


########## PROXY (deps + final) ##########
FROM --platform=${BUILDPLATFORM} node:18-alpine AS proxy-deps
WORKDIR /opt/node_app/proxy
COPY proxy/package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

FROM --platform=${TARGETPLATFORM} node:18-alpine AS proxy
WORKDIR /opt/node_app/proxy
ENV NODE_ENV=production \
    PORT=3000
COPY --from=proxy-deps /opt/node_app/proxy/node_modules ./node_modules
COPY proxy/ .
EXPOSE 3000
HEALTHCHECK CMD wget -q -O /dev/null http://localhost:3000 || exit 1
CMD ["node", "server.js"]

