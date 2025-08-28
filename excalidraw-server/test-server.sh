#!/bin/bash

# Test script for Excalidraw server API endpoints

SERVER_URL="${1:-http://localhost:3000}"

echo "Testing Excalidraw Server at: $SERVER_URL"
echo "======================================="

# Test health endpoint
echo "1. Testing health endpoint..."
curl -s "$SERVER_URL/api/health" | jq . || echo "Health check failed"
echo ""

# Test listing saves
echo "2. Testing list saves..."
curl -s "$SERVER_URL/api/saves" | jq . || echo "List saves failed"
echo ""

# Test saving a file with PUT
echo "3. Testing PUT save..."
TEST_DATA='{"elements":[],"appState":{"viewBackgroundColor":"#ffffff"},"files":{}}'
curl -X PUT \
  -H "Content-Type: application/json" \
  -d "$TEST_DATA" \
  -s "$SERVER_URL/api/saves/test-drawing.excalidraw" | jq . || echo "PUT save failed"
echo ""

# Test saving a file with POST
echo "4. Testing POST save..."
curl -X POST \
  -H "Content-Type: application/json" \
  -d "$TEST_DATA" \
  -s "$SERVER_URL/api/saves/test-drawing2.excalidraw" | jq . || echo "POST save failed"
echo ""

# Test retrieving a saved file
echo "5. Testing GET saved file..."
curl -s "$SERVER_URL/api/saves/test-drawing.excalidraw" | jq . || echo "GET file failed"
echo ""

# List saves again to see our test files
echo "6. Listing saves again..."
curl -s "$SERVER_URL/api/saves" | jq . || echo "List saves failed"
echo ""

echo "Test complete!"