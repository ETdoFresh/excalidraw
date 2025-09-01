const http = require('http');
const path = require('path');
const fs = require('fs');
const httpProxy = require('http-proxy');
const serveStatic = require('serve-static');
const finalhandler = require('finalhandler');

const PORT = Number(process.env.PORT || 3000);
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT || 5173);
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 3001);

// Prefer IPv4 loopback to avoid IPv6 (::1) resolution issues inside containers
const FRONTEND_TARGET = process.env.FRONTEND_ORIGIN || `http://127.0.0.1:${FRONTEND_PORT}`;
const BACKEND_TARGET = process.env.BACKEND_ORIGIN || `http://127.0.0.1:${BACKEND_PORT}`;

// If a built frontend directory is provided, serve it instead of proxying to the Vite dev server
const FRONTEND_DIR = process.env.FRONTEND_DIR || path.resolve(__dirname, 'build');
const hasBuiltFrontend = (() => {
  try {
    return fs.existsSync(path.join(FRONTEND_DIR, 'index.html'));
  } catch {
    return false;
  }
})();

const staticMiddleware = serveStatic(FRONTEND_DIR, {
  index: ['index.html'],
  fallthrough: true,
});

const proxy = httpProxy.createProxyServer({});

proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err.message);
  if (!res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
  }
  res.end(JSON.stringify({ error: 'Bad Gateway', detail: err.message }));
});

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const isApi = url.pathname.startsWith('/api');
  if (isApi) {
    proxy.web(req, res, { target: BACKEND_TARGET, changeOrigin: true });
    return;
  }

  if (hasBuiltFrontend) {
    staticMiddleware(req, res, () => {
      // SPA fallback to index.html for non-file routes
      if (req.method === 'GET') {
        const indexPath = path.join(FRONTEND_DIR, 'index.html');
        fs.readFile(indexPath, (err, data) => {
          if (err) return finalhandler(req, res)(err);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(data);
        });
      } else {
        finalhandler(req, res)(404);
      }
    });
  } else {
    proxy.web(req, res, { target: FRONTEND_TARGET, changeOrigin: true });
  }
});

// Support WebSocket upgrades (Vite dev server/HMR, etc.)
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const isApi = url.pathname.startsWith('/api');
  const target = isApi ? BACKEND_TARGET : FRONTEND_TARGET;
  // no websockets for static serving mode; dev server only
  if (!isApi && hasBuiltFrontend) {
    socket.destroy();
    return;
  }
  proxy.ws(req, socket, head, { target, changeOrigin: true });
});

server.listen(PORT, () => {
  console.log(`Proxy listening on http://localhost:${PORT}`);
  console.log(`  /api -> ${BACKEND_TARGET}`);
  if (hasBuiltFrontend) {
    console.log(`  /*   -> static ${FRONTEND_DIR}`);
  } else {
    console.log(`  /*   -> ${FRONTEND_TARGET}`);
  }
});
