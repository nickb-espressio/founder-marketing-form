# Founder-Led Marketing Cohort — Application Form

Live at https://form.lunarstrategy.com. Application form for the Lunar Strategy Founder-Led Marketing Cohort.

## Architecture

```
browser ──HTTPS──▶ nginx ──┬──▶ static files (/var/www/form.lunarstrategy.com)
                            │
                            └──▶ /api/* → Node proxy (127.0.0.1:3100) ──▶ Google Apps Script ──▶ Google Sheet
```

Static assets are served straight from nginx. Form submissions POST to `/api/submit`, which the Node proxy validates and forwards to the Apps Script Web App. **The Apps Script URL never ships to the client.**

## Local dev

```bash
cp .env.example .env       # then fill in SHEET_URL
node server.js             # → http://localhost:8089
```

The same `server.js` serves static files AND the `/api/` endpoints. In production, nginx handles static; Node only sees `/api/*`.

## Security model

- **Sheet URL** lives in `.env` on the server, never in any client-side file. `.env` is `chmod 600`.
- **Origin check**: `/api/submit` rejects requests whose `Origin` header isn't `https://form.lunarstrategy.com`.
- **Rate limit**: 5 submits per IP per minute (in-memory token bucket).
- **Input validation**: required fields, ≤ 200 chars each, no control characters, 4 KB max body.
- **Honeypot**: hidden `website` field; bots that fill it get a fake 200 with no row written.
- **HTTP security headers** (set by nginx): HSTS, CSP (`default-src 'self'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- **TLS** via Let's Encrypt (auto-renew via the existing certbot timer on the VPS).

## Operations

### Deploy
```bash
./deploy.sh root@187.124.34.41 /var/www/form.lunarstrategy.com
ssh root@187.124.34.41 'pm2 restart form-lunarstrategy'   # only if server.js changed
```
`deploy.sh` excludes `.env`, so server-side secrets survive sync.

### Logs & process management
```bash
ssh root@187.124.34.41 'pm2 logs form-lunarstrategy --lines 50'
ssh root@187.124.34.41 'pm2 restart form-lunarstrategy'
```

### Rotate the Apps Script URL
1. In Apps Script: **Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy**. The URL stays the same.
2. To force a new URL (e.g. if the old one leaked): **Deploy → New deployment**, then **Archive** the old one.
3. Update `/var/www/form.lunarstrategy.com/.env` with the new URL, then `pm2 restart form-lunarstrategy`.

### Recommended hardening (optional)
Add a shared secret check inside the Apps Script `doPost` so the URL alone is useless even if it leaks:

```js
function doPost(e) {
  const secret = PropertiesService.getScriptProperties().getProperty('PROXY_SECRET');
  const data = JSON.parse(e.postData.contents);
  if (!secret || data._secret !== secret) {
    return ContentService.createTextOutput(JSON.stringify({error:'unauthorized'}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.appendRow([new Date(), data.xHandle, data.tg, data.company, data.companyX]);
  return ContentService.createTextOutput(JSON.stringify({ok:true}))
    .setMimeType(ContentService.MimeType.JSON);
}
```
Then add `PROXY_SECRET=<long-random>` to `.env` and have `server.js` include `_secret: process.env.PROXY_SECRET` in the forwarded body.

## File overview

| File | Purpose |
|---|---|
| `index.html` | Markup, Lunar Strategy SVG logo, honeypot field |
| `style.css` | Layout + Neue Haas Unica typography |
| `script.js` | Submits to `/api/submit` (no secrets) |
| `server.js` | Static server + `/api/submit` proxy + rate limit + validation |
| `background.mov` | Looping background video |
| `fonts/` | Neue Haas Unica Light + Bold |
| `.env.example` | Template — copy to `.env` and fill in `SHEET_URL` |
| `deploy.sh` | rsync to VPS (excludes `.env`) |
| `nginx.conf.example` | Reference nginx server block |
