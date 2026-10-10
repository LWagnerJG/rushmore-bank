/**
 * End-to-end bots smoke against PartyServer.
 *
 * Spawns admin bots, auto-plays the human seat on its turns, and waits for
 * bots to act on theirs — through ROUND_RESULTS (default) or GAME_RESULTS.
 *
 * Host (no protocol):
 *   PARTY_HOST / NEXT_PUBLIC_PARTYKIT_HOST  (default: prod worker)
 *
 * Optional:
 *   SMOKE_UNTIL=round_results|game_results  (default: game_results)
 *   SMOKE_BOTS=3
 *   ROOM=CODE
 *
 * Usage:
 *   npx tsx scripts/smoke-bots.ts
 *   PARTY_HOST=127.0.0.1:8787 SMOKE_UNTIL=round_results npx tsx scripts/smoke-bots.ts
 */
import {
  ADMIN_PIN,
  playHumanTurn,
  randomRoomCode,
  resolvePartyHost,
  sleep,
  SmokeClient,
} from "./smoke-lib";

const HOST = resolvePartyHost();
const CODE = (process.env.ROOM || randomRoomCode("BOT")).toUpperCase();
const BOT_COUNT = Math.max(1, Math.min(8, Number(process.env.SMOKE_BOTS || 3) || 3));
const UNTIL = (process.env.SMOKE_UNTIL || "game_results").toLowerCase();
const TARGET_PHASE = UNTIL === "round_results" ? "ROUND_RESULTS" : "GAME_RESULTS";
/** Full multi-round games need headroom for dice anim holds. */
const DEADLINE_MS = Number(process.env.SMOKE_TIMEOUT_MS || 12 * 60 * 1000);

async function main() {
  console.log(
    `smoke-bots room ${CODE} @ ${HOST} bots=${BOT_COUNT} until=${TARGET_PHASE}`,
  );
  const human = new SmokeClient(HOST, CODE, `human-smoke-${Date.now()}`, "Luke");
  await human.connect();
  await human.join("player");
  console.log("joined", CODE, "players", human.state?.players.length);

  human.send({
    type: "admin_spawn_bots",
    pin: ADMIN_PIN,
    count: BOT_COUNT,
    fast: true,
  });
  await human.wait(
    () =>
      (human.state?.players.filter((p) => p.id.startsWith("bot-")).length ?? 0) >=
      BOT_COUNT,
    10000,
    "bot spawn",
  );
  const bots = human.state!.players.filter((p) => p.id.startsWith("bot-"));
  console.log(
    "spawned bots:",
    bots.map((b) => b.name).join(", "),
    "notice:",
    human.state?.notice,
  );

  human.send({ type: "start" });
  await human.waitPhase("TOPIC_SELECTION", 15000);
  console.log("TOPIC_SELECTION");

  // Prefer a single round when the host API allows; otherwise play all rounds.
  human.send({ type: "set_topic_rounds", rounds: 3 });

  const started = Date.now();
  let lastPhase = "";
  let lastDraftPicks = -1;

  while (Date.now() - started < DEADLINE_MS) {
    const phase = human.state?.phase ?? "";
    if (phase !== lastPhase) {
      console.log(
        `phase ${phase}`,
        phase === "DRAFT"
          ? `picks=${human.state?.picks.length ?? 0}`
          : phase === "SCORE_REVEAL"
            ? `scores=${human.state?.scores?.length ?? 0}`
            : "",
      );
      lastPhase = phase;
    }

    if (phase === "DRAFT" || phase === "CORRECTION") {
      const picks = human.state?.picks.length ?? 0;
      if (picks !== lastDraftPicks) {
        if (picks > 0) {
          const latest = human.state!.picks[picks - 1]!;
          console.log(
            `pick ${picks}: ${latest.playerId.slice(0, 16)} → ${latest.text}`,
          );
          if (/^Missed pick/i.test(latest.text)) {
            throw new Error(`miss placeholder: ${latest.text}`);
          }
        }
        lastDraftPicks = picks;
      }
    }

    if (phase === TARGET_PHASE || (TARGET_PHASE === "GAME_RESULTS" && phase === "GAME_RESULTS")) {
      break;
    }
    // round_results target: stop at first ROUND_RESULTS
    if (TARGET_PHASE === "ROUND_RESULTS" && phase === "ROUND_RESULTS") {
      break;
    }

    await playHumanTurn(human);
    await sleep(200);
  }

  const finalPhase = human.state?.phase;
  if (finalPhase !== TARGET_PHASE && !(TARGET_PHASE === "ROUND_RESULTS" && finalPhase === "GAME_RESULTS")) {
    throw new Error(
      `expected ${TARGET_PHASE}, got ${finalPhase} after ${Date.now() - started}ms (picks=${human.state?.picks.length ?? 0})`,
    );
  }

  const picks = human.state?.picks ?? [];
  if (picks.length < BOT_COUNT) {
    throw new Error(`expected picks from bots/human, got ${picks.length}`);
  }
  for (const p of picks) {
    if (/^Missed pick/i.test(p.text)) {
      throw new Error(`got miss placeholder instead of real answer: ${p.text}`);
    }
    if (p.text.length < 2) throw new Error("pick too short");
  }

  console.log("SMOKE OK", {
    code: CODE,
    phase: finalPhase,
    picks: picks.length,
    bots: bots.length,
    ms: Date.now() - started,
    stones: human.state?.players.map((p) => `${p.name}:${p.stones}`),
  });
  human.close();
  process.exit(0);
}

main().catch((e) => {
  console.error("SMOKE FAIL", e);
  process.exit(1);
});
