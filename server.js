// Static file server + /api/submit proxy to Google Apps Script.
// In production, nginx serves the static files and only proxies /api/ here.
// SHEET_URL is read from .env (or environment) — never shipped to the client.

const http = require('http');
const fs = require('fs');
const path = require('path');

// Minimal .env loader so we don't take a dependency.
(() => {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
})();

const PORT = Number(process.env.PORT) || 8089;
const SHEET_URL = process.env.SHEET_URL || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || ''; // e.g. https://form.lunarstrategy.com
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
const LONG_CACHE = new Set(['.ttf', '.woff', '.woff2', '.mov', '.mp4', '.webm', '.png', '.jpg', '.jpeg', '.ico']);

// In-memory token bucket: 5 submits per IP per minute.
const buckets = new Map();
const RATE_MAX = 5;
const RATE_WINDOW_MS = 60_000;

function rateAllow(ip) {
  const now = Date.now();
  const b = buckets.get(ip) || { count: 0, ts: now };
  if (now - b.ts > RATE_WINDOW_MS) { b.count = 0; b.ts = now; }
  b.count += 1;
  b.ts = b.ts || now;
  buckets.set(ip, b);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now - v.ts > RATE_WINDOW_MS * 5) buckets.delete(k);
  }
  return b.count <= RATE_MAX;
}

function validate(data) {
  const fields = ['xHandle', 'tg', 'company', 'companyX'];
  for (const f of fields) {
    if (typeof data[f] !== 'string') return `Missing field: ${f}`;
    const v = data[f].trim();
    if (v.length === 0) return `Empty field: ${f}`;
    if (v.length > 200) return `${f} too long`;
    if (/[\x00-\x1f\x7f]/.test(v)) return `${f} contains invalid characters`;
  }
  return null;
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function handleSubmit(req, res) {
  if (ALLOWED_ORIGIN) {
    const origin = req.headers.origin || '';
    if (origin && origin !== ALLOWED_ORIGIN) return json(res, 403, { error: 'Forbidden origin' });
  }

  const ip = clientIp(req);
  if (!rateAllow(ip)) return json(res, 429, { error: 'Too many requests, try again shortly' });

  let body = '';
  let size = 0;
  const MAX = 4096;
  let aborted = false;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX) { aborted = true; req.destroy(); return; }
    body += chunk;
  });
  req.on('end', async () => {
    if (aborted) return;
    let data;
    try { data = JSON.parse(body); } catch { return json(res, 400, { error: 'Invalid JSON' }); }

    // Honeypot — if a bot filled the hidden field, fake-succeed silently.
    if (data.website || data.url || data.fax) return json(res, 200, { ok: true });

    const err = validate(data);
    if (err) return json(res, 400, { error: err });

    if (!SHEET_URL) {
      console.error('SHEET_URL is not set');
      return json(res, 500, { error: 'Server misconfigured' });
    }

    try {
      const upstream = await fetch(SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xHandle: data.xHandle.trim(),
          tg: data.tg.trim(),
          company: data.company.trim(),
          companyX: data.companyX.trim(),
        }),
        redirect: 'follow',
      });
      if (!upstream.ok && upstream.status !== 302) {
        console.error('Upstream non-OK:', upstream.status);
        return json(res, 502, { error: 'Upstream error' });
      }
      return json(res, 200, { ok: true });
    } catch (e) {
      console.error('Forward error:', e.message);
      return json(res, 502, { error: 'Upstream error' });
    }
  });
}

function serveStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405); res.end('Method not allowed'); return;
  }
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
    headers['Cache-Control'] = LONG_CACHE.has(ext) ? 'public, max-age=31536000, immutable' : 'no-cache, must-revalidate';
    res.writeHead(200, headers);
    res.end(data);
  });
}

http.createServer((req, res) => {
  if (req.url === '/api/submit' && req.method === 'POST') return handleSubmit(req, res);
  if (req.url === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true });
  serveStatic(req, res);
}).listen(PORT, '127.0.0.1', () => console.log(`Server on http://127.0.0.1:${PORT}`));
