/**
 * Install-first join: WebKit iPhone UA + standalone matchMedia override,
 * and Chromium Android + beforeinstallprompt.
 *
 *   npx next dev --turbopack -p 3456
 *   BASE_URL=http://127.0.0.1:3456 npm run verify:install
 */
import { spawn, type ChildProcess } from "node:child_process";
import { chromium, webkit, type Browser } from "playwright";

const BASE = (process.env.BASE_URL || "").replace(/\/$/, "");
const PORT = Number(process.env.INSTALL_JOIN_PORT || 3456);
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const INSTAGRAM_UA = `${IPHONE_UA} Instagram 192.0.0.0.0`;

const STANDALONE_OVERRIDE = `
(() => {
  const orig = window.matchMedia.bind(window);
  window.matchMedia = (q) => {
    if (String(q).includes("display-mode: standalone")) {
      return {
        matches: true,
        media: q,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() { return false; },
      };
    }
    return orig(q);
  };
  Object.defineProperty(navigator, "standalone", { configurable: true, get: () => true });
})();
`;

async function waitForHttp(url: string, ms = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok || res.status === 404) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function maybeStartNext(): Promise<ChildProcess | null> {
  if (BASE) return null;
  const child = spawn("npx", ["next", "dev", "--turbopack", "-p", String(PORT)], {
    stdio: "pipe",
    env: { ...process.env, BROWSER: "none" },
  });
  child.stderr?.on("data", () => {});
  await waitForHttp(`http://127.0.0.1:${PORT}/api/version`);
  return child;
}

function origin(): string {
  return BASE || `http://127.0.0.1:${PORT}`;
}

async function checkManifest(base: string): Promise<void> {
  const none = await fetch(`${base}/manifest.webmanifest`);
  if (!none.ok) throw new Error(`manifest HTTP ${none.status}`);
  const home = (await none.json()) as { start_url?: string };
  if (home.start_url !== "/") throw new Error(`default start_url ${home.start_url}`);
  const room = await fetch(`${base}/manifest.webmanifest?room=ab-cd`);
  const body = (await room.json()) as { start_url?: string; id?: string };
  if (body.start_url !== "/join/ABCD") {
    throw new Error(`room start_url ${body.start_url}`);
  }
  if (body.id !== "/?icon=v3") throw new Error(`manifest id ${body.id}`);
  console.log("manifest route: ok");
}

async function withBrowser(
  kind: "webkit" | "chromium",
  fn: (browser: Browser) => Promise<void>,
): Promise<void> {
  const browser =
    kind === "webkit" ? await webkit.launch({ headless: true }) : await chromium.launch({ headless: true });
  try {
    await fn(browser);
  } finally {
    await browser.close();
  }
}

async function main() {
  const child = await maybeStartNext();
  const base = origin();
  try {
    await checkManifest(base);

    await withBrowser("webkit", async (browser) => {
      const page = await browser.newPage({
        userAgent: IPHONE_UA,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      await page.goto(`${base}/join/ABCD`, { waitUntil: "networkidle" });
      const headline = await page.getByText("Add Beans to your Home Screen to join").count();
      if (!headline) throw new Error("WebKit iPhone: missing install headline");
      if (!(await page.getByText("Continue in browser").count())) {
        throw new Error("WebKit iPhone: missing escape hatch");
      }
      if (!(await page.getByText("Share").count())) {
        throw new Error("WebKit iPhone: missing Share step");
      }
      console.log("webkit iphone install screen: ok");

      const stand = await browser.newPage({
        userAgent: IPHONE_UA,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      await stand.addInitScript(STANDALONE_OVERRIDE);
      await stand.goto(`${base}/join/ABCD`, { waitUntil: "networkidle" });
      if (await stand.getByText("Add Beans to your Home Screen to join").count()) {
        throw new Error("standalone still showing install screen");
      }
      const name = stand.locator('input[aria-label="Nickname"]');
      await name.waitFor({ state: "visible", timeout: 8000 });
      if (!(await stand.getByRole("button", { name: "Join game" }).count())) {
        throw new Error("standalone missing Join game");
      }
      if (await stand.getByText("Pick an avatar").count()) {
        throw new Error("standalone showed an avatar step");
      }
      console.log("webkit standalone name join: ok");

      const inApp = await browser.newPage({
        userAgent: INSTAGRAM_UA,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      await inApp.goto(`${base}/join/ABCD`, { waitUntil: "networkidle" });
      if (await inApp.getByText("Add Beans to your Home Screen to join").count()) {
        throw new Error("in-app browser was blocked on install");
      }
      if (!(await inApp.getByText("Open in Safari to install").count())) {
        throw new Error("in-app missing Safari hint");
      }
      await inApp.locator('input[aria-label="Nickname"]').waitFor({ state: "visible" });
      console.log("webkit in-app join: ok");
    });

    await withBrowser("chromium", async (browser) => {
      const page = await browser.newPage({
        userAgent: ANDROID_UA,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      await page.addInitScript(() => {
        const fire = () => {
          const ev = new Event("beforeinstallprompt");
          Object.assign(ev, {
            preventDefault: () => undefined,
            prompt: async () => undefined,
            userChoice: Promise.resolve({ outcome: "accepted" }),
          });
          window.dispatchEvent(ev);
        };
        window.addEventListener("load", () => {
          fire();
          setTimeout(fire, 200);
          setTimeout(fire, 800);
        });
      });
      await page.goto(`${base}/join/WXYZ`, { waitUntil: "networkidle" });
      const install = page.getByRole("button", { name: "Install" });
      // BIP may arrive after hydrate; wait briefly.
      await page.waitForTimeout(400);
      if ((await install.count()) === 0) {
        if (!(await page.getByText("Browser menu → Install app").count())) {
          throw new Error("Android missing install CTA");
        }
      }
      if (!(await page.getByText("Add Beans to your Home Screen to join").count())) {
        throw new Error("Android missing install headline");
      }
      console.log("chromium android install screen: ok");
    });

    console.log("verify-install-join: ok");
  } finally {
    child?.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error("verify-install-join failed:", err);
  process.exit(1);
});
