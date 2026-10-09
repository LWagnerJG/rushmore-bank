/**
 * WebKit retina crispness check — isolates iOS soft-raster compositing traps.
 *
 * Serves tiny HTML fixtures, screenshots at deviceScaleFactor:3, and scores
 * edge energy (Laplacian variance). Higher = sharper.
 *
 * Usage: npx tsx scripts/verify-ios-crisp.ts
 */
import { webkit, type Page } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "./_png-lite";

const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts";
const PORT = 8765;

type CaseId =
  | "clean"
  | "forwards-transform"
  | "settled-animation"
  | "fixed-tall-bg"
  | "backdrop-hidden"
  | "will-change-tall";

const CASES: Record<CaseId, string> = {
  clean: `
<style>
  html,body{margin:0;height:100%;background:#f5f0e7;color:#23483e;
    font-family:ui-sans-serif,system-ui,sans-serif;overflow:hidden}
  .chrome{padding:12px 16px;background:#f5f0e7}
  .brand{font-weight:800;font-size:28px;letter-spacing:-0.02em}
  .code{margin:16px;padding:24px;background:#fff;border-radius:18px;
    font-weight:800;font-size:56px;letter-spacing:0.22em;text-align:center}
</style>
<main>
  <header class="chrome"><div class="brand" id="brand">Beans</div></header>
  <section class="code" id="code">ABCD</section>
</main>`,

  "forwards-transform": `
<style>
  html,body{margin:0;height:100%;background:#f5f0e7;color:#23483e;
    font-family:ui-sans-serif,system-ui,sans-serif;overflow:hidden}
  @keyframes rise{
    from{opacity:0.01;transform:translateY(10px)}
    to{opacity:1;transform:none}
  }
  .wrap{min-height:200vh;animation:rise 40ms ease-out forwards;opacity:1}
  .chrome{padding:12px 16px;background:#f5f0e7}
  .brand{font-weight:800;font-size:28px;letter-spacing:-0.02em}
  .code{margin:16px;padding:24px;background:#fff;border-radius:18px;
    font-weight:800;font-size:56px;letter-spacing:0.22em;text-align:center}
</style>
<main class="wrap">
  <header class="chrome"><div class="brand" id="brand">Beans</div></header>
  <section class="code" id="code">ABCD</section>
</main>`,

  "settled-animation": `
<style>
  html,body{margin:0;height:100%;background:#f5f0e7;color:#23483e;
    font-family:ui-sans-serif,system-ui,sans-serif;overflow:hidden}
  @keyframes rise{
    from{opacity:0.01;transform:translateY(10px)}
    to{opacity:1;transform:none}
  }
  .wrap{min-height:200vh;opacity:1;animation:rise 40ms ease-out}
  .wrap.is-settled{animation:none;transform:none;opacity:1;will-change:auto}
  .chrome{padding:12px 16px;background:#f5f0e7}
  .brand{font-weight:800;font-size:28px;letter-spacing:-0.02em}
  .code{margin:16px;padding:24px;background:#fff;border-radius:18px;
    font-weight:800;font-size:56px;letter-spacing:0.22em;text-align:center}
</style>
<main class="wrap" id="wrap">
  <header class="chrome"><div class="brand" id="brand">Beans</div></header>
  <section class="code" id="code">ABCD</section>
</main>
<script>
  const el=document.getElementById('wrap');
  const settle=()=>el.classList.add('is-settled');
  el.addEventListener('animationend',settle,{once:true});
  setTimeout(settle,80);
</script>`,

  "fixed-tall-bg": `
<style>
  html,body{margin:0;height:100%;background:#f5f0e7;color:#23483e;
    font-family:ui-sans-serif,system-ui,sans-serif;overflow:hidden}
  body::before{content:"";position:fixed;inset:0;bottom:-50px;z-index:-1;
    background-image:
      radial-gradient(900px 480px at 0% -10%,rgba(244,201,91,.35),transparent 55%),
      radial-gradient(800px 420px at 100% 0%,rgba(167,215,194,.45),transparent 50%),
      linear-gradient(165deg,#f7f3eb,#f5f0e7)}
  .chrome{padding:12px 16px;background:#f5f0e7}
  .brand{font-weight:800;font-size:28px;letter-spacing:-0.02em}
  .code{margin:16px;padding:24px;background:#fff;border-radius:18px;
    font-weight:800;font-size:56px;letter-spacing:0.22em;text-align:center}
</style>
<main>
  <header class="chrome"><div class="brand" id="brand">Beans</div></header>
  <section class="code" id="code">ABCD</section>
</main>`,

  "backdrop-hidden": `
<style>
  html,body{margin:0;height:100%;background:#f5f0e7;color:#23483e;
    font-family:ui-sans-serif,system-ui,sans-serif;overflow:hidden}
  .veil{position:fixed;inset:0;z-index:80;opacity:0;pointer-events:none;
    background:rgba(35,72,62,.45);backdrop-filter:blur(2px);
    -webkit-backdrop-filter:blur(2px)}
  .chrome{padding:12px 16px;background:#f5f0e7}
  .brand{font-weight:800;font-size:28px;letter-spacing:-0.02em}
  .code{margin:16px;padding:24px;background:#fff;border-radius:18px;
    font-weight:800;font-size:56px;letter-spacing:0.22em;text-align:center}
</style>
<main>
  <header class="chrome"><div class="brand" id="brand">Beans</div></header>
  <section class="code" id="code">ABCD</section>
</main>
<div class="veil" aria-hidden="true"></div>`,

  "will-change-tall": `
<style>
  html,body{margin:0;height:100%;background:#f5f0e7;color:#23483e;
    font-family:ui-sans-serif,system-ui,sans-serif;overflow:hidden}
  .wrap{min-height:200vh;will-change:transform;transform:translateZ(0)}
  .chrome{padding:12px 16px;background:#f5f0e7}
  .brand{font-weight:800;font-size:28px;letter-spacing:-0.02em}
  .code{margin:16px;padding:24px;background:#fff;border-radius:18px;
    font-weight:800;font-size:56px;letter-spacing:0.22em;text-align:center}
</style>
<main class="wrap">
  <header class="chrome"><div class="brand" id="brand">Beans</div></header>
  <section class="code" id="code">ABCD</section>
</main>`,
};

function pageHtml(body: string): string {
  return `<!doctype html><html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover"/>
</head><body>${body}</body></html>`;
}

/** Laplacian variance on grayscale — higher means sharper edges. */
function sharpnessScore(png: PNG, x0: number, y0: number, w: number, h: number): number {
  const { width, height, data } = png;
  const x1 = Math.min(width, x0 + w);
  const y1 = Math.min(height, y0 + h);
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  const gray = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
  };
  for (let y = Math.max(1, y0); y < y1 - 1; y++) {
    for (let x = Math.max(1, x0); x < x1 - 1; x++) {
      const lap =
        -gray(x - 1, y) - gray(x + 1, y) - gray(x, y - 1) - gray(x, y + 1) +
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

async function measureCase(page: Page, id: CaseId): Promise<{
  brand: number;
  code: number;
  path: string;
}> {
  await page.setContent(pageHtml(CASES[id]), { waitUntil: "load" });
  // Let filled-forwards / settle class apply.
  await page.waitForTimeout(120);
  const shotPath = path.join(OUT, `ios-crisp-${id}.png`);
  await page.screenshot({ path: shotPath, fullPage: false });
  const buf = fs.readFileSync(shotPath);
  const png = PNG.decode(buf);
  // Sample brand + room-code bands (CSS px * dsf).
  const dsf = 3;
  const brand = sharpnessScore(png, 20 * dsf, 8 * dsf, 160 * dsf, 40 * dsf);
  const code = sharpnessScore(png, 40 * dsf, 70 * dsf, 300 * dsf, 80 * dsf);
  return { brand, code, path: shotPath };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  // Tiny server unused for setContent path, but kept for BASE_URL override.
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
  });
  await new Promise<void>((r) => server.listen(PORT, "127.0.0.1", r));

  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  const results: Record<string, { brand: number; code: number }> = {};
  for (const id of Object.keys(CASES) as CaseId[]) {
    const m = await measureCase(page, id);
    results[id] = { brand: m.brand, code: m.code };
    console.log(
      `${id}: brand=${m.brand.toFixed(2)} code=${m.code.toFixed(2)} → ${m.path}`,
    );
  }

  const clean = results.clean!;
  const forwards = results["forwards-transform"]!;
  const settled = results["settled-animation"]!;
  const willChange = results["will-change-tall"]!;
  const backdrop = results["backdrop-hidden"]!;

  // Soft raster typically crushes high-frequency energy well below clean.
  const report = {
    results,
    ratios: {
      forwardsVsCleanCode: forwards.code / clean.code,
      settledVsCleanCode: settled.code / clean.code,
      willChangeVsCleanCode: willChange.code / clean.code,
      backdropVsCleanCode: backdrop.code / clean.code,
    },
  };
  fs.writeFileSync(
    path.join(OUT, "ios-crisp-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report.ratios, null, 2));

  await browser.close();
  server.close();

  // Fail if settled path is still soft vs clean (contract for the fix).
  if (settled.code < clean.code * 0.55) {
    console.error("FAIL: settled-animation still soft vs clean");
    process.exit(1);
  }
  console.log("OK: settled animation path stays crisp vs clean baseline");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
