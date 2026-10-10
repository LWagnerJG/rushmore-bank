/**
 * Programmatic 3-player smoke against PartyServer (local wrangler or prod).
 *
 * Host: PARTY_HOST / NEXT_PUBLIC_PARTYKIT_HOST (default: prod worker)
 * Usage: npx tsx scripts/smoke-three.ts
 */
import {
  playHumanTurn,
  randomRoomCode,
  resolvePartyHost,
  sleep,
  SmokeClient,
} from "./smoke-lib";

const HOST = resolvePartyHost();
const CODE = (process.env.ROOM || randomRoomCode("SMK")).toUpperCase();

async function main() {
  console.log(`Smoke room ${CODE} @ ${HOST}`);
  const luke = new SmokeClient(HOST, CODE, "smoke-luke", "Luke");
  const brynna = new SmokeClient(HOST, CODE, "smoke-brynna", "Brynna");
  const friend = new SmokeClient(HOST, CODE, "smoke-friend", "Friend");
  const all = [luke, brynna, friend];

  await luke.connect();
  await luke.join();
  await brynna.connect();
  await brynna.join();
  await friend.connect();
  await friend.join();

  await luke.wait(() => (luke.state?.players.length ?? 0) >= 3, 8000, "3 players");
  console.log("joined", luke.state?.players.length);

  luke.send({ type: "start" });
  await luke.waitPhase("TOPIC_SELECTION");
  console.log("TOPIC_SELECTION");

  const topicId = luke.state?.topicOptions?.[0]?.id;
  if (!topicId) throw new Error("no topics");
  for (const c of all) c.send({ type: "vote_topic", topicId });

  await luke.waitPhase("DRAFT", 15000);
  console.log("DRAFT start");

  // Play through full snake: 3 players * 4 = 12 picks
  for (let i = 0; i < 12; i++) {
    await sleep(100);
    const st = luke.state!;
    if (st.phase !== "DRAFT" && st.phase !== "CORRECTION") break;
    const turnId = luke.draftTurnId();
    const actor = all.find((c) => c.youId === turnId);
    if (!actor) throw new Error(`no actor for ${turnId}`);
    const pick = `Pick-${actor.name}-${i}`;
    const before = st.picks.length;
    actor.send({ type: "lock_in", text: pick });
    await luke.wait(
      () =>
        (luke.state?.phase !== "DRAFT" && luke.state?.phase !== "CORRECTION") ||
        (luke.state?.picks.length ?? 0) > before,
      8000,
      `lock ${i + 1}`,
    );
    console.log(`pick ${i + 1}: ${actor.name} -> ${pick}`);
  }

  try {
    await luke.waitPhase("REVIEW", 1500);
    console.log("REVIEW flash — host skip");
    luke.send({ type: "skip_review" });
  } catch {
    /* expected */
  }

  await luke.waitPhase("VOTING_AND_JUDGING", 10000);
  console.log("VOTING — waiting for server-side judge + ballots");
  luke.send({ type: "submit_vote", targetPlayerId: brynna.youId });
  brynna.send({ type: "submit_vote", targetPlayerId: friend.youId });
  friend.send({ type: "submit_vote", targetPlayerId: luke.youId });

  await luke.waitPhase("SCORE_REVEAL", 25000);
  console.log("SCORE_REVEAL", luke.state?.scores);
  for (const c of all) c.send({ type: "bank_the_beans" });

  await luke.waitPhase("WAGER_SELECTION", 10000);
  console.log("WAGER");
  // startBalance is 0 — wager from earned (neutral award 45). Never send 0 when max≥1.
  luke.send({ type: "submit_wager", amount: 10 });
  brynna.send({ type: "submit_wager", amount: 5 });
  friend.send({ type: "submit_wager", amount: 1 });

  await luke.wait(
    () => luke.state?.phase === "DICE" || luke.state?.phase === "ROUND_RESULTS",
    15000,
    "dice or results",
  );
  console.log("after wager phase:", luke.state?.phase);

  const diceDeadline = Date.now() + 90000;
  while (Date.now() < diceDeadline && luke.state?.phase === "DICE") {
    for (const c of all) await playHumanTurn(c);
    await sleep(300);
  }

  await luke.wait(
    () =>
      luke.state?.phase === "ROUND_RESULTS" || luke.state?.phase === "GAME_RESULTS",
    30000,
    "ROUND_RESULTS",
  );
  console.log("final phase:", luke.state?.phase);
  console.log(
    "stones",
    luke.state?.players.map((p) => `${p.name}:${p.stones}`),
  );
  console.log("SMOKE_OK");
  for (const c of all) c.close();
  process.exit(0);
}

main().catch((e) => {
  console.error("SMOKE_FAIL", e);
  process.exit(1);
});
