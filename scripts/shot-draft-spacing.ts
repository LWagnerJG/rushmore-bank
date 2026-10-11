/**
 * Draft spacing / gutter / Lock-in pill shots at 390×844 and 375×667.
 * Also checks 2 / 4 / 8 seats with long names (closed keyboard).
 *
 *   BASE_URL=http://127.0.0.1:3100 PARTY_HOST=127.0.0.1:8787 \
 *     npx tsx scripts/shot-draft-spacing.ts
 */
import { mkdirSync, copyFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { webkit, type Browser, type Page } from "playwright";
import { SmokeClient, sleep } from "./smoke-lib";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const PARTY = process.env.PARTY_HOST || "127.0.0.1:8787";
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts/draft-ui-spacing";
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

const LONG_NAMES = [
  "Christopher",
  "Alexandria",
  "Montgomery",
  "Bernadette",
  "Maximilian",
  "Genevieve",
  "Bartholomew",
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

async function metrics(page: Page) {
  // String form avoids tsx injecting __name into the browser bundle.
  return page.evaluate(`(() => {
    const root = document.documentElement;
    const appH = getComputedStyle(root).getPropertyValue("--app-h").trim();
    const pagePad = getComputedStyle(root).getPropertyValue("--page-pad-x").trim();
    const composer = document.querySelector(".draft-composer-row");
    const board = document.querySelector(".draft-board-table");
    const firstCell = document.querySelector(".draft-board-table tbody tr td:first-child");
    const lastCell = document.querySelector(".draft-board-table tbody tr td:last-child");
    const topic = document.querySelector(".room-chrome-topic");
    const live = document.querySelector(".draft-board-cell-live .draft-board-cell-placeholder");
    const submit = document.querySelector(".draft-pick-submit");
    const cell = document.querySelector(".draft-board-cell");
    const shell = document.querySelector(".app-shell");
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        left: Math.round(r.left),
        right: Math.round(r.right),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
    };
    return {
      appH,
      pagePad,
      scrollY: window.scrollY,
      shellH: shell ? shell.clientHeight : null,
      topic: box(topic),
      composer: box(composer),
      board: box(board),
      firstCell: box(firstCell),
      lastCell: box(lastCell),
      cellH: cell ? Math.round(cell.getBoundingClientRect().height) : null,
      liveText: live ? live.textContent : null,
      submitText: submit ? submit.textContent.trim() : null,
      submitDisabled: submit ? submit.getAttribute("aria-disabled") : null,
      submitBg: submit ? getComputedStyle(submit).backgroundColor : null,
    };
  })()`);
}

async function advanceToLukeTurn(bots: SmokeClient[], lukeId: string) {
  const watcher = bots[0]!;
  for (let guard = 0; guard < 12; guard++) {
    if (watcher.state?.phase === "DRAFT" && watcher.draftTurnId() === lukeId) {
      return;
    }
    const bot = bots.find((b) => b.youId === watcher.draftTurnId());
    if (!bot || watcher.state?.phase !== "DRAFT") return;
    const before = watcher.state.picks.length;
    bot.send({ type: "lock_in", text: `${bot.name.split(" ")[0]} pick ${guard + 1}` });
    await watcher.wait(
      () => (watcher.state?.picks.length ?? 0) > before,
      5000,
      "bot pick",
    );
    await sleep(200);
  }
}

async function startDraft(
  page: Page,
  bots: SmokeClient[],
  code: string,
  botNames: string[],
) {
  await page.goto(`${BASE}/room/${code}?name=Luke`);
  await page.locator('[data-diag="lobby-start"]').waitFor({ timeout: 30000 });
  for (const name of botNames) {
    const bot = new SmokeClient(
      PARTY,
      code,
      `${name.replace(/\s+/g, "").toLowerCase()}-${code}-${Math.random().toString(36).slice(2, 6)}`,
      name,
    );
    bots.push(bot);
    await bot.connect();
    await bot.join();
  }
  await page.getByRole("button", { name: "Start game" }).click();
  await bots[0]!.waitPhase("TOPIC_SELECTION");
  const topicId = bots[0]!.state!.topicOptions![0]!.id;
  for (const b of bots) b.send({ type: "vote_topic", topicId });
  await page.locator(".topic-choice").first().click();
  await bots[0]!.waitPhase("DRAFT");
  await page.locator("#selected-pick").waitFor({ timeout: 20000 });
  await sleep(600);
  const lukeId =
    bots[0]!.state?.players.find((pl) => pl.name === "Luke")?.id ?? "";
  await advanceToLukeTurn(bots, lukeId);
  await sleep(400);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const beforeSrc =
    "/home/ubuntu/.cursor/projects/workspace/assets/a9ec1594bcdeab7d74db888b890aac912a5fa7428a176c347d6408b01dfdf9c4.png";
  if (existsSync(beforeSrc)) {
    copyFileSync(beforeSrc, path.join(OUT, "before_luke_iphone_draft.png"));
  }

  const browser = await webkit.launch({ headless: true });
  const report: Record<string, unknown>[] = [];
  let failed = 0;

  const check = (ok: boolean, label: string, detail = "") => {
    if (!ok) {
      failed += 1;
      console.error("FAIL", label, detail);
    } else {
      console.log("ok  ", label, detail);
    }
  };

  // Primary after shots: 3 players (matches Luke's screenshot shape)
  for (const p of PROFILES) {
    const { ctx, page } = await newPage(browser, p);
    const bots: SmokeClient[] = [];
    try {
      await startDraft(page, bots, roomCode(), ["Bot Sam", "Bot Ava"]);
      const closed = await metrics(page);
      await shot(page, `${TAG}_draft_closed_${p.name}.png`);

      // Gutter alignment: first/last cell edges match composer (table box
      // overhangs by border-spacing; cells are the visual edge).
      const closedCells = closed as typeof closed & {
        firstCell: { left: number; right: number } | null;
        lastCell: { left: number; right: number } | null;
      };
      if (closed.composer && closedCells.firstCell && closedCells.lastCell && closed.topic) {
        check(
          Math.abs(closed.composer.left - closedCells.firstCell.left) <= 2,
          `${p.name} composer↔board left gutter`,
          `${closed.composer.left} vs ${closedCells.firstCell.left}`,
        );
        check(
          Math.abs(closed.composer.right - closedCells.lastCell.right) <= 2,
          `${p.name} composer↔board right gutter`,
          `${closed.composer.right} vs ${closedCells.lastCell.right}`,
        );
        check(
          Math.abs(closed.topic.left - closed.composer.left) <= 2,
          `${p.name} topic↔composer left gutter`,
          `${closed.topic.left} vs ${closed.composer.left}`,
        );
      }
      check(
        typeof closed.cellH === "number" &&
          closed.cellH >= 40 &&
          closed.cellH <= 52,
        `${p.name} compact cells (~44–48px)`,
        `cellH=${closed.cellH}`,
      );
      if (closed.composer && closed.topic && closed.board) {
        const topicToComposer = closed.composer.top - closed.topic.bottom;
        const composerToBoard = closed.board.top - closed.composer.bottom;
        check(
          topicToComposer >= 12,
          `${p.name} airy topic→composer`,
          `${topicToComposer}px`,
        );
        check(
          composerToBoard >= 20,
          `${p.name} airy composer→board`,
          `${composerToBoard}px`,
        );
      }
      check(
        typeof closed.liveText === "string" && /^Pick \d$/.test(closed.liveText),
        `${p.name} Pick N placeholder`,
        `live=${closed.liveText}`,
      );
      check(
        closed.submitDisabled === "true",
        `${p.name} Lock in muted when empty`,
        `aria-disabled=${closed.submitDisabled}`,
      );

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
      const focused = await metrics(page);
      check(
        focused.appH === closed.appH,
        `${p.name} --app-h frozen with keyboard`,
        `${closed.appH} → ${focused.appH}`,
      );
      check(focused.scrollY === 0, `${p.name} scrollY 0 with keyboard`);
      await shot(page, `${TAG}_draft_focused_${p.name}.png`);

      await page.fill("#selected-pick", "Empire State of Mind");
      await sleep(200);
      const ready = await metrics(page);
      check(
        ready.submitDisabled === "false" || ready.submitDisabled === null,
        `${p.name} Lock in ready when typed`,
        `aria-disabled=${ready.submitDisabled}`,
      );
      await shot(page, `${TAG}_draft_ready_${p.name}.png`);

      report.push({ profile: p.name, closed, focused, ready });
    } finally {
      for (const b of bots) b.close();
      await ctx.close();
    }
  }

  // Seat-count + long-name checks at 390×844
  const seatCases: { seats: number; bots: string[] }[] = [
    { seats: 2, bots: ["Alexandria"] },
    {
      seats: 4,
      bots: ["Christopher", "Montgomery", "Bernadette"],
    },
    {
      seats: 8,
      bots: LONG_NAMES,
    },
  ];
  const p = PROFILES[0]!;
  for (const sc of seatCases) {
    const { ctx, page } = await newPage(browser, p);
    const bots: SmokeClient[] = [];
    try {
      await startDraft(page, bots, roomCode(), sc.bots);
      const m = await metrics(page);
      await shot(page, `${TAG}_draft_seats${sc.seats}_${p.name}.png`);
      check(
        typeof m.cellH === "number" && m.cellH >= 36 && m.cellH <= 56,
        `seats=${sc.seats} compact cell height`,
        `cellH=${m.cellH}`,
      );
      const mCells = m as typeof m & {
        firstCell: { left: number } | null;
      };
      if (m.composer && mCells.firstCell) {
        check(
          Math.abs(m.composer.left - mCells.firstCell.left) <= 2,
          `seats=${sc.seats} gutter align`,
          `${m.composer.left} vs ${mCells.firstCell.left}`,
        );
      }
      const headers = await page.locator(".draft-board-name").allTextContents();
      check(
        headers.length === sc.seats,
        `seats=${sc.seats} column count`,
        headers.join("|"),
      );
      report.push({ seats: sc.seats, metrics: m, headers });
    } finally {
      for (const b of bots) b.close();
      await ctx.close();
    }
  }

  writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ failed, report }, null, 2));
  await browser.close();
  if (failed) {
    console.error(`\n${failed} checks failed`);
    process.exit(1);
  }
  console.log("\nall draft spacing checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
