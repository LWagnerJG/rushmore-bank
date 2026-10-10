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
    expect(waiting).toMatch(/Standings/);
    expect(waiting).toMatch(/waiting-roster-person-done/);
    expect(waiting).not.toMatch(/while you wait/i);
    expect(waiting).not.toMatch(/\bTips?\b/);
    expect(vote).toMatch(/WaitingRoster/);
    expect(vote).not.toMatch(/vote-live-hint/);
    expect(wager).toMatch(/WaitingRoster/);
    expect(score).toMatch(/WaitingRoster/);
  });

  it("dims done people via opacity only", () => {
    const css = readFileSync(
      resolve(__dirname, "../../app/globals.css"),
      "utf8",
    );
    const done =
      css.match(/\.waiting-roster-person-done\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(done).toMatch(/opacity:\s*0\.\d+/);
    expect(done).not.toMatch(/filter|blur/);
  });
});
