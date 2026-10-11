/**
 * WebKit iPhone shots: home row + avatar picker (4-col soft tiles).
 *
 *   BASE_URL=http://127.0.0.1:3100 npx tsx scripts/shot-avatar-picker.ts
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { webkit, devices } from "playwright";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3100").replace(
  /\/$/,
  "",
);
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts/screenshots";

async function shot(name: string, page: import("playwright").Page) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", file);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await webkit.launch({ headless: true });
  const iphone = devices["iPhone 15"];
  const context = await browser.newContext({
    ...iphone,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("quarry:name", "Wags");
    localStorage.setItem("quarry:client-id", "demo-avatar-picker");
    localStorage.setItem("quarry:avatar-id", "beanie");
    localStorage.setItem(
      "quarry:profile-stats:demo-avatar-picker",
      JSON.stringify({
        wins: 2,
        gamesPlayed: 4,
        bestScore: 36,
        winStreak: 1,
        recordedGameIds: ["A:1", "B:2"],
        totalBeans: 90,
      }),
    );
  });

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const cont = page.getByRole("button", { name: /^Continue$/ });
  if (await cont.isVisible().catch(() => false)) {
    await page.getByLabel("Nickname").fill("Wags");
    await cont.click();
    await page.waitForTimeout(400);
  }

  await shot("avatar-home-playing-as-iphone15.png", page);

  await page.locator(".home-playing-avatar").first().click();
  await page.waitForSelector('[role="dialog"][aria-label="Profile"]');
  await page.waitForSelector(".avatar-picker-grid");
  await page.waitForTimeout(400);
  await shot("avatar-picker-iphone15.png", page);

  // SE-sized viewport for compact check
  await context.close();
  const se = await browser.newContext({
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: iphone.userAgent,
  });
  const pageSe = await se.newPage();
  await pageSe.addInitScript(() => {
    localStorage.setItem("quarry:name", "Wags");
    localStorage.setItem("quarry:client-id", "demo-avatar-picker");
    localStorage.setItem("quarry:avatar-id", "beanie");
  });
  await pageSe.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await pageSe.waitForTimeout(500);
  const contSe = pageSe.getByRole("button", { name: /^Continue$/ });
  if (await contSe.isVisible().catch(() => false)) {
    await pageSe.getByLabel("Nickname").fill("Wags");
    await contSe.click();
    await pageSe.waitForTimeout(300);
  }
  await pageSe.locator(".home-playing-avatar").first().click();
  await pageSe.waitForSelector(".avatar-picker-grid");
  await pageSe.waitForTimeout(350);
  await shot("avatar-picker-iphoneSE.png", pageSe);

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
