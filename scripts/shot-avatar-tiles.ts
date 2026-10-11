/**
 * Live WebKit shot: picker + per-tile zooms composite.
 * BASE_URL=https://beans-web.beans-lwagner.workers.dev npx tsx scripts/shot-avatar-tiles.ts
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { webkit, devices } from "playwright";
import sharp from "sharp";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts/screenshots";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    ...devices["iPhone 15"],
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("quarry:name", "Wags");
    localStorage.setItem("quarry:client-id", "live-avatar-tiles");
    localStorage.setItem("quarry:avatar-id", "beanie");
  });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const cont = page.getByRole("button", { name: /^Continue$/ });
  if (await cont.isVisible().catch(() => false)) {
    await page.getByLabel("Nickname").fill("Wags");
    await cont.click();
    await page.waitForTimeout(400);
  }
  await page.locator(".home-playing-avatar").first().click();
  await page.waitForSelector(".avatar-picker-grid");
  await page.waitForTimeout(500);
  const full = path.join(OUT, "live-avatar-picker-iphone15.png");
  await page.screenshot({ path: full, fullPage: false });

  const cells = page.locator(".avatar-picker-cell");
  const n = await cells.count();
  const zooms: Buffer[] = [];
  for (let i = 0; i < n; i++) {
    const box = await cells.nth(i).boundingBox();
    if (!box) continue;
    const buf = await page.screenshot({
      type: "png",
      clip: {
        x: Math.max(0, box.x - 2),
        y: Math.max(0, box.y - 2),
        width: box.width + 4,
        height: box.height + 4,
      },
    });
    zooms.push(
      await sharp(buf).resize(140, 140, { fit: "fill" }).png().toBuffer(),
    );
  }
  const cols = 4;
  const rows = Math.ceil(zooms.length / cols);
  const gap = 6;
  const cell = 140;
  const W = cols * cell + (cols + 1) * gap;
  const H = rows * cell + (rows + 1) * gap;
  const comps = zooms.map((input, i) => ({
    input,
    left: gap + (i % cols) * (cell + gap),
    top: gap + Math.floor(i / cols) * (cell + gap),
  }));
  await sharp({
    create: {
      width: W,
      height: H,
      channels: 3,
      background: { r: 245, g: 240, b: 230 },
    },
  })
    .composite(comps)
    .png()
    .toFile(path.join(OUT, "live-avatar-tiles-zoom-grid.png"));
  console.log("wrote", full, "and tile zoom grid", n);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
