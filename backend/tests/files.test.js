const os = require('os');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const request = require('supertest');
const { createApp } = require('../src/app');

function mkdtemp(prefix = 'excalidraw-backend-') {
  return fsp.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe('Filesystem API', () => {
  let tmpDir;
  let app;
  let agent;
  const baseUrl = process.env.BASE_URL || '';

  beforeAll(async () => {
    if (baseUrl) {
      // Use external server started by harness/script
      agent = request(baseUrl);
    } else {
      // Start an in-memory app with isolated tmp dir
      tmpDir = await mkdtemp();
      app = createApp({ baseDir: tmpDir });
      agent = request(app);
    }
  });

  afterAll(async () => {
    // When running in-process (no BASE_URL), clean up tmpDir recursively
    if (!baseUrl && fs.existsSync(tmpDir)) {
      if (fs.rm) {
        await fsp.rm(tmpDir, { recursive: true, force: true });
      } else {
        const rimraf = async (dir) => {
          const entries = await fsp.readdir(dir);
          for (const name of entries) {
            const child = path.join(dir, name);
            const stat = await fsp.stat(child);
            if (stat.isDirectory()) await rimraf(child);
            else await fsp.unlink(child);
          }
          await fsp.rmdir(dir);
        };
        await rimraf(tmpDir);
      }
    }
  });

  test('health check', async () => {
    const res = await agent.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('list base (empty)', async () => {
    const res = await agent.get('/api/list');
    expect(res.status).toBe(200);
    expect(res.body.cwd).toBe('.');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length === 0).toBe(true);
  });

  test('create directory, write/read file, list contents', async () => {
    // Create nested directory
    let res = await agent
      .post('/api/directory')
      .send({ path: 'a/b' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);

    // Write a file
    res = await agent
      .put('/api/file')
      .send({ path: 'a/b/hello.txt', content: 'hi there', encoding: 'utf8' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // List directory
    res = await agent.get('/api/list').query({ path: 'a/b' });
    expect(res.status).toBe(200);
    const names = res.body.items.map((x) => x.name);
    expect(names).toContain('hello.txt');

    // Read file
    res = await agent.get('/api/file').query({ path: 'a/b/hello.txt', encoding: 'utf8' });
    expect(res.status).toBe(200);
    expect(res.body.content).toBe('hi there');
  });

  test('delete file and directory (recursive)', async () => {
    // Delete file
    let res = await agent.delete('/api/file').query({ path: 'a/b/hello.txt' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Ensure it is gone
    res = await agent.get('/api/list').query({ path: 'a/b' });
    expect(res.status).toBe(200);
    expect(res.body.items.find((x) => x.name === 'hello.txt')).toBeUndefined();

    // Delete directory recursively
    res = await agent.delete('/api/directory').query({ path: 'a', recursive: 'true' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('reject path traversal', async () => {
    const res = await agent.get('/api/list').query({ path: '..' });
    expect(res.status).toBe(400);
    expect(String(res.body.error || '')).toMatch(/escapes base/i);
  });

  test('metadata endpoint describes API', async () => {
    const res = await agent.get('/api/meta');
    expect(res.status).toBe(200);
    expect(typeof res.body.name).toBe('string');
    expect(typeof res.body.description).toBe('string');
    expect(res.body && typeof res.body.endpoints).toBe('object');

    const eps = res.body.endpoints;
    // Basic presence
    expect(eps['/api/health']).toBeDefined();
    expect(eps['/api/list']).toBeDefined();
    expect(eps['/api/file']).toBeDefined();
    expect(eps['/api/directory']).toBeDefined();

    // Sample shape checks
    expect(eps['/api/health'].methods.GET).toBeDefined();
    expect(Array.isArray(eps['/api/health'].methods.GET.args)).toBe(true);

    const fileOps = eps['/api/file'].methods;
    expect(fileOps.GET && fileOps.PUT && fileOps.POST && fileOps.DELETE).toBeTruthy();
    expect(Array.isArray(fileOps.GET.args)).toBe(true);
    expect(Array.isArray(fileOps.PUT.args)).toBe(true);
  });
});
