/**
 * 375px shots: settings rejoin card, draft column Skip + presence chips.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts/screenshots";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = `.a2hs-nudge, .stats-merge-prompt { display: none !important; }`;
    document.documentElement.appendChild(style);
  });

  await page.goto(BASE + "/dev/host-skip", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  // 1) Settings sheet with room code (host)
  await page.getByRole("button", { name: /Open settings/i }).click();
  await page.waitForSelector(".settings-invite", { timeout: 5000 });
  await page.waitForTimeout(300);
  const settingsPath = path.join(OUT, "settings-rejoin-card-375.png");
  await page.screenshot({ path: settingsPath, fullPage: false });
  console.log("wrote", settingsPath);

  await page.getByRole("button", { name: "Close" }).first().click();
  await page.waitForTimeout(250);

  // 2) Draft column Skip + reconnecting/skipped chips
  await page.addStyleTag({
    content: `.lab-chrome { display: none !important; }`,
  });
  await page.waitForSelector(".draft-host-skip-btn", { timeout: 5000 });
  await page.waitForSelector(".player-presence-chip", { timeout: 5000 });
  await page.waitForTimeout(200);

  const draftPath = path.join(OUT, "draft-column-skip-presence-375.png");
  await page.screenshot({ path: draftPath, fullPage: false });
  console.log("wrote", draftPath);

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
