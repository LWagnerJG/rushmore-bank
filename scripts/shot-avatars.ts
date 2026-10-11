import { mkdirSync } from "node:fs";
import path from "node:path";
import { webkit } from "playwright";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("quarry:name", "Luke");
    localStorage.setItem("quarry:client-id", "demo-avatar");
    localStorage.setItem("quarry:avatar-id", "pirate");
    localStorage.setItem(
      "quarry:profile-stats:demo-avatar",
      JSON.stringify({
        wins: 3,
        gamesPlayed: 5,
        bestScore: 48,
        winStreak: 2,
        recordedGameIds: ["A:1", "B:2", "C:3"],
        totalBeans: 140,
      }),
    );
  });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const cont = page.getByRole("button", { name: /^Continue$/ });
  if (await cont.isVisible().catch(() => false)) {
    await page.getByLabel("Nickname").fill("Luke");
    await cont.click();
    await page.waitForTimeout(300);
  }
  await page.getByRole("button", { name: "Profile" }).click();
  await page.waitForSelector('[role="dialog"][aria-label="Profile"]');
  await page.waitForTimeout(350);
  await page.screenshot({
    path: path.join(OUT, "avatar-profile-main-390x844.png"),
    fullPage: false,
  });
  await page.getByRole("button", { name: "Change avatar" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(OUT, "avatar-picker-390x844.png"),
    fullPage: false,
  });
  console.log("wrote avatar shots");
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
