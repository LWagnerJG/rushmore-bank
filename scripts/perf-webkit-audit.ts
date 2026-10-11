/**
 * WebKit / throttled Chromium perf audit @ 390×844.
 * Usage: PARTY_HOST=127.0.0.1:8787 npx tsx scripts/perf-webkit-audit.ts
 */
import { chromium, webkit, devices, type Page } from "playwright";
import {
  SmokeClient,
  playHumanTurn,
  randomRoomCode,
  resolvePartyHost,
  sleep,
} from "./smoke-lib";

const VIEWPORT = { width: 390, height: 844 };
const APP = process.env.APP_URL || "http://localhost:3000";
const PARTY = resolvePartyHost();

type PhaseBytes = Record<string, { count: number; bytes: number; max: number }>;

async function measureHome(page: Page) {
  await page.goto(`${APP}/`, { waitUntil: "networkidle" });
  // String form avoids tsx/esbuild injecting helpers that WebKit rejects.
  return page.evaluate(`(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const paints = performance.getEntriesByType("paint");
    const resources = performance.getEntriesByType("resource");
    const sum = (pred) =>
      resources
        .filter(pred)
        .reduce((s, r) => s + (r.transferSize || r.encodedBodySize || 0), 0);
    return {
      fcp:
        paints.find((p) => p.name === "first-contentful-paint")?.startTime ??
        null,
      dcl: nav?.domContentLoadedEventEnd ?? null,
      load: nav?.loadEventEnd ?? null,
      jsBytes: sum(
        (r) =>
          r.initiatorType === "script" ||
          r.name.includes(".js") ||
          r.name.includes("/_next/"),
      ),
      cssBytes: sum(
        (r) =>
          r.initiatorType === "css" ||
          r.initiatorType === "link" ||
          r.name.includes(".css"),
      ),
      fontBytes: sum(
        (r) => r.name.includes("font") || r.name.includes("woff"),
      ),
      imgBytes: sum(
        (r) =>
          r.initiatorType === "img" ||
          /\\.(png|webp|jpe?g|svg|ico)/i.test(r.name),
      ),
      resourceCount: resources.length,
    };
  })()`);
}

async function measureWsPayloads(): Promise<{
  byPhase: PhaseBytes;
  totalBytes: number;
  totalMsgs: number;
  finalPhase: string | null;
}> {
  const room = randomRoomCode("PF");
  const host = new SmokeClient(PARTY, room, "perf-host", "PerfHost");
  await host.connect();
  await host.join("player");

  const byPhase: PhaseBytes = {};
  let totalBytes = 0;
  let totalMsgs = 0;
  const onMsg = (ev: MessageEvent) => {
    const raw = String(ev.data);
    const bytes = new TextEncoder().encode(raw).length;
    let phase = "?";
    try {
      const msg = JSON.parse(raw) as {
        type?: string;
        state?: { phase?: string };
      };
      if (msg.type === "state" || msg.type === "joined") {
        phase = msg.state?.phase ?? "?";
      } else {
        phase = msg.type ?? "?";
      }
    } catch {
      phase = "parse_err";
    }
    if (phase === "ping" || phase === "pong") return;
    totalBytes += bytes;
    totalMsgs += 1;
    const slot = (byPhase[phase] ??= { count: 0, bytes: 0, max: 0 });
    slot.count += 1;
    slot.bytes += bytes;
    slot.max = Math.max(slot.max, bytes);
  };
  host.sock.addEventListener("message", onMsg);

  host.send({
    type: "admin_spawn_bots",
    pin: process.env.ADMIN_PIN || "",
    count: 3,
    fast: true,
  });
  await host.wait(
    () =>
      (host.state?.players.filter((p) => p.id.startsWith("bot-")).length ?? 0) >=
      3,
    10_000,
    "bot spawn",
  );
  host.send({ type: "set_topic_rounds", rounds: 1 });
  await sleep(100);
  host.send({ type: "start" });

  const until = "ROUND_RESULTS";
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const phase = host.state?.phase ?? null;
    if (phase === until || phase === "GAME_RESULTS") break;
    await playHumanTurn(host);
    await sleep(120);
  }

  host.sock.removeEventListener("message", onMsg);
  const finalPhase = host.state?.phase ?? null;
  host.close();
  return { byPhase, totalBytes, totalMsgs, finalPhase };
}

async function measureRoomUi(page: Page) {
  await page.addInitScript(() => {
    (
      window as unknown as { __beansPerf: Record<string, unknown> }
    ).__beansPerf = {
      longTasks: [] as number[],
      mutations: 0,
    };
    try {
      const po = new PerformanceObserver((list) => {
        const bucket = (
          window as unknown as { __beansPerf: { longTasks: number[] } }
        ).__beansPerf.longTasks;
        for (const e of list.getEntries()) bucket.push(e.duration);
      });
      po.observe({
        type: "longtask",
        buffered: true,
      } as PerformanceObserverInit);
    } catch {
      /* WebKit may lack longtask */
    }
    const mo = new MutationObserver((recs) => {
      let n = 0;
      for (const r of recs) {
        n += r.addedNodes.length + r.removedNodes.length;
        if (r.type === "attributes" || r.type === "characterData") n += 1;
      }
      (
        window as unknown as { __beansPerf: { mutations: number } }
      ).__beansPerf.mutations += n;
    });
    const start = () => {
      if (document.body) {
        mo.observe(document.body, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        });
      }
    };
    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start);
  });

  const room = randomRoomCode("UI");
  const host = new SmokeClient(PARTY, room, "ui-host", "UiHost");
  await host.connect();
  await host.join("player");
  const bot = new SmokeClient(PARTY, room, "ui-bot", "UiBot");
  await bot.connect();
  await bot.join("player");

  await page.goto(`${APP}/room/${room}?name=UiHost`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(500);

  // Flood lobby with rename broadcasts to stress re-render path
  for (let i = 0; i < 12; i++) {
    bot.send({ type: "rename", name: `UiBot${i}` });
    await sleep(40);
  }
  await page.waitForTimeout(400);

  const startBtn = page.getByRole("button", { name: /start/i }).first();
  let tapToPaint: number | null = null;
  if (await startBtn.count()) {
    const t0 = Date.now();
    await startBtn.click();
    await page
      .waitForFunction(() => {
        const t = document.body?.innerText || "";
        return /topic|vote|draft|pick|lobby/i.test(t);
      }, { timeout: 8_000 })
      .catch(() => null);
    tapToPaint = Date.now() - t0;
  }

  const perf = await page.evaluate(() => {
    const p = (
      window as unknown as {
        __beansPerf: { longTasks: number[]; mutations: number };
      }
    ).__beansPerf;
    const over50 = p.longTasks.filter((d) => d > 50);
    return {
      mutations: p.mutations,
      longTaskCount: p.longTasks.length,
      longTasksOver50: over50.length,
      longestTaskMs: p.longTasks.reduce((m, d) => Math.max(m, d), 0),
    };
  });

  host.close();
  bot.close();
  return { tapToPaint, ...perf };
}

async function measureChromiumThrottledHome() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices["iPhone 13"],
    viewport: VIEWPORT,
  });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    latency: 150,
  });
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const home = await measureHome(page);
  await browser.close();
  return home;
}

async function main() {
  console.log(
    JSON.stringify({ app: APP, party: PARTY, viewport: VIEWPORT }, null, 2),
  );

  const ws = await measureWsPayloads();
  console.log("\n=== WS payloads (4p, 1 round) ===");
  console.log(JSON.stringify(ws, null, 2));

  const browser = await webkit.launch();
  const context = await browser.newContext({
    ...devices["iPhone 13"],
    viewport: VIEWPORT,
  });
  const page = await context.newPage();
  const homeWebkit = await measureHome(page);
  console.log("\n=== Home (WebKit 390×844) ===");
  console.log(JSON.stringify(homeWebkit, null, 2));

  const roomUi = await measureRoomUi(page);
  console.log("\n=== Room UI stress (WebKit) ===");
  console.log(JSON.stringify(roomUi, null, 2));
  await browser.close();

  const homeChrome = await measureChromiumThrottledHome();
  console.log("\n=== Home (Chromium 4×CPU + Slow-4G) ===");
  console.log(JSON.stringify(homeChrome, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
