# Excalidraw Server Drive Setup

This document explains how to set up and use the Server Drive functionality in Excalidraw.

## Features

- **Ctrl+S**: Save to server (replaces local save)
- **Ctrl+O**: Open from server (shows file browser dialog)
- **Ctrl+Shift+S**: Save to local file (original behavior)
- **Ctrl+Shift+O**: Open from local file (original behavior)

## Server Setup

### Option 1: Use the included Node.js server

1. Install dependencies:
```bash
npm install express cors
# or copy server-package.json to package.json and run:
npm install
```

2. Start the server:
```bash
node server.js
```

The server will run on port 3001 by default and store files in `./server-saves/` directory.

### Option 2: Implement your own server

Your server needs to implement these REST endpoints:

- `GET /api/saves` - List all saved files
  - Returns: `Array<{name: string, path: string, size: number, modified: string}>`
  
- `GET /api/saves/:filename` - Load a specific file
  - Returns: Excalidraw JSON data
  
- `PUT /api/saves/:filename` - Save a file
  - Body: Excalidraw JSON data
  - Returns: Success confirmation
  
- `DELETE /api/saves/:filename` - Delete a file
  - Returns: Success confirmation

## Development Setup

The Vite development server is configured to proxy `/api/saves` requests to `http://localhost:3001`.

1. Start the server (port 3001):
```bash
node server.js
```

2. Start Excalidraw dev server (port 3000):
```bash
yarn start
```

## Production Setup

Set the environment variable `VITE_APP_API_URL` to your API server URL:

```bash
VITE_APP_API_URL=https://your-api-server.com yarn build
```

Or configure your web server to proxy `/api/saves` requests to your backend.

## Testing the API

Run the test script to verify your server is working:

```bash
node test-api.js
```

## Security Considerations

1. **Authentication**: The current implementation doesn't include authentication. Add auth headers/cookies as needed.
2. **Path Traversal**: The example server includes basic path traversal protection.
3. **File Size Limits**: Consider adding file size limits in production.
4. **Rate Limiting**: Add rate limiting to prevent abuse.

## File Format

Files are saved with the `.excalidraw` extension and contain standard Excalidraw JSON data:

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "...",
  "elements": [...],
  "appState": {...},
  "files": {...}
}
```