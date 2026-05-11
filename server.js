const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 8089;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

// Long-cache only binary assets that genuinely don't change between deploys.
// HTML/CSS/JS must revalidate so updates to script.js (e.g. SHEET_URL) take effect.
const LONG_CACHE = new Set(['.ttf', '.woff', '.woff2', '.mov', '.mp4', '.webm', '.png', '.jpg', '.jpeg', '.ico']);

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const requested = urlPath === '/' ? '/index.html' : urlPath;
  const safePath = path.normalize(path.join(ROOT, requested));

  if (!safePath.startsWith(ROOT + path.sep) && safePath !== ROOT) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(safePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(safePath);
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    if (LONG_CACHE.has(ext)) headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    else headers['Cache-Control'] = 'no-cache, must-revalidate';
    res.writeHead(200, headers);
    res.end(data);
  });
}).listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
