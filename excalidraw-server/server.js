const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(morgan('combined'));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Storage directory for saved drawings
const SAVES_DIR = path.join(__dirname, 'saves');
fs.mkdir(SAVES_DIR, { recursive: true }).catch(console.error);

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    cb(null, SAVES_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

// API Routes

// Get list of saved files
app.get('/api/saves', async (req, res) => {
  try {
    const files = await fs.readdir(SAVES_DIR);
    const excalidrawFiles = files.filter(f => f.endsWith('.excalidraw'));
    res.json(excalidrawFiles);
  } catch (error) {
    console.error('Error listing saves:', error);
    res.status(500).json({ error: 'Failed to list saved files' });
  }
});

// Get a specific saved file
app.get('/api/saves/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(SAVES_DIR, filename);
    
    // Security check to prevent directory traversal
    if (!filepath.startsWith(SAVES_DIR)) {
      return res.status(403).json({ error: 'Invalid filename' });
    }
    
    const content = await fs.readFile(filepath, 'utf8');
    res.json(JSON.parse(content));
  } catch (error) {
    console.error('Error reading file:', error);
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'File not found' });
    } else {
      res.status(500).json({ error: 'Failed to read file' });
    }
  }
});

// Save or update a file
app.post('/api/saves/:filename', express.json(), async (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(SAVES_DIR, filename);
    
    // Security check
    if (!filepath.startsWith(SAVES_DIR)) {
      return res.status(403).json({ error: 'Invalid filename' });
    }
    
    // Ensure filename ends with .excalidraw
    const finalPath = filename.endsWith('.excalidraw') 
      ? filepath 
      : `${filepath}.excalidraw`;
    
    await fs.writeFile(finalPath, JSON.stringify(req.body, null, 2));
    res.json({ success: true, filename: path.basename(finalPath) });
  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).json({ error: 'Failed to save file' });
  }
});

// Upload file
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ success: true, filename: req.file.filename });
});

// Delete a saved file
app.delete('/api/saves/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(SAVES_DIR, filename);
    
    // Security check
    if (!filepath.startsWith(SAVES_DIR)) {
      return res.status(403).json({ error: 'Invalid filename' });
    }
    
    await fs.unlink(filepath);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'File not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete file' });
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Serve static frontend files
// This should be the last route to catch all non-API requests
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all route for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Excalidraw server running on http://0.0.0.0:${PORT}`);
  console.log(`Saves directory: ${SAVES_DIR}`);
});