/**
 * Host must be able to change rounds (3–6) and topic vibe any number of
 * times on the first topic screen. A shared actionId used to eat every
 * tap after the first.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Connection } from "partyserver";
import { describe, expect, it } from "vitest";
import { createTestServer } from "../../../test/party-server-harness";
import { gestureKeyFor } from "../../hooks/useGameRoom";

const topic = readFileSync(
  resolve(__dirname, "../../components/TopicPanel.tsx"),
  "utf8",
);
const hook = readFileSync(
  resolve(__dirname, "../../hooks/useGameRoom.ts"),
  "utf8",
);

function hostConn(sent: unknown[] = []) {
  return {
    id: "A",
    send(payload: string) {
      sent.push(JSON.parse(payload));
    },
  } as unknown as Connection;
}

function topicRoom() {
  const sent: unknown[] = [];
  const conn = hostConn(sent);
  const { server } = createTestServer("TPC1", { connections: [conn] });
  server.state.players = ["A", "B"].map((id, seat) => ({
    id,
    name: id,
    seat,
    connected: true,
    isHost: seat === 0,
    role: "player" as const,
    stones: 0,
    joinedAt: 1,
  }));
  server.state.seatOrder = ["A", "B"];
  server.state.rosterLocked = true;
  server.state.phase = "TOPIC_SELECTION";
  server.state.topicRound = 0;
  server.state.configuredTopicRounds = 3;
  server.state.settings.topicVibe = "all";
  return { server, conn, sent };
}

describe("topic reselect contracts", () => {
  it("keys each round and vibe choice separately so taps are not deduped", () => {
    expect(hook).toMatch(/set_topic_rounds:\$\{rev\}:\$\{msg\.rounds\}/);
    expect(hook).toMatch(/update_settings:\$\{rev\}:\$\{vibe\}/);
    expect(topic).toMatch(/pendingRounds/);
    expect(topic).toMatch(/pendingVibe/);
    expect(topic).toMatch(/Last tap wins/);
    expect(topic).not.toMatch(/setPendingRounds\(null\)/);
    expect(topic).not.toMatch(/setPendingVibe\(null\)/);
    expect(topic).toMatch(/data-rounds=\{n\}/);
    expect(topic).toMatch(/data-vibe=\{value\}/);
    expect(topic).not.toMatch(/topic-rounds-chip[\s\S]{0,400}disabled/);
    expect(topic).not.toMatch(/topic-vibe-chip[\s\S]{0,400}disabled/);
  });

  it("server accepts every distinct round chip, rejects a reused actionId", async () => {
    const { server, conn } = topicRoom();
    assert.deepEqual(server.state.processedActionIds, []);
    let seq = 0;
    for (const n of [4, 5, 6, 3, 4]) {
      seq += 1;
      await server.onMessage(
        conn,
        JSON.stringify({
          type: "set_topic_rounds",
          rounds: n,
          actionId: `round-chip-${seq}-${n}`,
        }),
      );
      assert.equal(
        server.state.configuredTopicRounds,
        n,
        `n=${n} ids=${server.state.processedActionIds.join(",")}`,
      );
    }
    const stuckId = "round-chip-2-5";
    assert.equal(server.seenAction(stuckId), true);
    await server.onMessage(
      conn,
      JSON.stringify({
        type: "set_topic_rounds",
        rounds: 6,
        actionId: stuckId,
      }),
    );
    assert.equal(server.state.configuredTopicRounds, 4);
    expect(gestureKeyFor({ type: "set_topic_rounds", rounds: 5 }, 0)).not.toBe(
      gestureKeyFor({ type: "set_topic_rounds", rounds: 4 }, 0),
    );
  });

  it("server accepts vibe switches back and forth", async () => {
    const { server, conn } = topicRoom();
    for (const vibe of ["sports", "basic", "all", "geography", "sports"] as const) {
      await server.onMessage(
        conn,
        JSON.stringify({
          type: "update_settings",
          settings: { topicVibe: vibe },
          actionId: `vibe-${vibe}-${Math.random()}`,
        }),
      );
      assert.equal(server.state.settings.topicVibe, vibe);
    }
    const firstId = "vibe-once";
    await server.onMessage(
      conn,
      JSON.stringify({
        type: "update_settings",
        settings: { topicVibe: "animals" },
        actionId: firstId,
      }),
    );
    assert.equal(server.state.settings.topicVibe, "animals");
    await server.onMessage(
      conn,
      JSON.stringify({
        type: "update_settings",
        settings: { topicVibe: "basic" },
        actionId: firstId,
      }),
    );
    assert.equal(
      server.state.settings.topicVibe,
      "animals",
      "reused actionId must not flip vibe",
    );
  });
});
