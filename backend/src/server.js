const { createApp } = require('./app');
const path = require('path');
const os = require('os');

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';
const BASE_DIR = process.env.BASE_DIR ? path.resolve(process.env.BASE_DIR) : undefined;

const app = createApp({ baseDir: BASE_DIR });

const server = app.listen(PORT, HOST, () => {
  const effectiveBase = BASE_DIR || path.resolve(process.cwd());

  // Build Local and Network URLs similar to Vite output
  const localUrl = `http://localhost:${PORT}/api`;
  const nets = os.networkInterfaces();
  const networkUrls = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      const family = typeof net.family === 'string' ? net.family : net.family === 4 ? 'IPv4' : 'IPv6';
      if (family === 'IPv4' && !net.internal) {
        networkUrls.push(`http://${net.address}:${PORT}/api`);
      }
    }
  }

  console.log('API server ready:');
  console.log(`  Local:   ${localUrl}`);
  if (networkUrls.length > 0) {
    console.log(`  Network: ${networkUrls[0]}`);
    for (let i = 1; i < networkUrls.length; i++) {
      console.log(`           ${networkUrls[i]}`);
    }
  } else {
    console.log('  Network: bind with HOST=0.0.0.0 to expose');
  }
  console.log(`  Base:    ${effectiveBase}`);
});

// Graceful shutdown on SIGINT/SIGTERM when run directly
function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
