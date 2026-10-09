/**
 * Screenshot the real Next home in WebKit at deviceScaleFactor:3.
 * Asserts MotionSettle lands on .motion-settled with transform:none, and
 * brand text has strong edge energy (crisp, not soft-rasterized).
 *
 * Usage: BASE_URL=http://localhost:3000 npx tsx scripts/verify-ios-crisp-app.ts
 */
import { webkit } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "./_png-lite";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts";

function sharpnessScore(
  png: PNG,
  x0: number,
  y0: number,
  w: number,
  h: number,
): number {
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
  page.on("pageerror", (err) => console.error("PAGE ERROR", err));

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Beans", { timeout: 10000 });
  await page.waitForFunction(
    () => document.querySelector(".motion-settled") != null,
    { timeout: 3000 },
  );
  // Extra frame so any compositor settle completes
  await page.waitForTimeout(100);

  const layerState = await page.evaluate(() => {
    const settled = [...document.querySelectorAll(".motion-settled")];
    const rising = [...document.querySelectorAll(".animate-rise, .phase-enter")];
    const cs = settled.map((el) => {
      const s = getComputedStyle(el);
      return {
        transform: s.transform,
        willChange: s.willChange,
        animationName: s.animationName,
      };
    });
    // Detect any fixed full-viewport veil left at opacity 0
    const veils = [...document.querySelectorAll("body *")].filter((el) => {
      const s = getComputedStyle(el);
      if (s.position !== "fixed") return false;
      if (s.opacity !== "0") return false;
      const r = el.getBoundingClientRect();
      return r.width >= window.innerWidth * 0.9 && r.height >= window.innerHeight * 0.9;
    }).length;
    return {
      settledCount: settled.length,
      stillAnimating: rising.length,
      settledStyles: cs,
      opacityZeroVeils: veils,
    };
  });
  console.log("layerState", JSON.stringify(layerState, null, 2));

  const homePath = path.join(OUT, "ios-crisp-home-webkit.png");
  await page.screenshot({ path: homePath, fullPage: false });
  const png = PNG.decode(fs.readFileSync(homePath));
  const dsf = 3;

  // Sample the large Beans wordmark region (home hero)
  const brandBox = await page.locator("text=Beans").first().boundingBox();
  if (!brandBox) {
    console.error("FAIL: Beans wordmark not found");
    process.exit(1);
  }
  const brandScore = sharpnessScore(
    png,
    Math.floor(brandBox.x * dsf),
    Math.floor(brandBox.y * dsf),
    Math.ceil(brandBox.width * dsf),
    Math.ceil(brandBox.height * dsf),
  );
  console.log(
    `home brand sharpness=${brandScore.toFixed(2)} box=${JSON.stringify(brandBox)} → ${homePath}`,
  );

  if (layerState.settledCount < 1) {
    console.error("FAIL: MotionSettle never reached .motion-settled");
    process.exit(1);
  }
  if (layerState.stillAnimating > 0) {
    console.error("FAIL: animate-rise/phase-enter still present after settle");
    process.exit(1);
  }
  if (layerState.opacityZeroVeils > 0) {
    console.error("FAIL: fixed opacity:0 full-viewport veil still mounted");
    process.exit(1);
  }
  for (const s of layerState.settledStyles) {
    if (s.transform !== "none") {
      console.error("FAIL: settled node still has transform", s);
      process.exit(1);
    }
    if (s.willChange && s.willChange !== "auto") {
      console.error("FAIL: settled node still has will-change", s);
      process.exit(1);
    }
  }
  if (brandScore < 80) {
    console.error(`FAIL: home brand sharpness too low (${brandScore})`);
    process.exit(1);
  }

  // Synthetic lobby using the same settle contract (inline CSS from globals rules)
  await page.setContent(
    `<!doctype html><html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover"/>
<style>
  html,body{margin:0;height:100%;background:#f5f0e7;color:#23483e;
    font-family:ui-sans-serif,system-ui,sans-serif;overflow:hidden}
  body::before{content:"";position:fixed;inset:0;bottom:-50px;z-index:-1;
    transform:none;filter:none;will-change:auto;background-attachment:scroll;
    background-color:#f5f0e7;
    background-image:radial-gradient(900px 480px at 0% -10%,rgba(244,201,91,.35),transparent 55%),
      linear-gradient(165deg,#f7f3eb,#f5f0e7)}
  .room-chrome{position:relative;overflow:hidden;background:#f5f0e7;
    transform:none;filter:none;will-change:auto;padding:12px 16px}
  .motion-settled{animation:none!important;transform:none!important;opacity:1!important;
    filter:none!important;will-change:auto!important}
  .panel{margin:16px;padding:24px;background:#fff;border-radius:18px;text-align:center}
  .brand{font-weight:800;font-size:28px}
  .code{font-weight:800;font-size:56px;letter-spacing:.22em;margin:0}
  .meta{text-align:right;font-size:12px;font-weight:700;text-transform:uppercase;color:#5a7a70}
</style></head><body>
<main>
  <header class="room-chrome" style="display:flex;justify-content:space-between">
    <div class="brand" id="brand">Beans</div>
    <div class="meta"><div>LOBBY</div><div style="font-size:14px;color:#23483e;text-transform:none">0 beans</div></div>
  </header>
  <div class="motion-settled">
    <section class="panel"><p class="code" id="code">WXYZ</p></section>
  </div>
</main>
</body></html>`,
    { waitUntil: "load" },
  );
  await page.waitForTimeout(50);
  const lobbyPath = path.join(OUT, "ios-crisp-lobby-mock-webkit.png");
  await page.screenshot({ path: lobbyPath, fullPage: false });
  const lobbyPng = PNG.decode(fs.readFileSync(lobbyPath));
  const codeBox = await page.locator("#code").boundingBox();
  if (!codeBox) {
    console.error("FAIL: lobby code missing");
    process.exit(1);
  }
  const codeScore = sharpnessScore(
    lobbyPng,
    Math.floor(codeBox.x * dsf),
    Math.floor(codeBox.y * dsf),
    Math.ceil(codeBox.width * dsf),
    Math.ceil(codeBox.height * dsf),
  );
  console.log(`lobby mock code sharpness=${codeScore.toFixed(2)} → ${lobbyPath}`);
  if (codeScore < 80) {
    console.error(`FAIL: lobby code sharpness too low (${codeScore})`);
    process.exit(1);
  }

  console.log("OK: WebKit dsf:3 home settled crisp + lobby mock crisp");
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
