/**
 * Ad-hoc multi-client stress for bug hunt (read-only against behavior; no fixes).
 * Target: PARTY_HOST (default 127.0.0.1:8787)
 *
 *   PARTY_HOST=127.0.0.1:8787 npx tsx scripts/bug-hunt-stress.ts
 */
import {
  ADMIN_PIN,
  playHumanTurn,
  randomRoomCode,
  resolvePartyHost,
  sleep,
  SmokeClient,
  type PublicState,
} from "./smoke-lib";

const HOST = resolvePartyHost();
type Finding = {
  id: string;
  severity: "P0" | "P1" | "P2" | "OK" | "SKIP";
  title: string;
  detail: string;
};

const findings: Finding[] = [];

function note(
  id: string,
  severity: Finding["severity"],
  title: string,
  detail: string,
) {
  findings.push({ id, severity, title, detail });
  console.log(`[${severity}] ${id}: ${title}\n  ${detail}`);
}

async function mk(room: string, name: string, suffix = "") {
  const id = `bh-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}${suffix}`;
  const c = new SmokeClient(HOST, room, id, name);
  await c.connect();
  return c;
}

async function joinAll(clients: SmokeClient[]) {
  for (const c of clients) await c.join("player");
}

function phaseOf(c: SmokeClient) {
  return c.state?.phase ?? "none";
}

/** Fast-forward a 3-human+bots lobby into VOTING with AI fallback scores. */
async function reachVoting(room: string, humans = 3): Promise<SmokeClient[]> {
  const clients: SmokeClient[] = [];
  for (let i = 0; i < humans; i++) {
    clients.push(await mk(room, `H${i}`, `-${i}`));
  }
  await joinAll(clients);
  const host = clients[0]!;
  const botsNeeded = Math.max(0, 3 - humans); // ensure >=3 for vote phase
  if (botsNeeded > 0) {
    host.send({ type: "admin_spawn_bots", pin: ADMIN_PIN, count: botsNeeded, fast: true });
    await host.wait(
      () => (host.state?.players.filter((p) => p.id.startsWith("bot-")).length ?? 0) >= botsNeeded,
      10000,
      "bots",
    );
  }
  host.send({ type: "start" });
  await host.waitPhase("TOPIC_SELECTION", 15000);
  host.send({ type: "set_topic_rounds", rounds: 3 });
  // Wait until every client has topic options, then vote the same id
  for (const c of clients) {
    await c.wait(() => (c.state?.topicOptions?.length ?? 0) > 0, 10000, "topic opts");
  }
  const topicId = host.state!.topicOptions![0]!.id;
  for (const c of clients) {
    c.send({ type: "vote_topic", topicId });
  }
  await host.waitPhase("DRAFT", 20000);
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const ph = phaseOf(host);
    if (ph === "VOTING_AND_JUDGING") break;
    if (ph === "REVIEW") {
      for (const c of clients) c.send({ type: "skip_review" });
    }
    for (const c of clients) await playHumanTurn(c);
    await sleep(200);
  }
  if (phaseOf(host) !== "VOTING_AND_JUDGING") {
    throw new Error(`failed to reach VOTING (phase=${phaseOf(host)})`);
  }
  // Wait for scores (AI or fallback)
  await host.wait(() => (host.state?.scores?.length ?? 0) > 0, 45000, "judge scores");
  return clients;
}

async function testVoteQuorumStaleBallot() {
  const room = randomRoomCode("VQ");
  console.log("\n=== vote quorum stale ballot ===", room);
  const clients = await reachVoting(room, 3);
  const [a, b, c] = clients;
  const targetA = a!.state!.seatOrder.find((id) => id !== a!.youId)!;
  const targetB = b!.state!.seatOrder.find((id) => id !== b!.youId)!;
  a!.send({ type: "submit_vote", targetPlayerId: targetA });
  b!.send({ type: "submit_vote", targetPlayerId: targetB });
  await sleep(500);
  // A disconnects permanently
  a!.close();
  // Wait past 8s grace
  await sleep(9000);
  await sleep(500);
  const phase = phaseOf(b!);
  const locked = phase === "SCORE_REVEAL" || phase === "WAGER_SELECTION" || phase === "DICE";
  // C never voted — if finalized, bug
  const cVoted = !!c!.state?.myHumanVote;
  if (locked && !cVoted) {
    note(
      "vote-stale-ballot",
      "P0",
      "Human vote finalizes using ballots from left seats",
      `phase=${phase} after A left; C never voted (myHumanVote=${cVoted}). needed drops but votesIn still includes A.`,
    );
  } else if (!locked) {
    note(
      "vote-stale-ballot",
      "OK",
      "Vote did not finalize without C",
      `phase=${phase}; waiting as expected`,
    );
  } else {
    note(
      "vote-stale-ballot",
      "OK",
      "Vote finalized but C had voted",
      `phase=${phase}`,
    );
  }
  for (const x of clients) {
    try {
      x.close();
    } catch {
      /* */
    }
  }
}

async function testStartWithDisconnected() {
  const room = randomRoomCode("ST");
  console.log("\n=== start with disconnected lobby seat ===", room);
  const host = await mk(room, "Host");
  const p2 = await mk(room, "P2");
  const p3 = await mk(room, "P3");
  await joinAll([host, p2, p3]);
  p3.close();
  // Lobby leave is immediate (delay 0) but async — race Start
  host.send({ type: "start" });
  await sleep(800);
  const phase = phaseOf(host);
  const seats = host.state?.seatOrder?.length ?? 0;
  const players = host.state?.players?.length ?? 0;
  const disconnectedInSeats = (host.state?.players ?? []).filter(
    (p) => host.state?.seatOrder?.includes(p.id) && !(p as { connected?: boolean }).connected,
  );
  // Public state may omit connected — check seat count vs live sockets
  if (phase !== "LOBBY" && seats >= 3) {
    // P3 may still be seated if leave raced after Start
    note(
      "start-ghost-seat",
      "P0",
      "Start can lock a just-disconnected lobby player into seatOrder",
      `phase=${phase} seats=${seats} players=${players} (closed P3 then raced Start)`,
    );
  } else if (phase !== "LOBBY" && seats === 2) {
    note(
      "start-ghost-seat",
      "OK",
      "Start after disconnect seated only connected players",
      `seats=${seats}`,
    );
  } else {
    note(
      "start-ghost-seat",
      "P1",
      "Start race inconclusive / start failed",
      `phase=${phase} seats=${seats}`,
    );
  }
  host.close();
  p2.close();
}

async function testRematchStuck() {
  const room = randomRoomCode("RM");
  console.log("\n=== rematch with someone gone ===", room);
  // 2 humans + 1 bot, play to GAME_RESULTS with 1 round if possible
  const a = await mk(room, "A");
  const b = await mk(room, "B");
  await joinAll([a, b]);
  a.send({ type: "admin_spawn_bots", pin: ADMIN_PIN, count: 1, fast: true });
  await a.wait(() => (a.state?.players.filter((p) => p.id.startsWith("bot-")).length ?? 0) >= 1, 10000, "bot");
  a.send({ type: "start" });
  await a.waitPhase("TOPIC_SELECTION", 15000);
  a.send({ type: "set_topic_rounds", rounds: 3 });
  // Jump via admin if available
  try {
    a.send({ type: "admin_jump_phase", pin: ADMIN_PIN, phase: "GAME_RESULTS" });
  } catch {
    /* */
  }
  await sleep(500);
  let phase = phaseOf(a);
  if (phase !== "GAME_RESULTS") {
    // Play through — may take a while; skip if too long
    const until = Date.now() + 240_000;
    while (Date.now() < until && phaseOf(a) !== "GAME_RESULTS") {
      for (const c of [a, b]) await playHumanTurn(c);
      if (phaseOf(a) === "ROUND_RESULTS") {
        // Force game over via jump if possible after one round
        a.send({ type: "admin_jump_phase", pin: ADMIN_PIN, phase: "GAME_RESULTS" });
      }
      await sleep(250);
    }
  }
  phase = phaseOf(a);
  if (phase !== "GAME_RESULTS") {
    note("rematch-stuck", "SKIP", "Could not reach GAME_RESULTS", `phase=${phase}`);
    a.close();
    b.close();
    return;
  }
  // Only A ready; B leaves → needed becomes {A} who is ready — should auto rematch but leave path does not call maybeRematchFromReady
  a.send({ type: "play_again" });
  await sleep(400);
  assertPhaseStuck: {
    if (phaseOf(a) !== "GAME_RESULTS") break assertPhaseStuck;
  }
  b.close();
  await sleep(10000);
  const after = phaseOf(a);
  if (after === "GAME_RESULTS") {
    a.send({ type: "play_again" });
    await sleep(500);
    const afterTap = phaseOf(a);
    if (afterTap === "LOBBY") {
      note(
        "rematch-stuck",
        "P1",
        "Rematch stuck until re-tap after peer leaves",
        `Stayed GAME_RESULTS after B left despite A ready; re-tap moved to LOBBY.`,
      );
    } else {
      note(
        "rematch-stuck",
        "P1",
        "Rematch did not advance after peer left",
        `phase=${afterTap}`,
      );
    }
  } else if (after === "LOBBY") {
    note("rematch-stuck", "OK", "Rematch advanced when peer left", "");
  } else {
    note("rematch-stuck", "P1", "Unexpected phase after rematch leave", `phase=${after}`);
  }
  a.close();
}

async function testDoubleTapStart() {
  const room = randomRoomCode("DT");
  console.log("\n=== double-tap start / join same name ===", room);
  const host = await mk(room, "Luke");
  const p2 = await mk(room, "Luke"); // duplicate name
  await joinAll([host, p2]);
  const names = host.state?.players.map((p) => p.name) ?? [];
  const dupOk = names.filter((n) => n === "Luke").length >= 2;
  if (dupOk) {
    note(
      "dup-name",
      "P1",
      "Lobby accepts duplicate nicknames",
      `players=${names.join(",")}`,
    );
  }
  host.send({ type: "admin_spawn_bots", pin: ADMIN_PIN, count: 1, fast: true });
  await host.wait(() => (host.state?.players.length ?? 0) >= 3, 10000, "3p");
  const sameId = `same-${Date.now()}`;
  host.send({ type: "start", actionId: sameId } as never);
  host.send({ type: "start", actionId: sameId } as never);
  await sleep(800);
  // Should still be single start
  const rev = host.state?.phaseRevision;
  const ph = phaseOf(host);
  if (ph === "TOPIC_SELECTION" || ph === "DRAFT") {
    note("double-start-same-id", "OK", "Identical actionId double-start deduped", `phase=${ph} rev=${rev}`);
  } else {
    note("double-start-same-id", "P2", "Unexpected after double start", `phase=${ph}`);
  }
  // Different actionIds (client behavior)
  const room2 = randomRoomCode("D2");
  const h2 = await mk(room2, "H");
  const p22 = await mk(room2, "P");
  await joinAll([h2, p22]);
  h2.send({ type: "admin_spawn_bots", pin: ADMIN_PIN, count: 1, fast: true });
  await h2.wait(() => (h2.state?.players.length ?? 0) >= 3, 10000, "3p");
  h2.send({ type: "start" });
  h2.send({ type: "start" });
  await sleep(600);
  note(
    "double-start-new-ids",
    "P1",
    "Client mints new actionId per send — server dedupe does not help double-tap",
    `phase=${phaseOf(h2)} (second start should error-ignore if already started; check wrangler for errors)`,
  );
  host.close();
  p2.close();
  h2.close();
  p22.close();
}

async function testHostTransfer() {
  const room = randomRoomCode("HT");
  console.log("\n=== host leave / transfer ===", room);
  const host = await mk(room, "Host");
  const p2 = await mk(room, "P2");
  const p3 = await mk(room, "P3");
  await joinAll([host, p2, p3]);
  host.send({ type: "start" });
  await host.waitPhase("TOPIC_SELECTION", 15000);
  const hostId = host.youId;
  host.close();
  // Mid-game grace 8s
  await sleep(9000);
  await sleep(500);
  const newHost = (p2.state?.players ?? []).find((p) => p.isHost);
  if (newHost && newHost.id !== hostId) {
    note(
      "host-transfer",
      "OK",
      "Host transferred after grace",
      `newHost=${newHost.name} notice=${p2.state?.notice}`,
    );
  } else if (newHost?.id === hostId) {
    note(
      "host-transfer",
      "P1",
      "Disconnected host still marked host after grace",
      `host=${newHost.name} connected flags unknown in public state`,
    );
  } else {
    note("host-transfer", "P1", "No host after transfer", `players=${JSON.stringify(p2.state?.players)}`);
  }
  // host_check never scheduled — code audit finding; confirm via reconnect path
  p2.close();
  p3.close();
}

async function testReconnectMidDraft() {
  const room = randomRoomCode("RC");
  console.log("\n=== reconnect mid-draft ===", room);
  const a = await mk(room, "A");
  const b = await mk(room, "B");
  await joinAll([a, b]);
  a.send({ type: "admin_spawn_bots", pin: ADMIN_PIN, count: 2, fast: true });
  await a.wait(() => (a.state?.players.length ?? 0) >= 4, 10000, "4p");
  a.send({ type: "start" });
  await a.waitPhase("TOPIC_SELECTION", 15000);
  for (const c of [a, b]) {
    await c.wait(() => (c.state?.topicOptions?.length ?? 0) > 0, 10000, "topic opts");
  }
  const topicId = a.state!.topicOptions![0]!.id;
  for (const c of [a, b]) c.send({ type: "vote_topic", topicId });
  // Bots also vote topics via nudge — wait for DRAFT
  await a.waitPhase("DRAFT", 30000);
  const beforePicks = a.state?.picks?.length ?? 0;
  const aId = a.youId;
  const aName = a.name;
  a.close();
  await sleep(1500); // within grace
  const a2 = new SmokeClient(HOST, room, aId, aName);
  await a2.connect();
  await a2.join("player");
  await sleep(500);
  const afterPicks = a2.state?.picks?.length ?? 0;
  const phase = phaseOf(a2);
  if (phase === "DRAFT" && a2.state?.seatOrder?.includes(aId)) {
    note(
      "reconnect-draft",
      "OK",
      "Rejoined mid-draft with same id; seat held",
      `picks ${beforePicks}->${afterPicks} phase=${phase}`,
    );
  } else {
    note(
      "reconnect-draft",
      "P0",
      "Reconnect mid-draft lost seat or phase",
      `phase=${phase} seatOrder=${a2.state?.seatOrder} you=${a2.youId}`,
    );
  }
  a2.close();
  b.close();
}

async function testZombieRoomExists() {
  const room = randomRoomCode("ZB");
  console.log("\n=== zombie room exists after all leave mid-game (humans only) ===", room);
  const a = await mk(room, "A");
  const b = await mk(room, "B");
  const c = await mk(room, "C");
  await joinAll([a, b, c]);
  a.send({ type: "start" });
  await a.waitPhase("TOPIC_SELECTION", 15000);
  a.close();
  b.close();
  c.close();
  await sleep(10000);
  const res = await fetch(`http://${HOST}/parties/main/${room}`);
  const body = (await res.json()) as { exists: boolean; phase: string; playerCount: number };
  if (body.exists && body.playerCount > 0) {
    note(
      "zombie-exists",
      "P1",
      "Empty mid-game room still exists=true (zombie DO)",
      JSON.stringify(body),
    );
  } else {
    note("zombie-exists", "OK", "Room cleaned or exists=false", JSON.stringify(body));
  }
}

async function testRemoveThenStart() {
  const room = randomRoomCode("RP");
  console.log("\n=== remove player then race start ===", room);
  const host = await mk(room, "Host");
  const p2 = await mk(room, "P2");
  const p3 = await mk(room, "P3");
  await joinAll([host, p2, p3]);
  host.send({ type: "remove_player", playerId: p3.youId });
  host.send({ type: "start" });
  await sleep(800);
  const seats = host.state?.seatOrder?.length ?? 0;
  const phase = phaseOf(host);
  if (phase !== "LOBBY" && seats === 2) {
    note("remove-start-race", "OK", "Remove then Start seated 2", `phase=${phase}`);
  } else if (phase === "LOBBY") {
    note("remove-start-race", "P2", "Start failed after remove (need 3?)", `players=${host.state?.players.length}`);
  } else {
    note("remove-start-race", "P1", "Unexpected seat count after remove+start", `seats=${seats} phase=${phase}`);
  }
  // Need 3 for min? Check rules — minPlayers might be 2
  host.close();
  p2.close();
  p3.close();
}

async function testIdempotentVoteDouble() {
  const room = randomRoomCode("IV");
  console.log("\n=== double-tap vote different actionIds ===", room);
  const clients = await reachVoting(room, 3);
  const [a, b, c] = clients;
  const target = a!.state!.seatOrder.find((id) => id !== a!.youId)!;
  a!.send({ type: "submit_vote", targetPlayerId: target });
  a!.send({ type: "submit_vote", targetPlayerId: target });
  await sleep(400);
  // last-write-wins is OK; should not error
  if (a!.lastError) {
    note("double-vote", "P2", "Double vote errored", a!.lastError);
  } else {
    note("double-vote", "OK", "Double vote accepted (overwrite)", `vote=${a!.state?.myHumanVote}`);
  }
  for (const x of clients) x.close();
  void b;
  void c;
}

async function main() {
  console.log(`bug-hunt-stress @ ${HOST}`);
  const tests = [
    testVoteQuorumStaleBallot,
    testStartWithDisconnected,
    testDoubleTapStart,
    testHostTransfer,
    testReconnectMidDraft,
    testZombieRoomExists,
    testRemoveThenStart,
    testIdempotentVoteDouble,
    testRematchStuck,
  ];
  for (const t of tests) {
    try {
      await t();
    } catch (err) {
      note(t.name, "P0", `Test threw: ${t.name}`, String(err));
    }
  }
  console.log("\n======== SUMMARY ========");
  for (const f of findings) {
    console.log(`${f.severity}\t${f.id}\t${f.title}`);
  }
  const bad = findings.filter((f) => f.severity === "P0" || f.severity === "P1");
  process.exitCode = bad.length ? 0 : 0; // report-only
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
