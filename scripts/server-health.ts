/**
 * Prod PartyServer health: connect, join 2 clients, assert state broadcast.
 *
 * Env:
 *   PARTY_HOST — host without protocol (default: beans-party.beans-lwagner.workers.dev)
 *   HEALTH_TIMEOUT_MS — overall budget (default: 15000)
 *   HEALTH_STEP_MS — per-step budget (default: 8000)
 *
 * Exit 0 on success; non-zero on failure / slowness (CI emails the committer).
 */
import PartySocket from "partysocket";

const HOST =
  process.env.PARTY_HOST ||
  process.env.NEXT_PUBLIC_PARTYKIT_HOST ||
  "beans-party.beans-lwagner.workers.dev";
const OVERALL_MS = Number(process.env.HEALTH_TIMEOUT_MS || 15_000);
const STEP_MS = Number(process.env.HEALTH_STEP_MS || 8_000);
const CODE = `H${Math.random().toString(36).slice(2, 5)}`.toUpperCase();

type State = {
  phase?: string;
  players?: { id: string; name: string }[];
  phaseRevision?: number;
};

type Msg = { type: string; state?: State; youId?: string; message?: string };

function fail(msg: string): never {
  console.error(`server-health: FAIL ${msg}`);
  process.exit(1);
}

function client(id: string, name: string) {
  const sock = new PartySocket({ host: HOST, room: CODE, id });
  let state: State | null = null;
  let youId = id;
  const waiters: Array<() => void> = [];

  sock.addEventListener("message", (ev) => {
    const msg = JSON.parse(String(ev.data)) as Msg;
    if (msg.type === "error") {
      console.error(`server-health: [${name}] error: ${msg.message}`);
      return;
    }
    if (msg.type === "state" || msg.type === "joined") {
      state = msg.state ?? state;
      if (msg.youId) youId = msg.youId;
      for (const w of waiters.splice(0)) w();
    }
  });

  function send(m: object) {
    sock.send(JSON.stringify({ ...m, actionId: `h-${Date.now()}-${Math.random()}` }));
  }

  async function open(timeoutMs: number) {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`${name} connect timeout`)), timeoutMs);
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
        reject(new Error(`${name} socket error`));
      });
    });
  }

  async function wait(pred: () => boolean, timeoutMs: number, label: string) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (state && pred()) return;
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 100);
        waiters.push(() => {
          clearTimeout(t);
          resolve();
        });
      });
    }
    throw new Error(`${name} timeout: ${label}`);
  }

  return {
    name,
    get state() {
      return state;
    },
    get youId() {
      return youId;
    },
    sock,
    send,
    open,
    wait,
  };
}

async function main() {
  const t0 = Date.now();
  const deadline = t0 + OVERALL_MS;
  const left = () => Math.max(500, deadline - Date.now());
  console.log(`server-health: room ${CODE} @ ${HOST} (budget ${OVERALL_MS}ms)`);

  const a = client(`health-a-${Date.now()}`, "HealthA");
  const b = client(`health-b-${Date.now()}`, "HealthB");

  await a.open(Math.min(STEP_MS, left()));
  const connectMs = Date.now() - t0;
  a.send({ type: "join", name: "HealthA", role: "player" });
  await a.wait(
    () => !!a.state?.players?.some((p) => p.id === a.youId),
    Math.min(STEP_MS, left()),
    "A joined",
  );
  const joinAMs = Date.now() - t0;

  await b.open(Math.min(STEP_MS, left()));
  b.send({ type: "join", name: "HealthB", role: "player" });
  await b.wait(
    () => !!b.state?.players?.some((p) => p.id === b.youId),
    Math.min(STEP_MS, left()),
    "B joined",
  );

  // Both clients should see the 2-player lobby broadcast.
  await a.wait(
    () => (a.state?.players?.length ?? 0) >= 2 && a.state?.phase === "LOBBY",
    Math.min(STEP_MS, left()),
    "A sees 2 players",
  );
  await b.wait(
    () => (b.state?.players?.length ?? 0) >= 2 && b.state?.phase === "LOBBY",
    Math.min(STEP_MS, left()),
    "B sees 2 players",
  );

  if (typeof a.state?.phaseRevision !== "number") {
    fail("missing phaseRevision on state broadcast");
  }
  if (!a.state?.players?.find((p) => p.name === "HealthB")) {
    fail("A missing HealthB in roster");
  }
  if (!b.state?.players?.find((p) => p.name === "HealthA")) {
    fail("B missing HealthA in roster");
  }

  const totalMs = Date.now() - t0;
  if (totalMs > OVERALL_MS) fail(`slow total ${totalMs}ms > ${OVERALL_MS}ms`);

  console.log("server-health: ok", {
    host: HOST,
    room: CODE,
    connectMs,
    joinAMs,
    totalMs,
    players: a.state?.players?.length,
    phase: a.state?.phase,
    phaseRevision: a.state?.phaseRevision,
  });

  a.sock.close();
  b.sock.close();
  process.exit(0);
}

main().catch((e) => {
  fail(e instanceof Error ? e.message : String(e));
});
