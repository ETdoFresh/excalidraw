function getApiMetadata() {
  const endpoints = {
    '/api/health': {
      description: 'Healthcheck for readiness/liveness',
      methods: {
        GET: {
          description: 'Returns { ok: true } when server is up',
          args: [],
        },
      },
    },
    '/api/list': {
      description: 'List directory contents relative to base directory',
      methods: {
        GET: {
          description: 'Returns items in a directory',
          args: [
            {
              name: 'path',
              in: 'query',
              required: false,
              type: 'string',
              description: 'Relative path within base directory (default: ".")',
            },
          ],
        },
      },
    },
    '/api/file': {
      description: 'Read, write, and delete a file',
      methods: {
        GET: {
          description: 'Read a file as text',
          args: [
            { name: 'path', in: 'query', required: true, type: 'string', description: 'Relative file path' },
            { name: 'encoding', in: 'query', required: false, type: 'string', description: 'Text encoding (default: utf8)' },
          ],
        },
        PUT: {
          description: 'Create or overwrite a file with text content',
          args: [
            { name: 'path', in: 'body', required: true, type: 'string', description: 'Relative file path' },
            { name: 'content', in: 'body', required: true, type: 'string', description: 'File contents' },
            { name: 'encoding', in: 'body', required: false, type: 'string', description: 'Text encoding (default: utf8)' },
          ],
        },
        POST: {
          description: 'Create or overwrite a file with text content (same as PUT)',
          args: [
            { name: 'path', in: 'body', required: true, type: 'string', description: 'Relative file path' },
            { name: 'content', in: 'body', required: true, type: 'string', description: 'File contents' },
            { name: 'encoding', in: 'body', required: false, type: 'string', description: 'Text encoding (default: utf8)' },
          ],
        },
        DELETE: {
          description: 'Delete a file',
          args: [
            { name: 'path', in: 'query', required: true, type: 'string', description: 'Relative file path' },
          ],
        },
      },
    },
    '/api/directory': {
      description: 'Create or delete directories',
      methods: {
        POST: {
          description: 'Create a directory (recursive)',
          args: [
            { name: 'path', in: 'body', required: true, type: 'string', description: 'Relative directory path' },
          ],
        },
        DELETE: {
          description: 'Delete a directory (optionally recursive)',
          args: [
            { name: 'path', in: 'query', required: true, type: 'string', description: 'Relative directory path' },
            { name: 'recursive', in: 'query', required: false, type: 'boolean', description: 'Remove contents recursively (default: false)' },
          ],
        },
      },
    },
  };

  return {
    name: 'Excalidraw Files API',
    description: 'Simple filesystem API used for local development and tests',
    endpoints,
  };
}

module.exports = { getApiMetadata };

