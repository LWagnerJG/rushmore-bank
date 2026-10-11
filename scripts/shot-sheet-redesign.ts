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
      // Emulate iOS safe-area on the sheet only — never stretch the
      // backdrop height (that reintroduces flex-end clipping).
      style.textContent = `
        :root {
          --sat: ${top}px;
          --sab: ${bottom}px;
        }
        .settings-sheet {
          padding-bottom: calc(16px + ${bottom}px) !important;
        }
      `;
      document.documentElement.appendChild(style);
    },
    { top: safeTop, bottom: safeBottom, key: ADMIN_UNLOCK_KEY },
  );
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
    // Collapse inline avatar expand if home opened with picker expanded.
    const change = page.getByRole("button", { name: /^Change avatar$/ });
    const grid = page.locator(".avatar-picker-grid");
    if (
      (await grid.isVisible().catch(() => false)) &&
      (await change.isVisible().catch(() => false))
    ) {
      await change.click();
      await page.waitForTimeout(250);
    }
  }
  await page
    .waitForFunction(() => {
      const s = document.querySelector(".settings-sheet") as HTMLElement | null;
      if (!s) return false;
      return Math.abs(window.innerHeight - s.getBoundingClientRect().bottom) < 2;
    }, { timeout: 3000 })
    .catch(() => undefined);
  await page.waitForTimeout(200);
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

    const closeBtn = page.locator(".settings-sheet-close");
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    } else if (
      await page.locator(".settings-sheet-backdrop").isVisible().catch(() => false)
    ) {
      await page.locator(".settings-sheet-backdrop").click({ position: { x: 20, y: 20 } });
    }
    await page
      .waitForSelector(".settings-sheet-backdrop", { state: "detached", timeout: 5000 })
      .catch(() => undefined);
    await page.waitForTimeout(200);

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

    // Name editing open (Luke follow-up evidence)
    const nameBtn = page.getByRole("button", {
      name: /Edit your nickname/i,
    });
    if (await nameBtn.isVisible().catch(() => false)) {
      await nameBtn.click();
      await page.waitForSelector(".profile-sheet-name-input", { timeout: 5000 });
      await page.waitForTimeout(200);
      const editDest = path.join(OUT, `sheet-name-editing-${vp.label}.png`);
      await page.screenshot({ path: editDest, fullPage: false });
      console.log("wrote", editDest);
      await page.locator(".profile-sheet-name-input").blur();
      await page.waitForTimeout(200);
    }

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
