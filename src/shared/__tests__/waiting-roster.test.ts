import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { emptyRoomState } from "../types";
import { projectPublicState } from "../engine/public-state";

const waiting = readFileSync(
  resolve(__dirname, "../../components/WaitingRoster.tsx"),
  "utf8",
);
const vote = readFileSync(
  resolve(__dirname, "../../components/VotePanel.tsx"),
  "utf8",
);
const wager = readFileSync(
  resolve(__dirname, "../../components/WagerPanel.tsx"),
  "utf8",
);
const score = readFileSync(
  resolve(__dirname, "../../components/ScorePanel.tsx"),
  "utf8",
);
const room = readFileSync(
  resolve(__dirname, "../../components/RoomClient.tsx"),
  "utf8",
);
const settings = readFileSync(
  resolve(__dirname, "../../components/SettingsSheet.tsx"),
  "utf8",
);
const admin = readFileSync(
  resolve(__dirname, "../../components/AdminPanel.tsx"),
  "utf8",
);
const css = readFileSync(
  resolve(__dirname, "../../app/globals.css"),
  "utf8",
);

describe("waiting roster", () => {
  it("projects voted/ready ids without leaking ballot maps", () => {
    const state = emptyRoomState("WAIT");
    state.players = [
      {
        id: "a",
        name: "Ada",
        stones: 40,
        connected: true,
        isHost: true,
        role: "player",
        seat: 0,
        joinedAt: 1,
      },
      {
        id: "b",
        name: "Bea",
        stones: 30,
        connected: true,
        isHost: false,
        role: "player",
        seat: 1,
        joinedAt: 1,
      },
      {
        id: "c",
        name: "Cal",
        stones: 20,
        connected: true,
        isHost: false,
        role: "player",
        seat: 2,
        joinedAt: 1,
      },
    ];
    state.seatOrder = ["a", "b", "c"];
    state.humanVotes = { a: "b" };
    state.bankBeansReady = { a: true, c: true };

    const pub = projectPublicState(state, "a");
    expect(pub.humanVotedIds).toEqual(["a"]);
    expect(pub.bankBeansReadyIds.sort()).toEqual(["a", "c"]);
    expect(JSON.stringify(pub)).not.toMatch(/"humanVotes"/);
    expect(JSON.stringify(pub)).not.toMatch(/"bankBeansReady"/);
  });

  it("wires WaitingRoster into vote/wager/score waits", () => {
    expect(waiting).toMatch(/waiting-roster-person-done/);
    expect(waiting).toMatch(/FitName/);
    expect(waiting).not.toMatch(/while you wait/i);
    expect(waiting).not.toMatch(/\bTips?\b/);
    expect(vote).toMatch(/WaitingRoster/);
    expect(vote).not.toMatch(/vote-live-hint/);
    expect(wager).toMatch(/WaitingRoster/);
    expect(score).toMatch(/WaitingRoster/);
  });

  it("keeps one status line with count — no duplicate waiting copy", () => {
    expect(waiting).toMatch(/waiting-roster-status/);
    expect(waiting).toMatch(/waiting-roster-count/);
    // Single status construction — not a second "Waiting on" block below avatars
    const waitingOnMatches = waiting.match(/Waiting on/g) ?? [];
    expect(waitingOnMatches.length).toBe(1);
  });

  it("removes standings and divider from the waiting block", () => {
    expect(waiting).not.toMatch(/Standings|standings/);
    expect(waiting).not.toMatch(/waiting-roster-standings/);
    expect(css).not.toMatch(/\.waiting-roster-standings\s*\{/);
  });

  it("uses uniform small avatars: green done + check, neutral waiting", () => {
    expect(waiting).toMatch(/waiting-roster-check/);
    const avatar =
      css.match(/\.waiting-roster-avatar\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(avatar).toMatch(/2\.25rem/);
    const doneAvatar =
      css.match(
        /\.waiting-roster-person-done \.waiting-roster-avatar\s*\{[\s\S]*?\n\}/,
      )?.[0] ?? "";
    expect(doneAvatar).toMatch(/mint|--mint/);
    // No pink/coral waiting circle
    const waitAvatar =
      css.match(
        /\.waiting-roster-person-wait \.waiting-roster-avatar\s*\{[\s\S]*?\n\}/,
      )?.[0] ?? "";
    expect(waitAvatar).not.toMatch(/coral|--coral/);
  });
});

describe("admin chrome", () => {
  it("lives in host settings — no floating ADMIN pill", () => {
    expect(settings).toMatch(/AdminTools/);
    expect(settings).toMatch(/isHost && adminUnlocked/);
    expect(room).not.toMatch(/<AdminPanel/);
    expect(admin).toMatch(/export function AdminTools/);
    // Floating fixed pill removed
    expect(admin).not.toMatch(/fixed bottom-\[max/);
    expect(admin).not.toMatch(/>Admin</);
  });
});

describe("bottom seam", () => {
  it("keeps phase panels transparent; page cream fills past the safe area", () => {
    const phase =
      css.match(/\.phase-panel\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(phase).toMatch(/background:\s*transparent/);
    expect(css).toMatch(
      /body::before[\s\S]*?bottom:\s*calc\(\s*-80px/,
    );
    expect(css).toMatch(
      /body::before[\s\S]*?background-size:\s*100%\s*var\(--app-h/,
    );
    // No white/flat overlay band at the bottom
    expect(css).not.toMatch(/html::after\s*\{/);
    expect(css).not.toMatch(/\.app-shell::after\s*\{/);
  });
});
