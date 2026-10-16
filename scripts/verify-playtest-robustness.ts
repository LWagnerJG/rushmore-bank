/**
 * Multi-client Playwright WebKit regressions for Luke's playtest bugs:
 * sticky host across setOffline, dice land (not stuck tumbling) for
 * watcher + roller across background/foreground and mid-roll reconnect,
 * resync after slow-3G-style delay.
 *
 *   npx wrangler dev --ip 127.0.0.1 --port 8787
 *   NEXT_PUBLIC_PARTYKIT_HOST=127.0.0.1:8787 npx next build && npx next start -p 3100
 *   BASE_URL=http://127.0.0.1:3100 npm run test:playtest
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { webkit, type Browser, type BrowserContext, type Page } from "playwright";
import { ADMIN_PIN, SmokeClient, sleep } from "./smoke-lib";

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

/**
 * String evaluate — tsx/esbuild keepNames injects `__name` around arrow
 * functions, which WebKit page.evaluate then throws (CI playtest fail).
 */
async function ev(page: Page, expr: string) {
  return page.evaluate(expr);
}

async function foreground(page: Page) {
  await ev(
    page,
    `(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: function () { return "visible"; },
      });
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("pageshow"));
    })()`,
  );
}

async function background(page: Page) {
  await ev(
    page,
    `(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: function () { return "hidden"; },
      });
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("blur"));
    })()`,
  );
}

async function assertDiceLanded(page: Page, d1?: number, d2?: number) {
  const tray = page.locator(".bean-dice-tray");
  await tray.waitFor({ timeout: 15000 });
  // Playwright: options are the 3rd arg — `{ timeout }` as 2nd is treated as `arg`.
  await page.waitForFunction(
    `(() => {
      const t = document.querySelector(".bean-dice-tray");
      if (!t) return false;
      const phase = t.getAttribute("data-dice-phase");
      const a = Number(t.getAttribute("data-dice-d1"));
      const b = Number(t.getAttribute("data-dice-d2"));
      return phase === "settled" && a >= 1 && a <= 6 && b >= 1 && b <= 6;
    })()`,
    undefined,
    { timeout: 15000 },
  );
  const d1Attr = Number(await tray.getAttribute("data-dice-d1"));
  const d2Attr = Number(await tray.getAttribute("data-dice-d2"));
  if (d1 != null && d1Attr !== d1) {
    throw new Error(`expected d1=${d1}, got ${d1Attr}`);
  }
  if (d2 != null && d2Attr !== d2) {
    throw new Error(`expected d2=${d2}, got ${d2Attr}`);
  }
  const pip0 = Number(
    await page.locator('[data-die-index="0"]').getAttribute("data-pip-count"),
  );
  const pip1 = Number(
    await page.locator('[data-die-index="1"]').getAttribute("data-pip-count"),
  );
  if (pip0 !== d1Attr || pip1 !== d2Attr) {
    throw new Error(`pip counts ${pip0}+${pip1} !== faces ${d1Attr}+${d2Attr}`);
  }
  const total = d1Attr + d2Attr;
  const sumSel = `[data-dice-sum="${total}"], [data-dice-landed-total="${total}"]`;
  const sum = page.locator(sumSel).first();
  await sum.waitFor({ state: "visible", timeout: 8000 });
  if ((await page.locator(".bean-dice-tray").getAttribute("data-dice-phase")) !== "settled") {
    throw new Error("tray left settled after land check");
  }
}

/**
 * After mid-roll reconnect: tray must not stay tumbling.
 * `settled` = faces still showing; `idle` = server advanced after land
 * (common on BEAN BUSTER — startDiceTurn clears lastDice).
 */
async function assertDiceNotStuckTumbling(page: Page) {
  const tray = page.locator(".bean-dice-tray");
  await tray.waitFor({ timeout: 15000 });
  await page.waitForFunction(
    `(() => {
      const t = document.querySelector(".bean-dice-tray");
      if (!t) return false;
      const phase = t.getAttribute("data-dice-phase");
      return phase === "settled" || phase === "idle";
    })()`,
    undefined,
    { timeout: 30000 },
  );
  const phase = await tray.getAttribute("data-dice-phase");
  if (phase === "tumbling") {
    throw new Error("tray still tumbling after hard-land window");
  }
  if (phase === "settled") {
    const d1Attr = Number(await tray.getAttribute("data-dice-d1"));
    const d2Attr = Number(await tray.getAttribute("data-dice-d2"));
    if (
      !(d1Attr >= 1 && d1Attr <= 6 && d2Attr >= 1 && d2Attr <= 6)
    ) {
      throw new Error(`settled faces invalid: ${d1Attr}+${d2Attr}`);
    }
  }
}

async function assertDiceNumbers(page: Page, d1: number, d2: number) {
  await assertDiceLanded(page, d1, d2);
}

async function diceLab(browser: Browser) {
  const { ctx, page } = await newPage(browser);
  try {
    await page.goto(`${BASE}/dev/dice-layout`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.getByRole("button", { name: "Settled" }).click();
    await assertDiceLanded(page, 5, 2);
    await shot(page, "dice-settled-numbers.png");

    await page.getByRole("button", { name: "Your turn" }).click();
    await assertDiceLanded(page, 3, 4);
    await shot(page, "dice-your-turn-numbers.png");

    await page.getByRole("button", { name: "Watching" }).click();
    await page.locator(".bean-dice-tray").waitFor();
    const pips = page.locator(".bean-pip-die-pip");
    await pips.first().waitFor({ state: "visible", timeout: 8000 });
    if ((await pips.count()) < 2) {
      throw new Error("watcher dice pips missing");
    }
    await shot(page, "dice-watching-numbers.png");
  } finally {
    await ctx.close();
  }
}

async function diceStuckRoll(browser: Browser) {
  const code = roomCode();
  const partyHost =
    process.env.PARTY_HOST ||
    process.env.NEXT_PUBLIC_PARTYKIT_HOST ||
    "127.0.0.1:8787";
  const ctrl = new SmokeClient(partyHost, code, `ctrl-${Date.now()}`, "Ctrl");
  const { ctx: rollerCtx, page: roller } = await newPage(browser);
  const { ctx: watchCtx, page: watch } = await newPage(browser);
  try {
    await ctrl.connect();
    await ctrl.join("player");

    await roller.goto(`${BASE}/room/${code}?name=Luke`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await watch.goto(`${BASE}/room/${code}?name=Ava`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await roller.locator(".lobby-roster").waitFor({ timeout: 30000 });
    await watch.locator(".lobby-roster").waitFor({ timeout: 30000 });

    ctrl.send({ type: "admin_jump_phase", phase: "DICE", pin: ADMIN_PIN });
    await ctrl.wait(() => ctrl.state?.phase === "DICE", 20000, "dice phase");

    await roller.locator(".bean-dice-tray").waitFor({ timeout: 20000 });
    await watch.locator(".bean-dice-tray").waitFor({ timeout: 20000 });

    const turnId = ctrl.diceTurnId();
    if (turnId === ctrl.youId) {
      ctrl.send({ type: "roll" });
    } else {
      const lukeUp = await roller.locator(".dice-up-title").innerText();
      const page = /your roll/i.test(lukeUp) ? roller : watch;
      await page.locator(".bean-dice-tray").click();
    }

    await ctrl.wait(
      () => ctrl.state?.diceSubphase === "COMMITTED",
      10000,
      "committed",
    );

    // Mid-roll: watcher goes to background, other WebKit drops the socket.
    await background(watch);
    await rollerCtx.setOffline(true);

    await sleep(2400 + 1500 + 900);

    await rollerCtx.setOffline(false);
    await foreground(watch);

    // Server must leave COMMITTED (reveal, then settle-hold / next seat).
    await ctrl.wait(
      () =>
        ctrl.state?.diceSubphase !== "COMMITTED" ||
        ctrl.state?.lastDice?.revealed === true,
      20000,
      "dice revealed or advanced",
    );

    await assertDiceNotStuckTumbling(roller);
    await assertDiceNotStuckTumbling(watch);
    await shot(roller, "dice-landed-after-reconnect.png");
    await shot(watch, "dice-landed-after-bg.png");
  } finally {
    ctrl.close();
    await rollerCtx.close();
    await watchCtx.close();
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

    // Host star on *other* players also uses .lobby-rename-host — only the
    // guest's own rename control means Ava stole host.
    const avaIsHost = await guest
      .locator(".lobby-rename-btn .lobby-rename-host")
      .count();
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
    const avaIsHostAfterFg = await guest
      .locator(".lobby-rename-btn .lobby-rename-host")
      .count();
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

async function assertChipOn(page: Page, sel: string, label: string) {
  const pressed = await page.locator(sel).getAttribute("aria-pressed");
  if (pressed !== "true") {
    throw new Error(`${label} not selected (aria-pressed=${pressed})`);
  }
}

async function topicReselect(browser: Browser) {
  const code = roomCode();
  const { ctx: hostCtx, page: host } = await newPage(browser);
  const { ctx: guestCtx, page: guest } = await newPage(browser);
  try {
    await host.goto(`${BASE}/room/${code}?name=Luke`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await guest.goto(`${BASE}/room/${code}?name=Ava`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await host.locator(".lobby-roster").waitFor({ timeout: 30000 });
    await guest.locator(".lobby-roster").waitFor({ timeout: 30000 });

    await host.getByRole("button", { name: /Start/i }).click();
    await host.locator(".topic-layout").waitFor({ timeout: 20000 });
    await guest.locator(".topic-layout").waitFor({ timeout: 20000 });

    const toggle = host.locator(".topic-options-toggle");
    await toggle.click();
    await host.locator(".topic-options-body").waitFor();

    for (const n of [4, 5, 6, 3, 5]) {
      await host.locator(`.topic-rounds-chip[data-rounds="${n}"]`).click();
      await host.waitForFunction(
        `document.querySelector('.topic-rounds-chip[data-rounds="${n}"]')?.getAttribute('aria-pressed') === 'true'`,
        undefined,
        { timeout: 8000 },
      );
      await assertChipOn(
        host,
        `.topic-rounds-chip[data-rounds="${n}"]`,
        `rounds ${n}`,
      );
    }

    for (const vibe of ["sports", "basic", "all", "geography", "sports"]) {
      await host.locator(`.topic-vibe-chip[data-vibe="${vibe}"]`).click();
      await host.waitForFunction(
        `document.querySelector('.topic-vibe-chip[data-vibe="${vibe}"]')?.getAttribute('aria-pressed') === 'true'`,
        undefined,
        { timeout: 8000 },
      );
      await assertChipOn(
        host,
        `.topic-vibe-chip[data-vibe="${vibe}"]`,
        `vibe ${vibe}`,
      );
    }

    // Pick a topic, then change rounds again — must still land.
    // Wait until the shortlist finished spinning (buttons enabled) — the vibe
    // chip is optimistic and can show pressed before new options arrive.
    // Use button.topic-choice — the custom row is a div.topic-choice.
    // Playwright: options are the 3rd arg — `{ timeout }` as 2nd is treated as `arg`.
    await host.waitForFunction(
      `(() => {
        const btns = [...document.querySelectorAll("button.topic-choice")];
        return (
          btns.length >= 1 &&
          btns.every((b) => !(b).disabled) &&
          !document.querySelector(".topic-choices.topic-refresh")
        );
      })()`,
      undefined,
      { timeout: 12000 },
    );
    const choice = host.locator("button.topic-choice:not([disabled])").first();
    await choice.click();
    await host.locator(".topic-choice-selected").waitFor({ timeout: 8000 });
    await host.locator('.topic-rounds-chip[data-rounds="6"]').click();
    await host.waitForFunction(
      `document.querySelector('.topic-rounds-chip[data-rounds="6"]')?.getAttribute('aria-pressed') === 'true'`,
      { timeout: 8000 },
    );

    // Options must close and reopen.
    await toggle.click();
    if (await host.locator(".topic-options-body").count()) {
      throw new Error("Options stayed open after toggle close");
    }
    await toggle.click();
    await host.locator(".topic-options-body").waitFor({ timeout: 5000 });
    await assertChipOn(host, '.topic-rounds-chip[data-rounds="6"]', "rounds 6 after reopen");

    await shot(host, "topic-reselect-host.png");
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
      ["dice-stuck-roll", () => diceStuckRoll(browser)],
      ["topic-reselect", () => topicReselect(browser)],
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
