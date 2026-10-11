/**
 * WebKit iPhone 15 + SE screenshots of the redesigned profile bottom sheet
 * in standalone mode with safe-area insets.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { webkit, type Page } from "playwright";
import { ADMIN_UNLOCK_KEY } from "../src/lib/admin-session";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts/screenshots";

const VIEWPORTS = [
  {
    label: "iphone15",
    w: 390,
    h: 844,
    safeTop: 47,
    safeBottom: 34,
  },
  {
    label: "iphoneSE",
    w: 375,
    h: 667,
    safeTop: 20,
    safeBottom: 0,
  },
] as const;

async function injectStandaloneSafeArea(
  page: Page,
  safeTop: number,
  safeBottom: number,
) {
  await page.addInitScript(
    ({ top, bottom, key }) => {
      try {
        Object.defineProperty(navigator, "standalone", {
          configurable: true,
          get: () => true,
        });
        sessionStorage.setItem(key, "1");
        localStorage.setItem("quarry:client-id", "sheet-demo");
        localStorage.setItem("quarry:name", "Wags");
        localStorage.setItem("quarry:avatar", "cake");
        localStorage.setItem(
          "quarry:profile-stats:sheet-demo",
          JSON.stringify({
            wins: 3,
            gamesPlayed: 5,
            bestScore: 48,
            winStreak: 2,
            totalBeans: 120,
            recordedGameIds: ["A:1", "B:2", "C:3"],
          }),
        );
      } catch {
        /* ignore */
      }
      const style = document.createElement("style");
      style.setAttribute("data-shot-safe-area", "1");
      style.textContent = `
        :root {
          --sat: ${top}px;
          --sab: ${bottom}px;
        }
        html {
          padding: env(safe-area-inset-top, ${top}px)
            env(safe-area-inset-right, 0px)
            env(safe-area-inset-bottom, ${bottom}px)
            env(safe-area-inset-left, 0px);
        }
      `;
      // Also force env() via CSS variables for browsers that ignore viewport-fit
      const force = document.createElement("style");
      force.textContent = `
        .settings-sheet {
          padding-bottom: calc(16px + ${bottom}px) !important;
        }
        .settings-sheet-backdrop {
          height: calc(100dvh + 200px + ${bottom}px) !important;
        }
        .app-shell, .phase-chrome, .topbar {
          /* ensure status-bar clearance visible in shots */
        }
      `;
      document.documentElement.appendChild(style);
      document.documentElement.appendChild(force);
    },
    { top: safeTop, bottom: safeBottom, key: ADMIN_UNLOCK_KEY },
  );

  await page.addStyleTag({
    content: `
      :root {
        --shot-safe-top: ${safeTop}px;
        --shot-safe-bottom: ${safeBottom}px;
      }
      .settings-sheet {
        padding-bottom: calc(16px + ${safeBottom}px) !important;
      }
    `,
  });
}

async function dismissContinue(page: Page) {
  const cont = page.getByRole("button", { name: /^Continue$/ });
  if (await cont.isVisible().catch(() => false)) {
    const nick = page.getByLabel("Nickname");
    if (await nick.isVisible().catch(() => false)) {
      await nick.fill("Wags");
    }
    await cont.click();
    await page.waitForTimeout(350);
  }
}

async function openProfile(page: Page, preferMain = true) {
  const profile = page.getByRole("button", { name: /^Profile$/ });
  if (await profile.isVisible().catch(() => false)) {
    await profile.click();
  } else {
    // Home nickname-row avatar opens the avatar panel by design —
    // open it, then step back to main when we want the profile sheet.
    await page.locator(".home-playing-avatar").first().click();
  }
  await page.waitForSelector('[role="dialog"][aria-label="Profile"]', {
    timeout: 10000,
  });
  if (preferMain) {
    const back = page.getByRole("button", { name: /^‹\s*Avatar$/ });
    if (await back.isVisible().catch(() => false)) {
      await back.click();
      await page.waitForTimeout(250);
    }
  }
  await page.waitForTimeout(400);
}

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
    await injectStandaloneSafeArea(page, vp.safeTop, vp.safeBottom);

    // —— Home sheet ——
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    await dismissContinue(page);
    await openProfile(page);
    const homeDest = path.join(OUT, `sheet-redesign-home-${vp.label}.png`);
    await page.screenshot({ path: homeDest, fullPage: false });
    console.log("wrote", homeDest);

    // Assert bottom sheet geometry
    const geo = await page.evaluate(() => {
      const sheet = document.querySelector(".settings-sheet") as HTMLElement | null;
      const backdrop = document.querySelector(
        ".settings-sheet-backdrop",
      ) as HTMLElement | null;
      if (!sheet || !backdrop) return null;
      const sr = sheet.getBoundingClientRect();
      const br = backdrop.getBoundingClientRect();
      const cs = getComputedStyle(sheet);
      const bc = getComputedStyle(backdrop);
      return {
        sheetBottom: sr.bottom,
        viewportH: window.innerHeight,
        radius: cs.borderRadius,
        maxH: cs.maxHeight,
        padBottom: cs.paddingBottom,
        backdropBg: bc.backgroundColor,
        grabber: !!document.querySelector(".settings-sheet-grabber-pill"),
        roomCodeInSheet: /Room code/i.test(sheet.innerText),
        closeText: !!Array.from(sheet.querySelectorAll("button")).find(
          (b) => b.textContent?.trim() === "Close",
        ),
        backdropTop: br.top,
        backdropBottom: br.bottom,
      };
    });
    console.log("geo", vp.label, JSON.stringify(geo));

    await page.keyboard.press("Escape").catch(() => undefined);
    await page.locator(".settings-sheet-close").click().catch(async () => {
      await page.locator(".settings-sheet-backdrop").click({ position: { x: 10, y: 10 } });
    });
    await page.waitForTimeout(250);

    // —— Lobby sheet + roster ——
    await page.getByRole("button", { name: /Create game/i }).click();
    await page.waitForURL(/\/room\//, { timeout: 30000 });
    await page.waitForSelector("text=Lobby", { timeout: 20000 });
    await page.waitForTimeout(500);

    const lobbyDest = path.join(OUT, `sheet-redesign-lobby-${vp.label}.png`);
    await page.screenshot({ path: lobbyDest, fullPage: false });
    console.log("wrote", lobbyDest);

    await openProfile(page);
    const sheetDest = path.join(OUT, `sheet-redesign-open-${vp.label}.png`);
    await page.screenshot({ path: sheetDest, fullPage: false });
    console.log("wrote", sheetDest);

    // Expand Admin so it's visible (was clipped before)
    const admin = page.getByRole("button", { name: /^Admin$/ });
    if (await admin.isVisible().catch(() => false)) {
      await admin.click();
      await page.waitForTimeout(350);
      const adminDest = path.join(OUT, `sheet-redesign-admin-${vp.label}.png`);
      await page.screenshot({ path: adminDest, fullPage: false });
      console.log("wrote", adminDest);
    }

    await context.close();
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
