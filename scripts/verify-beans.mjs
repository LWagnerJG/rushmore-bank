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
function load(file) {
  if (modules.has(file)) return modules.get(file);
  if (file === "next/server") {
    const mod = new vm.SyntheticModule(["NextRequest", "NextResponse"], function () {
      this.setExport("NextRequest", Request);
      this.setExport("NextResponse", { json: (data, options) => Response.json(data, options) });
    }, { context });
    modules.set(file, mod);
    return mod;
  }
  const source = stripTypeScriptTypes(fs.readFileSync(file, "utf8"), { mode: "transform" });
  const mod = new vm.SourceTextModule(source, { context, identifier: file });
  modules.set(file, mod);
  return mod;
}
function linker(spec, ref) {
  if (spec === "next/server") return load(spec);
  let resolved = spec.startsWith("@/") ? path.join(root, "src", spec.slice(2)) : path.resolve(path.dirname(ref.identifier), spec);
  resolved = fs.existsSync(resolved + ".ts") ? resolved + ".ts" : path.join(resolved, "index.ts");
  return load(resolved);
}
async function get(relative) {
  const mod = load(path.join(root, relative));
  if (mod.status === "unlinked") await mod.link(linker);
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
for (let n = 2; n <= 10; n++) {
  const order = snakeDraftOrder(n, 4, 0);
  assert.equal(order.length, n * 4);
  for (let seat = 0; seat < n; seat++) assert.equal(order.filter(x => x === seat).length, 4);
}
console.log("PASS: " + cases + " dice cases and snake counts for 2–10 players");

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
for (const n of [2, 3, 6, 10]) {
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
console.log("PASS: actual waiting-bank/timer/duplicate/privacy/client-judge handlers for 2, 3, 6, 10 players");

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


// Keep Fudge's provider choice and anonymous scoring intact end to end.
function fresh(n) {
  const storage = { async get() {}, async put() {}, async delete() {}, async setAlarm() {}, async deleteAlarm() {} };
  const server = new Server({ id: "LOCAL", storage, getConnections() { return []; }, env: { JUDGE_URL: "https://judge.test", JUDGE_SECRET: "test-only-secret" } });
  for (let i = 0; i < n; i++) server.handleJoin("p" + i, "Friend " + i, "player");
  return server;
}
async function settleJob(server) {
  for (let i = 0; i < 50 && server.state.phase === "VOTING_AND_JUDGING"; i++) await new Promise(setImmediate);
}
let providerCalls = [];
context.fetch = async (url, options) => {
  if (url === "https://judge.test/api/judge") return POST(new Request(url, options));
  if (url === "https://judge.test/api/draft-options") return Response.json({ options: [] });
  const u = new URL(url);
  providerCalls.push(u.hostname);
  if (u.hostname === "generativelanguage.googleapis.com") assert.equal(u.pathname, "/v1beta/models/" + (context.process.env.GEMINI_MODEL || "gemini-3.5-flash") + ":generateContent");
  const payload = JSON.parse(options.body);
  const user = u.hostname === "generativelanguage.googleapis.com"
    ? JSON.parse(payload.contents[0].parts[0].text)
    : JSON.parse(payload.messages[1].content);
  for (const roster of user.rosters) {
    assert.deepEqual(Object.keys(roster).sort(), ["anonId", "picks"]);
    assert.equal(roster.picks.length, 4);
  }
  const result = { judgments: user.rosters.map((r, i) => ({ anonId: r.anonId, topicFit: 8, pickStrength: 16 - i, rosterQuality: 7, explanation: "Strong picks with variety." })) };
  if (u.hostname === "generativelanguage.googleapis.com") return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }] });
  if (u.hostname === "api.openai.com") return Response.json({ choices: [{ message: { content: JSON.stringify(result) } }] });
  throw new Error("Unexpected external request in test");
};

for (const mode of ["gemini", "alias", "openai", "neutral"]) {
  context.process.env = { JUDGE_SECRET: "test-only-secret" };
  if (mode === "gemini") Object.assign(context.process.env, { GEMINI_API_KEY: "test", OPENAI_API_KEY: "test" });
  if (mode === "alias") Object.assign(context.process.env, { GOOGLE_GENERATIVE_AI_API_KEY: "test", GEMINI_MODEL: "gemini-3.1-flash-lite" });
  if (mode === "openai") context.process.env.OPENAI_API_KEY = "test";
  providerCalls = [];
  const s = fresh(2);
  await s.handleStart("p0");
  assert.equal(s.state.configuredTopicRounds, 3);
  for (let round = 0; round < 3; round++) {
    assert.equal(s.state.phase, "TOPIC_SELECTION");
    const topicId = s.state.topicOptions[0].id;
    await s.handleVoteTopic("p0", topicId);
    await s.handleVoteTopic("p1", topicId);
    assert.equal(s.state.phase, "PREP");
    await s.handleAdvance("p0");
    while (s.state.phase === "DRAFT") await s.handleLockIn(s.currentDraftPlayerId(), "Pick " + s.state.draftCursor);
    assert.equal(s.state.picks.length, 8);
    for (const id of s.state.seatOrder) assert.equal(s.state.picks.filter(p => p.playerId === id).length, 4);
    assert.equal(s.state.phase, "REVIEW");
    await s.handleSkipReview("p0");
    await settleJob(s);
    assert.equal(s.state.phase, "SCORE_REVEAL", "two players must not wait for fake votes");
    assert.equal(s.publicStateFor("p0").humanVotesNeeded, 0);
    assert.equal(Object.keys(s.state.humanVotes).length, 0);
    for (const score of s.state.scores) {
      assert.equal(score.votes, 0);
      assert.equal(score.earned, mode === "neutral" ? 40 : 20 + score.aiAward);
    }
    const before = Object.fromEntries(s.state.players.map(p => [p.id, p.stones]));
    const earned = { ...s.state.earnedThisRound };
    await s.handleAdvance("p0");
    await s.handleWager("p0", Math.floor(earned.p0 / 2));
    await s.handleWager("p1", Math.floor(earned.p1 / 2));
    assert.equal(s.state.phase, "DICE");
    await s.onAlarm(); // Server cooldown alarm; no wall-clock wait in unit harness.
    const roller = s.currentDicePlayerId();
    await s.handleRoll(roller);
    assert.equal(s.publicStateFor("p1").lastDice.d1, undefined);
    await s.onAlarm();
    assert.equal(s.state.lastDice.revealed, true);
    const gain = s.state.lastDice.potAfter - s.state.lastDice.potBefore;
    for (const id of [...s.state.diceActiveIds]) await s.handlePullOut(id);
    for (const p of s.state.players) assert.equal(p.stones, before[p.id] + earned[p.id] + (p.id === roller ? gain : 0));
    assert.equal(s.state.phase, round === 2 ? "GAME_RESULTS" : "ROUND_RESULTS");
    if (round < 2) await s.handleAdvance("p0");
  }
  assert.equal(s.state.gameOver, true);
  assert.equal(providerCalls.length, mode === "neutral" ? 0 : 3);
  if (mode !== "neutral") assert.equal(providerCalls.every(host => host === (mode === "openai" ? "api.openai.com" : "generativelanguage.googleapis.com")), true);
}
console.log("PASS: complete 2-player games through 3 rounds with Gemini, Google alias, OpenAI, and neutral fallback (mock APIs)");

// A two-player ballot cannot add five artificial beans, even with forged input.
const pair = fresh(2);
await pair.handleStart("p0");
pair.state.phase = "VOTING_AND_JUDGING";
await assert.rejects(pair.handleVote("p0", "p1"), /Two-player/);
assert.equal(Object.keys(pair.state.humanVotes).length, 0);

// Locked roster size, not transient connection count, selects group voting.
const group = fresh(3);
await group.handleStart("p0");
group.state.players[2].connected = false;
group.state.phase = "VOTING_AND_JUDGING";
await group.handleVote("p0", "p1");
assert.equal(group.state.humanVotes.p0, "p1");
assert.equal(group.publicStateFor("p0").humanVotesNeeded, 2);
console.log("PASS: two-player vote rejection and retained group ballots when a third player disconnects");

for (const n of [2, 3, 10]) for (const stage of ["DRAFT", "REVIEW", "VOTING_AND_JUDGING"]) for (const timeout of [false, true]) {
  const s = fresh(n);
  await s.handleStart("p0");
  await s.beginDraft();
  const pickCount = stage === "DRAFT" ? 2 : n * 4;
  for (let i = 0; i < pickCount; i++) await s.handleLockIn(s.currentDraftPlayerId(), "Original " + i);
  s.state.phase = stage;
  if (stage === "VOTING_AND_JUDGING") { s.state.judgeJobId = "stale-job"; s.state.humanVotes = { p0: "p1" }; }
  const resumeCursor = s.state.draftCursor;
  const original = { ...s.state.picks[0] };
  await s.handleCorrect("p0", original.turnIndex, "invalid");
  assert.equal(s.state.phase, "CORRECTION");
  assert.equal(s.currentDraftPlayerId(), original.playerId);
  assert.equal(s.state.judgeJobId, null);
  if (timeout) await s.onPickTimeout();
  else await s.handleLockIn(original.playerId, "Replacement");
  assert.equal(s.state.draftCursor, resumeCursor);
  assert.equal(s.state.phase, stage === "DRAFT" ? "DRAFT" : "REVIEW");
  assert.equal(s.state.picks.length, pickCount);
  assert.equal(s.state.picks.find(p => p.turnIndex === original.turnIndex).pickIndex, original.pickIndex);
  while (s.state.phase === "DRAFT") await s.handleLockIn(s.currentDraftPlayerId(), "Remaining " + s.state.draftCursor);
  assert.equal(new Set(s.state.picks.map(p => p.turnIndex)).size, n * 4);
  for (const id of s.state.seatOrder) {
    assert.equal(s.state.picks.filter(p => p.playerId === id).length, 4);
    assert.equal(new Set(s.state.picks.filter(p => p.playerId === id).map(p => p.pickIndex)).size, 4);
  }
  s.state.scoresLocked = true;
  const snapshot = JSON.stringify(s.state.picks);
  await assert.rejects(s.handleCorrect("p0", 0, "duplicate"));
  assert.equal(JSON.stringify(s.state.picks), snapshot);
}
console.log("PASS: corrections and expired replacement turns resume correctly for 2, 3, 10 players; locked corrections do not mutate picks");


const { maxWager, applyWager } = await get("src/shared/engine/wager.ts");
assert.equal(maxWager(40, 900), 940);
assert.equal(applyWager({ earned: 40, banked: 900, wager: 940 }).protected, 0);
assert.equal(Number.isFinite(applyWager({ earned: 40, banked: 900, wager: NaN }).pot), true);
const nativeMath = context.Math;
context.Math = Object.create(Math);
context.Math.random = () => 0;
for (const n of [2, 3, 10]) {
  const s = fresh(n);
  await s.handleStart("p0");
  s.state.players.forEach((p) => p.stones = 100);
  s.state.earnedThisRound = Object.fromEntries(s.state.seatOrder.map((id) => [id, 40]));
  await s.beginWagers();
  for (const bad of [NaN, Infinity, -1, 1.5, 141]) await assert.rejects(s.handleWager("p0", bad));
  await s.handleWager("p0", 0);
  await assert.rejects(s.handleWager("p0", 20), /locked/);
  for (let i = 1; i < n; i++) await s.handleWager("p" + i, 0);
  assert.equal(s.state.phase, "DICE", "all-zero wagers must still play BANK");
  assert.equal(s.state.diceActiveIds.length, n);
  assert.equal(s.state.players.every((p) => p.stones === 140), true);
  const order = [...s.state.seatOrder];
  // Two complete circuits: each person rolls exactly once per circuit.
  for (let circuit = 0; circuit < 2; circuit++) for (const id of order) {
    assert.equal(s.currentDicePlayerId(), id);
    await s.onAlarm();
    await s.handleRoll(id);
    assert.equal(s.state.personalRollCounts[id], circuit + 1);
    await s.onAlarm();
    assert.equal(s.state.diceActiveIds.length, n);
    assert.equal(s.state.pots[id], (circuit + 1) * 2);
  }
  // A seven after the two safe rolls only busts its roller.
  let randomCall = 0;
  context.Math.random = () => (randomCall++ % 2 === 0 ? 0 : 5 / 0x100000000);
  s.state.diceRoundStartedAt = Date.now() - 600_000;
  s.state.diceLapsCompleted = 9;
  const busted = s.currentDicePlayerId();
  await s.onAlarm(); await s.handleRoll(busted); await s.onAlarm();
  assert.equal(s.state.phase, "DICE", "no global timer prematurely ends everyone's BANK round");
  assert.equal(s.state.pots[busted], 0);
  assert.equal(s.state.diceActiveIds.length, n - 1);
  assert.equal(s.state.players.find((p) => p.id === busted).stones, 140);
  for (const id of [...s.state.diceActiveIds]) await s.handlePullOut(id);
  for (const p of s.state.players) assert.equal(p.stones, p.id === busted ? 140 : 144);
  await s.handleAdvance("p0");
  assert.equal(s.state.lastDice, null);
  assert.equal(Object.keys(s.state.personalRollCounts).length, 0);
  s.state.earnedThisRound = Object.fromEntries(order.map((id) => [id, 40]));
  await s.beginWagers();
  for (const id of order) await s.handleWager(id, 0);
  assert.equal(s.state.diceActiveIds.length, n, "banked and busted players re-enter next topic");
  assert.equal(Object.values(s.state.personalRollCounts).every((count) => count === 0), true);
  // Idle banking must work for zero pots too, or absent players stall the table.
  for (let i = 0; i < n; i++) { await s.onAlarm(); await s.onAlarm(); }
  assert.equal(s.state.diceActiveIds.length, 0);
  assert.equal(s.state.phase === "ROUND_RESULTS" || s.state.phase === "GAME_RESULTS", true);
  context.Math.random = () => 0;
}
context.Math = nativeMath;
console.log("PASS: full round-robin BANK circuits, zero/all wagers, personal safe-roll resets, individual busts, carryover and idle exits for 2, 3, 10 players");

const { cleanDraftOptions, starterDraftOptions } = await get("src/shared/draft-options.ts");
assert.deepEqual(Array.from(cleanDraftOptions(["  Aaron Judge ", "aaron judge", 5, "", "a".repeat(49), "Babe Ruth"])), ["Aaron Judge", "Babe Ruth"]);
assert.equal(starterDraftOptions("greatest-nba-players").length >= 40, true);
const { POST: draftOptionsPost } = await get("src/app/api/draft-options/route.ts");
function draftRequest(auth = "Bearer test-only-secret", data = { topic: "Greatest NBA players", scopeBoundary: "NBA only" }) {
  return new Request("http://local/api/draft-options", { method: "POST", headers: { authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify(data) });
}
context.process.env = { GEMINI_API_KEY: "test" };
assert.equal((await draftOptionsPost(draftRequest())).status, 401);
context.process.env.JUDGE_SECRET = "test-only-secret";
assert.equal((await draftOptionsPost(draftRequest("Bearer wrong"))).status, 401);
assert.equal((await draftOptionsPost(draftRequest(undefined, { topic: 123 }))).status, 400);
context.fetch = async (url, options) => {
  assert.equal(new URL(url).hostname, "generativelanguage.googleapis.com");
  const input = JSON.parse(JSON.parse(options.body).contents[0].parts[0].text);
  assert.deepEqual(Object.keys(input).sort(), ["scopeBoundary", "topic"]);
  return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ options: ["Jordan", " Jordan ", "Curry"] }) }] } }] });
};
assert.deepEqual((await (await draftOptionsPost(draftRequest())).json()).options, ["Jordan", "Curry"]);
context.fetch = async () => { throw new Error("Provider down"); };
assert.deepEqual((await (await draftOptionsPost(draftRequest())).json()).options, []);
const late = fresh(2);
late.state.selectedTopic = { id: "old", text: "Old", scope: "everyday", scopeBoundary: "Old" };
late.state.phase = "PREP"; late.state.draftOptionsJobId = "old-job";
let release;
context.fetch = () => new Promise((resolve) => { release = resolve; });
const pendingOptions = late.loadDraftOptions(late.state.selectedTopic, "old-job");
await late.beginTopicSelection();
release(Response.json({ options: ["Stale pick"] }));
await pendingOptions;
assert.equal(late.state.draftOptions.length, 0);
assert.equal("draftOptionsJobId" in late.publicStateFor("p0"), false);
console.log("PASS: suggestion auth, bounds, deduplication, private payload, provider failure and stale-job isolation");
console.log("No live rooms, real credentials, or paid AI calls used.");
