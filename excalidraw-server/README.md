# Excalidraw Server

A self-hosted Excalidraw instance with backend API support for saving and loading drawings.

## Features

- Full Excalidraw frontend
- Backend API for persistent storage
- Save/load drawings to server
- Multi-platform Docker support (amd64, arm64)

## Quick Start

### Using Docker

```bash
docker run -p 3000:3000 -v ./saves:/app/saves etdofresh/excalidraw-server:latest
```

### Using Docker Compose

```bash
docker-compose up -d
```

## API Endpoints

- `GET /api/saves` - List all saved drawings
- `GET /api/saves/:filename` - Get specific drawing
- `POST /api/saves/:filename` - Save/update drawing
- `DELETE /api/saves/:filename` - Delete drawing
- `GET /api/health` - Health check

## Building

```bash
# Build multi-platform image
docker buildx build --platform linux/amd64,linux/arm64 -t etdofresh/excalidraw-server:latest --push .
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (default: production)

## Volume

Mount `/app/saves` to persist drawings between container restarts.