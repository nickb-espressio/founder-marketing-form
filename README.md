# Founder-Led Marketing Cohort — Application Form

Static one-pager that collects applications for the Lunar Strategy Founder-Led Marketing Cohort and POSTs them to a Google Apps Script Web App (which writes to a Google Sheet).

## Local dev

```bash
node server.js
# → http://localhost:8089
```

Override the port with `PORT=3000 node server.js`.

## Before you deploy

1. **Wire up the Google Sheet endpoint.** Edit [`script.js`](./script.js) line 2 and paste your Apps Script Web App URL:
   ```js
   const SHEET_URL = 'https://script.google.com/macros/s/.../exec';
   ```
   The submit handler POSTs JSON (`{xHandle, tg, company, companyX}`) with `mode: 'no-cors'`.

2. **Shrink the background video.** `background.mov` is 28.5 MB and `.mov` (QuickTime) doesn't autoplay reliably outside Safari. Re-encode before shipping:
   ```bash
   ffmpeg -i background.mov -vcodec libx264 -crf 28 -preset slow -vf "scale=1920:-2" \
          -movflags +faststart -an background.mp4
   ffmpeg -i background.mov -c:v libvpx-vp9 -crf 35 -b:v 0 -vf "scale=1920:-2" -an background.webm
   ```
   Then in `index.html` replace the two `<source>` lines with:
   ```html
   <source src="background.webm" type="video/webm">
   <source src="background.mp4" type="video/mp4">
   ```
   Target ≤ 3 MB. Also add a `poster="background-poster.jpg"` attribute on the `<video>` so users on slow connections see something.

## Deploy to a VPS

Two paths. Pick one.

### Option A — nginx (recommended; this is a static site)

1. Copy the files to your server:
   ```bash
   ./deploy.sh user@your-vps.com /var/www/founder-form
   ```
2. Point nginx at the directory using [`nginx.conf.example`](./nginx.conf.example) as a starting point. Reload nginx: `sudo nginx -t && sudo systemctl reload nginx`.
3. Add TLS with certbot: `sudo certbot --nginx -d apply.yourdomain.com`.

### Option B — keep the Node server, run under pm2

```bash
ssh user@your-vps.com
cd /var/www/founder-form
npm install -g pm2
PORT=3000 pm2 start server.js --name founder-form
pm2 save && pm2 startup
```
Then reverse-proxy `apply.yourdomain.com` → `127.0.0.1:3000` via nginx.

## File overview

| File | Purpose |
|---|---|
| `index.html` | Markup, embedded Lunar Strategy SVG logo, video background |
| `style.css` | Layout + Neue Haas Unica typography |
| `script.js` | Form submit → Apps Script POST |
| `server.js` | Tiny static server for local dev (or VPS Option B) |
| `background.mov` | Looping background (replace with `.mp4`/`.webm` before deploy) |
| `fonts/` | Neue Haas Unica Light + Bold |
| `deploy.sh` | rsync to VPS |
| `nginx.conf.example` | Drop-in nginx server block |
