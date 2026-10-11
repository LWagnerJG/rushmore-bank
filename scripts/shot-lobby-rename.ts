/**
 * WebKit lobby rename at 390×844 and 375×667 — two browser clients.
 * Renamer edits their name; watcher must see the update.
 *
 *   BASE_URL=http://127.0.0.1:3100 PARTY_HOST=127.0.0.1:8787 \
 *     OUT_DIR=/opt/cursor/artifacts/lobby-rename npx tsx scripts/shot-lobby-rename.ts
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { webkit, type Browser, type Page } from "playwright";
import { sleep } from "./smoke-lib";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts/lobby-rename";
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

async function newPage(browser: Browser, p: Profile) {
  const ctx = await browser.newContext({
    viewport: { width: p.width, height: p.height },
    deviceScaleFactor: p.scale,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
    userAgent: IOS_UA,
  });
  await ctx.addInitScript({
    content: `document.addEventListener("DOMContentLoaded", function () {
      var s = document.createElement("style");
      s.textContent = ".room-chrome-safe, .app-safe-top { height: calc(${p.safeTop}px + var(--safe-top-solid-extra) + var(--safe-top-fade)) !important; }";
      document.head.appendChild(s);
    });`,
  });
  return { ctx, page: await ctx.newPage() };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await webkit.launch();

  try {
    for (const p of PROFILES) {
      const code = roomCode();
      const { ctx: hostCtx, page: host } = await newPage(browser, p);
      const { ctx: watchCtx, page: watch } = await newPage(browser, p);

      await host.goto(`${BASE}/room/${code}?name=Luke`, {
        waitUntil: "networkidle",
        timeout: 60000,
      });
      await host.locator(".lobby-rename-btn").waitFor({ timeout: 30000 });

      await watch.goto(`${BASE}/room/${code}?name=Ava`, {
        waitUntil: "networkidle",
        timeout: 60000,
      });
      await watch.locator(".lobby-roster").waitFor({ timeout: 30000 });
      await watch
        .locator(".lobby-roster-list", { hasText: "Luke" })
        .waitFor({ timeout: 15000 });

      // Before shot — editing state optional; do the rename
      await host.locator(".lobby-rename-btn").click();
      const input = host.locator(".lobby-rename-input");
      await input.waitFor({ timeout: 5000 });
      await input.fill("");
      await input.type("Brynna", { delay: 20 });
      await input.press("Enter");
      await sleep(700);

      await host
        .locator(".lobby-rename-btn", { hasText: /Brynna/i })
        .waitFor({ timeout: 10000 });
      await watch
        .locator(".lobby-roster-list", { hasText: "Brynna" })
        .waitFor({ timeout: 10000 });
      // Old name should be gone from watcher list
      const lukeLeft = await watch
        .locator(".lobby-roster-list")
        .evaluate((el) => /Luke/i.test(el.textContent ?? ""));
      if (lukeLeft) throw new Error("watcher still shows Luke after rename");

      const tap = await host.locator(".lobby-rename-btn").boundingBox();
      if (!tap || tap.height < 43.5) {
        throw new Error(`rename tap target too small: ${JSON.stringify(tap)}`);
      }

      await shot(host, `${TAG}_renamer_${p.name}.png`);
      await shot(watch, `${TAG}_watcher_${p.name}.png`);
      await host.locator(".lobby-roster").screenshot({
        path: path.join(OUT, `${TAG}_renamer_${p.name}_roster.png`),
      });
      await watch.locator(".lobby-roster").screenshot({
        path: path.join(OUT, `${TAG}_watcher_${p.name}_roster.png`),
      });

      await hostCtx.close();
      await watchCtx.close();
      console.log("ok", p.name, "tapH=", Math.round(tap.height));
    }
  } finally {
    await browser.close();
  }
  console.log("all profiles ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
