/**
 * WebKit profile sheet verify @ 390×844 and 375×667.
 *
 * Creates a room, adds bots, jumps to GAME_RESULTS, asserts wins increment
 * once (reload must not double-count), and writes screenshots.
 *
 *   BASE_URL=http://127.0.0.1:3100 npx tsx scripts/verify-profile-sheet.ts
 */
import { mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import { webkit, type Page } from "playwright";
import { ADMIN_UNLOCK_KEY } from "../src/lib/admin-session";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts";
const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "375x667", width: 375, height: 667 },
] as const;

async function shot(page: Page, name: string) {
  const dest = path.join(OUT, name);
  await page.screenshot({ path: dest, fullPage: false });
  console.log("wrote", dest);
  // Mirror into workspace artifacts path when OUT is the shared volume.
  try {
    const mirror = path.join("/opt/cursor/artifacts", name);
    if (mirror !== dest) {
      mkdirSync(path.dirname(mirror), { recursive: true });
      copyFileSync(dest, mirror);
    }
  } catch {
    /* ignore */
  }
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

async function openProfile(page: Page) {
  await page.getByRole("button", { name: "Profile" }).click();
  await page.waitForSelector('[role="dialog"][aria-label="Profile"]', {
    timeout: 8000,
  });
  // Sheet enter uses opacity/transform — wait for paint before screenshots.
  await page.waitForTimeout(350);
}

async function readWins(page: Page): Promise<number> {
  const dialog = page.locator('[role="dialog"][aria-label="Profile"]');
  const hero = dialog.locator(".profile-stat-hero .profile-stat-value");
  await hero.waitFor({ state: "visible", timeout: 5000 });
  const text = (await hero.textContent())?.trim() ?? "0";
  return Number(text) || 0;
}

async function closeProfile(page: Page) {
  await page.getByRole("button", { name: /^Close$/ }).click();
  await page.waitForSelector('[role="dialog"][aria-label="Profile"]', {
    state: "detached",
    timeout: 5000,
  });
}

async function createRoomAndReachResults(page: Page) {
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  const continueBtn = page.getByRole("button", { name: /^Continue$/ });
  if (await continueBtn.isVisible().catch(() => false)) {
    const nameInput = page.getByLabel("Nickname");
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill("Luke");
    }
    await continueBtn.click();
    await page.waitForTimeout(300);
  }
  await page.getByRole("button", { name: /Create game/i }).click();
  await page.waitForURL(/\/room\//, { timeout: 25000 });
  await page.waitForSelector("text=Lobby", { timeout: 20000 });

  await openProfile(page);
  // Add bots via admin tools
  const botInput = page.locator('label:has-text("Add bots") input');
  await botInput.waitFor({ state: "visible", timeout: 8000 });
  await botInput.fill("2");
  await page.getByRole("button", { name: /^Add$/ }).click();
  await page.waitForTimeout(700);
  // Jump to GAME_RESULTS
  const jump = page.locator("label:has-text('Jump phase') select");
  await jump.selectOption({ label: "Final standings" });
  await page.waitForTimeout(800);
  await closeProfile(page);
  // Heading + list both say Final standings — wait for rematch dock / reveal.
  await page.waitForSelector("text=Final standings", { timeout: 15000 });
  await page.waitForTimeout(500);
}

async function runViewport(
  width: number,
  height: number,
  label: string,
): Promise<void> {
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    userAgent: IOS_UA,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await unlockAdmin(page);

  // Home profile chrome
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const continueBtn = page.getByRole("button", { name: /^Continue$/ });
  if (await continueBtn.isVisible().catch(() => false)) {
    await page.getByLabel("Nickname").fill("Luke");
    await continueBtn.click();
    await page.waitForTimeout(250);
  }
  await openProfile(page);
  const before = await readWins(page);
  await shot(page, `profile-home-${label}.png`);
  await closeProfile(page);

  await createRoomAndReachResults(page);
  await openProfile(page);
  const after = await readWins(page);
  await shot(page, `profile-results-${label}.png`);
  if (after !== before + 1) {
    throw new Error(
      `[${label}] expected wins ${before}+1, got before=${before} after=${after}`,
    );
  }
  console.log(`[${label}] wins ${before} → ${after}`);

  // Reload must not double-count the same gameId
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  // May land on rematch/results still — open profile
  await openProfile(page);
  const afterReload = await readWins(page);
  await shot(page, `profile-reload-${label}.png`);
  await closeProfile(page);
  if (afterReload !== after) {
    throw new Error(
      `[${label}] double-count on reload: was ${after}, now ${afterReload}`,
    );
  }
  console.log(`[${label}] reload stable at ${afterReload} wins`);

  // Confirm a second distinct game increments again
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await createRoomAndReachResults(page);
  await openProfile(page);
  const second = await readWins(page);
  await shot(page, `profile-second-game-${label}.png`);
  if (second !== after + 1) {
    throw new Error(
      `[${label}] second game: expected ${after}+1, got ${second}`,
    );
  }
  console.log(`[${label}] second game wins → ${second}`);

  await browser.close();
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  // One browser flow for the win-count assertion (390); second viewport shots only.
  await runViewport(390, 844, "390x844");

  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    userAgent: IOS_UA,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await unlockAdmin(page);
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const continueBtn = page.getByRole("button", { name: /^Continue$/ });
  if (await continueBtn.isVisible().catch(() => false)) {
    await page.getByLabel("Nickname").fill("Luke");
    await continueBtn.click();
  }
  await openProfile(page);
  await shot(page, "profile-home-375x667.png");
  await closeProfile(page);
  await createRoomAndReachResults(page);
  await openProfile(page);
  await shot(page, "profile-results-375x667.png");
  await browser.close();
  console.log("profile sheet verify ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
