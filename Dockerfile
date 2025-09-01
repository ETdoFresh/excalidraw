# syntax=docker/dockerfile:1.6

# Single image that installs frontend, backend, and proxy, then runs `npm start` at the repo root.
FROM node:18

WORKDIR /opt/app

# Ensure Yarn (v1) is available for the frontend workspace
RUN corepack enable && corepack prepare yarn@1.22.22 --activate

# Install root deps (concurrently)
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi

# Copy the app source
COPY backend ./backend
COPY frontend ./frontend
COPY proxy ./proxy

# Install subproject deps using the orchestrator script
RUN npm run setup

# Build the frontend once (no dev/watch in container)
RUN yarn --cwd frontend build:app:docker

# Environment for proxy to serve the built frontend
ENV SERVE_STATIC=true \
    FRONTEND_DIR=/opt/app/frontend/excalidraw-app/build

# Ports: proxy(3000), backend(3001)
EXPOSE 3000 3001

# Default command runs backend + proxy only
CMD ["npm", "run", "start:prod"]
