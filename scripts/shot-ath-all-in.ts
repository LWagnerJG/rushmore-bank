/**
 * 375px screenshots: final standings (normal + new ATH) and Everyone’s in! beat.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts/screenshots";

async function shot(pageUrl: string, file: string, clickAth?: "normal" | "new") {
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
  await page.goto(BASE + pageUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  if (clickAth) {
    await page.getByRole("button", { name: `ath:${clickAth}` }).click();
    await page.waitForTimeout(900);
  }
  // Let endgame reveal finish so ATH line is visible.
  if (pageUrl.includes("endgame")) {
    await page.waitForTimeout(2200);
  }
  // Hide lab chrome so the shot reads as the in-game panel.
  await page.addStyleTag({
    content: `.lab-chrome { display: none !important; }`,
  });
  await page.waitForTimeout(100);
  const out = path.join(OUT, file);
  await page.screenshot({ path: out, fullPage: false });
  console.log("wrote", out);
  await browser.close();
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  await shot("/dev/endgame", "standings-ath-normal-375.png", "normal");
  await shot("/dev/endgame", "standings-ath-new-375.png", "new");
  await shot("/dev/all-in", "draft-all-in-375.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
