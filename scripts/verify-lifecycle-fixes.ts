/**
 * Live wrangler checks for server lifecycle fixes.
 * PARTY_HOST=127.0.0.1:8787 npx tsx scripts/verify-lifecycle-fixes.ts
 */
import {
  ADMIN_PIN,
  randomRoomCode,
  resolvePartyHost,
  sleep,
  SmokeClient,
} from "./smoke-lib";

const HOST = resolvePartyHost();

async function main() {
  // 1) Start race: disconnect then Start → 2 seats
  {
    const room = randomRoomCode("VS");
    const host = new SmokeClient(HOST, room, `h-${Date.now()}`, "Host");
    const p2 = new SmokeClient(HOST, room, `p2-${Date.now()}`, "P2");
    const p3 = new SmokeClient(HOST, room, `p3-${Date.now()}`, "P3");
    await host.connect();
    await p2.connect();
    await p3.connect();
    await host.join();
    await p2.join();
    await p3.join();
    p3.close();
    await sleep(50);
    host.send({ type: "start" });
    await sleep(800);
    const seats = host.state?.seatOrder?.length ?? 0;
    if (seats !== 2) throw new Error(`Start ghost: seats=${seats}`);
    console.log("OK start-ghost seats=2");
    host.close();
    p2.close();
  }

  // 2) Zombie exists after all leave mid-game
  {
    const room = randomRoomCode("VZ");
    const a = new SmokeClient(HOST, room, `a-${Date.now()}`, "A");
    const b = new SmokeClient(HOST, room, `b-${Date.now()}`, "B");
    await a.connect();
    await b.connect();
    await a.join();
    await b.join();
    a.send({ type: "admin_spawn_bots", pin: ADMIN_PIN, count: 1, fast: true });
    await a.wait(() => (a.state?.players.length ?? 0) >= 3, 10000, "bots");
    a.send({ type: "start" });
    await a.waitPhase("TOPIC_SELECTION", 15000);
    a.close();
    b.close();
    await sleep(10000);
    const res = await fetch(`http://${HOST}/parties/main/${room}`);
    const body = (await res.json()) as { exists: boolean; playerCount: number };
    if (body.exists) throw new Error(`zombie exists: ${JSON.stringify(body)}`);
    console.log("OK zombie-exists", body);
  }

  // 3) Dup name rejected
  {
    const room = randomRoomCode("VD");
    const a = new SmokeClient(HOST, room, `a-${Date.now()}`, "Luke");
    const b = new SmokeClient(HOST, room, `b-${Date.now()}`, "Luke");
    await a.connect();
    await b.connect();
    await a.join();
    b.send({ type: "join", name: "Luke", role: "player" });
    await sleep(500);
    if (!b.lastError?.match(/Name taken/i)) {
      throw new Error(`expected name taken, got ${b.lastError}`);
    }
    console.log("OK dup-name");
    a.close();
    b.close();
  }

  console.log("VERIFY_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
