/**
 * WebKit 390×844 after-shots for Luke polish (#152).
 *
 *   BASE_URL=https://… npx tsx scripts/shot-luke-polish.ts
 *
 * Writes PNGs under OUT_DIR (default /opt/cursor/artifacts).
 */
import { mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import { webkit, type Page } from "playwright";
import { ADMIN_UNLOCK_KEY } from "../src/lib/admin-session";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts";
const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

async function shot(page: Page, name: string) {
  const dest = path.join(OUT, name);
  await page.screenshot({ path: dest, fullPage: false });
  console.log("wrote", dest);
}

async function unlockAdmin(page: Page) {
  await page.addInitScript((key) => {
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
  }, ADMIN_UNLOCK_KEY);
}

async function createRoom(page: Page) {
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  // Admin unlock via init script — confirm Continue if nickname gate shows
  const continueBtn = page.getByRole("button", { name: /^Continue$/ });
  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.click();
    await page.waitForTimeout(300);
  }
  await page.getByRole("button", { name: /Create game/i }).click();
  await page.waitForURL(/\/room\//, { timeout: 25000 });
  await page.waitForSelector("text=Lobby", { timeout: 20000 });
}

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "Settings" }).click();
  await page.waitForSelector('[role="dialog"][aria-label="Settings"]', {
    timeout: 8000,
  });
}

async function jumpPhase(page: Page, phaseLabel: string) {
  await openSettings(page);
  const select = page.locator('select').filter({ has: page.locator(`option:has-text("${phaseLabel}")`) }).first();
  // Prefer label match on option text
  const jump = page.locator("label:has-text('Jump phase') select");
  await jump.selectOption({ label: phaseLabel });
  // Close settings
  await page.getByRole("button", { name: /^Close$/ }).click();
  await page.waitForTimeout(600);
}

async function addBots(page: Page, count = 2) {
  await openSettings(page);
  const input = page.locator('label:has-text("Add bots") input');
  await input.fill(String(count));
  await page.getByRole("button", { name: /^Add$/ }).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^Close$/ }).click();
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: IOS_UA,
  });
  const page = await context.newPage();
  await unlockAdmin(page);

  try {
    await createRoom(page);
    await addBots(page, 2);

    // Settings: no hard divider lines
    await openSettings(page);
    const tag = process.env.SHOT_TAG || "after";
    await shot(page, `${tag}_settings_no_dividers_390x844.png`);
    await page.getByRole("button", { name: /^Close$/ }).click();

    await jumpPhase(page, "Vote");
    await page.waitForTimeout(800);
    await shot(page, `${tag}_vote_quiet_wait_390x844.png`);

    await jumpPhase(page, "Scores");
    await page.waitForTimeout(800);
    await shot(page, `${tag}_score_reveal_hero_dock_390x844.png`);

    await jumpPhase(page, "Wager");
    await page.waitForTimeout(800);
    await shot(page, `${tag}_wager_quiet_rail_390x844.png`);

    await jumpPhase(page, "Round results");
    await page.waitForTimeout(1200);
    // Skip reveal if present so scores are visible
    const list = page.locator(".results-reveal");
    if (await list.count()) {
      await list.click();
      await page.waitForTimeout(400);
    }
    await shot(page, `${tag}_round_results_no_rail_390x844.png`);

    // Update banner toast — inject soft banner to prove bottom placement
    await page.evaluate(() => {
      const el = document.createElement("div");
      el.className = "stale-client-banner";
      el.setAttribute("role", "status");
      el.textContent = "A newer Beans build is available. Update after this round";
      document.body.appendChild(el);
    });
    await shot(page, `${tag}_update_banner_bottom_390x844.png`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
