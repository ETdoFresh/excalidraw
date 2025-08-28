const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - Order matters!
app.use(morgan('combined'));
app.use(cors());

// CRITICAL: Set up API routes BEFORE static file serving
// Parse JSON only for API routes
app.use('/api', express.json({ limit: '50mb' }));
app.use('/api', express.urlencoded({ extended: true, limit: '50mb' }));

// Debug logging for ALL requests
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const isApi = req.path.startsWith('/api/');
  console.log(`[${timestamp}] ${req.method} ${req.path}${isApi ? ' (API)' : ' (STATIC)'}`);
  next();
});

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

// =======================
// API ROUTES - MUST BE FIRST
// =======================

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log(`[${new Date().toISOString()}] Health check requested`);
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: 'v3.0'
  });
});

// Get list of saved files
app.get('/api/saves', async (req, res) => {
  try {
    const files = await fs.readdir(SAVES_DIR);
    const excalidrawFiles = files.filter(f => f.endsWith('.excalidraw'));
    console.log(`[${new Date().toISOString()}] Listing ${excalidrawFiles.length} saved files`);
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
    console.log(`[${new Date().toISOString()}] Retrieved file: ${filename}`);
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

// Save or update a file - Handle both POST and PUT
const saveHandler = async (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(SAVES_DIR, filename);
    
    console.log(`[${new Date().toISOString()}] Saving file: ${filename}`);
    
    // Security check
    if (!filepath.startsWith(SAVES_DIR)) {
      return res.status(403).json({ error: 'Invalid filename' });
    }
    
    // Ensure filename ends with .excalidraw
    const finalPath = filename.endsWith('.excalidraw') 
      ? filepath 
      : `${filepath}.excalidraw`;
    
    await fs.writeFile(finalPath, JSON.stringify(req.body, null, 2));
    console.log(`[${new Date().toISOString()}] File saved successfully: ${path.basename(finalPath)}`);
    res.json({ success: true, filename: path.basename(finalPath) });
  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).json({ error: 'Failed to save file' });
  }
};

app.post('/api/saves/:filename', saveHandler);
app.put('/api/saves/:filename', saveHandler);

// Upload file
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  console.log(`[${new Date().toISOString()}] File uploaded: ${req.file.filename}`);
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
    console.log(`[${new Date().toISOString()}] File deleted: ${filename}`);
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

// Frontend logging endpoint
app.post('/api/log', (req, res) => {
  const { level = 'info', message, data } = req.body;
  const timestamp = new Date().toISOString();
  const logPrefix = `[${timestamp}] [FRONTEND] [${level.toUpperCase()}]`;
  
  if (data) {
    console.log(`${logPrefix} ${message}`, data);
  } else {
    console.log(`${logPrefix} ${message}`);
  }
  
  res.json({ success: true });
});

// Catch all unmatched API routes
app.all('/api/*', (req, res) => {
  console.log(`[${new Date().toISOString()}] 404 - API endpoint not found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    error: 'API endpoint not found',
    path: req.path,
    method: req.method 
  });
});

// =======================
// STATIC FILE SERVING - MUST BE AFTER API ROUTES
// =======================

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public'), {
  // Don't serve index.html for API routes
  index: false,
  setHeaders: (res, filePath) => {
    // Add cache headers for static assets
    if (filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.png')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// Catch-all route for SPA - serves index.html for all non-API routes
app.get('*', async (req, res) => {
  // This should never catch /api/* routes due to the order
  if (req.path.startsWith('/api/')) {
    console.error(`[${new Date().toISOString()}] ERROR: API route leaked to catch-all: ${req.path}`);
    return res.status(500).json({ error: 'Server routing error' });
  }
  
  const indexPath = path.join(__dirname, 'public', 'index.html');
  
  // Check if frontend logging is enabled
  if (process.env.ENABLE_FRONTEND_LOGGING === 'true') {
    try {
      let html = await fs.readFile(indexPath, 'utf8');
      
      // Inject logging script
      const loggerScript = `
<script>
(function() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  function sendLog(level, args) {
    try {
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: level,
          message: Array.from(args).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
        })
      }).catch(() => {});
    } catch(e) {}
  }
  
  console.log = function(...args) {
    originalLog.apply(console, args);
    sendLog('info', args);
  };
  console.error = function(...args) {
    originalError.apply(console, args);
    sendLog('error', args);
  };
  console.warn = function(...args) {
    originalWarn.apply(console, args);
    sendLog('warn', args);
  };
  
  window.addEventListener('error', function(e) {
    sendLog('error', ['Uncaught error: ' + e.message + ' at ' + e.filename + ':' + e.lineno]);
  });
})();
</script>`;
      
      html = html.replace('</head>', loggerScript + '</head>');
      res.send(html);
    } catch (error) {
      console.error('Error injecting logger:', error);
      res.sendFile(indexPath);
    }
  } else {
    res.sendFile(indexPath);
  }
});

// Start server
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log('\n=====================================');
  console.log('🚀 Excalidraw Server v3.0 Started');
  console.log('=====================================');
  console.log(`Server URL: http://0.0.0.0:${PORT}`);
  console.log(`Saves directory: ${SAVES_DIR}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Node version: ${process.version}`);
  console.log(`Frontend logging: ${process.env.ENABLE_FRONTEND_LOGGING === 'true' ? 'ENABLED' : 'DISABLED'}`);
  console.log('');
  
  // Run startup health checks
  console.log('Running startup health checks...');
  
  // Check saves directory
  try {
    await fs.access(SAVES_DIR);
    const files = await fs.readdir(SAVES_DIR);
    console.log(`✅ Saves directory accessible (${files.length} files)`);
  } catch (error) {
    console.log(`⚠️  Saves directory not accessible, creating...`);
    await fs.mkdir(SAVES_DIR, { recursive: true });
    console.log(`✅ Saves directory created`);
  }
  
  // Test internal API with delay
  const http = require('http');
  setTimeout(() => {
    http.get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status === 'healthy') {
            console.log('✅ Health endpoint responding correctly');
          } else {
            console.log('⚠️  Health endpoint returned unexpected data');
          }
        } catch (e) {
          console.log('❌ Health endpoint returned non-JSON response');
        }
      });
    }).on('error', (err) => {
      console.log('❌ Health endpoint not responding:', err.message);
    });
  }, 100);
  
  console.log('');
  console.log('API Endpoints:');
  console.log('  GET    /api/health');
  console.log('  GET    /api/saves');
  console.log('  GET    /api/saves/:filename');
  console.log('  PUT    /api/saves/:filename');
  console.log('  POST   /api/saves/:filename');
  console.log('  POST   /api/upload');
  console.log('  DELETE /api/saves/:filename');
  console.log('  POST   /api/log');
  console.log('');
  console.log('Server ready!');
  console.log('=====================================\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\nSIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});