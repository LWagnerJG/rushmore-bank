/**
 * Topic and human ballots are last-write-wins, but they used to skip
 * phaseRevision bumps. Client gestureKeys are vote_topic:${rev}:${id} /
 * submit_vote:${rev}:${target}, so A→B→A reused the burned actionId for A
 * and the server no-op'd — UI stuck on B. Same class as rounds/vibe (#topic
 * reselect) and avatar/host-clock bumps.
 */
import assert from "node:assert/strict";
import type { Connection } from "partyserver";
import { describe, expect, it } from "vitest";
import { createTestServer } from "../../../test/party-server-harness";
import { gestureKeyFor } from "../../hooks/useGameRoom";

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
  const { server } = createTestServer("VTPC", { connections: [conn] });
  server.state.players = ["A", "B", "C"].map((id, seat) => ({
    id,
    name: id,
    seat,
    connected: true,
    isHost: seat === 0,
    role: "player" as const,
    stones: 0,
    joinedAt: seat + 1,
  }));
  server.state.seatOrder = ["A", "B", "C"];
  server.state.rosterLocked = true;
  server.state.phase = "TOPIC_SELECTION";
  server.state.topicRound = 0;
  server.state.topicOptions = [
    { id: "t1", text: "One", scope: "everyday", scopeBoundary: "" },
    { id: "t2", text: "Two", scope: "everyday", scopeBoundary: "" },
    { id: "t3", text: "Three", scope: "everyday", scopeBoundary: "" },
  ];
  return { server, conn, sent };
}

function voteRoom() {
  const sent: unknown[] = [];
  const conn = hostConn(sent);
  const { server } = createTestServer("VVOT", { connections: [conn] });
  server.state.players = ["A", "B", "C"].map((id, seat) => ({
    id,
    name: id,
    seat,
    connected: true,
    isHost: seat === 0,
    role: "player" as const,
    stones: 0,
    joinedAt: seat + 1,
  }));
  server.state.seatOrder = ["A", "B", "C"];
  server.state.rosterLocked = true;
  server.state.phase = "VOTING_AND_JUDGING";
  server.state.scores = ["A", "B", "C"].map((id) => ({
    playerId: id,
    votes: 0,
    aiAward: 0,
    topicFit: 0,
    pickStrength: 0,
    rosterQuality: 0,
    explanation: "",
    earned: 0,
    aiFallback: false,
  }));
  return { server, conn, sent };
}

describe("topic + human vote reselect (revision bump)", () => {
  it("gestureKeyFor discriminates topic and vote targets", () => {
    expect(
      gestureKeyFor({ type: "vote_topic", topicId: "t1" }, 1),
    ).not.toBe(gestureKeyFor({ type: "vote_topic", topicId: "t2" }, 1));
    expect(
      gestureKeyFor({ type: "submit_vote", targetPlayerId: "B" }, 1),
    ).not.toBe(
      gestureKeyFor({ type: "submit_vote", targetPlayerId: "C" }, 1),
    );
  });

  it("without a bump, A→B→A topic reselect would reuse a burned actionId", async () => {
    const { server, conn } = topicRoom();
    const rev = server.state.phaseRevision;
    const idT1 = gestureKeyFor({ type: "vote_topic", topicId: "t1" }, rev);
    const idT2 = gestureKeyFor({ type: "vote_topic", topicId: "t2" }, rev);
    await server.onMessage(
      conn,
      JSON.stringify({ type: "vote_topic", topicId: "t1", actionId: idT1 }),
    );
    await server.onMessage(
      conn,
      JSON.stringify({ type: "vote_topic", topicId: "t2", actionId: idT2 }),
    );
    assert.equal(server.state.topicVotes.A, "t2");
    // Same revision + same key → same burned id (client would reuse).
    assert.equal(
      gestureKeyFor({ type: "vote_topic", topicId: "t1" }, rev),
      idT1,
    );
    assert.equal(server.seenAction(idT1), true);
  });

  it("gestureKeyFor + revision bump lets a prior topic vote re-land", async () => {
    const { server, conn } = topicRoom();
    const ids = new Map<string, string>();
    let rev = server.state.phaseRevision;
    for (const topicId of ["t1", "t2", "t3", "t1"] as const) {
      const key = gestureKeyFor({ type: "vote_topic", topicId }, rev);
      const actionId = ids.get(key) ?? `gid-${key}`;
      ids.set(key, actionId);
      await server.onMessage(
        conn,
        JSON.stringify({ type: "vote_topic", topicId, actionId }),
      );
      assert.equal(
        server.state.topicVotes.A,
        topicId,
        `topic=${topicId} rev=${rev} key=${key} seen=${server.seenAction(actionId)}`,
      );
      if (server.state.phaseRevision !== rev) {
        rev = server.state.phaseRevision;
        ids.clear();
      }
    }
  });

  it("gestureKeyFor + revision bump lets a prior human vote re-land", async () => {
    const { server, conn } = voteRoom();
    const ids = new Map<string, string>();
    let rev = server.state.phaseRevision;
    for (const target of ["B", "C", "B"] as const) {
      const key = gestureKeyFor(
        { type: "submit_vote", targetPlayerId: target },
        rev,
      );
      const actionId = ids.get(key) ?? `gid-${key}`;
      ids.set(key, actionId);
      await server.onMessage(
        conn,
        JSON.stringify({
          type: "submit_vote",
          targetPlayerId: target,
          actionId,
        }),
      );
      assert.equal(
        server.state.humanVotes.A,
        target,
        `target=${target} rev=${rev} key=${key}`,
      );
      if (server.state.phaseRevision !== rev) {
        rev = server.state.phaseRevision;
        ids.clear();
      }
    }
  });
});
