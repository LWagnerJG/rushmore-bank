/**
 * Home Create/Join swap screenshots — empty vs typed code.
 * Viewports: 390×844 and 430×932.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { webkit } from "playwright";
import { ADMIN_UNLOCK_KEY } from "../src/lib/admin-session";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts/screenshots";

const VIEWPORTS = [
  { label: "390x844", w: 390, h: 844 },
  { label: "430x932", w: 430, h: 932 },
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
    await page.addInitScript(({ key }) => {
      try {
        sessionStorage.setItem(key, "1");
        localStorage.setItem("quarry:client-id", "join-primary-demo");
        localStorage.setItem("quarry:name", "Wags");
        localStorage.setItem("quarry:avatar-id", "aviator");
      } catch {
        /* ignore */
      }
      const style = document.createElement("style");
      style.textContent = `.a2hs-nudge, .stats-merge-prompt { display: none !important; }`;
      document.documentElement.appendChild(style);
    }, { key: ADMIN_UNLOCK_KEY });

    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const cont = page.getByRole("button", { name: /^Continue$/ });
    if (await cont.isVisible().catch(() => false)) {
      const nick = page.getByLabel("Nickname");
      if (await nick.isVisible().catch(() => false)) await nick.fill("Wags");
      await cont.click();
      await page.waitForTimeout(350);
    }
    const keep = page.getByRole("button", { name: /Keep my stats/i });
    if (await keep.isVisible().catch(() => false)) {
      await keep.click();
      await page.waitForTimeout(250);
    }

    await page.waitForSelector(".home-cta-stack", { timeout: 10000 });
    await page.waitForSelector('button:has-text("Create game")');

    const emptyPath = path.join(OUT, `join-primary-empty-${vp.label}.png`);
    await page.screenshot({ path: emptyPath, fullPage: false });
    console.log("wrote", emptyPath);

    const emptyState = await page.evaluate(() => {
      const stack = document.querySelector(".home-cta-stack");
      const create = document.querySelector(".home-create-btn") as HTMLElement | null;
      const join = document.querySelector(".home-join-go") as HTMLElement | null;
      return {
        joinMode: stack?.classList.contains("home-cta-join-mode") ?? false,
        createVisible: !!create && create.getBoundingClientRect().height > 8,
        joinPrimary: join?.classList.contains("btn-primary") ?? false,
        joinSecondary: join?.classList.contains("btn-secondary") ?? false,
      };
    });
    if (emptyState.joinMode || emptyState.joinPrimary || !emptyState.createVisible) {
      throw new Error(`empty state wrong: ${JSON.stringify(emptyState)}`);
    }

    await page.getByLabel("Room code").click();
    await page.getByLabel("Room code").fill("AB");
    await page.waitForTimeout(350);

    const typedPath = path.join(OUT, `join-primary-typed-${vp.label}.png`);
    await page.screenshot({ path: typedPath, fullPage: false });
    console.log("wrote", typedPath);

    const typedState = await page.evaluate(() => {
      const stack = document.querySelector(".home-cta-stack");
      const createSlot = document.querySelector(".home-create-slot") as HTMLElement | null;
      const join = document.querySelector(".home-join-go") as HTMLElement | null;
      const code = document.querySelector(".home-join-code") as HTMLInputElement | null;
      const sr = createSlot?.getBoundingClientRect();
      const jr = join?.getBoundingClientRect();
      const slotStyle = createSlot ? getComputedStyle(createSlot) : null;
      return {
        joinMode: stack?.classList.contains("home-cta-join-mode") ?? false,
        createSlotHeight: sr ? Math.round(sr.height) : -1,
        createSlotMaxHeight: slotStyle?.maxHeight ?? "",
        createSlotAriaHidden: createSlot?.getAttribute("aria-hidden"),
        joinPrimary: join?.classList.contains("btn-primary") ?? false,
        joinWidth: jr ? Math.round(jr.width) : 0,
        codeWidth: code ? Math.round(code.getBoundingClientRect().width) : 0,
        vw: window.innerWidth,
        joinNearFull: jr ? jr.width >= window.innerWidth * 0.85 : false,
      };
    });
    console.log("typed", vp.label, JSON.stringify(typedState));
    if (
      !typedState.joinMode ||
      !typedState.joinPrimary ||
      typedState.createSlotHeight > 2 ||
      typedState.createSlotMaxHeight !== "0px" ||
      !typedState.joinNearFull
    ) {
      throw new Error(`typed state wrong: ${JSON.stringify(typedState)}`);
    }

    // Clearing restores Create
    await page.getByLabel("Room code").fill("");
    await page.waitForTimeout(350);
    const restored = await page.evaluate(() => {
      const stack = document.querySelector(".home-cta-stack");
      const create = document.querySelector(".home-create-btn") as HTMLElement | null;
      const join = document.querySelector(".home-join-go") as HTMLElement | null;
      return {
        joinMode: stack?.classList.contains("home-cta-join-mode") ?? false,
        createVisible: !!create && create.getBoundingClientRect().height > 8,
        joinSecondary: join?.classList.contains("btn-secondary") ?? false,
      };
    });
    if (restored.joinMode || !restored.createVisible || !restored.joinSecondary) {
      throw new Error(`restore failed: ${JSON.stringify(restored)}`);
    }

    await context.close();
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
