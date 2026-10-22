/**
 * Prod judge-smoke must retry once on transient timeout / provider flakes
 * (same spirit as PartyServer's one retry), and must not retry auth failures.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const smoke = readFileSync(
  resolve(__dirname, "../../../scripts/judge-smoke.mjs"),
  "utf8",
);

describe("judge-smoke retry", () => {
  it("allows exactly one retry (MAX_ATTEMPTS = 2)", () => {
    expect(smoke).toMatch(/MAX_ATTEMPTS\s*=\s*2/);
    expect(smoke).toMatch(/for\s*\(\s*let\s+attempt\s*=\s*0/);
  });

  it("retries timeout / provider_error / rate_limited fallbacks", () => {
    expect(smoke).toMatch(/fallbackReason === "timeout"/);
    expect(smoke).toMatch(/fallbackReason === "provider_error"/);
    expect(smoke).toMatch(/fallbackReason === "rate_limited"/);
  });

  it("does not treat auth failures as retryable", () => {
    // 401/403 must not set retryable — only 5xx / 429 for non-200.
    expect(smoke).toMatch(
      /summary\.retryable\s*=\s*res\.status\s*>=\s*500\s*\|\|\s*res\.status\s*===\s*429/,
    );
    expect(smoke).not.toMatch(/retryable:\s*true.*401/);
  });
});
