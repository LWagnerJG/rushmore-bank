/**
 * Playwright WebKit (390×844) smoke against the Cloudflare beans-web worker.
 *
 * Checks:
 *   1. Home loads (brand + create flow)
 *   2. Create a room → lobby
 *   3. Admin unlock + spawn bots (bots join)
 *   4. POST /api/judge returns non-fallback
 *   5. GET /api/version sha matches EXPECTED_SHA (default: git rev-parse HEAD)
 *
 * Env:
 *   WEB_URL          — base URL (default https://beans-web.beans-lwagner.workers.dev)
 *   EXPECTED_SHA     — full or short commit sha to match /api/version
 *   JUDGE_SECRET     — Bearer for /api/judge (optional if party mark accepted)
 */
import { chromium, webkit, type Browser, type Page } from "playwright";
import { execSync } from "node:child_process";

const WEB_URL = (
  process.env.WEB_URL || "https://beans-web.beans-lwagner.workers.dev"
).replace(/\/$/, "");
const VIEWPORT = { width: 390, height: 844 };

function expectedSha(): string {
  if (process.env.EXPECTED_SHA) return process.env.EXPECTED_SHA.slice(0, 8);
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim().slice(0, 8);
  } catch {
    return "local";
  }
}

async function withBrowser<T>(fn: (browser: Browser) => Promise<T>): Promise<T> {
  // Prefer WebKit (iPhone); fall back to Chromium if WebKit isn't installed.
  let browser: Browser;
  try {
    browser = await webkit.launch({ headless: true });
  } catch (err) {
    console.warn("WebKit launch failed, falling back to Chromium:", err);
    browser = await chromium.launch({ headless: true });
  }
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

async function checkVersion(): Promise<void> {
  const expect = expectedSha();
  const res = await fetch(`${WEB_URL}/api/version`, { cache: "no-store" });
  if (!res.ok) throw new Error(`/api/version HTTP ${res.status}`);
  const data = (await res.json()) as { sha?: string; partyHost?: string };
  console.log("version:", data);
  if (!data.sha || data.sha.slice(0, 8) !== expect.slice(0, 8)) {
    throw new Error(
      `/api/version sha mismatch: got ${data.sha}, expected ${expect}`,
    );
  }
  if (
    data.partyHost &&
    !data.partyHost.includes("beans-party") &&
    !data.partyHost.includes("127.0.0.1")
  ) {
    console.warn("unexpected partyHost:", data.partyHost);
  }
}

async function checkJudge(): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-quarry-judge": "partyserver",
  };
  if (process.env.JUDGE_SECRET) {
    headers.Authorization = `Bearer ${process.env.JUDGE_SECRET}`;
  }
  const res = await fetch(`${WEB_URL}/api/judge`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      topic: "Best pets",
      scopeBoundary: "Animals only",
      rosters: [
        { anonId: "R1", picks: ["dog", "cat", "rabbit", "hamster"] },
        { anonId: "R2", picks: ["parrot", "fish", "turtle", "ferret"] },
      ],
    }),
  });
  const data = (await res.json()) as {
    fallback?: boolean;
    fallbackReason?: string;
    model?: string;
    judgments?: unknown[];
  };
  console.log("judge:", {
    status: res.status,
    fallback: data.fallback,
    fallbackReason: data.fallbackReason,
    model: data.model,
    count: data.judgments?.length,
  });
  if (res.status !== 200) {
    throw new Error(`/api/judge HTTP ${res.status}`);
  }
  if (data.fallback === true) {
    throw new Error(
      `/api/judge returned fallback:true reason=${data.fallbackReason ?? "unknown"}`,
    );
  }
}

async function checkHomeCreateBots(page: Page): Promise<string> {
  await page.goto(WEB_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByText(/Draft four/i).first().waitFor({ state: "visible", timeout: 30_000 });
  await page.getByLabel("Beans").first().waitFor({ state: "visible", timeout: 15_000 });

  // Unlock admin on home (5 taps on bean logo) so Profile sheet shows AdminTools.
  const homeLogo = page.getByRole("button", { name: "Beans logo" }).first();
  for (let i = 0; i < 5; i++) await homeLogo.click();
  await page.getByText(/Admin unlocked/i).first().waitFor({ state: "visible", timeout: 5_000 });

  // Nickname → Create game.
  const nameInput = page.getByLabel("Nickname");
  if (await nameInput.isVisible().catch(() => false)) {
    await nameInput.fill("CFSmoke");
    await page.getByRole("button", { name: "Continue" }).click();
  }

  await page.getByRole("button", { name: /Create game/i }).click();
  await page.waitForURL(/\/room\/[A-Z0-9]{4}/i, { timeout: 30_000 });
  const roomMatch = page.url().match(/\/room\/([A-Z0-9]{4})/i);
  if (!roomMatch) throw new Error("did not navigate to a room URL");
  const code = roomMatch[1]!.toUpperCase();
  console.log("created room", code);

  // Wait for lobby / connection, then open profile (merged settings).
  await page.waitForTimeout(1500);
  const profileBtn = page.getByRole("button", { name: "Profile" }).first();
  await profileBtn.waitFor({ state: "visible", timeout: 20_000 });
  await profileBtn.click();

  await page.getByRole("button", { name: /^Admin$/ }).click();
  const addBots = page.getByRole("button", { name: /^Add$/ });
  await addBots.first().waitFor({ state: "visible", timeout: 10_000 });
  await addBots.first().click();

  // Bots show as players in lobby.
  await page.waitForFunction(
    () => {
      const text = document.body.innerText;
      return /\bbot\b/i.test(text);
    },
    { timeout: 20_000 },
  );
  console.log("bots joined (lobby shows bot players)");
  return code;
}

async function checkPwaAssets(): Promise<void> {
  for (const path of [
    "/site.webmanifest",
    "/sw.js",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
  ]) {
    const res = await fetch(`${WEB_URL}${path}`);
    if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
    console.log("asset ok", path, res.status);
  }
}

async function main() {
  console.log(`verify-beans-web → ${WEB_URL} @ ${VIEWPORT.width}x${VIEWPORT.height}`);

  await checkPwaAssets();
  await checkVersion();
  await checkJudge();

  await withBrowser(async (browser) => {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await checkHomeCreateBots(page);
    await context.close();
  });

  console.log("verify-beans-web: ok");
}

main().catch((err) => {
  console.error("verify-beans-web failed:", err);
  process.exit(1);
});
