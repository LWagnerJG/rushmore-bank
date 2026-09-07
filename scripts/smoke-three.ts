/**
 * Programmatic 3-player smoke against local PartyKit.
 * Usage: npx tsx scripts/smoke-three.ts
 */
import PartySocket from "partysocket";

const HOST = process.env.PARTY_HOST || "127.0.0.1:1999";
const CODE = (process.env.ROOM || "SMOK").toUpperCase();

type Msg = { type: string; [k: string]: unknown };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function client(id: string, name: string) {
  const sock = new PartySocket({ host: HOST, room: CODE, id });
  let state: Record<string, unknown> | null = null;
  let youId = id;
  const waiters: Array<(s: Record<string, unknown>) => void> = [];

  sock.addEventListener("message", (ev) => {
    const msg = JSON.parse(String(ev.data)) as Msg;
    if (msg.type === "state" || msg.type === "joined") {
      state = msg.state as Record<string, unknown>;
      youId = String(msg.youId ?? id);
      for (const w of waiters.splice(0)) w(state!);
    } else if (msg.type === "error") {
      console.error(`[${name}] error:`, msg.message);
    }
  });

  function send(m: object) {
    sock.send(JSON.stringify({ ...m, actionId: `a-${Date.now()}-${Math.random()}` }));
  }

  async function waitPhase(phase: string, timeout = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (state && state.phase === phase) return state;
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 200);
        waiters.push(() => {
          clearTimeout(t);
          resolve();
        });
      });
    }
    throw new Error(`[${name}] timeout waiting for ${phase}, have ${state?.phase}`);
  }

  async function open() {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("connect timeout")), 8000);
      if (sock.readyState === WebSocket.OPEN) {
        clearTimeout(t);
        resolve();
        return;
      }
      sock.addEventListener("open", () => {
        clearTimeout(t);
        resolve();
      });
      sock.addEventListener("error", () => {
        clearTimeout(t);
        reject(new Error("socket error"));
      });
    });
    send({ type: "join", name, role: "player" });
    await waitPhase("LOBBY");
  }

  return { sock, name, id, send, waitPhase, get state() { return state; }, get youId() { return youId; }, open };
}

async function main() {
  console.log(`Smoke room ${CODE} @ ${HOST}`);
  const luke = client("smoke-luke", "Luke");
  const brynna = client("smoke-brynna", "Brynna");
  const friend = client("smoke-friend", "Friend");

  await luke.open();
  await brynna.open();
  await friend.open();
  console.log("joined", (luke.state?.players as unknown[])?.length);

  luke.send({ type: "start" });
  await luke.waitPhase("TOPIC_SELECTION");
  console.log("TOPIC_SELECTION");

  const opts = (luke.state?.topicOptions as Array<{ id: string }>) ?? [];
  const topicId = opts[0]?.id;
  if (!topicId) throw new Error("no topics");
  luke.send({ type: "vote_topic", topicId });
  brynna.send({ type: "vote_topic", topicId });
  friend.send({ type: "vote_topic", topicId });

  // May go PREP then DRAFT via alarms — wait for DRAFT (prep is 20s)
  // Force: wait PREP then DRAFT with long timeout
  try {
    await luke.waitPhase("PREP", 10000);
    console.log("PREP — host advance");
    luke.send({ type: "advance" });
  } catch {
    /* may already be draft */
  }
  await luke.waitPhase("DRAFT", 10000);
  console.log("DRAFT start");

  // Play through full snake: 3 players * 4 = 12 picks
  for (let i = 0; i < 12; i++) {
    await sleep(150);
    const st = luke.state!;
    if (st.phase !== "DRAFT" && st.phase !== "CORRECTION") break;
    const cursor = Number(st.draftCursor);
    const order = st.draftOrder as number[];
    const seats = st.seatOrder as string[];
    const seat = order[cursor];
    const pid = seats[seat!];
    const actor = [luke, brynna, friend].find((c) => c.youId === pid || c.id === pid);
    if (!actor) throw new Error(`no actor for ${pid}`);
    const pick = `Pick-${actor.name}-${i}`;
    actor.send({ type: "lock_in", text: pick });
    await sleep(200);
    console.log(`pick ${i + 1}: ${actor.name} -> ${pick}`);
  }

  // REVIEW (30s) or host skip
  try {
    await luke.waitPhase("REVIEW", 8000);
    console.log("REVIEW — host skip");
    luke.send({ type: "skip_review" });
  } catch {
    /* */
  }

  await luke.waitPhase("VOTING_AND_JUDGING", 10000);
  console.log("VOTING — waiting for server-side judge + ballots");
  luke.send({ type: "submit_vote", targetPlayerId: brynna.youId });
  brynna.send({ type: "submit_vote", targetPlayerId: friend.youId });
  friend.send({ type: "submit_vote", targetPlayerId: luke.youId });
  // Judging is server-authoritative — do not submit client AI scores.

  await luke.waitPhase("SCORE_REVEAL", 25000);
  console.log("SCORE_REVEAL", luke.state?.scores);
  luke.send({ type: "advance" });

  await luke.waitPhase("WAGER_SELECTION", 8000);
  console.log("WAGER");
  luke.send({ type: "submit_wager", amount: 10 });
  brynna.send({ type: "submit_wager", amount: 5 });
  friend.send({ type: "submit_wager", amount: 0 });

  // Dice or round results
  await sleep(1000);
  const phase = luke.state?.phase;
  console.log("after wager phase:", phase);

  if (phase === "DICE") {
    for (let i = 0; i < 20; i++) {
      const st = luke.state!;
      if (st.phase !== "DICE") break;
      if ((st.diceActiveIds as string[]).length === 0) break;
      if (st.diceSubphase === "COOLDOWN") {
        await sleep(1200);
        continue;
      }
      if (st.diceSubphase !== "READY") {
        await sleep(400);
        continue;
      }
      const roller = (st.seatOrder as string[])[st.diceTurnSeat as number];
      const actor = [luke, brynna, friend].find(
        (c) => c.youId === roller || c.id === roller,
      );
      if (!actor) {
        await sleep(400);
        continue;
      }
      console.log(actor.name, "pull_out");
      actor.send({ type: "pull_out" });
      await sleep(600);
    }
  }

  try {
    await luke.waitPhase("ROUND_RESULTS", 20000);
  } catch {
    /* */
  }
  await sleep(500);
  console.log("final phase:", luke.state?.phase);
  console.log(
    "stones",
    (luke.state?.players as Array<{ name: string; stones: number }>).map(
      (p) => `${p.name}:${p.stones}`,
    ),
  );
  if (luke.state?.phase !== "ROUND_RESULTS" && luke.state?.phase !== "GAME_RESULTS") {
    throw new Error(`Expected ROUND_RESULTS, got ${luke.state?.phase}`);
  }
  console.log("SMOKE_OK");
  luke.sock.close();
  brynna.sock.close();
  friend.sock.close();
  process.exit(0);
}

main().catch((e) => {
  console.error("SMOKE_FAIL", e);
  process.exit(1);
});
