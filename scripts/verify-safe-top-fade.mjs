/**
 * Visual seam check for the cream safe-top band at deviceScaleFactor 3.
 * Usage: node scripts/verify-safe-top-fade.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SOLID_EXTRA = 14;
const FADE = 32;
const SAFE_TOP = 59;
const bandH = SAFE_TOP + SOLID_EXTRA + FADE;
const fadeStart = SAFE_TOP + SOLID_EXTRA;
const dpr = 3;

const html = `<!doctype html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<style>
  :root {
    --safe-top-cream: #f7f3eb;
    --safe-top-solid-extra: ${SOLID_EXTRA}px;
    --safe-top-fade: ${FADE}px;
    --bg: #f5f0e7;
    --text: #23483e;
  }
  /* Prod-like page top (body::before first stop). Contrasting mode via ?contrast=1 */
  html, body { margin: 0; height: 100%; background: #f7f3eb; color: var(--text);
    font-family: ui-sans-serif, system-ui, sans-serif; }
  html.contrast, html.contrast body { background: #c4b8a0; }
  .app-safe-top {
    height: calc(${SAFE_TOP}px + var(--safe-top-solid-extra) + var(--safe-top-fade));
    min-height: calc(var(--safe-top-solid-extra) + var(--safe-top-fade));
    flex-shrink: 0;
    pointer-events: none;
    background-color: transparent;
    background-image: linear-gradient(
      to bottom,
      var(--safe-top-cream) 0,
      var(--safe-top-cream) calc(100% - var(--safe-top-fade)),
      color-mix(in srgb, var(--safe-top-cream) 88%, transparent)
        calc(100% - var(--safe-top-fade) * 0.78),
      color-mix(in srgb, var(--safe-top-cream) 62%, transparent)
        calc(100% - var(--safe-top-fade) * 0.5),
      color-mix(in srgb, var(--safe-top-cream) 32%, transparent)
        calc(100% - var(--safe-top-fade) * 0.28),
      color-mix(in srgb, var(--safe-top-cream) 10%, transparent)
        calc(100% - var(--safe-top-fade) * 0.12),
      transparent 100%
    );
    filter: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    mask-image: none;
    -webkit-mask-image: none;
  }
  .page {
    min-height: 200px;
    background: transparent;
    padding: 0 16px;
  }
  .header-row {
    display: flex; justify-content: space-between; align-items: flex-start;
    font-weight: 800; font-size: 28px; padding-top: 4px;
  }
  .meta { font-size: 12px; text-align: right; text-transform: uppercase; color: #5a7a70; }
  #probe { position: fixed; left: -9999px; top: 0; }
</style>
</head><body>
  <div class="app-safe-top" id="band" aria-hidden="true"></div>
  <div class="page">
    <div class="header-row">
      <span>Beans</span>
      <span class="meta">LOBBY</span>
    </div>
  </div>
  <canvas id="probe"></canvas>
  <script>
    window.__analyze = async function(pngBase64, fadeStartCss, fadeLenCss, bandHCss, scale) {
      const img = new Image();
      img.src = "data:image/png;base64," + pngBase64;
      await new Promise((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("img decode failed"));
      });
      const canvas = document.getElementById("probe");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const x = Math.floor(img.width / 2);
      const fadeStartPx = Math.floor(fadeStartCss * scale);
      const fadeEndPx = Math.floor((fadeStartCss + fadeLenCss) * scale);
      const bandEndPx = Math.floor(bandHCss * scale);
      function lumAt(y) {
        const d = ctx.getImageData(x, y, 1, 1).data;
        return 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2];
      }
      let stepMax = { dy: 0, y: 0, a: 0, b: 0 };
      for (let y = fadeStartPx; y < fadeEndPx - 1; y++) {
        const a = lumAt(y);
        const b = lumAt(y + 1);
        const dy = Math.abs(a - b);
        if (dy > stepMax.dy) stepMax = { dy, y, a, b };
      }
      return {
        width: img.width,
        height: img.height,
        fadeStartPx,
        fadeEndPx,
        maxStep: stepMax,
        junction: Math.abs(lumAt(fadeStartPx) - lumAt(fadeStartPx + 1)),
        tail: Math.abs(lumAt(fadeEndPx - 1) - lumAt(Math.min(fadeEndPx + 2, bandEndPx + 4))),
        solidLum: lumAt(Math.max(0, fadeStartPx - 6)),
        midFadeLum: lumAt(Math.floor((fadeStartPx + fadeEndPx) / 2)),
        afterLum: lumAt(Math.min(bandEndPx + 8, img.height - 1)),
      };
    };
  </script>
</body></html>`;

const outDir = resolve("/opt/cursor/artifacts/screenshots");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

async function runMode(mode) {
  const page = await browser.newPage({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: dpr,
  });
  const doc = mode === "contrast" ? html.replace("<html>", '<html class="contrast">') : html;
  await page.setContent(doc, { waitUntil: "load" });
  const shot = await page.screenshot({ type: "png", fullPage: false });
  const shotPath = resolve(outDir, `safe-top-fade-dsf3-${mode}.png`);
  writeFileSync(shotPath, shot);
  const analysis = await page.evaluate(
    ({ b64, fadeStartCss, fadeLenCss, bandHCss, scale }) =>
      window.__analyze(b64, fadeStartCss, fadeLenCss, bandHCss, scale),
    {
      b64: shot.toString("base64"),
      fadeStartCss: fadeStart,
      fadeLenCss: FADE,
      bandHCss: bandH,
      scale: dpr,
    },
  );
  await page.close();
  return { mode, shotPath, analysis };
}

const cream = await runMode("cream");
const contrast = await runMode("contrast");
await browser.close();

console.log("cream:", JSON.stringify(cream.analysis, null, 2));
console.log("contrast:", JSON.stringify(contrast.analysis, null, 2));
console.log("screenshots:", cream.shotPath, contrast.shotPath);

// Cream-on-cream (prod-like): fade must be invisible — no band edge
if (cream.analysis.maxStep.dy > 0.75 || cream.analysis.junction > 0.75) {
  throw new Error(
    `Visible seam on cream page: maxStep=${cream.analysis.maxStep.dy} junction=${cream.analysis.junction}`,
  );
}
// Contrasting body: prove the fade is soft (no hard 1px cliff)
const MAX_ADJACENT = 2.5;
const MAX_JUNCTION = 3.5;
if (contrast.analysis.maxStep.dy > MAX_ADJACENT) {
  throw new Error(
    `Hard seam in fade at y=${contrast.analysis.maxStep.y}: ΔL=${contrast.analysis.maxStep.dy.toFixed(3)}`,
  );
}
if (contrast.analysis.junction > MAX_JUNCTION) {
  throw new Error(
    `Hard solid→fade junction: ΔL=${contrast.analysis.junction.toFixed(3)}`,
  );
}
console.log("OK: no hard seam at dsf 3 (cream + contrast)");
