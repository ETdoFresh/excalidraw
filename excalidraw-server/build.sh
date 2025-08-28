#!/bin/bash

# Build Excalidraw with backend server
# Run this from the excalidraw-server directory

echo "Building Excalidraw with backend server..."

# Build from parent directory context
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t etdofresh/excalidraw-server:latest \
  -f Dockerfile \
  --push \
  ..

echo "Build complete! Image pushed to etdofresh/excalidraw-server:latest"