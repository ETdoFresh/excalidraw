// Simple test server for server drive functionality
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const SAVES_DIR = process.env.VITE_APP_SERVER_DRIVE_PATH || path.join(__dirname, 'saves');

// Ensure saves directory exists
async function ensureSavesDir() {
  try {
    await fs.mkdir(SAVES_DIR, { recursive: true });
    console.log(`Saves directory: ${SAVES_DIR}`);
  } catch (err) {
    console.error('Error creating saves directory:', err);
  }
}

// List files endpoint
app.get('/api/server-drive/files', async (req, res) => {
  try {
    const files = await fs.readdir(SAVES_DIR);
    const fileList = await Promise.all(
      files
        .filter(f => f.endsWith('.excalidraw'))
        .map(async (name) => {
          const filePath = path.join(SAVES_DIR, name);
          const stats = await fs.stat(filePath);
          return {
            name,
            path: filePath,
            size: stats.size,
            modified: stats.mtime
          };
        })
    );
    res.json(fileList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save file endpoint
app.post('/api/server-drive/save', async (req, res) => {
  try {
    const { filename, data } = req.body;
    if (!filename || !data) {
      return res.status(400).json({ error: 'Missing filename or data' });
    }
    
    const filePath = path.join(SAVES_DIR, filename.endsWith('.excalidraw') ? filename : `${filename}.excalidraw`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    
    res.json({ 
      success: true, 
      path: filePath,
      message: `File saved to ${filePath}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Load file endpoint
app.get('/api/server-drive/load', async (req, res) => {
  try {
    const { path: filePath } = req.query;
    if (!filePath) {
      return res.status(400).json({ error: 'Missing file path' });
    }
    
    const data = await fs.readFile(filePath, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete file endpoint
app.delete('/api/server-drive/delete', async (req, res) => {
  try {
    const { path: filePath } = req.query;
    if (!filePath) {
      return res.status(400).json({ error: 'Missing file path' });
    }
    
    await fs.unlink(filePath);
    res.json({ success: true, message: 'File deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;

ensureSavesDir().then(() => {
  app.listen(PORT, () => {
    console.log(`Server drive API running on http://localhost:${PORT}`);
    console.log(`Saves directory: ${SAVES_DIR}`);
    console.log('\nEndpoints:');
    console.log(`  GET  /api/server-drive/files - List files`);
    console.log(`  POST /api/server-drive/save - Save file`);
    console.log(`  GET  /api/server-drive/load?path=<path> - Load file`);
    console.log(`  DELETE /api/server-drive/delete?path=<path> - Delete file`);
  });
});
