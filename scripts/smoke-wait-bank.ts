/**
 * Local regression: waiting-player Pull Out + reject client AI scores.
 * Requires partykit + next on 1999/3000 with NEXT_PUBLIC_PARTYKIT_HOST=127.0.0.1:1999
 */
import PartySocket from "partysocket";

const HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999";
const code = "WXYZ";

type State = {
  phase: string;
  diceSubphase: string;
  diceTurnSeat: number;
  diceActiveIds: string[];
  seatOrder: string[];
  pots: Record<string, number>;
  diceDecisionDeadlineAt: number | null;
  phaseRevision: number;
  scores?: unknown[];
  humanVotesCast?: number;
  topicVotes?: unknown;
  humanVotes?: unknown;
};

class Client {
  sock: PartySocket;
  state: State | null = null;
  youId = "";
  constructor(public name: string, id: string) {
    this.sock = new PartySocket({ host: HOST, room: code, id });
    this.sock.addEventListener("message", (e) => {
      const msg = JSON.parse(String(e.data));
      if (msg.type === "state" || msg.type === "joined") {
        this.state = msg.state;
        this.youId = msg.youId;
      } else if (msg.type === "error") {
        this.lastError = msg.message;
      }
    });
  }
  lastError: string | null = null;
  send(m: object) {
    this.sock.send(JSON.stringify({ ...m, actionId: `a-${Math.random()}` }));
  }
  async wait(pred: () => boolean, ms = 15000) {
    const start = Date.now();
    while (Date.now() - start < ms) {
      if (pred()) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`${this.name} timeout`);
  }
}

async function main() {
  const a = new Client("A", "wait-a");
  const b = new Client("B", "wait-b");
  const c = new Client("C", "wait-c");
  await Promise.all(
    [a, b, c].map(
      (x) =>
        new Promise<void>((res) => {
          x.sock.addEventListener("open", () => res());
        }),
    ),
  );
  a.send({ type: "join", name: "A" });
  b.send({ type: "join", name: "B" });
  c.send({ type: "join", name: "C" });
  await a.wait(() => (a.state?.phase === "LOBBY"));
  a.send({ type: "start" });
  await a.wait(() => a.state?.phase === "TOPIC_SELECTION");
  // Force custom topic to skip voting
  a.send({
    type: "custom_topic",
    text: "Best snacks",
    scope: "food",
    scopeBoundary: "edible",
  });
  await a.wait(() => a.state?.phase === "PREP" || a.state?.phase === "DRAFT");
  if (a.state?.phase === "PREP") a.send({ type: "advance" });
  await a.wait(() => a.state?.phase === "DRAFT");

  // Fast draft — 12 picks
  for (let i = 0; i < 12; i++) {
    await a.wait(() => {
      const s = a.state!;
      return s.phase === "DRAFT" || s.phase === "REVIEW" || s.phase === "VOTING_AND_JUDGING";
    });
    if (a.state!.phase !== "DRAFT") break;
    const s = a.state as unknown as {
      draftOrder: number[];
      draftCursor: number;
      seatOrder: string[];
    };
    const pid = s.seatOrder[s.draftOrder[s.draftCursor]!]!;
    const actor = [a, b, c].find((x) => x.youId === pid)!;
    const before = s.draftCursor;
    actor.send({ type: "lock_in", text: `Item-${i}-${actor.name}` });
    await a.wait(() => {
      const cur = (a.state as unknown as { draftCursor: number; phase: string });
      return cur.phase !== "DRAFT" || cur.draftCursor > before;
    });
  }
  await a.wait(() => a.state?.phase === "REVIEW" || a.state?.phase === "VOTING_AND_JUDGING");
  if (a.state?.phase === "REVIEW") a.send({ type: "skip_review" });
  await a.wait(() => a.state?.phase === "VOTING_AND_JUDGING");

  // Privacy: no ballot maps
  if ("topicVotes" in (a.state as object) || "humanVotes" in (a.state as object)) {
    throw new Error("LEAK: ballot maps in public state");
  }

  // Reject client AI
  a.lastError = null;
  a.send({ type: "submit_ai_judgments", judgments: [], fallback: true });
  await a.wait(() => a.lastError !== null, 5000);
  if (!a.lastError?.includes("server-side")) {
    throw new Error(`expected reject AI, got ${a.lastError}`);
  }
  console.log("OK reject client AI:", a.lastError);

  a.send({ type: "submit_vote", targetPlayerId: b.youId });
  b.send({ type: "submit_vote", targetPlayerId: c.youId });
  c.send({ type: "submit_vote", targetPlayerId: a.youId });
  await a.wait(() => a.state?.phase === "SCORE_REVEAL", 25000);
  a.send({ type: "advance" });
  await a.wait(() => a.state?.phase === "WAGER_SELECTION");
  // All wager so dice runs
  for (const x of [a, b, c]) x.send({ type: "submit_wager", amount: 20 });
  await a.wait(() => a.state?.phase === "DICE");

  const rollerId = a.state!.seatOrder[a.state!.diceTurnSeat];
  const waiter = [a, b, c].find((x) => x.youId !== rollerId)!;
  const revBefore = a.state!.phaseRevision;
  const seatBefore = a.state!.diceTurnSeat;
  const deadlineBefore = a.state!.diceDecisionDeadlineAt;
  console.log("dice", a.state!.diceSubphase, "roller", rollerId, "waiter", waiter.youId);

  // Waiter banks during cooldown/ready
  await waiter.wait(
    () =>
      waiter.state?.diceSubphase === "COOLDOWN" ||
      waiter.state?.diceSubphase === "READY",
  );
  waiter.send({ type: "pull_out" });
  await waiter.wait(() => !waiter.state!.diceActiveIds.includes(waiter.youId));
  if (waiter.state!.diceTurnSeat !== seatBefore) {
    throw new Error("waiting bank advanced seat");
  }
  if (waiter.state!.diceDecisionDeadlineAt !== deadlineBefore && waiter.state!.diceSubphase === "COOLDOWN") {
    // deadline object may refresh only on bump — phaseRevision may bump but seat must hold
  }
  if (!waiter.state!.diceActiveIds.includes(rollerId!)) {
    throw new Error("waiting bank removed roller");
  }
  console.log("OK waiting Pull Out; seat still", waiter.state!.diceTurnSeat, "rev", waiter.state!.phaseRevision, "was", revBefore);

  // Current roller can still be there
  console.log("SMOKE_WAIT_BANK_OK");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
