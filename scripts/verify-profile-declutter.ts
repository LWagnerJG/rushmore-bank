/**
 * WebKit verify for profile sheet declutter + backdrop seam.
 *
 * Viewports: 390×844 and 375×667
 * - Main sheet: calm zero-state, Sound + Room code only
 * - Nested Host options + Admin (admin unlocked)
 * - Non-admin: no Admin row
 * - Backdrop paints to the bottom edge (no cream seam)
 *
 *   BASE_URL=http://127.0.0.1:3100 npx tsx scripts/verify-profile-declutter.ts
 */
import { mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import { webkit, type Page, type BrowserContext } from "playwright";
import { ADMIN_UNLOCK_KEY } from "../src/lib/admin-session";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts";
const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "375x667", width: 375, height: 667 },
] as const;

async function shot(page: Page, name: string) {
  const dest = path.join(OUT, name);
  await page.screenshot({ path: dest, fullPage: false });
  console.log("wrote", dest);
  try {
    const mirror = path.join("/opt/cursor/artifacts", name);
    if (mirror !== dest) {
      mkdirSync(path.dirname(mirror), { recursive: true });
      copyFileSync(dest, mirror);
    }
  } catch {
    /* ignore */
  }
}

async function continueIfNeeded(page: Page, name: string) {
  const continueBtn = page.getByRole("button", { name: /^Continue$/ });
  if (await continueBtn.isVisible().catch(() => false)) {
    const nameInput = page.getByLabel("Nickname");
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill(name);
    }
    await continueBtn.click();
    await page.waitForTimeout(300);
  }
}

async function openProfile(page: Page) {
  await page.getByRole("button", { name: "Profile" }).click();
  await page.waitForSelector('[role="dialog"][aria-label="Profile"]', {
    timeout: 8000,
  });
  await page.waitForTimeout(350);
}

async function closeProfile(page: Page) {
  await page.getByRole("button", { name: /^Close$/ }).click();
  await page.waitForSelector('[role="dialog"][aria-label="Profile"]', {
    state: "detached",
    timeout: 5000,
  });
}

async function assertBackdropFullBleed(page: Page, label: string) {
  const metrics = await page.evaluate(() => {
    const backdrop = document.querySelector(
      ".settings-sheet-backdrop",
    ) as HTMLElement | null;
    if (!backdrop) return { ok: false, reason: "missing backdrop" };
    const onBody = backdrop.parentElement === document.body;
    const rootOpen = document.documentElement.classList.contains(
      "settings-sheet-open",
    );
    const bodyOpen = document.body.classList.contains("settings-sheet-open");
    const rect = backdrop.getBoundingClientRect();
    const style = getComputedStyle(backdrop);
    const vh = window.innerHeight;
    // Bleed past the layout viewport (home indicator / safe-area)
    const covers =
      rect.top <= 1 &&
      rect.left <= 1 &&
      rect.bottom >= vh + 40 &&
      rect.right >= window.innerWidth - 1;
    const bg = style.backgroundColor;
    const dimmed =
      bg.includes("35, 72, 62") || bg.includes("42, 74, 64") || bg !== "rgba(0, 0, 0, 0)";
    return {
      ok: onBody && rootOpen && bodyOpen && covers && dimmed,
      reason: !onBody
        ? "not-ported"
        : !rootOpen || !bodyOpen
          ? "missing-open-class"
          : !covers
            ? "short"
            : dimmed
              ? "ok"
              : "no-dim",
      top: rect.top,
      bottom: rect.bottom,
      vh,
      heightCss: style.height,
      bg,
      onBody,
      rootOpen,
      bodyOpen,
    };
  });
  if (!metrics.ok) {
    throw new Error(
      `[${label}] backdrop seam: ${JSON.stringify(metrics)}`,
    );
  }
  console.log(`[${label}] backdrop full-bleed ok`, metrics);
}

async function createLobby(page: Page) {
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await continueIfNeeded(page, "Luke");
  await page.getByRole("button", { name: /Create game/i }).click();
  await page.waitForURL(/\/room\//, { timeout: 25000 });
  await page.waitForSelector("text=Lobby", { timeout: 20000 });
}

async function withContext(
  width: number,
  height: number,
  admin: boolean,
): Promise<{ context: BrowserContext; page: Page }> {
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    userAgent: IOS_UA,
    isMobile: true,
    hasTouch: true,
  });
  if (admin) {
    await context.addInitScript((key) => {
      try {
        sessionStorage.setItem(key, "1");
      } catch {
        /* ignore */
      }
    }, ADMIN_UNLOCK_KEY);
  }
  const page = await context.newPage();
  return { context, page };
}

async function runAdminViewport(width: number, height: number, label: string) {
  const { context, page } = await withContext(width, height, true);
  const browser = context.browser()!;

  await createLobby(page);
  await openProfile(page);

  const dialog = page.locator('[role="dialog"][aria-label="Profile"]');
  await expectVisible(dialog.getByText("No games yet"));
  await expectVisible(dialog.getByText("Sound", { exact: true }));
  await expectVisible(dialog.getByText("Room code"));
  await expectVisible(dialog.getByRole("button", { name: /^Host options$/ }));
  await expectVisible(dialog.getByRole("button", { name: /^Admin$/ }));
  // Nested clutter must not be on main
  if (await dialog.getByText("Jump phase").isVisible().catch(() => false)) {
    throw new Error(`[${label}] Jump phase visible on main sheet`);
  }
  if (await dialog.getByText("Party Mode").isVisible().catch(() => false)) {
    throw new Error(`[${label}] Party Mode visible on main sheet`);
  }
  if (await dialog.getByText("Off by default").isVisible().catch(() => false)) {
    throw new Error(`[${label}] helper subtitle still present`);
  }

  await assertBackdropFullBleed(page, `${label}-main`);
  await shot(page, `profile-declutter-main-admin-${label}.png`);

  await dialog.getByRole("button", { name: /^Host options$/ }).click();
  await page.waitForTimeout(250);
  await expectVisible(dialog.getByText("Party Mode"));
  await expectVisible(dialog.getByText("AI judge"));
  await shot(page, `profile-declutter-host-${label}.png`);

  await dialog.getByRole("button", { name: /Host options/ }).click();
  await page.waitForTimeout(200);
  await dialog.getByRole("button", { name: /^Admin$/ }).click();
  await page.waitForSelector("label:has-text('Jump phase')", { timeout: 8000 });
  await expectVisible(dialog.getByText("Jump phase"));
  await expectVisible(dialog.getByText("Add bots"));
  // Platform line from /api/version
  await page.waitForFunction(
    () => /Served by /i.test(document.body.innerText),
    { timeout: 8000 },
  );
  await assertBackdropFullBleed(page, `${label}-admin`);
  await shot(page, `profile-declutter-admin-${label}.png`);

  await closeProfile(page);
  await context.close();
  await browser.close();
  console.log(`[${label}] admin flow ok`);
}

async function runNonAdminViewport(width: number, height: number, label: string) {
  const { context, page } = await withContext(width, height, false);
  const browser = context.browser()!;

  await createLobby(page);
  await openProfile(page);
  const dialog = page.locator('[role="dialog"][aria-label="Profile"]');
  await expectVisible(dialog.getByRole("button", { name: /^Host options$/ }));
  if (await dialog.getByRole("button", { name: /^Admin$/ }).isVisible().catch(() => false)) {
    throw new Error(`[${label}] Admin row visible for non-admin`);
  }
  await shot(page, `profile-declutter-main-nonadmin-${label}.png`);
  await dialog.getByRole("button", { name: /^Host options$/ }).click();
  await page.waitForTimeout(250);
  await expectVisible(dialog.getByText("Party Mode"));
  await shot(page, `profile-declutter-host-nonadmin-${label}.png`);
  await closeProfile(page);

  await context.close();
  await browser.close();
  console.log(`[${label}] non-admin flow ok`);
}

async function expectVisible(
  locator: ReturnType<Page["locator"]> | ReturnType<Page["getByText"]>,
) {
  await locator.first().waitFor({ state: "visible", timeout: 8000 });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const vp of VIEWPORTS) {
    await runAdminViewport(vp.width, vp.height, vp.name);
    await runNonAdminViewport(vp.width, vp.height, vp.name);
  }
  console.log("profile declutter verify ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
