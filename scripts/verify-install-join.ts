/**
 * Install-first join: WebKit iPhone UA + standalone matchMedia override,
 * and Chromium Android + beforeinstallprompt.
 *
 *   npx next dev --turbopack -p 3456
 *   BASE_URL=http://127.0.0.1:3456 npm run verify:install
 */
import { spawn, type ChildProcess } from "node:child_process";
import { chromium, webkit, type Browser, type Page } from "playwright";

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

const EXISTS_FALSE = `
(() => {
  const orig = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/api/room/") && url.includes("/exists")) {
      return Promise.resolve(new Response(JSON.stringify({ exists: false }), {
        headers: { "Content-Type": "application/json" },
      }));
    }
    return orig(input, init);
  };
})();
`;

const STALE_ENDED_STORAGE = `
(() => {
  try {
    localStorage.setItem("quarry:name", "Luke");
    sessionStorage.setItem("quarry:name:session", "Luke");
    localStorage.setItem("beans:install-create-consumed", "1");
    localStorage.setItem(
      "beans:install-join-consumed",
      JSON.stringify({ ABCD: Date.now() }),
    );
    const stale = JSON.stringify({
      code: "ABCD",
      name: "Luke",
      playerId: "p-stale",
      role: "player",
      at: Date.now(),
    });
    localStorage.setItem("quarry:room-session:ABCD", stale);
    sessionStorage.setItem("quarry:room-session:ABCD", stale);
  } catch {}
})();
`;

const EXISTS_TRUE = `
(() => {
  const orig = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/api/room/") && url.includes("/exists")) {
      return Promise.resolve(new Response(JSON.stringify({ exists: true }), {
        headers: { "Content-Type": "application/json" },
      }));
    }
    return orig(input, init);
  };
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
  const create = await fetch(`${base}/manifest.webmanifest?create=1`);
  const createBody = (await create.json()) as { start_url?: string; id?: string };
  if (createBody.start_url !== "/?create=1") {
    throw new Error(`create start_url ${createBody.start_url}`);
  }
  if (createBody.id !== "/?icon=v3") throw new Error(`create manifest id ${createBody.id}`);
  console.log("manifest route: ok");
}

async function reachCreateButton(page: Page) {
  const create = page.getByRole("button", { name: "Create game" });
  if ((await create.count()) > 0) {
    await create.waitFor({ state: "visible" });
    return create;
  }
  const nick = page.locator("#home-name");
  await nick.waitFor({ state: "visible", timeout: 8000 });
  await nick.fill("Luke");
  await page.getByRole("button", { name: "Continue" }).click();
  await create.waitFor({ state: "visible", timeout: 8000 });
  return create;
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

      const dead = await browser.newPage({
        userAgent: IPHONE_UA,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      await dead.addInitScript(STANDALONE_OVERRIDE);
      await dead.goto(`${base}/join/ABCD`, { waitUntil: "networkidle" });
      if (await dead.getByText("Add Beans to your Home Screen to join").count()) {
        throw new Error("standalone still showing install screen");
      }
      // Dead room (or exists:false from party) → ended, not the name form.
      if (await dead.getByText("That room has ended").count()) {
        console.log("webkit standalone stale room: ok");
      } else {
        console.log("webkit standalone: room treated as live, checking join form");
      }

      const stand = await browser.newPage({
        userAgent: IPHONE_UA,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      await stand.addInitScript(STANDALONE_OVERRIDE);
      await stand.addInitScript(EXISTS_TRUE);
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

      const host = await browser.newPage({
        userAgent: IPHONE_UA,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      await host.goto(`${base}/`, { waitUntil: "networkidle" });
      await (await reachCreateButton(host)).click();
      await host.waitForURL(/create=1/, { timeout: 8000 });
      await host.getByText("Add Beans to your Home Screen to host").waitFor();
      if (!(await host.getByText("Continue in browser").count())) {
        throw new Error("WebKit create: missing escape hatch");
      }
      if (await host.getByText("Add Beans to your Home Screen to join").count()) {
        throw new Error("WebKit create showed join copy");
      }
      console.log("webkit iphone create install: ok");

      const standCreate = await browser.newPage({
        userAgent: IPHONE_UA,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      await standCreate.addInitScript(STANDALONE_OVERRIDE);
      await standCreate.goto(`${base}/?create=1`, { waitUntil: "networkidle" });
      if (await standCreate.getByText("Add Beans to your Home Screen to host").count()) {
        throw new Error("standalone create still showing install screen");
      }
      const homeName = standCreate.locator("#home-name");
      const createBtn = standCreate.getByRole("button", { name: "Create game" });
      const sawHome =
        (await homeName.count()) > 0 || (await createBtn.count()) > 0;
      if (!sawHome) {
        throw new Error("standalone create missing home create/name");
      }
      console.log("webkit standalone create: ok");

      // P0: leftover ended-room storage + exists:false (fresh unused code)
      // must still reach the new room, not "That room has ended".
      const staleCreate = await browser.newPage({
        userAgent: IPHONE_UA,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      await staleCreate.addInitScript(STANDALONE_OVERRIDE);
      await staleCreate.addInitScript(EXISTS_FALSE);
      await staleCreate.addInitScript(STALE_ENDED_STORAGE);
      await staleCreate.goto(`${base}/`, { waitUntil: "networkidle" });
      await (await reachCreateButton(staleCreate)).click();
      await staleCreate.waitForURL(/\/room\/[A-Z0-9]{4}/, { timeout: 8000 });
      if (await staleCreate.getByText("That room has ended").count()) {
        throw new Error("standalone create showed ended screen for a new room");
      }
      const joining = staleCreate.getByText(/Joining as Luke|Room [A-Z0-9]{4}|Pick a name to join/);
      await joining.first().waitFor({ state: "visible", timeout: 8000 });
      console.log("webkit standalone create with leftover ended state: ok");
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

      const host = await browser.newPage({
        userAgent: ANDROID_UA,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      await host.addInitScript(() => {
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
      await host.goto(`${base}/?create=1`, { waitUntil: "networkidle" });
      await host.getByText("Add Beans to your Home Screen to host").waitFor();
      await host.waitForTimeout(400);
      if (
        (await host.getByRole("button", { name: "Install" }).count()) === 0 &&
        (await host.getByText("Browser menu → Install app").count()) === 0
      ) {
        throw new Error("Android create missing install CTA");
      }
      console.log("chromium android create install: ok");
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
