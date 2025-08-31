#!/usr/bin/env node
/*
 * Starts the API server with a temporary base directory,
 * runs Jest tests, then cleanly shuts down and cleans up.
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { createApp } = require('../src/app');

async function mkdtemp(prefix = 'excalidraw-backend-e2e-') {
  return fsp.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function rimraf(dir) {
  if (!fs.existsSync(dir)) return;
  if (fsp.rm) {
    await fsp.rm(dir, { recursive: true, force: true });
    return;
  }
  const entries = await fsp.readdir(dir);
  for (const name of entries) {
    const child = path.join(dir, name);
    const stat = await fsp.stat(child);
    if (stat.isDirectory()) await rimraf(child);
    else await fsp.unlink(child);
  }
  await fsp.rmdir(dir);
}

async function run() {
  let server;
  let tmpDir;
  let exitCode = 1;
  try {
    // Prepare isolated base directory
    tmpDir = await mkdtemp();

    // Attempt to start server on ephemeral port (may fail in sandboxed envs)
    let started = false;
    try {
      // Ensure quiet 4xx logging inside tests
      process.env.NODE_ENV = 'test';
      const app = createApp({ baseDir: tmpDir });
      await new Promise((resolve, reject) => {
        server = app
          .listen(0)
          .once('listening', resolve)
          .once('error', reject);
      });
      started = true;
    } catch (listenErr) {
      // Fall back to in-process tests without BASE_URL
      console.warn('Listen not permitted; running tests in-process. Reason:', listenErr.message);
      if (server) {
        try { await new Promise((r) => server.close(r)); } catch (_) {}
        server = null;
      }
    }

    if (started && server) {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : process.env.PORT || 3001;
      process.env.PORT = String(port);
      process.env.BASE_DIR = tmpDir;
      process.env.BASE_URL = `http://127.0.0.1:${port}`;
    }

    // Keep logs tidy for local dev
    process.env.JEST_JUNIT_OUTPUT = '';

    // Run Jest programmatically
    const { runCLI } = require('jest');
    const projectRoot = path.resolve(__dirname, '..');
    const jestConfig = {
      // Use project root so jest.config.js is picked up
      rootDir: projectRoot,
      runInBand: true,
      // Respect existing config's testMatch; no need to override
    };
    const result = await runCLI(jestConfig, [projectRoot]);
    exitCode = result.results.success ? 0 : 1;
  } catch (err) {
    console.error(err);
    exitCode = 1;
  } finally {
    // Graceful shutdown
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (tmpDir) {
      try { await rimraf(tmpDir); } catch (_) {}
    }
    process.exit(exitCode);
  }
}

run();
