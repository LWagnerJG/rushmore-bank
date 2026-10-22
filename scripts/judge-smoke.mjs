#!/usr/bin/env node
/**
 * Prod/staging smoke for /api/judge.
 * Fails on non-200, fallback:true, or latencyMs > 15s after one retry
 * on transient timeout / provider flakes (matches PartyServer's one-retry).
 *
 * Env:
 *   JUDGE_URL     — base app URL (default https://beans-game.vercel.app;
 *                   that host must serve /api/judge without a cross-origin 308,
 *                   or Authorization is stripped and the smoke gets 401)
 *   JUDGE_SECRET  — Bearer token (required)
 */
const JUDGE_URL = (process.env.JUDGE_URL || "https://beans-game.vercel.app").replace(
  /\/$/,
  "",
);
const SECRET = process.env.JUDGE_SECRET;
const MAX_LATENCY_MS = 15_000;
/** One retry on transient timeout / slow / 5xx — same spirit as PartyServer. */
const MAX_ATTEMPTS = 2;

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

/**
 * @returns {Promise<{
 *   ok: boolean,
 *   retryable: boolean,
 *   status: number,
 *   fallback: boolean,
 *   fallbackReason: string | null,
 *   model: string | null,
 *   latencyMs: number | null,
 *   wallMs: number,
 *   judgmentCount: number,
 *   detail: string,
 * }>}
 */
async function runOnce() {
  const started = Date.now();
  let res;
  try {
    res = await fetch(`${JUDGE_URL}/api/judge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SECRET}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const wallMs = Date.now() - started;
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      retryable: true,
      status: 0,
      fallback: false,
      fallbackReason: null,
      model: null,
      latencyMs: null,
      wallMs,
      judgmentCount: 0,
      detail: `network error: ${msg}`,
    };
  }
  const wallMs = Date.now() - started;

  let data;
  try {
    data = await res.json();
  } catch {
    return {
      ok: false,
      retryable: res.status >= 500 || res.status === 0,
      status: res.status,
      fallback: false,
      fallbackReason: null,
      model: null,
      latencyMs: null,
      wallMs,
      judgmentCount: 0,
      detail: `non-JSON response status=${res.status}`,
    };
  }

  const fallback = data.fallback === true;
  const fallbackReason =
    typeof data.fallbackReason === "string" ? data.fallbackReason : null;
  const latency =
    typeof data.latencyMs === "number" ? data.latencyMs : wallMs;
  const summary = {
    ok: false,
    retryable: false,
    status: res.status,
    fallback,
    fallbackReason,
    model: data.model ?? null,
    latencyMs: typeof data.latencyMs === "number" ? data.latencyMs : null,
    wallMs,
    judgmentCount: Array.isArray(data.judgments) ? data.judgments.length : 0,
    detail: "",
  };

  if (res.status !== 200) {
    summary.detail = `expected HTTP 200, got ${res.status}`;
    // Auth mistakes are not transient; 5xx / 429 are.
    summary.retryable = res.status >= 500 || res.status === 429;
    return summary;
  }
  if (fallback) {
    summary.detail = `fallback:true reason=${fallbackReason ?? "unknown"}`;
    summary.retryable =
      fallbackReason === "timeout" ||
      fallbackReason === "provider_error" ||
      fallbackReason === "rate_limited";
    return summary;
  }
  if (latency > MAX_LATENCY_MS) {
    summary.detail = `latency ${latency}ms exceeds ${MAX_LATENCY_MS}ms`;
    summary.retryable = true;
    return summary;
  }

  summary.ok = true;
  summary.detail = "ok";
  return summary;
}

let last = null;
for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
  last = await runOnce();
  console.log(
    JSON.stringify(
      {
        attempt: attempt + 1,
        status: last.status,
        fallback: last.fallback,
        fallbackReason: last.fallbackReason,
        model: last.model,
        latencyMs: last.latencyMs,
        wallMs: last.wallMs,
        judgmentCount: last.judgmentCount,
      },
      null,
      2,
    ),
  );
  if (last.ok) {
    console.log("judge-smoke: ok");
    process.exit(0);
  }
  if (!last.retryable || attempt === MAX_ATTEMPTS - 1) {
    console.error(`judge-smoke: ${last.detail}`);
    process.exit(1);
  }
  console.log(
    `judge-smoke: retrying after transient failure (${last.detail})`,
  );
}

console.error(`judge-smoke: ${last?.detail ?? "unknown"}`);
process.exit(1);
