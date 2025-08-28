// Frontend logging helper - inject this into the HTML to send logs to backend
(function() {
  // Store original console methods
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;

  // Helper to send logs to backend
  function sendToBackend(level, args) {
    try {
      const message = Array.from(args).map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');

      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, message })
      }).catch(() => {}); // Silently fail to avoid infinite loops
    } catch (e) {
      // Silently fail
    }
  }

  // Override console methods
  console.log = function(...args) {
    originalLog.apply(console, args);
    sendToBackend('info', args);
  };

  console.error = function(...args) {
    originalError.apply(console, args);
    sendToBackend('error', args);
  };

  console.warn = function(...args) {
    originalWarn.apply(console, args);
    sendToBackend('warn', args);
  };

  console.info = function(...args) {
    originalInfo.apply(console, args);
    sendToBackend('info', args);
  };

  // Log unhandled errors
  window.addEventListener('error', function(event) {
    sendToBackend('error', [`Unhandled error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`]);
  });

  // Log unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
    sendToBackend('error', [`Unhandled promise rejection: ${event.reason}`]);
  });

  // Log initial page load
  sendToBackend('info', ['Frontend logger initialized']);
})();