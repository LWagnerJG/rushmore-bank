/**
 * Smoke: spawn bots against local PartyKit and assert they lock_in real answers.
 */
import PartySocket from "partysocket";

const HOST = process.env.PARTYKIT_HOST ?? "127.0.0.1:1999";
const CODE = `BOT${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const ADMIN_PIN = "8989";

type StateMsg = {
  type: "state" | "joined" | "error";
  state?: {
    phase: string;
    players: { id: string; name: string }[];
    picks: { playerId: string; text: string }[];
    topicVotes: Record<string, string>;
    selectedTopic: { id: string; text: string } | null;
    draftCursor: number;
    seatOrder: string[];
    draftOrder: number[];
    notice: string | null;
    phaseRevision: number;
  };
  message?: string;
  youId?: string;
};

function waitFor(
  sock: PartySocket,
  pred: (m: StateMsg) => boolean,
  ms = 15000,
): Promise<StateMsg> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout waiting for state")), ms);
    const onMsg = (ev: MessageEvent) => {
      const msg = JSON.parse(String(ev.data)) as StateMsg;
      if (msg.type === "error") {
        clearTimeout(t);
        sock.removeEventListener("message", onMsg);
        reject(new Error(msg.message ?? "error"));
        return;
      }
      if (pred(msg)) {
        clearTimeout(t);
        sock.removeEventListener("message", onMsg);
        resolve(msg);
      }
    };
    sock.addEventListener("message", onMsg);
  });
}

async function main() {
  const sock = new PartySocket({
    host: HOST,
    room: CODE,
    party: "main",
    id: `human-smoke-${Date.now()}`,
  });

  await new Promise<void>((resolve, reject) => {
    sock.addEventListener("open", () => resolve());
    sock.addEventListener("error", () => reject(new Error("ws error")));
    setTimeout(() => reject(new Error("ws open timeout")), 8000);
  });

  sock.send(JSON.stringify({ type: "join", name: "Luke", role: "player" }));
  let msg = await waitFor(sock, (m) => m.type === "joined" || !!m.state?.players?.length);
  console.log("joined", CODE, "players", msg.state?.players?.length);

  sock.send(
    JSON.stringify({
      type: "admin_spawn_bots",
      pin: ADMIN_PIN,
      count: 3,
    }),
  );
  msg = await waitFor(
    sock,
    (m) => (m.state?.players.filter((p) => p.id.startsWith("bot-")).length ?? 0) >= 3,
  );
  const bots = msg.state!.players.filter((p) => p.id.startsWith("bot-"));
  console.log(
    "spawned bots:",
    bots.map((b) => b.name).join(", "),
    "notice:",
    msg.state?.notice,
  );
  if (bots.length !== 3) throw new Error(`expected 3 bots, got ${bots.length}`);

  sock.send(JSON.stringify({ type: "start" }));
  msg = await waitFor(sock, (m) => m.state?.phase === "TOPIC_SELECTION");
  console.log("phase TOPIC_SELECTION options ready");

  // Wait for bots to vote topics (and human also votes so tally can complete).
  const topicId = (msg.state as { topicOptions?: { id: string }[] } & typeof msg.state)
    ?.topicOptions?.[0]?.id;
  // topicOptions may be on public state — fetch from raw
  const raw = msg.state as unknown as { topicOptions?: { id: string }[] };
  // re-read via next state after a moment if needed
  sock.send(
    JSON.stringify({
      type: "vote_topic",
      topicId:
        (msg as unknown as { state: { topicOptions: { id: string }[] } }).state
          ?.topicOptions?.[0]?.id ?? topicId,
    }),
  );

  // Keep voting if first message lacked options — pull from subsequent states
  const draftMsg = await waitFor(
    sock,
    (m) => m.state?.phase === "DRAFT" || m.state?.phase === "TOPIC_SELECTION",
    20000,
  );

  if (draftMsg.state?.phase === "TOPIC_SELECTION") {
    // Get options from live state by listening
    const withOpts = await waitFor(
      sock,
      (m) =>
        m.state?.phase === "TOPIC_SELECTION" &&
        Array.isArray((m.state as unknown as { topicOptions: unknown[] }).topicOptions) &&
        (m.state as unknown as { topicOptions: unknown[] }).topicOptions.length > 0,
      5000,
    ).catch(() => draftMsg);

    const opts = (withOpts.state as unknown as { topicOptions: { id: string }[] })
      .topicOptions;
    if (opts?.[0]) {
      sock.send(JSON.stringify({ type: "vote_topic", topicId: opts[0].id }));
    }
  }

  const inDraft = await waitFor(sock, (m) => m.state?.phase === "DRAFT", 25000);
  console.log("entered DRAFT, picks so far", inDraft.state?.picks.length ?? 0);

  // Wait for bots to make several lock_ins
  const withPicks = await waitFor(
    sock,
    (m) => (m.state?.picks.length ?? 0) >= 3,
    40000,
  );
  const picks = withPicks.state!.picks;
  console.log(
    "bot/human picks:",
    picks.map((p) => `${p.playerId.slice(0, 12)}→${p.text}`).join(" | "),
  );
  for (const p of picks) {
    if (/^Missed pick/i.test(p.text)) {
      throw new Error(`got miss placeholder instead of real answer: ${p.text}`);
    }
    if (p.text.length < 2) throw new Error("pick too short");
  }

  console.log("SMOKE OK", { code: CODE, picks: picks.length, bots: bots.length });
  sock.close();
  process.exit(0);
}

main().catch((e) => {
  console.error("SMOKE FAIL", e);
  process.exit(1);
});
