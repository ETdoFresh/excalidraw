#!/bin/bash

# Build script for Excalidraw server with enhanced logging

echo "Building Excalidraw server with enhanced logging..."

# Copy server files to root for Docker context
cp excalidraw-server/package.json server-package.json
cp excalidraw-server/server.js server.js

# Build multi-platform image
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t etdofresh/excalidraw-server:v2 \
  -t etdofresh/excalidraw-server:latest \
  -f Dockerfile.server \
  --push \
  .

# Clean up
rm -f server-package.json server.js

echo "Build complete!"
echo ""
echo "To run locally:"
echo "  docker run -p 3000:3000 -v ./saves:/app/saves -e ENABLE_FRONTEND_LOGGING=true etdofresh/excalidraw-server:v2"
echo ""
echo "The server will show:"
echo "  - Startup health checks"
echo "  - All API requests"
echo "  - Frontend console logs (if ENABLE_FRONTEND_LOGGING=true)"
echo "  - Save/load operations"