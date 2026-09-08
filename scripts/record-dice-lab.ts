/**
 * Record a short video of dice lab rolls for walkthrough evidence.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = process.env.OUT_DIR || "/workspace/artifacts";

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/local/bin/google-chrome",
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage({
    viewport: { width: 420, height: 720 },
    recordVideo: { dir: OUT, size: { width: 420, height: 720 } },
  });
  await page.goto(`${BASE}/dev/dice-lab`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  for (let i = 0; i < 4; i++) {
    await page.locator("[data-testid=lab-roll]").click();
    await page.waitForFunction(
      () =>
        document
          .querySelector(".bean-dice-tray")
          ?.getAttribute("data-dice-phase") === "settled",
      { timeout: 5000 },
    );
    await page.waitForTimeout(700);
    await page.locator("[data-testid=lab-next]").click();
    await page.waitForTimeout(250);
  }

  const video = page.video();
  await page.close();
  const raw = video ? await video.path() : null;
  await browser.close();
  if (raw) {
    const dest = path.join(OUT, "dice-settle-no-jump.webm");
    fs.renameSync(raw, dest);
    console.log("video:", dest);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
