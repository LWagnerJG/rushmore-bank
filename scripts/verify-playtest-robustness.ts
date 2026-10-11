/**
 * Multi-client Playwright WebKit regressions for Luke's playtest bugs:
 * sticky host across setOffline, dice face numbers for watcher + roller,
 * resync after background/foreground and slow-3G-style delay.
 *
 *   npx wrangler dev --ip 127.0.0.1 --port 8787
 *   NEXT_PUBLIC_PARTYKIT_HOST=127.0.0.1:8787 npx next build && npx next start -p 3100
 *   BASE_URL=http://127.0.0.1:3100 npm run test:playtest
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { webkit, type Browser, type BrowserContext, type Page } from "playwright";
import { sleep } from "./smoke-lib";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const OUT = process.env.OUT_DIR || "/tmp/playtest-robustness";
const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

type Profile = { name: string; width: number; height: number; scale: number };

const PROFILE: Profile = { name: "390x844", width: 390, height: 844, scale: 3 };

function roomCode() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)]!;
  return s;
}

async function shot(page: Page, name: string) {
  const dest = path.join(OUT, name);
  await page.screenshot({ path: dest, fullPage: false });
  console.log("wrote", dest);
}

async function newPage(browser: Browser) {
  const ctx = await browser.newContext({
    viewport: { width: PROFILE.width, height: PROFILE.height },
    deviceScaleFactor: PROFILE.scale,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
    userAgent: IOS_UA,
  });
  return { ctx, page: await ctx.newPage() };
}

/** ~slow-3G: hold every response ~400ms (WebKit has no CDP throttle). */
async function throttleSlow3G(ctx: BrowserContext) {
  await ctx.route("**/*", async (route) => {
    await sleep(400);
    await route.continue();
  });
}

async function foreground(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("pageshow"));
  });
}

async function background(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("blur"));
  });
}

async function assertDiceNumbers(page: Page, d1: number, d2: number) {
  const tray = page.locator(".bean-dice-tray");
  await tray.waitFor({ timeout: 15000 });
  await expectVisibleNumber(page, `[data-die-number="${d1}"]`);
  await expectVisibleNumber(page, `[data-die-number="${d2}"]`);
  await expectVisibleNumber(page, `[data-dice-sum="${d1 + d2}"]`);
  const opacity = await page.locator(".bean-pip-die-num").first().evaluate((el) => {
    return Number(getComputedStyle(el).opacity);
  });
  if (opacity < 0.99) {
    throw new Error(`die numeral opacity ${opacity} (must stay 1)`);
  }
}

async function expectVisibleNumber(page: Page, sel: string) {
  const loc = page.locator(sel).first();
  await loc.waitFor({ state: "visible", timeout: 10000 });
  const box = await loc.boundingBox();
  if (!box || box.width < 8 || box.height < 8) {
    throw new Error(`${sel} not painted (${JSON.stringify(box)})`);
  }
}

async function diceLab(browser: Browser) {
  const { ctx, page } = await newPage(browser);
  try {
    await page.goto(`${BASE}/dev/dice-layout`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.getByRole("button", { name: "Settled" }).click();
    await assertDiceNumbers(page, 5, 2);
    await shot(page, "dice-settled-numbers.png");

    await page.getByRole("button", { name: "Your turn" }).click();
    await assertDiceNumbers(page, 3, 4);
    await shot(page, "dice-your-turn-numbers.png");

    await page.getByRole("button", { name: "Watching" }).click();
    await page.locator(".bean-dice-tray").waitFor();
    // Watcher uses the same pip + numeral renderer (idle 1/1).
    const nums = page.locator(".bean-pip-die-num");
    await nums.first().waitFor({ state: "visible", timeout: 8000 });
    const count = await nums.count();
    if (count < 2) throw new Error(`watcher dice numerals missing (${count})`);
    await shot(page, "dice-watching-numbers.png");
  } finally {
    await ctx.close();
  }
}

async function hostStickyAndNetwork(browser: Browser) {
  const code = roomCode();
  const { ctx: hostCtx, page: host } = await newPage(browser);
  const { ctx: guestCtx, page: guest } = await newPage(browser);
  try {
    await throttleSlow3G(guestCtx);

    await host.goto(`${BASE}/room/${code}?name=Luke`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await host.locator(".lobby-roster").waitFor({ timeout: 30000 });

    await guest.goto(`${BASE}/room/${code}?name=Ava`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await guest.locator(".lobby-roster").waitFor({ timeout: 30000 });

    await host.getByRole("button", { name: /Start/i }).waitFor({ timeout: 15000 });
    const lukeHost = host.locator(".lobby-rename-host");
    await lukeHost.waitFor({ timeout: 10000 });

    const avaBefore = await guest.locator(".lobby-roster").innerText();
    if (!avaBefore.includes("Luke") || !avaBefore.includes("★")) {
      throw new Error(`guest roster missing host star: ${avaBefore}`);
    }

    // Brief drop — must NOT transfer host or remount the lobby.
    const hostTop = await host.locator(".lobby-roster").boundingBox();
    await hostCtx.setOffline(true);
    await sleep(2500);
    await hostCtx.setOffline(false);
    await host.locator(".lobby-roster").waitFor({ timeout: 20000 });
    await host.getByRole("button", { name: /Start/i }).waitFor({ timeout: 20000 });
    await lukeHost.waitFor({ timeout: 10000 });
    const hostTopAfter = await host.locator(".lobby-roster").boundingBox();
    if (
      hostTop &&
      hostTopAfter &&
      Math.abs(hostTop.y - hostTopAfter.y) > 24
    ) {
      throw new Error(
        `host roster jumped ${hostTop.y} → ${hostTopAfter.y} during reconnect`,
      );
    }

    const avaIsHost = await guest.locator(".lobby-rename-host").count();
    if (avaIsHost > 0) {
      throw new Error("guest stole host during the 2.5s offline blip");
    }
    const guestHasStart = await guest.getByRole("button", { name: /Start/i }).count();
    if (guestHasStart > 0) {
      throw new Error("guest saw Start (host UI jumped)");
    }

    await background(guest);
    await sleep(400);
    await foreground(guest);
    await guest.locator(".lobby-roster").waitFor({ timeout: 15000 });
    const avaIsHostAfterFg = await guest.locator(".lobby-rename-host").count();
    if (avaIsHostAfterFg > 0) {
      throw new Error("guest became host after background/foreground");
    }

    await shot(host, "host-after-offline.png");
    await shot(guest, "guest-after-offline.png");
  } finally {
    await hostCtx.close();
    await guestCtx.close();
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await webkit.launch();
  const report: { name: string; ok: boolean; error?: string }[] = [];
  try {
    for (const [name, fn] of [
      ["dice-lab-numbers", () => diceLab(browser)],
      ["host-offline-resync", () => hostStickyAndNetwork(browser)],
    ] as const) {
      try {
        await fn();
        report.push({ name, ok: true });
        console.log("ok", name);
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        report.push({ name, ok: false, error });
        console.error("FAIL", name, error);
      }
    }
  } finally {
    await browser.close();
  }
  writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  const failed = report.filter((r) => !r.ok);
  if (failed.length) {
    console.error(failed);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
