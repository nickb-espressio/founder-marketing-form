// Gold ASCII orb on a charcoal-gray backdrop.
// Adapted from the GoldOrb reference component into plain JS for this static page.

(function () {
  const bgCanvas = document.getElementById('bgCanvas');
  const asciiCanvas = document.getElementById('asciiCanvas');
  if (!bgCanvas || !asciiCanvas) return;

  const RAMP = " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
  const BG_COLOR = '#464646';

  let CELL_W, CELL_H, COLS, ROWS, RADIUS, CX, CY, canvasW, canvasH;
  let cellData = [];
  let frame = 0;
  let animId;

  function computeLayout() {
    canvasW = window.innerWidth;
    canvasH = window.innerHeight;
    const baseSize = Math.min(canvasW, canvasH);
    CELL_W = Math.max(7, Math.round(baseSize / 110));
    CELL_H = Math.round((CELL_W * 14) / 11);
    COLS = Math.ceil(canvasW / CELL_W);
    ROWS = Math.ceil(canvasH / CELL_H);
    CX = COLS / 2;
    CY = ROWS / 2;
    RADIUS = Math.round(Math.min(canvasW, canvasH) * 0.42);

    [bgCanvas, asciiCanvas].forEach((c) => {
      c.width = canvasW;
      c.height = canvasH;
      c.style.width = canvasW + 'px';
      c.style.height = canvasH + 'px';
    });
  }

  function buildOrb() {
    cellData = [];
    for (let row = 0; row < ROWS; row++) {
      cellData.push([]);
      for (let col = 0; col < COLS; col++) {
        const pxDx = (col - CX) * CELL_W;
        const pxDy = (row - CY) * CELL_H;
        const dist = Math.sqrt(pxDx * pxDx + pxDy * pxDy);
        if (dist > RADIUS) {
          cellData[row].push({ subject: false });
          continue;
        }

        const nx = pxDx / RADIUS;
        const ny = pxDy / RADIUS;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const lx = -0.45, ly = -0.55, lz = 0.7;
        const len = Math.sqrt(lx * lx + ly * ly + lz * lz);
        const dot = Math.max(0, (nx * lx + ny * ly + nz * lz) / len);

        // Obsidian / black orb — dark body, subtle cool highlights
        const baseR = 18, baseG = 18, baseB = 20;
        const light = 0.4 + dot * 1.6;
        const spec = Math.pow(Math.max(0, dot), 18) * 0.9;
        const edgeFactor = Math.pow(nz, 0.45);

        let r = Math.min(255, Math.round((baseR * light + 200 * spec) * edgeFactor + baseR * 0.4));
        let g = Math.min(255, Math.round((baseG * light + 205 * spec) * edgeFactor + baseG * 0.4));
        let b = Math.min(255, Math.round((baseB * light + 215 * spec) * edgeFactor + baseB * 0.4));

        const edgeDark = Math.pow(1 - nz, 2.5) * 0.9;
        r = Math.round(r * (1 - edgeDark) + 8 * edgeDark);
        g = Math.round(g * (1 - edgeDark) + 8 * edgeDark);
        b = Math.round(b * (1 - edgeDark) + 10 * edgeDark);

        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const ch = RAMP[Math.min(RAMP.length - 1, Math.max(0, Math.floor(lum * (RAMP.length - 1))))];
        cellData[row].push({ subject: true, r, g, b, lum, ch });
      }
    }
  }

  function drawBg() {
    const ctx = bgCanvas.getContext('2d');
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  function animate() {
    const ctx = asciiCanvas.getContext('2d');
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.font = `bold ${CELL_H - 1}px ui-monospace, Menlo, monospace`;
    ctx.textBaseline = 'top';

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const cell = cellData[row][col];
        if (!cell.subject) continue;

        let lum = cell.lum;
        let r = cell.r, g = cell.g, b = cell.b;
        let ch = cell.ch;
        const alpha = 1;

        if (lum > 0.5) {
          const shimmer = Math.sin(frame * 0.04 + col * 0.22 + row * 0.18) * 0.06;
          lum = Math.min(1, lum + shimmer);
          const idx = Math.min(RAMP.length - 1, Math.max(0, Math.floor(lum * (RAMP.length - 1))));
          ch = RAMP[idx];
        }

        ctx.shadowBlur = 0;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillText(ch, col * CELL_W, row * CELL_H);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }
    }
    frame++;
    animId = requestAnimationFrame(animate);
  }

  function init() {
    computeLayout();
    buildOrb();
    drawBg();
    animate();
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      cancelAnimationFrame(animId);
      frame = 0;
      init();
    }, 150);
  });

  init();
})();
