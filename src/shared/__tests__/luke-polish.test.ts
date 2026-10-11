import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlayerRail } from "@/components/PlayerRail";
import { VotePanel, voteWaitLine } from "@/components/VotePanel";
import { projectPublicState } from "@/shared/engine/public-state";
import type { Player, RoomState } from "@/shared/types";
import { emptyRoomState } from "@/shared/types";
import { rulesFor } from "./contrast";

const srcDir = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(srcDir, p), "utf8");
const css = read("app/globals.css");
const railSrc = read("components/PlayerRail.tsx");
const roomSrc = read("components/RoomClient.tsx");
const settingsSrc = read("components/SettingsSheet.tsx");
const staleSrc = read("components/StaleClientGuard.tsx");

function seat(id: string, name: string, stones: number): Player {
  return {
    id,
    name,
    stones,
    connected: true,
    isHost: id === "a",
    role: "player",
    seat: id === "a" ? 0 : id === "b" ? 1 : 2,
    joinedAt: 1,
  };
}

function baseRoom(phase: RoomState["phase"]): RoomState {
  const s = emptyRoomState("LUKE");
  s.phase = phase;
  s.players = [seat("a", "Ada", 48), seat("b", "Bea", 40), seat("c", "Cal", 30)];
  s.seatOrder = ["a", "b", "c"];
  s.scoresLocked = true;
  s.earnedThisRound = { a: 2, b: 10, c: 5 };
  return s;
}

describe("vote: one quiet waiting signal", () => {
  it("builds a single muted line — waiting count + AI next", () => {
    expect(
      voteWaitLine({
        twoPlayer: false,
        votesDone: false,
        judging: true,
        waitingCount: 2,
      }),
    ).toBe("Waiting on 2 · AI scoring next");
    expect(
      voteWaitLine({
        twoPlayer: false,
        votesDone: false,
        judging: false,
        waitingCount: 1,
      }),
    ).toBe("Waiting on 1 · AI scoring next");
    expect(
      voteWaitLine({
        twoPlayer: false,
        votesDone: true,
        judging: true,
        waitingCount: 0,
      }),
    ).toBe("AI scoring…");
    expect(
      voteWaitLine({
        twoPlayer: true,
        votesDone: false,
        judging: true,
        waitingCount: 0,
      }),
    ).toBe("AI scoring…");
  });

  it("renders Vote hero + one status, no avatar strip or AI is calculating", () => {
    const s = baseRoom("VOTING_AND_JUDGING");
    s.humanVotes = { a: "b" };
    s.judgeStatus = "pending";
    const state = projectPublicState(s, "b");
    expect(state.humanVotesNeeded).toBe(3);
    expect(state.humanVotesCast).toBe(1);
    const you = state.players.find((p) => p.id === "b")!;
    const html = renderToStaticMarkup(
      createElement(VotePanel, {
        state,
        you,
        youId: "b",
        send: () => {},
      }),
    );
    expect(html).toMatch(/type-display[^>]*>Vote</);
    expect(html).toMatch(/vote-wait/);
    expect(html).toMatch(/Waiting on 2 · AI scoring next/);
    expect(html).not.toMatch(/waiting-roster/);
    expect(html).not.toMatch(/AI is calculating/);
    expect(html).not.toMatch(/judge-working/);
  });
});

describe("score source: pending +earned only before wager applies", () => {
  it("shows +earned on SCORE_REVEAL; wager folds earned into one total", () => {
    expect(railSrc).toMatch(
      /const showEarned = state\.phase === "SCORE_REVEAL"/,
    );
    expect(railSrc).not.toMatch(/scoresLocked\s*\|\|/);

    const reveal = projectPublicState(baseRoom("SCORE_REVEAL"), "a");
    const revealHtml = renderToStaticMarkup(
      createElement(PlayerRail, { state: reveal, youId: "a" }),
    );
    expect(revealHtml).toMatch(/\+2/);
    expect(revealHtml).toMatch(/>48</);

    // ROUND_RESULTS: same stones, scoresLocked still true — must NOT show +2
    // (that was the 50-vs-48 disagreement when rail stayed mounted).
    const results = projectPublicState(baseRoom("ROUND_RESULTS"), "a");
    const resultsHtml = renderToStaticMarkup(
      createElement(PlayerRail, { state: results, youId: "a" }),
    );
    expect(resultsHtml).toMatch(/>48</);
    expect(resultsHtml).not.toMatch(/\+2/);
  });

  it("unmounts the rail on ROUND_RESULTS so the reveal list is the only score", () => {
    expect(roomSrc).toMatch(/phase !== "ROUND_RESULTS"/);
    expect(roomSrc).toMatch(/phase !== "GAME_RESULTS"/);
  });
});

describe("wager rail: one clear total (no unlabeled split)", () => {
  it("shows a single total on wager — Safe/Risking stay on the dice rail", () => {
    const s = baseRoom("WAGER_SELECTION");
    s.pots = { a: 10, b: 0, c: 5 };
    s.protectedStones = { a: 40, b: 50, c: 30 };
    s.diceActiveIds = ["a", "b", "c"];
    const state = projectPublicState(s, "a");
    const html = renderToStaticMarkup(
      createElement(PlayerRail, { state, youId: "a" }),
    );
    expect(html).not.toMatch(/player-chip-split/);
    expect(html).not.toMatch(/>Safe</);
    expect(html).not.toMatch(/>Risking</);
    expect(html).toMatch(/player-chip-stones/);
    // You tile uses on-coral text (AA on btn-bg)
    expect(css).toMatch(/--on-coral/);
    expect(css).toMatch(/\.player-chip-you[^{]*\{[^}]*color:\s*var\(--on-coral\)/);
  });
});

describe("settings: spacing instead of hard dividers", () => {
  it("drops border-top hairlines on settings rows and admin tools", () => {
    const row = rulesFor(css, ".settings-row").join("\n");
    expect(row).not.toMatch(/border-top/);
    expect(row).not.toMatch(/border:/);
    const admin = rulesFor(css, ".admin-tools").join("\n");
    expect(admin).not.toMatch(/border-top/);
    expect(settingsSrc).toMatch(/settings-row/);
    expect(settingsSrc).toMatch(/Host options/);
    expect(settingsSrc).toMatch(/setPanel\("admin"\)|setPanel\('admin'\)/);
  });

  it("covers the full viewport including safe-area with the sheet backdrop", () => {
    const backdrop = rulesFor(css, ".settings-sheet-backdrop").join("\n");
    expect(backdrop).toMatch(/position:\s*fixed/);
    expect(backdrop).toMatch(/bottom:\s*-120px/);
    expect(backdrop).toMatch(/100lvh|100dvh/);
    expect(backdrop).toMatch(/safe-area-inset-bottom/);
    expect(backdrop).toMatch(/overflow:\s*visible/);
    expect(backdrop).not.toMatch(/overflow:\s*hidden/);
    // Solid dim — translucent let cream show through on iOS
    expect(backdrop).toMatch(/background:\s*#2a4a40/);
    expect(backdrop).not.toMatch(/rgba\(\s*35,\s*72,\s*62/);
    expect(settingsSrc).toMatch(/createPortal/);
    expect(settingsSrc).toMatch(/settings-sheet-open/);
    expect(css).toMatch(/html\.settings-sheet-open/);
    expect(css).toMatch(/margin-bottom:\s*120px/);
  });
});

describe("update banner: never covers draft chrome", () => {
  it("anchors the toast to the bottom safe area, not a fixed top band", () => {
    const banner = rulesFor(css, ".stale-client-banner").join("\n");
    expect(banner).toMatch(/position:\s*fixed/);
    expect(banner).toMatch(/bottom:\s*max\(/);
    expect(banner).toMatch(/safe-area-inset-bottom/);
    expect(banner).not.toMatch(/(^|;)\s*top:\s*0/);
    expect(staleSrc).toMatch(/stale-client-banner/);
  });
});
