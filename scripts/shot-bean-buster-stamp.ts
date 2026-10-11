/**
 * WebKit mid-stamp screenshots at 390×844 and 375×667.
 *
 * Uses /dev/dice-layout Bust scenario so the stamp appears without a full game.
 *
 *   BASE_URL=http://127.0.0.1:3100 \
 *     OUT_DIR=/opt/cursor/artifacts/bean-buster-stamp \
 *     npx tsx scripts/shot-bean-buster-stamp.ts
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { webkit, type Browser, type Page } from "playwright";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3100").replace(
  /\/$/,
  "",
);
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts/bean-buster-stamp";
const TAG = process.env.SHOT_TAG || "mid";
const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

type Profile = {
  name: string;
  width: number;
  height: number;
  scale: number;
};

const PROFILES: Profile[] = [
  { name: "390x844", width: 390, height: 844, scale: 3 },
  { name: "375x667", width: 375, height: 667, scale: 2 },
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
  return { ctx, page: await ctx.newPage() };
}

async function captureMidStamp(page: Page, profile: Profile) {
  await page.goto(`${BASE}/dev/dice-layout`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.getByRole("button", { name: /^Bust$/ }).waitFor({
    timeout: 20000,
  });

  // Click Bust — stamp mounts instantly on SETTLED bust readout.
  await page.getByRole("button", { name: /^Bust$/ }).click();
  const stamp = page.locator('[data-testid="bean-buster-stamp"]');
  await stamp.waitFor({ state: "visible", timeout: 5000 });

  // Mid-hold (~400ms after slam) — stamp still fully visible.
  await page.waitForTimeout(400);

  const title = stamp.locator(".bean-buster-stamp-title");
  const text = (await title.innerText()).trim();
  if (text !== "BEAN BUSTER") {
    throw new Error(`expected BEAN BUSTER, got ${JSON.stringify(text)}`);
  }
  const caption = (await stamp.locator(".bean-buster-stamp-caption").innerText()).trim();
  if (!/got busted/i.test(caption)) {
    throw new Error(`expected got busted caption, got ${JSON.stringify(caption)}`);
  }

  // Dice tray must still exist beneath the wash (faintly visible).
  const tray = page.locator(".bean-dice-tray");
  await tray.waitFor({ state: "visible", timeout: 2000 });

  await shot(page, `${TAG}_stamp_${profile.name}.png`);

  // Confirm auto-dismiss does not leave a fixed veil.
  await stamp.waitFor({ state: "detached", timeout: 3000 });
  const leftover = await page.locator(".bean-buster-stamp").count();
  if (leftover !== 0) {
    throw new Error("stamp veil left mounted after hold");
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await webkit.launch({ headless: true });
  try {
    for (const p of PROFILES) {
      const { ctx, page } = await newPage(browser, p);
      try {
        await captureMidStamp(page, p);
      } finally {
        await ctx.close();
      }
    }
    console.log("OK bean-buster stamp shots");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
