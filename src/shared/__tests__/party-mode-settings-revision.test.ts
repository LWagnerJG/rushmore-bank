/**
 * Party Mode (and between-topic vibe) toggles discriminate actionIds by
 * `update_settings:${rev}:${vibe}:${party}`, so the server bumps
 * phaseRevision when those settings actually change. Off→On→Off→On without
 * a bump reused the burned `…::1` id and seenAction no-op'd — UI stuck Off.
 *
 * Party Mode is also host-writable in every phase (topic pick, draft, dice,
 * final results, …). Toggling must land + bump revision without changing
 * the current phase.
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

function lobbyRoom() {
  const sent: unknown[] = [];
  const conn = hostConn(sent);
  const { server } = createTestServer("PMOD", { connections: [conn] });
  server.state.players = [
    {
      id: "A",
      name: "A",
      seat: 0,
      connected: true,
      isHost: true,
      role: "player" as const,
      stones: 0,
      joinedAt: 1,
    },
  ];
  server.state.phase = "LOBBY";
  server.state.settings.partyMode = false;
  server.state.settings.topicVibe = "all";
  server.state.phaseRevision = 0;
  return { server, conn, sent };
}

function phaseRoom(
  phase:
    | "TOPIC_SELECTION"
    | "DRAFT"
    | "DICE"
    | "ROUND_RESULTS"
    | "SCORE_REVEAL"
    | "GAME_RESULTS",
) {
  const { server, conn, sent } = lobbyRoom();
  server.state.phase = phase;
  server.state.rosterLocked = true;
  server.state.seatOrder = ["A"];
  return { server, conn, sent };
}

async function toggleParty(
  server: ReturnType<typeof createTestServer>["server"],
  conn: Connection,
  sequence: boolean[],
) {
  const ids = new Map<string, string>();
  let rev = server.state.phaseRevision;
  for (const next of sequence) {
    const msg = {
      type: "update_settings" as const,
      settings: { partyMode: next },
    };
    const key = gestureKeyFor(msg, rev);
    const actionId = ids.get(key) ?? `gid-${key}`;
    ids.set(key, actionId);
    await server.onMessage(
      conn,
      JSON.stringify({ ...msg, actionId }),
    );
    assert.equal(
      server.state.settings.partyMode,
      next,
      `partyMode=${next} rev=${rev} key=${key} seen=${server.seenAction(actionId)}`,
    );
    if (server.state.phaseRevision !== rev) {
      rev = server.state.phaseRevision;
      ids.clear();
    }
  }
}

describe("party mode / vibe settings revision bump", () => {
  it("gestureKeyFor discriminates partyMode on/off", () => {
    expect(
      gestureKeyFor(
        { type: "update_settings", settings: { partyMode: true } },
        1,
      ),
    ).toBe("update_settings:1::1");
    expect(
      gestureKeyFor(
        { type: "update_settings", settings: { partyMode: false } },
        1,
      ),
    ).toBe("update_settings:1::0");
    expect(
      gestureKeyFor(
        { type: "update_settings", settings: { partyMode: true } },
        1,
      ),
    ).not.toBe(
      gestureKeyFor(
        { type: "update_settings", settings: { partyMode: false } },
        1,
      ),
    );
  });

  it("without a bump, Off→On→Off→On reuses a burned actionId", async () => {
    const { server, conn } = lobbyRoom();
    const rev = server.state.phaseRevision;
    const onId = gestureKeyFor(
      { type: "update_settings", settings: { partyMode: true } },
      rev,
    );
    const offId = gestureKeyFor(
      { type: "update_settings", settings: { partyMode: false } },
      rev,
    );
    await server.onMessage(
      conn,
      JSON.stringify({
        type: "update_settings",
        settings: { partyMode: true },
        actionId: onId,
      }),
    );
    await server.onMessage(
      conn,
      JSON.stringify({
        type: "update_settings",
        settings: { partyMode: false },
        actionId: offId,
      }),
    );
    assert.equal(server.state.settings.partyMode, false);
    // Same revision → same burned onId (client would reuse).
    assert.equal(
      gestureKeyFor(
        { type: "update_settings", settings: { partyMode: true } },
        rev,
      ),
      onId,
    );
    assert.equal(server.seenAction(onId), true);
  });

  it("LOBBY: Off→On→Off→On lands with revision bumps", async () => {
    const { server, conn } = lobbyRoom();
    const rev0 = server.state.phaseRevision;
    await toggleParty(server, conn, [true, false, true]);
    assert.equal(server.state.settings.partyMode, true);
    assert.ok(server.state.phaseRevision > rev0);
  });

  it("ROUND_RESULTS: partyMode reselect lands", async () => {
    const { server, conn } = phaseRoom("ROUND_RESULTS");
    await toggleParty(server, conn, [true, false, true]);
    assert.equal(server.state.settings.partyMode, true);
  });

  it("SCORE_REVEAL: partyMode reselect lands", async () => {
    const { server, conn } = phaseRoom("SCORE_REVEAL");
    await toggleParty(server, conn, [true, false, true]);
    assert.equal(server.state.settings.partyMode, true);
  });

  it("TOPIC_SELECTION: partyMode reselect lands without leaving phase", async () => {
    const { server, conn } = phaseRoom("TOPIC_SELECTION");
    const rev0 = server.state.phaseRevision;
    await toggleParty(server, conn, [true, false, true]);
    assert.equal(server.state.settings.partyMode, true);
    assert.equal(server.state.phase, "TOPIC_SELECTION");
    assert.ok(server.state.phaseRevision > rev0);
  });

  it("GAME_RESULTS: partyMode reselect lands without leaving phase", async () => {
    const { server, conn } = phaseRoom("GAME_RESULTS");
    const rev0 = server.state.phaseRevision;
    await toggleParty(server, conn, [true, false, true]);
    assert.equal(server.state.settings.partyMode, true);
    assert.equal(server.state.phase, "GAME_RESULTS");
    assert.ok(server.state.phaseRevision > rev0);
  });

  it("DRAFT / DICE: partyMode toggle does not break phase flow", async () => {
    for (const phase of ["DRAFT", "DICE"] as const) {
      const { server, conn } = phaseRoom(phase);
      server.state.phaseDeadlineAt = 9_999_999;
      const deadline = server.state.phaseDeadlineAt;
      const rev0 = server.state.phaseRevision;
      await toggleParty(server, conn, [true, false]);
      assert.equal(server.state.settings.partyMode, false);
      assert.equal(server.state.phase, phase);
      assert.equal(server.state.phaseDeadlineAt, deadline);
      assert.ok(server.state.phaseRevision > rev0);
    }
  });

  it("rejects non-party settings during locked play phases", async () => {
    const { server, conn, sent } = phaseRoom("DRAFT");
    sent.length = 0;
    await server.onMessage(
      conn,
      JSON.stringify({
        type: "update_settings",
        settings: { scopeMix: [] },
        actionId: "scope-locked",
      }),
    );
    const err = sent.find(
      (m) =>
        m &&
        typeof m === "object" &&
        (m as { type?: string }).type === "error",
    ) as { message?: string } | undefined;
    assert.equal(err?.message, "Settings locked during play");
    assert.equal(server.state.phase, "DRAFT");
    assert.equal(server.state.settings.partyMode, false);
  });

  it("LOBBY vibe sports→basic→sports lands", async () => {
    const { server, conn } = lobbyRoom();
    const ids = new Map<string, string>();
    let rev = server.state.phaseRevision;
    for (const vibe of ["sports", "basic", "sports"] as const) {
      const msg = {
        type: "update_settings" as const,
        settings: { topicVibe: vibe },
      };
      const key = gestureKeyFor(msg, rev);
      const actionId = ids.get(key) ?? `gid-${key}`;
      ids.set(key, actionId);
      await server.onMessage(
        conn,
        JSON.stringify({ ...msg, actionId }),
      );
      assert.equal(
        server.state.settings.topicVibe,
        vibe,
        `vibe=${vibe} rev=${rev} key=${key}`,
      );
      if (server.state.phaseRevision !== rev) {
        rev = server.state.phaseRevision;
        ids.clear();
      }
    }
  });

  it("no bump when partyMode is set to the current value", async () => {
    const { server, conn } = lobbyRoom();
    server.state.settings.partyMode = true;
    const rev0 = server.state.phaseRevision;
    await server.onMessage(
      conn,
      JSON.stringify({
        type: "update_settings",
        settings: { partyMode: true },
        actionId: "noop-party",
      }),
    );
    assert.equal(server.state.settings.partyMode, true);
    assert.equal(server.state.phaseRevision, rev0);
  });
});
