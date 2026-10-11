/**
 * WebKit before/after shots for every phase at 390×844 and 375×667.
 *
 *   BASE_URL=http://127.0.0.1:3100 OUT_DIR=/opt/cursor/artifacts/spacing-phases \
 *     SHOT_TAG=before npx tsx scripts/shot-spacing-phases.ts
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { webkit, type Browser, type Page } from "playwright";
import { ADMIN_UNLOCK_KEY } from "../src/lib/admin-session";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3100").replace(
  /\/$/,
  "",
);
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts/spacing-phases";
const TAG = process.env.SHOT_TAG || "after";
const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

type Profile = {
  name: string;
  width: number;
  height: number;
  scale: number;
  safeTop: number;
};

const PROFILES: Profile[] = [
  { name: "390x844", width: 390, height: 844, scale: 3, safeTop: 47 },
  { name: "375x667", width: 375, height: 667, scale: 2, safeTop: 20 },
];

const PHASES: { label: string; file: string }[] = [
  { label: "Lobby", file: "lobby" },
  { label: "Pick a topic", file: "topic" },
  { label: "Draft", file: "draft" },
  { label: "Vote", file: "vote" },
  { label: "Scores", file: "scores" },
  { label: "Wager", file: "wager" },
  { label: "Bank", file: "dice" },
  { label: "Round results", file: "round_results" },
  { label: "Final standings", file: "end" },
];

async function shot(page: Page, name: string) {
  const dest = path.join(OUT, name);
  await page.screenshot({ path: dest, fullPage: false });
  console.log("wrote", dest);
}

async function newPage(browser: Browser, p: Profile) {
  const ctx = await browser.newContext({
    viewport: { width: p.width, height: p.height },
    deviceScaleFactor: p.scale,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
    userAgent: IOS_UA,
  });
  await ctx.addInitScript((key) => {
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
  }, ADMIN_UNLOCK_KEY);
  await ctx.addInitScript({
    content: `document.addEventListener("DOMContentLoaded", function () {
      var s = document.createElement("style");
      s.textContent = ".room-chrome-safe, .app-safe-top { height: calc(${p.safeTop}px + var(--safe-top-solid-extra) + var(--safe-top-fade)) !important; }";
      document.head.appendChild(s);
    });`,
  });
  return { ctx, page: await ctx.newPage() };
}

async function createRoom(page: Page) {
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  const continueBtn = page.getByRole("button", { name: /^Continue$/ });
  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.click();
    await page.waitForTimeout(200);
  }
  await page.getByRole("button", { name: /Create game/i }).click();
  await page.waitForURL(/\/room\//, { timeout: 25000 });
  await page.waitForSelector("text=Lobby", { timeout: 20000 });
}

async function openAdmin(page: Page) {
  await page.getByRole("button", { name: "Profile" }).click();
  await page.waitForSelector('[role="dialog"][aria-label="Profile"]', {
    timeout: 8000,
  });
  const admin = page.getByRole("button", { name: /^Admin$/ });
  if (await admin.isVisible().catch(() => false)) {
    await admin.click();
    await page.waitForSelector("label:has-text('Jump phase')", {
      timeout: 8000,
    });
  }
}

async function jumpPhase(page: Page, phaseLabel: string) {
  await openAdmin(page);
  const jump = page.locator("label:has-text('Jump phase') select");
  await jump.selectOption({ label: phaseLabel });
  await page.getByRole("button", { name: /^Close$/ }).click();
  await page.waitForTimeout(500);
}

async function addBots(page: Page, count = 2) {
  await openAdmin(page);
  const input = page.locator('label:has-text("Add bots") input');
  if (await input.count()) {
    await input.fill(String(count));
    await page.getByRole("button", { name: /^Add$/ }).click();
    await page.waitForTimeout(400);
  }
  await page.getByRole("button", { name: /^Close$/ }).click();
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await webkit.launch({ headless: true });

  try {
    for (const p of PROFILES) {
      const { ctx, page } = await newPage(browser, p);

      await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(400);
      await shot(page, `${TAG}_home_${p.name}.png`);

      await createRoom(page);
      await addBots(page, 2);

      await page.getByRole("button", { name: "Profile" }).click();
      await page.waitForSelector('[role="dialog"][aria-label="Profile"]', {
        timeout: 8000,
      });
      await shot(page, `${TAG}_settings_${p.name}.png`);
      await page.getByRole("button", { name: /^Close$/ }).click();
      await page.waitForTimeout(300);

      for (const ph of PHASES) {
        await jumpPhase(page, ph.label);
        if (ph.file === "round_results" || ph.file === "end") {
          const list = page.locator(".results-reveal");
          if (await list.count()) {
            await list.click().catch(() => undefined);
            await page.waitForTimeout(300);
          }
        }
        await shot(page, `${TAG}_${ph.file}_${p.name}.png`);
      }

      await page.goto(`${BASE}/dev/dice-layout`, {
        waitUntil: "networkidle",
        timeout: 60000,
      });
      await page.getByRole("button", { name: "Your turn" }).click();
      await page.waitForSelector(".dice-ticker", { timeout: 10000 });
      await page.waitForTimeout(250);
      const tickerPath = path.join(OUT, `${TAG}_dice_ticker_${p.name}.png`);
      await page.locator(".dice-zone-strip").screenshot({ path: tickerPath });
      console.log("wrote", tickerPath);

      await ctx.close();
    }
    console.log("OK spacing phase shots", TAG);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
