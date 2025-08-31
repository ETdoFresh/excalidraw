const express = require('express');
const cors = require('cors');
const path = require('path');
const createFilesRouter = require('./routes/files');
const { getApiMetadata } = require('./meta');

function createApp(options = {}) {
  const app = express();
  // Prefer explicit option, then env, then current working directory
  const baseDir = options.baseDir || process.env.BASE_DIR || path.resolve(process.cwd());

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Mount API under /api
  app.use('/api', createFilesRouter(baseDir));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // API metadata / docs
  app.get('/api/meta', (_req, res) => {
    res.json(getApiMetadata());
  });

  // Error handler
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) {
      console.error(err);
    } else if (process.env.NODE_ENV !== 'test') {
      // Keep 4xx noise out of tests; log succinctly otherwise
      console.warn(err.message);
    }
    res.status(status).json({ error: err.message || 'Internal Server Error' });
  });

  return app;
}

module.exports = { createApp };
