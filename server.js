// Simple Express server for Excalidraw Server Drive API
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const SAVES_DIR = path.join(__dirname, 'server-saves');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Ensure saves directory exists
async function ensureSavesDir() {
  try {
    await fs.access(SAVES_DIR);
  } catch {
    await fs.mkdir(SAVES_DIR, { recursive: true });
    console.log(`Created saves directory: ${SAVES_DIR}`);
  }
}

// List files endpoint
app.get('/api/saves', async (req, res) => {
  try {
    await ensureSavesDir();
    const files = await fs.readdir(SAVES_DIR);
    
    const fileList = await Promise.all(
      files
        .filter(file => file.endsWith('.excalidraw'))
        .map(async (filename) => {
          const filepath = path.join(SAVES_DIR, filename);
          const stats = await fs.stat(filepath);
          return {
            name: filename,
            path: filename,
            size: stats.size,
            modified: stats.mtime.toISOString()
          };
        })
    );
    
    // Sort by modified date (newest first)
    fileList.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    
    res.json(fileList);
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Load file endpoint
app.get('/api/saves/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(SAVES_DIR, filename);
    
    // Security: prevent path traversal
    if (!filepath.startsWith(SAVES_DIR)) {
      return res.status(403).json({ error: 'Invalid filename' });
    }
    
    const content = await fs.readFile(filepath, 'utf-8');
    const data = JSON.parse(content);
    res.json(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'File not found' });
    } else {
      console.error('Error loading file:', error);
      res.status(500).json({ error: 'Failed to load file' });
    }
  }
});

// Save file endpoint
app.put('/api/saves/:filename', async (req, res) => {
  try {
    await ensureSavesDir();
    const filename = req.params.filename;
    const filepath = path.join(SAVES_DIR, filename);
    
    // Security: prevent path traversal
    if (!filepath.startsWith(SAVES_DIR)) {
      return res.status(403).json({ error: 'Invalid filename' });
    }
    
    // Ensure filename has .excalidraw extension
    if (!filename.endsWith('.excalidraw')) {
      return res.status(400).json({ error: 'Filename must end with .excalidraw' });
    }
    
    await fs.writeFile(filepath, JSON.stringify(req.body, null, 2));
    res.json({ success: true, message: 'File saved successfully' });
  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).json({ error: 'Failed to save file' });
  }
});

// Delete file endpoint
app.delete('/api/saves/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(SAVES_DIR, filename);
    
    // Security: prevent path traversal
    if (!filepath.startsWith(SAVES_DIR)) {
      return res.status(403).json({ error: 'Invalid filename' });
    }
    
    await fs.unlink(filepath);
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'File not found' });
    } else {
      console.error('Error deleting file:', error);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server Drive API running on http://localhost:${PORT}`);
  console.log(`Saves directory: ${SAVES_DIR}`);
  console.log('\nEndpoints:');
  console.log(`  GET    http://localhost:${PORT}/api/saves           - List files`);
  console.log(`  GET    http://localhost:${PORT}/api/saves/:filename - Load file`);
  console.log(`  PUT    http://localhost:${PORT}/api/saves/:filename - Save file`);
  console.log(`  DELETE http://localhost:${PORT}/api/saves/:filename - Delete file`);
});