/**
 * WebKit DRAFT declutter shots at 390×844 and 375×667 (closed + focused).
 *
 *   BASE_URL=http://127.0.0.1:3100 PARTY_HOST=127.0.0.1:8787 \
 *     npx tsx scripts/shot-draft-declutter.ts
 */
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { webkit, type Browser, type Page } from "playwright";
import { SmokeClient, sleep } from "./smoke-lib";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const PARTY = process.env.PARTY_HOST || "127.0.0.1:8787";
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts/draft-declutter";
const TAG = process.env.SHOT_TAG || "after";
const EMULATOR = path.resolve(__dirname, "ios-keyboard-emulator.js");
const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

type Profile = {
  name: string;
  width: number;
  height: number;
  scale: number;
  safeTop: number;
  keyboard: number;
};

const PROFILES: Profile[] = [
  { name: "390x844", width: 390, height: 844, scale: 3, safeTop: 47, keyboard: 380 },
  { name: "375x667", width: 375, height: 667, scale: 2, safeTop: 20, keyboard: 304 },
];

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
    content: `window.__KB_CONFIG = ${JSON.stringify({ keyboardPx: p.keyboard })};`,
  });
  await ctx.addInitScript({ path: EMULATOR });
  await ctx.addInitScript({
    content: `document.addEventListener("DOMContentLoaded", function () {
      var s = document.createElement("style");
      s.textContent = ".room-chrome-safe, .app-safe-top { height: calc(${p.safeTop}px + var(--safe-top-solid-extra) + var(--safe-top-fade)) !important; }";
      document.head.appendChild(s);
    });`,
  });
  return { ctx, page: await ctx.newPage() };
}

async function startRoom(page: Page, bots: SmokeClient[], code: string) {
  await page.goto(`${BASE}/room/${code}?name=Luke`);
  await page.locator('[data-diag="lobby-start"]').waitFor({ timeout: 30000 });
  for (const name of ["Bot Sam", "Bot Ava"]) {
    const bot = new SmokeClient(
      PARTY,
      code,
      `${name.replace(/\s+/g, "").toLowerCase()}-${code}`,
      name,
    );
    bots.push(bot);
    await bot.connect();
    await bot.join();
  }
  await page.getByRole("button", { name: "Start game" }).click();
  await bots[0]!.waitPhase("TOPIC_SELECTION");
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  const beforeSrc =
    "/home/ubuntu/.cursor/projects/workspace/assets/e3edbee3292978840918c87e74e4931abc3e904e45a40f44fd1984de1246111f.png";
  if (existsSync(beforeSrc)) {
    const beforeDest = path.join(OUT, "before_luke_iphone_draft.png");
    copyFileSync(beforeSrc, beforeDest);
    console.log("wrote", beforeDest);
  }

  const browser = await webkit.launch({ headless: true });

  for (const p of PROFILES) {
    const { ctx, page } = await newPage(browser, p);
    const bots: SmokeClient[] = [];
    try {
      await startRoom(page, bots, roomCode());
      const topicId = bots[0]!.state!.topicOptions![0]!.id;
      for (const b of bots) b.send({ type: "vote_topic", topicId });
      await page.locator(".topic-choice").first().click();
      await bots[0]!.waitPhase("DRAFT");
      await page.locator("#selected-pick").waitFor({ timeout: 20000 });
      await sleep(700);

      const watcher = bots[0]!;
      const lukeId =
        watcher.state?.players.find((pl) => pl.name === "Luke")?.id ?? "";
      for (let guard = 0; guard < 8; guard++) {
        if (
          watcher.state?.phase === "DRAFT" &&
          watcher.draftTurnId() === lukeId
        ) {
          break;
        }
        const bot = bots.find((b) => b.youId === watcher.draftTurnId());
        if (!bot || watcher.state?.phase !== "DRAFT") break;
        const before = watcher.state.picks.length;
        bot.send({
          type: "lock_in",
          text: `${bot.name} collab ${guard + 1}`,
        });
        await watcher.wait(
          () => (watcher.state?.picks.length ?? 0) > before,
          5000,
          "bot pick",
        );
        await sleep(250);
      }

      await shot(page, `${TAG}_draft_closed_${p.name}.png`);

      await page.tap("#selected-pick");
      await sleep(250);
      await page.evaluate(() => {
        (
          window as unknown as {
            __kbTest?: { paintKeyboard: (on: boolean) => void };
          }
        ).__kbTest?.paintKeyboard(true);
      });
      await sleep(200);
      await shot(page, `${TAG}_draft_focused_${p.name}.png`);

      await page.fill("#selected-pick", "Empire State of Mind");
      await sleep(200);
      await shot(page, `${TAG}_draft_ready_${p.name}.png`);
    } finally {
      for (const b of bots) b.close();
      await ctx.close();
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
