/** Browser -> real Next app -> real local PartyKit -> durable state -> browser. */
import fs from "node:fs";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";

const out = "test-results";
fs.mkdirSync(out, { recursive: true });
const config = ".partykit-browser-ci.json";
fs.writeFileSync(config, JSON.stringify({ name: "beans-browser-ci", main: "party/server.ts", compatibilityDate: "2024-09-01", port: 1999, vars: { JUDGE_URL: "http://localhost:3000", JUDGE_SECRET: "ci-local-only" } }));
const env = { ...process.env, JUDGE_SECRET: "ci-local-only", GEMINI_API_KEY: "", GOOGLE_GENERATIVE_AI_API_KEY: "", OPENAI_API_KEY: "", NEXT_TELEMETRY_DISABLED: "1" };
const children = [];
const report = { passed: [], errors: [], pages: [], dice: [], logs: {} };
function start(command, args, name) {
  const child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] });
  const log = fs.createWriteStream(`${out}/${name}.log`);
  child.stdout.pipe(log); child.stderr.pipe(log); children.push(child);
  return child;
}
async function until(check, message, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  throw new Error("Timeout: " + message);
}
const address = "http://localhost:3000";
async function smoke(type, engine) {
  const browser = await engine.launch();
  const contexts = [];
  const clients = [];
  const errors = [];
  try {
    for (const name of ["Luke", "Brynna"]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      contexts.push(context);
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
      const page = await context.newPage();
      const client = { name, page, state: null, id: null };
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("websocket", (socket) => socket.on("framereceived", ({ payload }) => {
        try { const message = JSON.parse(String(payload)); if (message.state) { client.state = message.state; client.id = message.youId; } } catch {}
      }));
      clients.push(client);
    }
    const [host, guest] = clients;
    await host.page.goto(address);
    await host.page.getByLabel("Your name", { exact: true }).fill("Luke");
    await host.page.getByRole("button", { name: "Make a room", exact: true }).click();
    await until(() => host.state?.phase === "LOBBY" && host.state.players.length === 1, "host lobby");
    assert.equal(await host.page.getByRole("button", { name: "Start game", exact: true }).isDisabled(), true);
    const code = host.state.code;
    await guest.page.goto(address);
    await guest.page.getByRole("button", { name: "Join friends", exact: true }).click();
    await guest.page.getByLabel("Your name", { exact: true }).fill("Brynna");
    await guest.page.getByLabel("Room code", { exact: true }).fill(code);
    await guest.page.getByRole("button", { name: "Join the room", exact: true }).click();
    await until(() => clients.every((client) => client.state?.players.length === 2), "live lobby arrivals");
    await host.page.getByRole("heading", { name: "Players (2/10)", exact: true }).waitFor();
    const roster = host.page.getByLabel("Lobby players");
    assert.match(await roster.innerText(), /Brynna/);
    assert.equal((await roster.boundingBox()).y < 350, true, "arrivals visible before sharing controls");
    await host.page.screenshot({ path: `${out}/${type}-lobby.png`, fullPage: true });
    await host.page.screenshot({ path: `${out}/${type}-lobby.jpg`, type: "jpeg", quality: 40, scale: "css" });
    guest.state = null;
    await guest.page.reload();
    await until(() => guest.state?.players.find((player) => player.id === guest.id)?.connected, "rejoin");
    await host.page.getByRole("button", { name: "Start game", exact: true }).click();
    for (let round = 0; round < 3; round++) {
      await until(() => host.state?.phase === "TOPIC_SELECTION", "topic selection");
      await host.page.getByText("Write a topic", { exact: true }).click();
      await host.page.getByLabel("Custom topic").fill("Greatest NBA players of all time");
      await host.page.getByRole("button", { name: "Use this topic", exact: true }).click();
      await until(() => clients.every((client) => client.state?.phase === "PREP"), "prep");
      await guest.page.getByLabel("Private idea").fill("Private queue check");
      await guest.page.getByRole("button", { name: "Queue", exact: true }).click();
      await host.page.getByRole("button", { name: "Skip prep", exact: true }).click();
      await until(() => host.state?.phase === "DRAFT", "draft");
      assert.equal(host.state.draftOptions.length >= 40, true);
      assert.equal(JSON.stringify(host.state).includes("Private queue check"), false);
      await guest.page.getByRole("button", { name: "My queue (1)", exact: true }).click();
      await guest.page.getByRole("button", { name: "Private queue check", exact: true }).waitFor();
      await guest.page.getByRole("button", { name: "Available", exact: true }).click();
      const order = [...host.state.draftOrder];
      const seats = [...host.state.seatOrder];
      for (let pick = 0; pick < 8; pick++) {
        await until(() => clients.every((client) => client.state?.draftCursor === pick), "pick sync");
        const player = clients.find((client) => client.id === seats[order[pick]]);
        const answer = player.state.draftOptions.find((text) => !player.state.takenNormalized.includes(text.toLowerCase()));
        await player.page.getByRole("button", { name: "Available", exact: true }).click();
        await player.page.getByRole("button", { name: answer, exact: true }).click();
        await player.page.getByRole("button", { name: "Lock pick", exact: true }).click();
        await until(() => host.state.picks.length === pick + 1, "locked pick on board");
        if (pick === 0) {
          await host.page.getByRole("button", { name: "Board", exact: true }).click();
          assert.match(await host.page.getByRole("table").innerText(), new RegExp(answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
          assert.equal(await host.page.locator("td").count(), 8);
          await host.page.screenshot({ path: `${out}/${type}-draft.png`, fullPage: true });
          await host.page.screenshot({ path: `${out}/${type}-draft.jpg`, type: "jpeg", quality: 40, scale: "css" });
          await host.page.getByRole("button", { name: "Available", exact: true }).click();
        }
      }
      await until(() => host.state?.phase === "REVIEW", "review");
      await host.page.getByRole("button", { name: "Judge our picks", exact: true }).click();
      await until(() => clients.every((client) => client.state?.phase === "SCORE_REVEAL"), "neutral judge");
      assert.equal(host.state.scores.every((score) => score.earned === 40 && score.aiFallback), true);
      await host.page.getByRole("button", { name: "Choose beans to roll", exact: true }).click();
      await until(() => clients.every((client) => client.state?.phase === "WAGER_SELECTION"), "wagers");
      const totals = Object.fromEntries(host.state.players.map((p) => [p.id, p.stones + 40]));
      for (const [i, client] of clients.entries()) {
        const slider = client.page.getByRole("slider", { name: "Wager slider" });
        await slider.waitFor();
        assert.equal(Number(await slider.getAttribute("max")), totals[client.id]);
        await slider.focus();
        await slider.press(i === 0 ? "Home" : "End");
        assert.equal(await client.page.getByLabel("Beans to wager").inputValue(), i === 0 ? "0" : String(totals[client.id]));
        if (i === 0 && round === 0) await client.page.screenshot({ path: `${out}/${type}-wager.png`, fullPage: true });
        await client.page.getByRole("button", { name: /^Lock \d+ beans$/ }).click();
      }
      await until(() => clients.every((client) => client.state?.phase === "DICE"), "fresh BANK round");
      assert.equal(host.state.diceActiveIds.length, 2);
      assert.equal(Object.values(host.state.personalRollCounts).every((count) => count === 0), true);
      const circuits = round === 0 ? 2 : 1;
      for (let turn = 0; turn < circuits * 2; turn++) {
        await until(() => host.state.diceSubphase === "READY", "roll countdown", 20000);
        const player = clients.find((client) => client.id === host.state.seatOrder[host.state.diceTurnSeat]);
        await player.page.getByRole("button", { name: "Roll dice", exact: true }).click();
        await until(() => clients.every((client) => client.state?.lastDice && !client.state.lastDice.revealed), "shared tumble");
        assert.equal(host.state.lastDice.rollId, guest.state.lastDice.rollId);
        assert.equal(host.state.lastDice.d1, undefined);
        await until(() => clients.every((client) => client.state?.lastDice?.revealed), "shared dice reveal");
        const dice = host.state.lastDice;
        assert.equal(dice.d1, guest.state.lastDice.d1);
        assert.equal(dice.d2, guest.state.lastDice.d2);
        for (const client of clients) {
          await client.page.getByRole("img", { name: `Dice show ${dice.d1} and ${dice.d2}, total ${dice.d1 + dice.d2}`, exact: true }).waitFor();
          assert.equal(await client.page.locator(".bean-die").first().getAttribute("data-face"), String(dice.d1));
          assert.equal(await client.page.locator(".bean-die").nth(1).getAttribute("data-face"), String(dice.d2));
        }
        for (const client of clients) await until(async () => {
          const frontPips = await client.page.locator(".bean-die").evaluateAll((dice) => dice.map((die) => {
            const rotation = new DOMMatrix(getComputedStyle(die).transform);
            const front = [...die.children].sort((a, b) => rotation.multiply(new DOMMatrix(getComputedStyle(b).transform)).m33 - rotation.multiply(new DOMMatrix(getComputedStyle(a).transform)).m33)[0];
            return front.querySelectorAll(".bean-pip").length;
          }));
          return frontPips[0] === dice.d1 && frontPips[1] === dice.d2;
        }, "visible pip faces match server dice", 2000);
        if (turn === 0 && round === 0) {
          await new Promise(resolve => setTimeout(resolve, 300));
          report.dice.push({ engine: type, faces: [dice.d1, dice.d2], styles: await host.page.locator(".bean-die").evaluateAll((elements) => elements.map((element) => ({
            transform: getComputedStyle(element).transform, style: getComputedStyle(element).transformStyle,
            faceTransforms: [...element.children].map((face) => getComputedStyle(face).transform),
          }))) });
          await host.page.locator(".bean-dice-tray").screenshot({ path: `${out}/${type}-dice-tray.jpg`, type: "jpeg", quality: 65, scale: "css" });
          await host.page.screenshot({ path: `${out}/${type}-dice.png`, fullPage: true });
          await host.page.screenshot({ path: `${out}/${type}-dice.jpg`, type: "jpeg", quality: 40, scale: "css" });
        }
      }
      for (const client of clients) {
        await client.page.getByRole("button", { name: /^Bank \d+$/ }).click();
      }
      await until(() => host.state.phase === (round === 2 ? "GAME_RESULTS" : "ROUND_RESULTS"), "round end");
      assert.equal(host.state.players.every((p) => p.stones >= totals[p.id]), true, "safe dice gains and balances carry forward");
      if (round < 2) await host.page.getByRole("button", { name: "Next Topic", exact: true }).click();
    }
    assert.deepEqual(errors, []);
    await host.page.screenshot({ path: `${out}/${type}-final.png`, fullPage: true });
    report.passed.push(type);
    console.log(`PASS ${type}: create/join, live lobby, rejoin, queue privacy, snake board, wager slider, synced dice and 3-round two-player game`);
  } catch (error) {
    report.errors.push(`${type}: ${error.stack || error}`);
    for (const client of clients) {
      report.pages.push({ engine: type, name: client.name, phase: client.state?.phase, cursor: client.state?.draftCursor, body: (await client.page.locator("body").innerText().catch(() => "")).slice(0, 2500) });
      await client.page.screenshot({ path: `${out}/${type}-${client.name}-failure.jpg`, type: "jpeg", quality: 40, scale: "css" }).catch(() => {});
    }
    throw error;
  } finally {
    for (let i = 0; i < contexts.length; i++) await contexts[i].tracing.stop({ path: `${out}/${type}-${i}.zip` });
    await browser.close();
  }
}
try {
  start("node_modules/.bin/next", ["start", "-p", "3000"], "next");
  start("node_modules/.bin/partykit", ["dev", "--config", config], "partykit");
  await until(async () => { try { return (await fetch(address)).ok && (await fetch("http://localhost:1999/parties/main/CHECK")).ok; } catch { return false; } }, "local servers", 60000);
  const checks = await Promise.allSettled([smoke("chromium", chromium), smoke("webkit", webkit)]);
  for (const result of checks) if (result.status === "rejected") throw result.reason;
} catch (error) {
  report.errors.push(String(error.stack || error));
  throw error;
} finally {
  for (const name of ["next", "partykit"]) {
    const file = `${out}/${name}.log`;
    if (fs.existsSync(file)) report.logs[name] = fs.readFileSync(file, "utf8").slice(-4000);
  }
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  for (const child of children) child.kill("SIGTERM");
  fs.rmSync(config, { force: true });
}
