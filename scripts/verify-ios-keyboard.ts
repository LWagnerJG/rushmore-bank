/**
 * iOS keyboard e2e: Playwright WebKit + scripts/ios-keyboard-emulator.js
 * against the real app and a real room.
 *
 * At 390×844 and 375×667 with an iOS-sized keyboard, each text field (draft
 * pick, home nickname, home room code, room-link nickname, custom topic) must
 * stay put and fully above the keyboard while typing: input top constant per
 * frame (±1px), input and submit bottom ≤ visualViewport.height, no pan,
 * window.scrollY 0, nothing above it changing height, no enter animation
 * re-applied. One tap on the submit control must submit (focus kept where the
 * field stays), Enter/Go must submit, and closing the keyboard must restore
 * the exact layout.
 *
 *   npx wrangler dev --ip 127.0.0.1 --port 8787
 *   NEXT_PUBLIC_PARTYKIT_HOST=127.0.0.1:8787 npx next build && npx next start -p 3100
 *   BASE_URL=http://127.0.0.1:3100 PARTY_HOST=127.0.0.1:8787 npm run test:ios-keyboard
 *
 * OUT_DIR (default /tmp/ios-keyboard) receives report.json and screenshots.
 * REPORT_ONLY=1 records failures without failing (before/after comparisons).
 * ONLY=390x844 runs one profile.
 */
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { webkit, type Browser, type Page } from "playwright";
import { SmokeClient, sleep } from "./smoke-lib";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const PARTY = process.env.PARTY_HOST || "127.0.0.1:8787";
const OUT = process.env.OUT_DIR || "/tmp/ios-keyboard";
const REPORT_ONLY = process.env.REPORT_ONLY === "1";
const ONLY = process.env.ONLY;
const EMULATOR = path.resolve(__dirname, "ios-keyboard-emulator.js");
const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
/** 15 characters. */
const TYPED = "Paddington Bear";
const TOLERANCE_PX = 1;
const SUBMIT_ATTR = "data-kb-submit";
const ENTRY_CLASS = /^(phase-enter|motion-enter|animate-[\w-]+)$/;

type Profile = {
  name: string;
  width: number;
  height: number;
  scale: number;
  safeTop: number;
  /** Keyboard + QuickType + form accessory bar. */
  keyboard: number;
};

const PROFILES: Profile[] = [
  { name: "390x844", width: 390, height: 844, scale: 3, safeTop: 47, keyboard: 380 },
  { name: "375x667", width: 375, height: 667, scale: 2, safeTop: 20, keyboard: 304 },
];

type Field = { input: string; submit: RegExp };

const DRAFT_PICK: Field = {
  input: "#selected-pick",
  submit: /^(Lock in|Locking…|Stash it)$/,
};
const HOME_NAME: Field = { input: "#home-name", submit: /^Continue$/ };
const HOME_CODE: Field = {
  input: 'input[aria-label="Room code"]',
  submit: /^(Join|…)$/,
};
const ROOM_NAME: Field = {
  input: 'input[placeholder="Nickname"]',
  submit: /^Join game$/,
};
const TOPIC_CUSTOM: Field = {
  input: 'input[placeholder="Your topic"]',
  submit: /^Lock in$/,
};

type Rect = { top: number; bottom: number; left: number; right: number; h: number; w: number };
type Sample = {
  t: number;
  kbOpen: boolean;
  vvH: number;
  pan: number;
  scrollY: number;
  scrollerTop: number;
  appH: string;
  active: string;
  focused: boolean;
  input: Rect | null;
  submit: Rect | null;
  submitText: string | null;
  value: string | null;
  fontSize: number | null;
};
type Frame = {
  t: number;
  inputTop: number | null;
  inputBottom: number | null;
  submitTop: number | null;
  submitBottom: number | null;
  pan: number;
  vvH: number;
  scrollY: number;
  appH: string;
};
type LogEntry = { t: number; type: string; el?: string; vertical?: boolean };
type ClassEntry = { t: number; el: string; inScope: boolean; added: string[]; removed: string[] };
type NodeEntry = { t: number; el: string; inScope: boolean; entry: string[] };
type TapEntry = { t: number; type: string; target: string; appH: string };
type Above = { tracked: number; changed: string[]; removed: string[] };

// --- reporting ---------------------------------------------------------------

type Check = { profile: string; scenario: string; name: string; ok: boolean; detail: string };
const checks: Check[] = [];
const metrics: Record<string, Record<string, unknown>> = {};
let at = { profile: "", scenario: "" };

function begin(p: Profile, scenario: string) {
  at = { profile: p.name, scenario };
  metrics[`${p.name} ${scenario}`] = {};
  console.log(`\n${p.name} · ${scenario}`);
}
function record(key: string, value: unknown) {
  metrics[`${at.profile} ${at.scenario}`]![key] = value;
}
function check(name: string, ok: boolean, detail: string) {
  checks.push({ ...at, name, ok, detail });
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name} — ${detail}`);
}

const q = JSON.stringify;
const r1 = (n: number) => Math.round(n * 10) / 10;
const uniq = <T>(xs: T[]) => Array.from(new Set(xs));
const spread = (xs: number[]) => (xs.length ? Math.max(...xs) - Math.min(...xs) : 0);
const near = (a: number | undefined, b: number | undefined) =>
  a != null && b != null && Math.abs(a - b) <= TOLERANCE_PX;
/** Space between a box's bottom and the keyboard top (negative = covered). */
const clearance = (r: Rect | null, s: { pan: number; vvH: number }) =>
  r ? r1(s.vvH - (r.bottom - s.pan)) : Number.NaN;

// --- page helpers --------------------------------------------------------------

async function ev<T>(page: Page, expr: string): Promise<T> {
  return (await page.evaluate(expr)) as T;
}

function roomCode() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
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
    content: `window.__KB_CONFIG = ${q({ keyboardPx: p.keyboard })};`,
  });
  await ctx.addInitScript({ path: EMULATOR });
  // Desktop WebKit reports env(safe-area-inset-top) = 0; use the phone's.
  await ctx.addInitScript({
    content: `document.addEventListener("DOMContentLoaded", function () {
      var s = document.createElement("style");
      s.textContent = ".room-chrome-safe, .app-safe-top { height: calc(${p.safeTop}px + var(--safe-top-solid-extra) + var(--safe-top-fade)) !important; }";
      document.head.appendChild(s);
    });`,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error(`    pageerror: ${e.message}`));
  return { ctx, page };
}

/** Tags the nearest button whose label matches, walking up from the field. */
async function tagSubmit(page: Page, f: Field) {
  await ev(
    page,
    `(() => {
      document.querySelectorAll("[${SUBMIT_ATTR}]").forEach((el) => el.removeAttribute("${SUBMIT_ATTR}"));
      const re = new RegExp(${q(f.submit.source)});
      let node = document.querySelector(${q(f.input)});
      while (node && node !== document.body) {
        node = node.parentElement;
        const hit = node && [...node.querySelectorAll("button")].find((b) => re.test((b.textContent || "").trim()));
        if (hit) { hit.setAttribute("${SUBMIT_ATTR}", ""); return true; }
      }
      return false;
    })()`,
  );
}

async function sample(page: Page, f: Field): Promise<Sample> {
  await tagSubmit(page, f);
  return ev<Sample>(page, `window.__kbTest.sample(${q(f.input)}, "[${SUBMIT_ATTR}]")`);
}

async function waitKeyboard(page: Page, open: boolean, timeout = 4000) {
  await page.waitForFunction(
    `(() => { const s = window.__kbTest.state(); return s.settled && s.open === ${open} && (${open} ? s.kb > 0 : s.kb === 0); })()`,
    undefined,
    { timeout },
  );
  await sleep(150);
}

async function shot(page: Page, dir: string, name: string, keyboard: boolean) {
  if (keyboard) await ev(page, "window.__kbTest.paintKeyboard(true)");
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
  if (keyboard) await ev(page, "window.__kbTest.paintKeyboard(false)");
}

async function blurField(page: Page) {
  await ev(page, "document.activeElement && document.activeElement.blur && document.activeElement.blur()");
}

// --- shared checks -------------------------------------------------------------

function checkOpen(closed: Sample, open: Sample) {
  check("keyboard opened", open.kbOpen && open.vvH < closed.vvH, `visual viewport ${closed.vvH} → ${open.vvH}px`);
  check("field focused", open.focused, open.active);
  check(
    "field did not move when the keyboard opened",
    near(open.input?.top, closed.input?.top),
    `top ${closed.input?.top} → ${open.input?.top}`,
  );
  check("no pan to reveal the field", open.pan === 0, `pan ${open.pan}px`);
  check(
    "field fully above the keyboard",
    clearance(open.input, open) >= 0,
    `bottom ${open.input?.bottom}, keyboard top ${open.vvH}`,
  );
  check(
    "submit control fully above the keyboard",
    clearance(open.submit, open) >= 0,
    open.submit ? `bottom ${open.submit.bottom}, keyboard top ${open.vvH}` : "not found",
  );
  check("--app-h unchanged by the keyboard", open.appH === closed.appH, `${closed.appH} → ${open.appH}`);
  check("window.scrollY 0", open.scrollY === 0, `scrollY ${open.scrollY}, app scroller ${open.scrollerTop}`);
  check("font-size ≥ 16px", (open.fontSize ?? 0) >= 16, `${open.fontSize}px`);
  record("closed", { input: closed.input, submit: closed.submit, appH: closed.appH });
  record("open", {
    keyboardTop: open.vvH,
    pan: open.pan,
    input: open.input,
    submit: open.submit,
    inputClearance: clearance(open.input, open),
    submitClearance: clearance(open.submit, open),
    fontSize: open.fontSize,
  });
}

type Typed = {
  frames: Frame[];
  log: LogEntry[];
  classes: ClassEntry[];
  nodes: NodeEntry[];
  tracked: number;
  aboveChanged: string[];
  aboveRemoved: string[];
  animations: string[];
};

/**
 * Types one character at a time while the emulator traces every frame;
 * after each key, re-checks the layout boxes above the field.
 */
async function typeWhileTracing(
  page: Page,
  f: Field,
  text: string,
  hooks: { afterKey?: (index: number) => Promise<void>; afterTyping?: () => Promise<void> } = {},
): Promise<Typed> {
  await ev(page, `window.__kbTest.startTrace(${q(f.input)}, "[${SUBMIT_ATTR}]")`);
  const logStart = await ev<number>(page, "window.__kbTest.log.length");
  const classStart = await ev<number>(page, "window.__kbTest.classLog.length");
  const nodeStart = await ev<number>(page, "window.__kbTest.nodeLog.length");
  const changed = new Set<string>();
  const removed = new Set<string>();
  const animations = new Set<string>();
  let tracked = 0;
  const probe = async () => {
    const above = await ev<Above>(page, "window.__kbTest.checkAbove()");
    tracked = above.tracked;
    above.changed.forEach((c) => changed.add(c));
    above.removed.forEach((c) => removed.add(c));
    for (const a of await ev<string[]>(page, `window.__kbTest.animationsOn(${q(f.input)})`))
      animations.add(a);
  };
  for (let i = 0; i < text.length; i++) {
    await page.keyboard.type(text[i]!);
    await sleep(40);
    if (hooks.afterKey) await hooks.afterKey(i);
    await probe();
  }
  if (hooks.afterTyping) await hooks.afterTyping();
  await sleep(250);
  await probe();
  const frames = await ev<Frame[]>(page, "window.__kbTest.stopTrace()");
  return {
    frames,
    log: (await ev<LogEntry[]>(page, "window.__kbTest.log")).slice(logStart),
    classes: (await ev<ClassEntry[]>(page, "window.__kbTest.classLog")).slice(classStart),
    nodes: (await ev<NodeEntry[]>(page, "window.__kbTest.nodeLog")).slice(nodeStart),
    tracked,
    aboveChanged: [...changed],
    aboveRemoved: [...removed],
    animations: [...animations],
  };
}

function checkTyping(closed: Sample, typed: Typed) {
  const frames = typed.frames.filter((fr) => fr.inputTop != null && fr.inputBottom != null);
  if (frames.length === 0) {
    check("field traced while typing", false, "no frames");
    return;
  }
  const tops = frames.map((fr) => fr.inputTop!);
  const screenTops = frames.map((fr) => fr.inputTop! - fr.pan);
  const inputClear = Math.min(...frames.map((fr) => fr.vvH - (fr.inputBottom! - fr.pan)));
  const withSubmit = frames.filter((fr) => fr.submitBottom != null);
  const submitClear = withSubmit.length
    ? Math.min(...withSubmit.map((fr) => fr.vvH - (fr.submitBottom! - fr.pan)))
    : Number.NaN;
  const submitTops = withSubmit.map((fr) => fr.submitTop!);
  const pans = uniq(frames.map((fr) => fr.pan));
  const scrollYs = uniq(frames.map((fr) => fr.scrollY));
  const appHs = uniq(frames.map((fr) => fr.appH));
  const vvHs = uniq(frames.map((fr) => fr.vvH));
  const scrolls = typed.log.filter(
    (l) =>
      l.type === "window.scrollTo" ||
      l.type === "scrollIntoView" ||
      l.type === "set.scrollTop" ||
      ((l.type === "el.scrollTo" || l.type === "el.scrollBy") && l.vertical),
  );
  const entryClasses = typed.classes.filter((c) => c.added.some((a) => ENTRY_CLASS.test(a)));
  const entryNodes = typed.nodes.filter((n) => n.entry.length > 0);
  const outside = typed.classes.filter((c) => !c.inScope);

  check(
    "field top constant every frame (±1px)",
    spread(tops) <= TOLERANCE_PX && spread(screenTops) <= TOLERANCE_PX,
    `${frames.length} frames, top ${r1(Math.min(...screenTops))}–${r1(Math.max(...screenTops))} on screen`,
  );
  check(
    "submit control never moves",
    withSubmit.length > 0 && spread(submitTops) <= TOLERANCE_PX,
    withSubmit.length ? `top ${r1(Math.min(...submitTops))}–${r1(Math.max(...submitTops))}` : "not found",
  );
  check("field bottom ≤ visualViewport.height", inputClear >= 0, `${r1(inputClear)}px above the keyboard`);
  check(
    "submit bottom ≤ visualViewport.height",
    submitClear >= 0,
    Number.isNaN(submitClear) ? "not found" : `${r1(submitClear)}px above the keyboard`,
  );
  check("keyboard stayed open", vvHs.length === 1 && vvHs[0] < closed.vvH, `visual viewport ${q(vvHs)}`);
  check("no pan (visualViewport.offsetTop 0)", pans.length === 1 && pans[0] === 0, `pans ${q(pans)}`);
  check("window.scrollY stays 0", scrollYs.length === 1 && scrollYs[0] === 0, `scrollY ${q(scrollYs)}`);
  check("--app-h never changes", appHs.length === 1 && appHs[0] === closed.appH, q(appHs));
  check(
    "nothing above the field changes height or position",
    typed.aboveChanged.length === 0,
    typed.aboveChanged.length
      ? typed.aboveChanged.slice(0, 4).join("; ")
      : `${typed.tracked} layout boxes tracked`,
  );
  check(
    "no animation on the field or its wrappers",
    typed.animations.length === 0,
    typed.animations.join(", ") || "none",
  );
  check(
    "no enter-animation class re-added",
    entryClasses.length === 0 && entryNodes.length === 0,
    entryClasses.length || entryNodes.length
      ? [...entryClasses.map((c) => `${c.el} +${c.added.join(" +")}`), ...entryNodes.map((n) => n.entry.join(","))]
          .slice(0, 4)
          .join("; ")
      : `${typed.classes.length} class changes, none an enter animation`,
  );
  check(
    "no programmatic vertical scroll",
    scrolls.length === 0,
    scrolls.length ? scrolls.slice(0, 4).map((s) => `${s.type} ${s.el ?? ""}`).join("; ") : "none",
  );
  record("typing", {
    frames: frames.length,
    inputTopOnScreen: [r1(Math.min(...screenTops)), r1(Math.max(...screenTops))],
    keyboardTop: vvHs,
    inputClearance: r1(inputClear),
    submitClearance: Number.isNaN(submitClear) ? null : r1(submitClear),
    pans,
    scrollY: scrollYs,
    appH: appHs,
    layoutBoxesTracked: typed.tracked,
    layoutBoxesChanged: typed.aboveChanged.length,
    nodesRemovedAbove: typed.aboveRemoved.length,
    classChangesOutsideField: outside.map((c) => `${c.el} ${c.added.map((a) => `+${a}`).join(" ")} ${c.removed.map((a) => `-${a}`).join(" ")}`.trim()),
    enterAnimationAdds: entryClasses.length + entryNodes.length,
    verticalScrollCalls: scrolls.length,
  });
}

/** One touch tap at the centre of the field's submit control. */
async function tapSubmit(
  page: Page,
  f: Field,
  label: string,
  landed: () => Promise<boolean>,
  opts: { keepsFocus: boolean },
) {
  const before = await sample(page, f);
  if (!before.submit) {
    check(`“${label}” present`, false, "not found");
    return { ok: false, before, after: before };
  }
  const tapStart = await ev<number>(page, "window.__kbTest.tapLog.length");
  const x = Math.round(before.submit.left + before.submit.w / 2);
  const y = Math.round(before.submit.top + before.submit.h / 2);
  await page.touchscreen.tap(x, y);
  const ok = await landed();
  const events = (await ev<TapEntry[]>(page, "window.__kbTest.tapLog")).slice(tapStart);
  const click = events.find((e) => e.type === "click");
  check(`one tap on “${label}” submits`, ok, `click target ${click ? click.target : "none"}`);
  let after = before;
  if (opts.keepsFocus) {
    await sleep(200);
    after = await sample(page, f);
    check(`field keeps focus and keyboard after “${label}”`, after.focused && after.kbOpen, `active ${after.active}`);
    check(
      `“${label}” did not move under the finger`,
      near(after.submit?.top, before.submit.top),
      `top ${before.submit.top} → ${after.submit?.top}`,
    );
  }
  record(`tap ${label}`, {
    landed: ok,
    visibleAboveKeyboard: clearance(before.submit, before) >= 0,
    events: events.map((e) => `${e.type}→${e.target} (--app-h ${e.appH})`),
  });
  if (!ok && REPORT_ONLY) {
    await page.touchscreen.tap(x, y);
    record(`tap ${label} second tap landed`, await landed());
  }
  return { ok, before, after };
}

async function closeAndCheckRestore(page: Page, f: Field, closed: Sample) {
  await blurField(page);
  await waitKeyboard(page, false);
  await sleep(400);
  const after = await sample(page, f);
  check("keyboard closed", !after.kbOpen && after.vvH === closed.vvH, `visual viewport ${after.vvH}px`);
  check(
    "layout restored exactly",
    near(after.input?.top, closed.input?.top) && after.appH === closed.appH,
    `top ${closed.input?.top} → ${after.input?.top}, --app-h ${closed.appH} → ${after.appH}`,
  );
  check("no leftover offset", after.scrollY === 0 && after.pan === 0, `scrollY ${after.scrollY}, pan ${after.pan}`);
  record("restored", { input: after.input, appH: after.appH, scrollY: after.scrollY, pan: after.pan });
  return after;
}

/**
 * Baseline with the keyboard closed, then open it with a tap and check the
 * field is still and clear. Leaves the keyboard open.
 */
async function openField(page: Page, f: Field, dir: string, name: string, scope: string | null) {
  await page.locator(f.input).waitFor();
  await sleep(300);
  const closed = await sample(page, f);
  await ev(page, `window.__kbTest.markAbove(${q(f.input)})`);
  await ev(page, `window.__kbTest.watch(${q(scope)})`);
  await shot(page, dir, `${name}-1-closed`, false);
  await page.tap(f.input);
  await waitKeyboard(page, true);
  const open = await sample(page, f);
  checkOpen(closed, open);
  await shot(page, dir, `${name}-2-keyboard`, true);
  return closed;
}

// --- draft room ----------------------------------------------------------------

async function startRoom(page: Page, bots: SmokeClient[], code: string) {
  await page.goto(`${BASE}/room/${code}?name=Luke`);
  await page.locator('[data-diag="lobby-start"]').waitFor({ timeout: 30000 });
  for (const name of ["Ana", "Ben"]) {
    const bot = new SmokeClient(PARTY, code, `${name.toLowerCase()}-${code}`, name);
    bots.push(bot);
    await bot.connect();
    await bot.join();
  }
  await page.getByRole("button", { name: "Start game" }).click();
  await bots[0]!.waitPhase("TOPIC_SELECTION");
}

function draftTable(bots: SmokeClient[]) {
  const watcher = bots[0]!;
  const lukeId = () => watcher.state?.players.find((pl) => pl.name === "Luke")?.id ?? "";
  const lukePicks = () =>
    watcher.state?.picks.filter((pk) => pk.playerId === lukeId()).length ?? 0;
  const lukeUp = () => watcher.state?.phase === "DRAFT" && watcher.draftTurnId() === lukeId();
  async function botPick(tag: string) {
    const bot = bots.find((b) => b.youId === watcher.draftTurnId());
    if (!bot || watcher.state?.phase !== "DRAFT") return false;
    const before = watcher.state.picks.length;
    bot.send({ type: "lock_in", text: `${bot.name} ${tag} ${Math.random().toString(36).slice(2, 6)}` });
    await watcher.wait(() => (watcher.state?.picks.length ?? 0) > before, 5000, "bot pick");
    await sleep(250);
    return true;
  }
  async function advanceToLuke() {
    for (let guard = 0; guard < 8 && !lukeUp(); guard++) {
      if (!(await botPick("adv"))) break;
    }
    await sleep(300);
    return lukeUp();
  }
  const lukeLanded = (count: number) => async () => {
    try {
      await watcher.wait(() => lukePicks() > count, 2500, "Luke pick");
      return true;
    } catch {
      return false;
    }
  };
  return { watcher, lukeId, lukePicks, lukeUp, botPick, advanceToLuke, lukeLanded };
}

async function draftScenario(browser: Browser, p: Profile, dir: string) {
  begin(p, "draft pick");
  const { ctx, page } = await newPage(browser, p);
  const bots: SmokeClient[] = [];
  try {
    await startRoom(page, bots, roomCode());
    const topicId = bots[0]!.state!.topicOptions![0]!.id;
    for (const b of bots) b.send({ type: "vote_topic", topicId });
    await page.locator(".topic-choice").first().click();
    await bots[0]!.waitPhase("DRAFT");
    await page.locator(DRAFT_PICK.input).waitFor();
    await sleep(900);
    const table = draftTable(bots);

    // Typing must happen on someone else's turn so broadcasts land mid-word.
    if (table.lukeUp()) {
      const count = table.lukePicks();
      await page.tap(DRAFT_PICK.input);
      await waitKeyboard(page, true);
      await page.keyboard.type("Opening pick");
      await sample(page, DRAFT_PICK);
      await page.tap(`[${SUBMIT_ATTR}]`);
      if (!(await table.lukeLanded(count)())) await page.tap(`[${SUBMIT_ATTR}]`);
      await table.lukeLanded(count)();
      await blurField(page);
      await waitKeyboard(page, false);
      await sleep(600);
    }

    const closed = await openField(page, DRAFT_PICK, dir, "draft", ".draft-composer");
    await ev(page, `window.__kbTest.mark("panel", ".phase-panel")`);

    const typed = await typeWhileTracing(page, DRAFT_PICK, TYPED, {
      // Two other players lock picks mid-word; then the turn comes to Luke.
      afterKey: async (i) => {
        if (i === 4 || i === 9) await table.botPick(`k${i}`);
      },
      afterTyping: async () => {
        await table.advanceToLuke();
      },
    });
    const end = await sample(page, DRAFT_PICK);
    check("typed text landed in the field", end.value === TYPED, q(end.value));
    checkTyping(closed, typed);
    const panelSame = await ev<boolean>(page, `window.__kbTest.same("panel", ".phase-panel")`);
    const settled = await ev<boolean>(
      page,
      `!!document.querySelector(".phase-panel") && document.querySelector(".phase-panel").classList.contains("motion-settled")`,
    );
    check("phase panel never remounted or re-animated", panelSame && settled, `same node ${panelSame}, settled ${settled}`);
    await shot(page, dir, "draft-3-typed", true);

    if (!table.lukeUp()) {
      check("turn reached Luke", false, `phase ${table.watcher.state?.phase}`);
      return;
    }
    check("submit reads “Lock in” on Luke's turn", end.submitText === "Lock in", q(end.submitText));
    await tapSubmit(page, DRAFT_PICK, "Lock in", table.lukeLanded(table.lukePicks()), { keepsFocus: true });

    // Stash it on someone else's turn; Enter/Go on Luke's next turn.
    let stashed = false;
    let entered = false;
    for (let guard = 0; guard < 10 && !(stashed && entered); guard++) {
      if (table.watcher.state?.phase !== "DRAFT") break;
      if (table.lukeUp()) {
        if (entered) break;
        const count = table.lukePicks();
        await page.locator(DRAFT_PICK.input).fill("");
        await page.keyboard.type("Big Ben");
        await page.keyboard.press("Enter");
        const ok = await table.lukeLanded(count)();
        const after = await sample(page, DRAFT_PICK);
        check("Enter / Go submits the pick", ok, `value after ${q(after.value)}`);
        check("field keeps focus after Enter / Go", after.focused && after.kbOpen, after.active);
        entered = true;
      } else if (!stashed) {
        await page.locator(DRAFT_PICK.input).fill("");
        await page.keyboard.type("Marmalade");
        const before = await sample(page, DRAFT_PICK);
        check("submit reads “Stash it” off turn", before.submitText === "Stash it", q(before.submitText));
        await tapSubmit(
          page,
          DRAFT_PICK,
          "Stash it",
          async () => {
            try {
              await page.locator(".stash-chip", { hasText: "Marmalade" }).waitFor({ timeout: 1500 });
              return true;
            } catch {
              return false;
            }
          },
          { keepsFocus: true },
        );
        const after = await sample(page, DRAFT_PICK);
        check("stash row renders below the field", near(after.input?.top, before.input?.top), `top ${before.input?.top} → ${after.input?.top}`);
        await shot(page, dir, "draft-4-stash", true);
        stashed = true;
      } else {
        await table.botPick("loop");
      }
    }
    if (!stashed) check("Stash it exercised", false, "never off turn");
    if (!entered) check("Enter / Go exercised", false, "no turn left");

    await closeAndCheckRestore(page, DRAFT_PICK, closed);
    await shot(page, dir, "draft-5-closed-again", false);

    // A stash chip locks with one tap on Luke's turn, keyboard open.
    if (await page.locator(".stash-chip", { hasText: "Marmalade" }).count()) {
      await page.tap(DRAFT_PICK.input);
      await waitKeyboard(page, true);
      if (await table.advanceToLuke()) {
        const count = table.lukePicks();
        const chip = page.locator(".stash-chip", { hasText: "Marmalade" });
        const box = (await chip.boundingBox())!;
        await page.touchscreen.tap(Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2));
        const ok = await table.lukeLanded(count)();
        const last = table.watcher.state?.picks.filter((pk) => pk.playerId === table.lukeId()).at(-1);
        check("one tap on a stash chip locks it", ok && last?.text === "Marmalade", `pick ${q(last?.text)}`);
        // The draft's final pick unmounts the composer; focus has nowhere to stay.
        if (table.watcher.state?.phase === "DRAFT") {
          await sleep(200);
          const after = await sample(page, DRAFT_PICK);
          check("field keeps focus after the chip tap", after.focused && after.kbOpen, after.active);
        }
      }
    }
  } finally {
    for (const b of bots) b.close();
    await ctx.close();
  }
}

// --- other fields --------------------------------------------------------------

async function homeScenario(browser: Browser, p: Profile, dir: string) {
  begin(p, "home nickname");
  const { ctx, page } = await newPage(browser, p);
  const room = roomCode();
  const host = new SmokeClient(PARTY, room, `host-${room}`, "Host");
  try {
    await page.goto(`${BASE}/`);
    const closed = await openField(page, HOME_NAME, dir, "home-name", null);
    const typed = await typeWhileTracing(page, HOME_NAME, TYPED);
    const end = await sample(page, HOME_NAME);
    check("typed text landed in the field", end.value === TYPED, q(end.value));
    checkTyping(closed, typed);
    await shot(page, dir, "home-name-3-typed", true);
    await tapSubmit(
      page,
      HOME_NAME,
      "Continue",
      async () => {
        try {
          await page.getByRole("button", { name: "Create game" }).waitFor({ timeout: 1500 });
          return true;
        } catch {
          return false;
        }
      },
      { keepsFocus: false },
    );
    await waitKeyboard(page, false);
    await sleep(400);
    const appH = await ev<string>(page, `getComputedStyle(document.documentElement).getPropertyValue("--app-h").trim()`);
    check("--app-h restored after the field unmounts", appH === closed.appH, `${closed.appH} → ${appH}`);

    begin(p, "home room code");
    await host.connect();
    await host.join();
    const codeClosed = await openField(page, HOME_CODE, dir, "home-code", null);
    const codeTyped = await typeWhileTracing(page, HOME_CODE, room);
    const codeEnd = await sample(page, HOME_CODE);
    check("typed code landed in the field", codeEnd.value === room, q(codeEnd.value));
    checkTyping(codeClosed, codeTyped);
    await closeAndCheckRestore(page, HOME_CODE, codeClosed);
    await page.tap(HOME_CODE.input);
    await waitKeyboard(page, true);
    await tapSubmit(
      page,
      HOME_CODE,
      "Join",
      async () => {
        try {
          await page.waitForURL(new RegExp(`/room/${room}`), { timeout: 4000 });
          return true;
        } catch {
          return false;
        }
      },
      { keepsFocus: false },
    );
  } finally {
    host.close();
    await ctx.close();
  }
}

async function roomLinkScenario(browser: Browser, p: Profile, dir: string) {
  begin(p, "room-link nickname");
  const code = roomCode();
  const host = new SmokeClient(PARTY, code, `host-${code}`, "Host");
  const { ctx, page } = await newPage(browser, p);
  try {
    await host.connect();
    await host.join();
    await page.goto(`${BASE}/room/${code}`);
    const closed = await openField(page, ROOM_NAME, dir, "room-name", null);
    const typed = await typeWhileTracing(page, ROOM_NAME, TYPED);
    const end = await sample(page, ROOM_NAME);
    check("typed text landed in the field", end.value === TYPED, q(end.value));
    checkTyping(closed, typed);
    await tapSubmit(
      page,
      ROOM_NAME,
      "Join game",
      async () => {
        try {
          await host.wait(() => !!host.state?.players.some((pl) => pl.name === TYPED), 2500, "joined");
          return true;
        } catch {
          return false;
        }
      },
      { keepsFocus: false },
    );
  } finally {
    host.close();
    await ctx.close();
  }
}

async function topicScenario(browser: Browser, p: Profile, dir: string) {
  begin(p, "custom topic");
  const { ctx, page } = await newPage(browser, p);
  const bots: SmokeClient[] = [];
  try {
    await startRoom(page, bots, roomCode());
    await page.locator(".topic-choice-custom-toggle").waitFor();
    await sleep(900);
    await page.tap(".topic-choice-custom-toggle");
    await page.locator(TOPIC_CUSTOM.input).waitFor();
    // The toggle tap autofocuses the field; start from a closed keyboard.
    await sleep(600);
    await blurField(page);
    await waitKeyboard(page, false).catch(() => undefined);
    await sleep(500);
    const closed = await openField(page, TOPIC_CUSTOM, dir, "topic-custom", null);
    const typed = await typeWhileTracing(page, TOPIC_CUSTOM, TYPED);
    const end = await sample(page, TOPIC_CUSTOM);
    check("typed text landed in the field", end.value === TYPED, q(end.value));
    checkTyping(closed, typed);
    await tapSubmit(
      page,
      TOPIC_CUSTOM,
      "Lock in",
      async () => {
        try {
          await bots[0]!.wait(() => bots[0]!.state?.selectedTopic?.text === TYPED, 2500, "custom topic");
          return true;
        } catch {
          return false;
        }
      },
      { keepsFocus: false },
    );
  } finally {
    for (const b of bots) b.close();
    await ctx.close();
  }
}

// --- main ----------------------------------------------------------------------

/** A crash fails the scenario that was running and moves on to the next. */
async function guarded(run: () => Promise<void>) {
  try {
    await run();
  } catch (e) {
    check("scenario ran to completion", false, e instanceof Error ? e.message.split("\n")[0]! : String(e));
  }
}

(async () => {
  mkdirSync(OUT, { recursive: true });
  const browser = await webkit.launch();
  try {
    for (const p of PROFILES) {
      if (ONLY && p.name !== ONLY) continue;
      const dir = path.join(OUT, p.name);
      mkdirSync(dir, { recursive: true });
      await guarded(() => draftScenario(browser, p, dir));
      await guarded(() => homeScenario(browser, p, dir));
      await guarded(() => roomLinkScenario(browser, p, dir));
      await guarded(() => topicScenario(browser, p, dir));
    }
  } finally {
    await browser.close();
  }
  const failed = checks.filter((c) => !c.ok);
  writeFileSync(
    path.join(OUT, "report.json"),
    JSON.stringify({ base: BASE, profiles: PROFILES, checks, metrics }, null, 2),
  );
  console.log(
    `\n${checks.length - failed.length}/${checks.length} checks passed · report ${path.join(OUT, "report.json")}`,
  );
  if (failed.length) {
    for (const c of failed) console.log(`  FAIL ${c.profile} ${c.scenario}: ${c.name} — ${c.detail}`);
    if (!REPORT_ONLY) process.exit(1);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
