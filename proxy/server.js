const http = require('http');
const httpProxy = require('http-proxy');

const PORT = Number(process.env.PORT || 3000);
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT || 5173);
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 3001);

const FRONTEND_TARGET = process.env.FRONTEND_ORIGIN || `http://localhost:${FRONTEND_PORT}`;
const BACKEND_TARGET = process.env.BACKEND_ORIGIN || `http://localhost:${BACKEND_PORT}`;

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
  const target = isApi ? BACKEND_TARGET : FRONTEND_TARGET;

  proxy.web(req, res, { target, changeOrigin: true });
});

// Support WebSocket upgrades (Vite dev server/HMR, etc.)
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const isApi = url.pathname.startsWith('/api');
  const target = isApi ? BACKEND_TARGET : FRONTEND_TARGET;

  proxy.ws(req, socket, head, { target, changeOrigin: true });
});

server.listen(PORT, () => {
  console.log(`Proxy listening on http://localhost:${PORT}`);
  console.log(`  /api -> ${BACKEND_TARGET}`);
  console.log(`  /*   -> ${FRONTEND_TARGET}`);
});

