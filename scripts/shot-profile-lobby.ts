import { mkdirSync } from "node:fs";
import path from "node:path";
import { webkit } from "playwright";
import { ADMIN_UNLOCK_KEY } from "../src/lib/admin-session";

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
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  await page.addInitScript((key) => {
    try {
      sessionStorage.setItem(key, "1");
      localStorage.setItem("quarry:name", "Luke");
    } catch {
      /* ignore */
    }
  }, ADMIN_UNLOCK_KEY);

  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  const cont = page.getByRole("button", { name: /^Continue$/ });
  if (await cont.isVisible().catch(() => false)) {
    await page.getByLabel("Nickname").fill("Luke");
    await cont.click();
  }
  await page.getByRole("button", { name: /Create game/i }).click();
  await page.waitForURL(/\/room\//, { timeout: 25000 });
  await page.waitForSelector("text=Lobby", { timeout: 20000 });
  await page.getByRole("button", { name: "Profile" }).click();
  await page.waitForSelector('[role="dialog"][aria-label="Profile"]');
  await page.waitForTimeout(400);
  const dest = path.join(OUT, "profile-sheet-lobby-390x844.png");
  await page.screenshot({ path: dest, fullPage: false });
  console.log("wrote", dest);

  // Nested Host options + Admin for declutter shots
  await page.getByRole("button", { name: /^Host options$/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(OUT, "profile-sheet-host-390x844.png"),
    fullPage: false,
  });
  await page.getByRole("button", { name: /Host options/ }).click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /^Admin$/ }).click();
  await page.waitForSelector("label:has-text('Jump phase')", { timeout: 8000 });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(OUT, "profile-sheet-admin-390x844.png"),
    fullPage: false,
  });
  console.log("wrote nested host/admin shots");
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
