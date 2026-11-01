/**
 * Clean phone screenshots + drag-geometry check for avatar sheet UX.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { webkit } from "playwright";
import { ADMIN_UNLOCK_KEY } from "../src/lib/admin-session";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts/screenshots";

const VIEWPORTS = [
  { label: "390x844", w: 390, h: 844, safeTop: 47, safeBottom: 34 },
  { label: "430x932", w: 430, h: 932, safeTop: 59, safeBottom: 34 },
] as const;

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await webkit.launch({ headless: true });
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    });
    const page = await context.newPage();
    await page.addInitScript(
      ({ top, bottom, key }) => {
        try {
          Object.defineProperty(navigator, "standalone", {
            configurable: true,
            get: () => true,
          });
          sessionStorage.setItem(key, "1");
          localStorage.setItem("quarry:client-id", "avatar-sheet-demo");
          localStorage.setItem("quarry:name", "Wags");
          localStorage.setItem("quarry:avatar-id", "cake");
        } catch {
          /* ignore */
        }
        const style = document.createElement("style");
        style.textContent = `
          :root { --sat: ${top}px; --sab: ${bottom}px; }
          .settings-sheet { padding-bottom: calc(12px + ${bottom}px) !important; }
          .a2hs-nudge { display: none !important; }
        `;
        document.documentElement.appendChild(style);
      },
      { top: vp.safeTop, bottom: vp.safeBottom, key: ADMIN_UNLOCK_KEY },
    );

    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const cont = page.getByRole("button", { name: /^Continue$/ });
    if (await cont.isVisible().catch(() => false)) {
      const nick = page.getByLabel("Nickname");
      if (await nick.isVisible().catch(() => false)) await nick.fill("Wags");
      await cont.click();
      await page.waitForTimeout(400);
    }
    const keep = page.getByRole("button", { name: /Keep my stats/i });
    if (await keep.isVisible().catch(() => false)) {
      await keep.click();
      await page.waitForTimeout(300);
    }

    await page.waitForSelector(".home-playing-avatar", { timeout: 10000 });
    await page.screenshot({
      path: path.join(OUT, `avatar-home-${vp.label}.png`),
      fullPage: false,
    });
    console.log("wrote home", vp.label);

    await page.locator(".home-playing-avatar").click();
    await page.waitForSelector('[role="dialog"][aria-label="Profile"]');
    await page.waitForSelector(".avatar-picker-grid", { timeout: 8000 });
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(OUT, `avatar-picker-${vp.label}.png`),
      fullPage: false,
    });
    console.log("wrote picker", vp.label);

    await page.evaluate(() => {
      const sheet = document.querySelector(".settings-sheet") as HTMLElement | null;
      if (!sheet) return;
      sheet.classList.add("settings-sheet-settled");
      sheet.style.setProperty("--sheet-drag-y", "140px");
    });
    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(OUT, `avatar-sheet-drag-${vp.label}.png`),
      fullPage: false,
    });
    const geo = await page.evaluate(() => {
      const sheet = document.querySelector(".settings-sheet") as HTMLElement;
      const sr = sheet.getBoundingClientRect();
      return {
        left: Math.round(sr.left),
        width: Math.round(sr.width),
        vw: window.innerWidth,
        centered:
          Math.abs(sr.left - (window.innerWidth - sr.width) / 2) < 2 ||
          sr.width >= window.innerWidth - 1,
        dragY: getComputedStyle(sheet).getPropertyValue("--sheet-drag-y").trim(),
      };
    });
    console.log("drag-geo", vp.label, JSON.stringify(geo));
    if (!geo.centered) {
      throw new Error(`off-center while dragging on ${vp.label}: ${JSON.stringify(geo)}`);
    }

    await context.close();
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
