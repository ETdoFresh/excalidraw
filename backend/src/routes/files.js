const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');

function createFilesRouter(baseDir) {
  const router = Router();
  const BASE_DIR = path.resolve(baseDir || __dirname);

  function resolveSafe(relPath = '') {
    const target = path.resolve(BASE_DIR, relPath || '.');
    const baseWithSep = BASE_DIR.endsWith(path.sep) ? BASE_DIR : BASE_DIR + path.sep;
    if (target !== BASE_DIR && !target.startsWith(baseWithSep)) {
      const err = new Error('Path escapes base directory');
      err.status = 400;
      throw err;
    }
    return target;
  }

  function toFileInfo(fullPath, name) {
    const stat = fs.statSync(fullPath);
    return {
      name: name ?? path.basename(fullPath),
      path: path.relative(BASE_DIR, fullPath) || '.',
      type: stat.isDirectory() ? 'dir' : 'file',
      size: stat.isDirectory() ? null : stat.size,
      mtimeMs: stat.mtimeMs,
    };
  }

  // GET /api/list?path=optional/subdir
  router.get('/list', async (req, res, next) => {
    try {
      const rel = (req.query.path || '').toString();
      const dir = resolveSafe(rel);
      const items = await fsp.readdir(dir, { withFileTypes: true });
      const list = items.map((d) => {
        const full = path.join(dir, d.name);
        return toFileInfo(full, d.name);
      });
      res.json({ base: BASE_DIR, cwd: path.relative(BASE_DIR, dir) || '.', items: list });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/file?path=some/file.txt[&encoding=utf8]
  router.get('/file', async (req, res, next) => {
    try {
      const rel = (req.query.path || '').toString();
      if (!rel) {
        const e = new Error('Missing query parameter: path');
        e.status = 400;
        throw e;
      }
      const filePath = resolveSafe(rel);
      const stat = await fsp.stat(filePath);
      if (!stat.isFile()) {
        const e = new Error('Not a file');
        e.status = 400;
        throw e;
      }
      const encoding = (req.query.encoding || 'utf8').toString();
      const content = await fsp.readFile(filePath, { encoding });
      res.json({ path: rel, encoding, size: stat.size, content });
    } catch (err) {
      next(err);
    }
  });

  // PUT /api/file  { path, content, encoding? }
  // POST also supported
  async function writeFileHandler(req, res, next) {
    try {
      const { path: rel, content, encoding = 'utf8' } = req.body || {};
      if (!rel || typeof content === 'undefined') {
        const e = new Error('Missing body parameters: path, content');
        e.status = 400;
        throw e;
      }
      const filePath = resolveSafe(rel);
      await fsp.mkdir(path.dirname(filePath), { recursive: true });
      await fsp.writeFile(filePath, content, { encoding });
      const info = toFileInfo(filePath);
      res.status(200).json({ ok: true, file: info });
    } catch (err) {
      next(err);
    }
  }

  router.put('/file', writeFileHandler);
  router.post('/file', writeFileHandler);

  // DELETE /api/file?path=some/file.txt
  router.delete('/file', async (req, res, next) => {
    try {
      const rel = (req.query.path || '').toString();
      if (!rel) {
        const e = new Error('Missing query parameter: path');
        e.status = 400;
        throw e;
      }
      const filePath = resolveSafe(rel);
      const stat = await fsp.stat(filePath);
      if (!stat.isFile()) {
        const e = new Error('Not a file');
        e.status = 400;
        throw e;
      }
      await fsp.unlink(filePath);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/directory  { path }
  router.post('/directory', async (req, res, next) => {
    try {
      const { path: rel } = req.body || {};
      if (!rel) {
        const e = new Error('Missing body parameter: path');
        e.status = 400;
        throw e;
      }
      const dirPath = resolveSafe(rel);
      await fsp.mkdir(dirPath, { recursive: true });
      res.status(201).json({ ok: true, dir: path.relative(BASE_DIR, dirPath) || '.' });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/directory?path=dir[&recursive=true]
  router.delete('/directory', async (req, res, next) => {
    try {
      const rel = (req.query.path || '').toString();
      if (!rel) {
        const e = new Error('Missing query parameter: path');
        e.status = 400;
        throw e;
      }
      const recursive = String(req.query.recursive || 'false') === 'true';
      const dirPath = resolveSafe(rel);
      const stat = await fsp.stat(dirPath);
      if (!stat.isDirectory()) {
        const e = new Error('Not a directory');
        e.status = 400;
        throw e;
      }
      if (recursive) {
        // Node 14+: fs.rm supports recursive
        if (fsp.rm) {
          await fsp.rm(dirPath, { recursive: true, force: true });
        } else {
          // Fallback: remove contents then rmdir
          const entries = await fsp.readdir(dirPath);
          await Promise.all(entries.map(async (name) => {
            const child = path.join(dirPath, name);
            const s = await fsp.stat(child);
            return s.isDirectory() ? router.helpers.rmdirRecursive(child) : fsp.unlink(child);
          }));
          await fsp.rmdir(dirPath);
        }
      } else {
        await fsp.rmdir(dirPath);
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // Expose helpers if needed internally
  router.helpers = {
    async rmdirRecursive(dir) {
      const entries = await fsp.readdir(dir);
      for (const name of entries) {
        const child = path.join(dir, name);
        const s = await fsp.stat(child);
        if (s.isDirectory()) await router.helpers.rmdirRecursive(child);
        else await fsp.unlink(child);
      }
      await fsp.rmdir(dir);
    },
  };

  return router;
}

module.exports = createFilesRouter;
