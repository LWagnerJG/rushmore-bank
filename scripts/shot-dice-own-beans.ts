/**
 * WebKit dice ownership shots at 390×844 and 375×667 (your turn + watching).
 * Uses /dev/dice-layout lab — no Party room required.
 *
 *   BASE_URL=http://127.0.0.1:3100 OUT_DIR=/opt/cursor/artifacts/dice-own-beans \
 *     npx tsx scripts/shot-dice-own-beans.ts
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { webkit, type Browser, type Page } from "playwright";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts/dice-own-beans";
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
  { id: "your_turn", label: "your-turn" },
  { id: "watching", label: "other-turn" },
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

async function measureFit(page: Page) {
  return page.evaluate(() => {
    const layout = document.querySelector(".dice-layout");
    const bank =
      document.querySelector(".dice-bank-cta") ||
      document.querySelector(".dice-bank-cta-spacer");
    const yours = document.querySelector(".dice-your-beans");
    const roller = document.querySelector(".dice-roller-beans");
    const tray = document.querySelector(".bean-dice-tray");
    if (!layout) return null;
    const lr = layout.getBoundingClientRect();
    const br = bank?.getBoundingClientRect();
    return {
      layoutH: Math.round(lr.height),
      layoutBottom: Math.round(lr.bottom),
      viewportH: window.innerHeight,
      bankBottom: br ? Math.round(br.bottom) : null,
      overflow: Math.round(lr.bottom - window.innerHeight),
      yourText: yours?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      rollerText: roller?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      trayH: tray ? Math.round(tray.getBoundingClientRect().height) : null,
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
        await page.getByRole("button", { name: sc.id === "your_turn" ? "Your turn" : "Watching" }).click();
        await page.waitForSelector(".dice-your-beans", { timeout: 10000 });
        if (sc.id === "watching") {
          await page.waitForSelector(".dice-roller-beans", { timeout: 5000 });
        } else {
          const roller = await page.$(".dice-roller-beans");
          if (roller) throw new Error("roller beans shown on your turn");
        }
        // CSS-hide lab chrome (React re-renders from Measure must not bring it back)
        await page.addStyleTag({
          content: `
            main.app-shell > :not(.dice-layout) { display: none !important; }
            main.app-shell { padding-top: 0.5rem !important; gap: 0 !important; }
          `,
        });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(250);
        const fit = await measureFit(page);
        console.log(p.name, sc.label, JSON.stringify(fit));
        results.push({ profile: p.name, scenario: sc.label, fit });
        await shot(page, `${TAG}_${sc.label}_${p.name}.png`);
        // Cropped stage for ownership focus
        const stage = page.locator(".dice-stage-panel");
        await stage.screenshot({
          path: path.join(OUT, `${TAG}_${sc.label}_${p.name}_stage.png`),
        });
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }

  // Fail if 375×667 puts Bank below the fold once lab chrome is gone
  for (const r of results) {
    const fit = r.fit as {
      overflow: number;
      bankBottom: number | null;
      viewportH: number;
      yourText: string | null;
      rollerText: string | null;
      trayH: number | null;
    } | null;
    if (!fit) throw new Error("missing fit");
    if (!fit.yourText?.includes("Your beans")) {
      throw new Error(`missing Your beans in ${r.scenario}`);
    }
    if (r.scenario === "other-turn" && !fit.rollerText?.includes("'s beans")) {
      throw new Error(`missing roller beans in ${r.scenario}`);
    }
    if (r.scenario === "your-turn" && fit.rollerText) {
      throw new Error(`roller beans shown on your turn`);
    }
    if (r.profile === "375x667" && fit.bankBottom != null && fit.bankBottom > fit.viewportH + 1) {
      throw new Error(`Bank below fold on 375×667 (${fit.bankBottom} > ${fit.viewportH})`);
    }
    if (r.profile === "375x667" && fit.trayH != null && (fit.trayH < 188 || fit.trayH > 260)) {
      throw new Error(`tray height ${fit.trayH} outside #151 clamp`);
    }
  }
  console.log("ok", results.length, "shots");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
