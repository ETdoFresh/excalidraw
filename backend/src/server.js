const { createApp } = require('./app');
const path = require('path');

const PORT = Number(process.env.PORT || 3001);
const BASE_DIR = process.env.BASE_DIR ? path.resolve(process.env.BASE_DIR) : undefined;

const app = createApp({ baseDir: BASE_DIR });

const server = app.listen(PORT, () => {
  const effectiveBase = BASE_DIR || path.resolve(process.cwd());
  console.log(`API server listening on http://localhost:${PORT}/api (base: ${effectiveBase})`);
});

// Graceful shutdown on SIGINT/SIGTERM when run directly
function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
