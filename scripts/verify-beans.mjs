/**
 * Dependency-free regression checks against the actual server handlers.
 * Run: node --experimental-vm-modules scripts/verify-beans.mjs (Node 24).
 * Storage, framework responses and external AI calls are test doubles.
 * This is not a browser or deployed-backend test.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { stripTypeScriptTypes } from "node:module";

const root = path.resolve(import.meta.dirname, "..");
const context = vm.createContext({
  console, Date, Math, crypto, AbortController, AbortSignal, setTimeout, clearTimeout,
  Request, Response, URL, process: { env: {} },
  fetch: async () => { throw new Error("External fetch prohibited in local regression tests"); },
});
const modules = new Map();
async function load(file) {
  if (modules.has(file)) return modules.get(file);
  const source = stripTypeScriptTypes(fs.readFileSync(file, "utf8"), { mode: "transform" });
  const mod = new vm.SourceTextModule(source, { context, identifier: file });
  modules.set(file, mod);
  await mod.link(async (spec, ref) => {
    if (spec === "next/server") {
      if (!modules.has(spec)) modules.set(spec, new vm.SyntheticModule(["NextRequest", "NextResponse"], function () {
        this.setExport("NextRequest", Request);
        this.setExport("NextResponse", { json: (data, options) => Response.json(data, options) });
      }, { context }));
      return modules.get(spec);
    }
    let resolved = spec.startsWith("@/") ? path.join(root, "src", spec.slice(2)) : path.resolve(path.dirname(ref.identifier), spec);
    resolved = fs.existsSync(resolved + ".ts") ? resolved + ".ts" : path.join(resolved, "index.ts");
    return load(resolved);
  });
  return mod;
}
async function get(relative) {
  const mod = await load(path.join(root, relative));
  if (mod.status !== "evaluated") await mod.evaluate();
  return mod.namespace;
}

const { default: Server } = await get("party/server.ts");
const { applyDiceRoll, snakeDraftOrder } = await get("src/shared/engine/index.ts");
const { resolvePartyHost, DEFAULT_PARTYKIT_HOST } = await get("src/shared/connection.ts");
let cases = 0;
for (let roll = 1; roll <= 3; roll++) for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) {
  const total = a + b;
  const expected = roll <= 2 ? 100 + (total === 7 ? 70 : total) : total === 7 ? 0 : a === b ? 200 : 100 + total;
  assert.equal(applyDiceRoll(100, { d1: a, d2: b }, roll).potAfter, expected);
  cases++;
}
for (let n = 3; n <= 10; n++) {
  const order = snakeDraftOrder(n, 4, 0);
  assert.equal(order.length, n * 4);
  for (let seat = 0; seat < n; seat++) assert.equal(order.filter(x => x === seat).length, 4);
}
console.log("PASS: " + cases + " dice cases and snake counts for 3–10 players");

function seed(n) {
  const storage = { async get() {}, async put() {}, async delete() {}, async setAlarm() {}, async deleteAlarm() {} };
  const server = new Server({ id: "LOCAL", storage, getConnections() { return []; }, env: {} });
  const ids = Array.from({ length: n }, (_, i) => "p" + i);
  for (const id of ids) server.handleJoin(id, id, "player");
  server.state.players.forEach((p, i) => p.seat = i);
  Object.assign(server.state, {
    phase: "DICE", diceSubphase: "READY", seatOrder: ids, diceTurnSeat: 0,
    diceActiveIds: [...ids], diceRoundStartedAt: Date.now(),
    pots: Object.fromEntries(ids.map(id => [id, 50])),
    protectedStones: Object.fromEntries(ids.map(id => [id, 20])),
    personalRollCounts: Object.fromEntries(ids.map(id => [id, 0])),
  });
  return server;
}
for (const n of [3, 6, 10]) {
  for (const stage of ["COOLDOWN", "READY", "COMMITTED"]) {
    const s = seed(n);
    s.state.diceSubphase = stage === "COMMITTED" ? "READY" : stage;
    if (stage === "COMMITTED") await s.handleRoll("p0");
    else await s.setAlarmAt(Date.now(), { kind: stage === "COOLDOWN" ? "dice_decision" : "dice_idle", revision: s.state.phaseRevision });
    const revision = s.state.phaseRevision;
    await s.handlePullOut("p1");
    assert.equal(s.state.phaseRevision, revision, "waiting bank must preserve the pending alarm revision");
    assert.equal(s.state.diceTurnSeat, 0);
    assert.equal(s.state.players.find(p => p.id === "p1").stones, 70);
    await assert.rejects(s.handlePullOut("p1"));
    assert.equal(s.state.players.find(p => p.id === "p1").stones, 70);
    if (stage === "COMMITTED") await assert.rejects(s.handlePullOut("p0"));
    await s.onAlarm();
    if (stage === "COOLDOWN") assert.equal(s.state.diceSubphase, "READY", "cooldown must unlock");
    if (stage === "READY") assert.equal(s.state.diceActiveIds.includes("p0"), false, "idle player must bank");
    if (stage === "COMMITTED") assert.equal(s.state.lastDice.revealed, true, "dice must settle");
  }
  const s = seed(n);
  s.state.phase = "VOTING_AND_JUDGING";
  s.state.humanVotes = { p0: "p1" };
  const spectator = s.publicStateFor("observer");
  assert.equal("humanVotes" in spectator, false);
  assert.equal(spectator.myHumanVote, null);
  await assert.rejects(s.handle({ type: "submit_ai_judgments", judgments: [] }, { id: "p0" }));
}
console.log("PASS: actual waiting-bank/timer/duplicate/privacy/client-judge handlers for 3, 6, 10 players");

for (const env of ["test", "preview"]) {
  assert.equal(resolvePartyHost(undefined, env), "");
  assert.equal(resolvePartyHost(DEFAULT_PARTYKIT_HOST, env), "");
  assert.equal(resolvePartyHost("https://" + DEFAULT_PARTYKIT_HOST.toUpperCase() + "/", env), "");
  assert.equal(resolvePartyHost("beans-test.example", env), "beans-test.example");
}
assert.equal(resolvePartyHost(undefined, "production"), DEFAULT_PARTYKIT_HOST);
assert.equal(resolvePartyHost(undefined, "development"), "localhost:1999");
console.log("PASS: preview connections fail closed when test backend is missing or points to production");

const { POST } = await get("src/app/api/judge/route.ts");
const body = JSON.stringify({ topic: "Snacks", rosters: [{ anonId: "R1", picks: ["a", "b", "c", "d"] }] });
function request(headers = {}) { return new Request("http://local/api/judge", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body }); }
context.process.env = { OPENAI_API_KEY: "test-only-key" };
assert.equal((await POST(request({ "x-quarry-judge": "partykit" }))).status, 401);
context.process.env = { OPENAI_API_KEY: "test-only-key", JUDGE_SECRET: "test-only-secret" };
assert.equal((await POST(request({ authorization: "Bearer wrong" }))).status, 401);
context.process.env = {};
const fallback = await POST(request());
assert.equal(fallback.status, 200);
assert.equal((await fallback.json()).fallback, true);
console.log("PASS: spoofed judge header rejected, incorrect secret rejected, neutral fallback remains available");
console.log("No live rooms, real credentials, or paid AI calls used.");
