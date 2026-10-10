/**
 * Local regression: waiting Bank rejected + current Bank advances seat.
 * Requires wrangler on 8787 (or PARTY_HOST).
 */
import { randomRoomCode, resolvePartyHost, SmokeClient } from "./smoke-lib";

const HOST = resolvePartyHost();
const CODE = (process.env.ROOM || randomRoomCode("WB")).toUpperCase();

async function main() {
  const a = new SmokeClient(HOST, CODE, "wait-a", "A");
  const b = new SmokeClient(HOST, CODE, "wait-b", "B");
  const c = new SmokeClient(HOST, CODE, "wait-c", "C");
  await Promise.all([a.connect(), b.connect(), c.connect()]);
  await a.join();
  await b.join();
  await c.join();
  await a.wait(() => (a.state?.players.length ?? 0) >= 3, 8000, "3 players");

  a.send({ type: "start" });
  await a.waitPhase("TOPIC_SELECTION");
  a.send({
    type: "custom_topic",
    text: "Best snacks",
    scope: "food",
    scopeBoundary: "edible",
  });
  await a.waitPhase("DRAFT");

  for (let i = 0; i < 12; i++) {
    await a.wait(
      () => {
        const s = a.state!;
        return (
          s.phase === "DRAFT" ||
          s.phase === "REVIEW" ||
          s.phase === "VOTING_AND_JUDGING"
        );
      },
      10000,
      "draft tick",
    );
    if (a.state!.phase !== "DRAFT") break;
    const turnId = a.draftTurnId();
    const actor = [a, b, c].find((x) => x.youId === turnId)!;
    const before = a.state!.draftCursor;
    actor.send({ type: "lock_in", text: `Item-${i}-${actor.name}` });
    await a.wait(
      () => {
        const cur = a.state!;
        return cur.phase !== "DRAFT" || cur.draftCursor > before;
      },
      8000,
      "cursor advance",
    );
  }
  await a.wait(
    () => a.state?.phase === "REVIEW" || a.state?.phase === "VOTING_AND_JUDGING",
    10000,
    "post-draft",
  );
  if (a.state?.phase === "REVIEW") a.send({ type: "skip_review" });
  await a.waitPhase("VOTING_AND_JUDGING");

  if ("topicVotes" in (a.state as object) || "humanVotes" in (a.state as object)) {
    throw new Error("LEAK: ballot maps in public state");
  }

  a.lastError = null;
  a.send({ type: "submit_ai_judgments", judgments: [], fallback: true });
  await a.wait(() => a.lastError !== null, 5000, "reject AI");
  if (!a.lastError?.includes("server-side")) {
    throw new Error(`expected reject AI, got ${a.lastError}`);
  }
  console.log("OK reject client AI:", a.lastError);

  a.send({ type: "submit_vote", targetPlayerId: b.youId });
  b.send({ type: "submit_vote", targetPlayerId: c.youId });
  c.send({ type: "submit_vote", targetPlayerId: a.youId });
  await a.waitPhase("SCORE_REVEAL", 25000);
  for (const x of [a, b, c]) x.send({ type: "bank_the_beans" });
  await a.waitPhase("WAGER_SELECTION");
  for (const x of [a, b, c]) x.send({ type: "submit_wager", amount: 20 });
  await a.waitPhase("DICE");

  const rollerId = a.state!.seatOrder[a.state!.diceTurnSeat!];
  const waiter = [a, b, c].find((x) => x.youId !== rollerId)!;
  const roller = [a, b, c].find((x) => x.youId === rollerId)!;
  const seatBefore = a.state!.diceTurnSeat!;
  console.log("dice", a.state!.diceSubphase, "roller", rollerId, "waiter", waiter.youId);

  await waiter.wait(() => waiter.state?.diceSubphase === "READY", 10000, "READY");
  waiter.lastError = null;
  waiter.send({ type: "pull_out" });
  await waiter.wait(() => waiter.lastError !== null, 5000, "wait reject");
  if (!waiter.lastError?.toLowerCase().includes("wait")) {
    throw new Error(`expected wait-your-turn reject, got ${waiter.lastError}`);
  }
  if (!waiter.state!.diceActiveIds?.includes(waiter.youId)) {
    throw new Error("waiter should still be active");
  }
  if (waiter.state!.diceTurnSeat !== seatBefore) {
    throw new Error("rejected waiting bank should not advance seat");
  }
  console.log("OK waiting Bank rejected:", waiter.lastError);

  await roller.wait(() => roller.state?.diceSubphase === "READY", 10000, "roller READY");
  roller.send({ type: "pull_out" });
  await roller.wait(
    () => !roller.state!.diceActiveIds?.includes(roller.youId),
    10000,
    "roller banked",
  );
  if (
    roller.state!.diceTurnSeat === seatBefore &&
    (roller.state!.diceActiveIds?.length ?? 0) > 0
  ) {
    throw new Error("current Bank should advance seat");
  }
  console.log("OK current Bank advanced; seat", roller.state!.diceTurnSeat);

  console.log("SMOKE_WAIT_BANK_OK");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
