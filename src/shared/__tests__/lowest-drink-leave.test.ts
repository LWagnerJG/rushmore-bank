/**
 * Party Mode lowest_drink on ROUND_RESULTS must not soft-lock the table when
 * a drink target permanently leaves. Mirror bust-redo leave: auto-ack the
 * departed target so host next_topic is not blocked forever.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { createTestServer } from "../../../test/party-server-harness";

const START = 1_800_000_000_000;

function resultsRoom() {
  const harness = createTestServer("DRNK");
  const { server } = harness;
  server.state.players = ["A", "B", "C"].map((id, seat) => ({
    id,
    name: id,
    seat,
    connected: true,
    isHost: seat === 0,
    role: "player" as const,
    stones: seat === 1 ? 5 : 20,
    joinedAt: START,
  }));
  server.state.seatOrder = ["A", "B", "C"];
  server.state.rosterLocked = true;
  server.state.phase = "ROUND_RESULTS";
  server.state.settings.partyMode = true;
  server.state.partyPrompt = {
    kind: "lowest_drink",
    targetPlayerIds: ["B"],
    resolved: false,
    acknowledgedPlayerIds: [],
  };
  return { server };
}

describe("lowest_drink leave unblocks ROUND_RESULTS", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => vi.useRealTimers());

  it("auto-acks a departed drink target and clears the prompt", async () => {
    const { server } = resultsRoom();
    server.state.players.find((p) => p.id === "B")!.connected = false;
    await server.handlePlayerLeave("B");
    assert.equal(server.state.partyPrompt, null);
  });

  it("acks one departed target but keeps the prompt when another remains", async () => {
    const { server } = resultsRoom();
    server.state.partyPrompt = {
      kind: "lowest_drink",
      targetPlayerIds: ["B", "C"],
      resolved: false,
      acknowledgedPlayerIds: [],
    };
    server.state.players.find((p) => p.id === "B")!.connected = false;
    await server.handlePlayerLeave("B");
    assert.ok(server.state.partyPrompt);
    assert.equal(server.state.partyPrompt!.kind, "lowest_drink");
    assert.deepEqual(server.state.partyPrompt!.acknowledgedPlayerIds, ["B"]);
    assert.deepEqual(server.state.partyPrompt!.targetPlayerIds, ["B", "C"]);
  });

  it("lets host next_topic after the last drink target leaves", async () => {
    const { server } = resultsRoom();
    server.state.topicRound = 1;
    server.state.configuredTopicRounds = 3;
    server.state.players.find((p) => p.id === "B")!.connected = false;
    await server.handlePlayerLeave("B");
    assert.equal(server.state.partyPrompt, null);
    await server.handleNextTopic("A");
    assert.equal(server.state.phase, "TOPIC_SELECTION");
  });

  it("still blocks next_topic while a connected drink target has not acked", async () => {
    const { server } = resultsRoom();
    await assert.rejects(
      () => server.handleNextTopic("A"),
      /Finish the party drink first/,
    );
    assert.ok(server.state.partyPrompt);
  });
});
