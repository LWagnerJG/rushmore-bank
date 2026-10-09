/**
 * WebKit dsf:3 sharpness check focused on the room header band.
 *
 * Renders a lobby-shaped header (Beans + AI waiting + LOBBY / 0 beans) with
 * production static-chrome CSS, plus a crisp EXGL card below as contrast.
 *
 * Usage: npx tsx scripts/verify-ios-header-crisp.ts
 */
import { webkit } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "./_png-lite";

const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts";

function sharpnessScore(
  png: PNG,
  x0: number,
  y0: number,
  w: number,
  h: number,
): number {
  const { width, height, data } = png;
  const x1 = Math.min(width, Math.max(0, x0 + w));
  const y1 = Math.min(height, Math.max(0, y0 + h));
  const sx = Math.max(1, Math.min(width - 2, x0));
  const sy = Math.max(1, Math.min(height - 2, y0));
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  const gray = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
  };
  for (let y = sy; y < y1 - 1; y++) {
    for (let x = sx; x < x1 - 1; x++) {
      const lap =
        -gray(x - 1, y) -
        gray(x + 1, y) -
        gray(x, y - 1) -
        gray(x, y + 1) +
        4 * gray(x, y);
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

const HTML = `<!doctype html><html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover"/>
<style>
  :root { --text:#23483e; --muted:#5a7a70; --bg:#f5f0e7; --font-display:ui-sans-serif,system-ui,sans-serif; }
  html,body{margin:0;height:100%;background:#f5f0e7;color:var(--text);
    font-family:ui-sans-serif,system-ui,sans-serif;overflow:hidden}
  /* Mirror production static chrome contract */
  .room-chrome{position:relative;overflow:visible;background:#f5f0e7;border-bottom:1px solid #d9e0dc;
    transform:none;filter:none;will-change:auto;isolation:auto;contain:none;opacity:1}
  .room-chrome,.room-chrome *{animation:none!important;transition:none!important;transform:none!important;
    will-change:auto!important;filter:none!important;backdrop-filter:none!important;
    -webkit-backdrop-filter:none!important;mask-image:none!important;mix-blend-mode:normal!important;
    text-shadow:none!important;-webkit-text-stroke:0!important;
    -webkit-background-clip:border-box!important;background-clip:border-box!important}
  .room-chrome-safe{height:47px;background:#f5f0e7}
  .room-chrome-body{padding:4px 16px 8px;background:#f5f0e7}
  .room-chrome-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
  .brand{display:inline-flex;align-items:center;gap:10px}
  .brand-word{font-weight:800;font-size:28px;letter-spacing:-0.02em;color:var(--text)}
  .host-ai-chrome{display:inline-flex;align-items:center;min-height:1.35rem;padding:0.12rem 0.45rem;
    border-radius:0.45rem;font-size:0.62rem;font-weight:800;line-height:1;border:1px solid #b7d7c8;
    white-space:nowrap;color:var(--text);background:#d8ebe2;opacity:1}
  .meta{text-align:right;font-size:12px;font-weight:700;text-transform:uppercase;color:var(--muted)}
  .meta-beans{font-size:14px;color:var(--text);text-transform:none;font-weight:800}
  .panel{margin:12px 16px;padding:24px;background:#fff;border-radius:18px;text-align:center;
    border:1.5px solid rgba(35,72,62,0.1)}
  .code{font-weight:800;font-size:56px;letter-spacing:0.22em;margin:0;color:var(--text)}
  .bean{width:36px;height:36px;display:block}
</style></head><body>
<header class="room-chrome" id="chrome">
  <div class="room-chrome-safe" aria-hidden="true"></div>
  <div class="room-chrome-body">
    <div class="room-chrome-top">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <div class="brand" id="brand">
          <svg class="bean" viewBox="0 0 128 128" shape-rendering="auto">
            <path d="M85 13C109 15 122 39 112 60C106 73 92 71 89 85C85 110 61 123 38 111C11 97 10 61 25 38C40 17 63 10 85 13Z" fill="#E76F4E" stroke="#23483E" stroke-width="6"/>
            <ellipse cx="47" cy="62" rx="4" ry="6" fill="#23483E"/>
            <ellipse cx="65" cy="58" rx="4" ry="6" fill="#23483E"/>
          </svg>
          <span class="brand-word">Beans</span>
        </div>
        <span class="host-ai-chrome host-ai-chrome-ready" id="ai">AI waiting</span>
      </div>
      <div class="meta" id="meta">
        <div>LOBBY</div>
        <div class="meta-beans">0 beans</div>
      </div>
    </div>
  </div>
</header>
<section class="panel"><p class="code" id="code">EXGL</p></section>
</body></html>`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.setContent(HTML, { waitUntil: "load" });
  await page.waitForTimeout(80);

  // Assert no animation / transform on chrome descendants
  const layer = await page.evaluate(() => {
    const chrome = document.getElementById("chrome")!;
    const nodes = [chrome, ...chrome.querySelectorAll("*")];
    return nodes.map((el) => {
      const s = getComputedStyle(el);
      return {
        tag: el.tagName,
        cls: (el as HTMLElement).className,
        transform: s.transform,
        willChange: s.willChange,
        animation: s.animationName,
        filter: s.filter,
        bgClip: s.backgroundClip,
      };
    });
  });
  for (const n of layer) {
    if (n.transform !== "none") {
      console.error("FAIL: chrome node has transform", n);
      process.exit(1);
    }
    if (n.willChange && n.willChange !== "auto") {
      console.error("FAIL: chrome node has will-change", n);
      process.exit(1);
    }
    if (n.animation && n.animation !== "none") {
      console.error("FAIL: chrome node has animation", n);
      process.exit(1);
    }
  }

  const shotPath = path.join(OUT, "ios-crisp-header-webkit.png");
  await page.screenshot({ path: shotPath, fullPage: false });
  const png = PNG.decode(fs.readFileSync(shotPath));
  const dsf = 3;

  const brandBox = await page.locator("#brand").boundingBox();
  const aiBox = await page.locator("#ai").boundingBox();
  const metaBox = await page.locator("#meta").boundingBox();
  const codeBox = await page.locator("#code").boundingBox();
  if (!brandBox || !aiBox || !metaBox || !codeBox) {
    console.error("FAIL: missing boxes");
    process.exit(1);
  }

  const score = (box: { x: number; y: number; width: number; height: number }) =>
    sharpnessScore(
      png,
      Math.floor(box.x * dsf),
      Math.floor(box.y * dsf),
      Math.ceil(box.width * dsf),
      Math.ceil(box.height * dsf),
    );

  const brand = score(brandBox);
  const ai = score(aiBox);
  const meta = score(metaBox);
  const code = score(codeBox);
  console.log(
    JSON.stringify(
      { brand, ai, meta, code, shotPath, brandBox, aiBox, metaBox, codeBox },
      null,
      2,
    ),
  );

  // Header regions must stay in the same crisp ballpark as the room-code card
  if (brand < 80 || ai < 40 || meta < 40) {
    console.error("FAIL: header sharpness too low");
    process.exit(1);
  }
  if (code < 80) {
    console.error("FAIL: code sharpness too low (fixture broken)");
    process.exit(1);
  }
  // Header must not be dramatically softer than the card (the bug pattern)
  if (brand < code * 0.35) {
    console.error(
      `FAIL: brand (${brand}) much softer than code (${code}) — soft header regression`,
    );
    process.exit(1);
  }

  console.log("OK: WebKit dsf:3 header band crisp alongside EXGL card");
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
