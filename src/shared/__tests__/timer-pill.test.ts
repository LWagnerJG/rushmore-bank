import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { watchSecondsLeft } from "@/lib/countdown";
import { contrastRatio, mixHex, rootToken, rulesFor } from "./contrast";

const srcDir = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(srcDir, p), "utf8");
const css = read("app/globals.css");
const pill = read("components/TimerPill.tsx");
const clocks = {
  Pick: read("components/RoomClient.tsx"),
  Vote: read("components/VotePanel.tsx"),
  Wager: read("components/WagerPanel.tsx"),
  Dice: read("components/DicePanel.tsx"),
};

function appSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : appSources(p);
    return /\.(tsx?|css)$/.test(e.name) ? [p] : [];
  });
}

describe("watchSecondsLeft", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports each whole second once, one wake per second, then stops", () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const seen: number[] = [];
    watchSecondsLeft(Date.now() + 44_700, (s) => seen.push(s));
    vi.advanceTimersByTime(50_000);
    expect(seen).toEqual(Array.from({ length: 46 }, (_, i) => 45 - i));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports 0 and schedules nothing without a live deadline", () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const seen: number[] = [];
    watchSecondsLeft(null, (s) => seen.push(s));
    watchSecondsLeft(Date.now() - 5, (s) => seen.push(s));
    expect(seen).toEqual([0, 0]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("lands on the true value after a late wake, and cancels cleanly", () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const until = Date.now() + 30_000;
    const seen: number[] = [];
    const stop = watchSecondsLeft(until, (s) => seen.push(s));
    // iOS froze timers while backgrounded: the wall clock moved on.
    vi.setSystemTime(Date.now() + 10_000);
    vi.advanceTimersToNextTimer();
    expect(seen).toHaveLength(2);
    expect(seen[1]).toBe(Math.ceil((until - Date.now()) / 1000));
    stop();
    vi.advanceTimersByTime(60_000);
    expect(seen).toHaveLength(2);
  });
});

describe("one quiet timer", () => {
  it("every in-game clock is the shared pill, each naming what it times", () => {
    expect(clocks.Pick).toMatch(/<TimerPill[\s\S]*?label="Pick"/);
    expect(clocks.Vote).toMatch(/<TimerPill[\s\S]*?label="Vote"/);
    expect(clocks.Wager).toMatch(/<TimerPill[\s\S]*?label="Wager"/);
    expect(clocks.Dice).toMatch(/<TimerPill[\s\S]*?label=\{timerLabel\}/);
  });

  it("retires the four bespoke clocks and their styles", () => {
    const retired =
      /draft-timer-pill|wager-timer|dice-timer\b|DraftBannerClock|DecisionTimer|function Countdown/;
    for (const file of appSources(srcDir)) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(retired);
    }
  });

  it("ticks silently and announces once, when it turns urgent", () => {
    expect(pill).toMatch(/role="timer"/);
    expect(pill).toMatch(/<span aria-hidden="true">/);
    expect(pill.match(/aria-live=/g)).toHaveLength(1);
    expect(pill).toMatch(/urgent \? `\$\{label\}: almost out of time` : ""/);
    expect(pill).not.toMatch(/setInterval/);
    // Only whoever the clock is for hears it.
    expect(clocks.Vote).toMatch(/announce=\{canVote && !myVote\}/);
    expect(clocks.Dice).toMatch(/announce=\{myTurn && timerLive\}/);
    expect(clocks.Pick).toMatch(/announce=\{\s*you\.role === "player" &&/);
  });

  it("urgency is color only — no pulse, scale, or filter", () => {
    for (const body of rulesFor(css, ".timer-pill")) {
      expect(body).not.toMatch(/animation|transform|filter/);
    }
    expect(css).not.toMatch(/@keyframes\s+dice-timer-press/);
  });

  it("holds 4.5:1 on cream and over Party mode's densest mint wash", () => {
    const base = /\n\.timer-pill\s*\{([^}]*)\}/.exec(css)?.[1];
    const textPct = Number(
      /color:\s*color-mix\(in srgb, var\(--text\) (\d+)%, var\(--muted\)\)/.exec(
        base ?? "",
      )?.[1],
    );
    const tint = Number(
      /background:\s*rgba\(35, 72, 62, (0?\.\d+)\)/.exec(base ?? "")?.[1],
    );
    expect(textPct).toBeGreaterThan(0);
    expect(tint).toBeGreaterThan(0);
    const ink = rootToken(css, "text");
    const fg = mixHex(ink, rootToken(css, "muted"), textPct / 100);
    // html.party-on body::before: mint radial at 0.5 over #fff8ec.
    const partyMint = mixHex("#7ed9b8", "#fff8ec", 0.5);
    for (const page of [rootToken(css, "bg"), partyMint]) {
      expect(contrastRatio(fg, mixHex(ink, page, tint))).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it("urgent coral ink holds 4.5:1 on its opaque plate in both palettes", () => {
    const [urgent] = rulesFor(css, ".timer-pill-urgent");
    expect(urgent).toMatch(/color:\s*var\(--coral-ink\)/);
    const platePct = Number(
      /background:\s*color-mix\(in srgb, var\(--coral\) (\d+)%, #fff\)/.exec(
        urgent ?? "",
      )?.[1],
    );
    expect(platePct).toBeGreaterThan(0);
    const partyCoral = /html\.party-on\s*\{[^}]*--coral:\s*(#[0-9a-f]{6})/i.exec(
      css,
    )?.[1];
    expect(partyCoral).toBeDefined();
    for (const coral of [rootToken(css, "coral"), partyCoral!]) {
      const plate = mixHex(coral, "#ffffff", platePct / 100);
      expect(
        contrastRatio(rootToken(css, "coral-ink"), plate),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
