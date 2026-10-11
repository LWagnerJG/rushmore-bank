import { mkdirSync } from "node:fs";
import path from "node:path";
import { webkit } from "playwright";
import { ADMIN_UNLOCK_KEY } from "../src/lib/admin-session";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await webkit.launch({ headless: true });
  for (const vp of [
    { w: 390, h: 844, label: "390x844" },
    { w: 375, h: 667, label: "375x667" },
  ]) {
    const context = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    });
    const page = await context.newPage();
    await page.addInitScript((key) => {
      try {
        sessionStorage.setItem(key, "1");
        localStorage.setItem("quarry:client-id", "demo-client");
        localStorage.setItem("quarry:name", "Luke");
        localStorage.setItem(
          "quarry:profile-stats:demo-client",
          JSON.stringify({
            wins: 3,
            gamesPlayed: 5,
            bestScore: 48,
            winStreak: 2,
            recordedGameIds: ["A:1", "B:2", "C:3"],
          }),
        );
      } catch {
        /* ignore */
      }
    }, ADMIN_UNLOCK_KEY);

    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    const cont = page.getByRole("button", { name: /^Continue$/ });
    if (await cont.isVisible().catch(() => false)) {
      await page.getByLabel("Nickname").fill("Luke");
      await cont.click();
      await page.waitForTimeout(300);
    }
    await page.getByRole("button", { name: "Profile" }).click();
    await page.waitForSelector('[role="dialog"][aria-label="Profile"]');
    await page.waitForTimeout(350);
    const dest = path.join(OUT, `profile-sheet-open-${vp.label}.png`);
    await page.screenshot({ path: dest, fullPage: false });
    const winsEl = page.locator(".profile-stat-hero .profile-stat-value");
    const emptyEl = page.locator(".profile-stats-empty");
    const wins = (await winsEl.count())
      ? (await winsEl.textContent())?.trim()
      : (await emptyEl.textContent())?.trim();
    console.log("wrote", dest, "wins", wins);
    await context.close();
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

