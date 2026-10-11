/**
 * WebKit dice ticker + pinned roller shots at 390×844 and 375×667.
 *
 *   BASE_URL=http://127.0.0.1:3100 OUT_DIR=/opt/cursor/artifacts/dice-ticker \
 *     npx tsx scripts/shot-dice-ticker.ts
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { webkit, type Browser, type Page } from "playwright";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts/dice-ticker";
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

const SCENARIOS = [
  { id: "your_turn", label: "your-turn", button: "Your turn" },
  { id: "watching", label: "other-turn", button: "Watching" },
] as const;

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

async function measure(page: Page) {
  return page.evaluate(() => {
    const layout = document.querySelector(".dice-layout");
    const bank =
      document.querySelector(".dice-bank-cta") ||
      document.querySelector(".dice-bank-cta-spacer");
    const ticker = document.querySelector(".dice-ticker");
    const pinned = document.querySelector(".dice-pinned-roller");
    const yours = document.querySelector(".dice-your-beans");
    const rollerLine = document.querySelector(".dice-roller-beans");
    const tray = document.querySelector(".bean-dice-tray");
    const track = document.querySelector(".dice-ticker-track");
    if (!layout) return null;
    const lr = layout.getBoundingClientRect();
    const br = bank?.getBoundingClientRect();
    const cs = track ? getComputedStyle(track) : null;
    return {
      layoutH: Math.round(lr.height),
      layoutBottom: Math.round(lr.bottom),
      viewportH: window.innerHeight,
      bankBottom: br ? Math.round(br.bottom) : null,
      overflow: Math.round(lr.bottom - window.innerHeight),
      tickerText: ticker?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      pinnedText: pinned?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      yourText: yours?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      hasRollerLine: !!rollerLine,
      trayH: tray ? Math.round(tray.getBoundingClientRect().height) : null,
      animName: cs?.animationName ?? null,
      transform: cs?.transform ?? null,
      mask: getComputedStyle(ticker!).maskImage || getComputedStyle(ticker!).webkitMaskImage,
    };
  });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await webkit.launch();
  const results: Record<string, unknown>[] = [];

  try {
    for (const p of PROFILES) {
      for (const sc of SCENARIOS) {
        const { ctx, page } = await newPage(browser, p);
        await page.goto(`${BASE}/dev/dice-layout`, {
          waitUntil: "networkidle",
          timeout: 60000,
        });
        await page.getByRole("button", { name: sc.button }).click();
        await page.waitForSelector(".dice-ticker", { timeout: 10000 });
        await page.waitForSelector(".dice-pinned-roller", { timeout: 5000 });
        await page.addStyleTag({
          content: `
            main.app-shell > :not(.dice-layout) { display: none !important; }
            main.app-shell { padding-top: 0.5rem !important; gap: 0 !important; }
          `,
        });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(300);
        const fit = await measure(page);
        console.log(p.name, sc.label, JSON.stringify(fit));
        results.push({ profile: p.name, scenario: sc.label, fit });
        await shot(page, `${TAG}_${sc.label}_${p.name}.png`);
        await page.locator(".dice-zone-strip").screenshot({
          path: path.join(OUT, `${TAG}_${sc.label}_${p.name}_top.png`),
        });
        await page.locator(".dice-stage-panel").screenshot({
          path: path.join(OUT, `${TAG}_${sc.label}_${p.name}_stage.png`),
        });
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }

  for (const r of results) {
    const fit = r.fit as {
      bankBottom: number | null;
      viewportH: number;
      pinnedText: string | null;
      yourText: string | null;
      hasRollerLine: boolean;
      trayH: number | null;
      animName: string | null;
      mask: string;
    } | null;
    if (!fit) throw new Error("missing fit");
    if (!fit.pinnedText) throw new Error(`missing pinned in ${r.scenario}`);
    if (fit.hasRollerLine) throw new Error("legacy roller beans line still present");
    if (r.scenario === "your-turn") {
      if (!/You/.test(fit.pinnedText)) {
        throw new Error(`pinned should say You on your turn: ${fit.pinnedText}`);
      }
      if (fit.yourText) {
        throw new Error("Your beans under tray must be hidden on your turn");
      }
    }
    if (r.scenario === "other-turn") {
      if (!fit.yourText?.includes("Your beans")) {
        throw new Error("Your beans under tray required while watching");
      }
      if (!/Bot Sam|Sam/.test(fit.pinnedText ?? "")) {
        throw new Error(`pinned should name the other roller: ${fit.pinnedText}`);
      }
    }
    if (fit.animName && !fit.animName.includes("dice-ticker-scroll")) {
      throw new Error(`expected ticker animation, got ${fit.animName}`);
    }
    if (!fit.mask || fit.mask === "none") {
      throw new Error("ticker missing mask-image edge fade");
    }
    if (r.profile === "375x667" && fit.bankBottom != null && fit.bankBottom > fit.viewportH + 1) {
      throw new Error(`Bank below fold on 375×667 (${fit.bankBottom} > ${fit.viewportH})`);
    }
    if (r.profile === "375x667" && fit.trayH != null && (fit.trayH < 188 || fit.trayH > 260)) {
      throw new Error(`tray height ${fit.trayH} outside clamp`);
    }
  }
  console.log("ok", results.length, "shots");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
