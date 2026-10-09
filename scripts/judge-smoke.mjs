#!/usr/bin/env node
/**
 * Prod/staging smoke for /api/judge.
 * Fails on non-200, fallback:true, or latencyMs > 15s.
 *
 * Env:
 *   JUDGE_URL     — base app URL (default https://beans-game.vercel.app)
 *   JUDGE_SECRET  — Bearer token (required)
 */
const JUDGE_URL = (process.env.JUDGE_URL || "https://beans-game.vercel.app").replace(
  /\/$/,
  "",
);
const SECRET = process.env.JUDGE_SECRET;
const MAX_LATENCY_MS = 15_000;

if (!SECRET) {
  console.error("JUDGE_SECRET is required");
  process.exit(1);
}

const body = {
  topic: "Best pets",
  scopeBoundary: "Animals only",
  rosters: [
    { anonId: "R1", picks: ["dog", "cat", "rabbit", "hamster"] },
    { anonId: "R2", picks: ["parrot", "fish", "turtle", "ferret"] },
  ],
};

const started = Date.now();
const res = await fetch(`${JUDGE_URL}/api/judge`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SECRET}`,
  },
  body: JSON.stringify(body),
});
const wallMs = Date.now() - started;

let data;
try {
  data = await res.json();
} catch {
  console.error(`judge-smoke: non-JSON response status=${res.status} wallMs=${wallMs}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: res.status,
      fallback: data.fallback ?? false,
      fallbackReason: data.fallbackReason ?? null,
      model: data.model ?? null,
      latencyMs: data.latencyMs ?? null,
      wallMs,
      judgmentCount: Array.isArray(data.judgments) ? data.judgments.length : 0,
    },
    null,
    2,
  ),
);

if (res.status !== 200) {
  console.error(`judge-smoke: expected HTTP 200, got ${res.status}`);
  process.exit(1);
}
if (data.fallback === true) {
  console.error(
    `judge-smoke: fallback:true reason=${data.fallbackReason ?? "unknown"}`,
  );
  process.exit(1);
}
const latency = typeof data.latencyMs === "number" ? data.latencyMs : wallMs;
if (latency > MAX_LATENCY_MS) {
  console.error(
    `judge-smoke: latency ${latency}ms exceeds ${MAX_LATENCY_MS}ms`,
  );
  process.exit(1);
}

console.log("judge-smoke: ok");
