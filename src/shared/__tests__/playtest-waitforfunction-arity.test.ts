/**
 * Playwright waitForFunction is (fn, arg?, options?). Passing `{ timeout }`
 * as the 2nd arg treats it as `arg` and ignores the timeout — a prior source
 * of topic-reselect flakes. Keep string-fn calls using undefined + options.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = readFileSync(
  resolve(__dirname, "../../../scripts/verify-playtest-robustness.ts"),
  "utf8",
);

describe("playtest waitForFunction arity", () => {
  it("passes timeout as the 3rd arg for the rounds-6 reselect wait", () => {
    const marker = "topic-rounds-chip[data-rounds=\"6\"]').click";
    const idx = script.indexOf(marker);
    expect(idx).toBeGreaterThan(-1);
    const afterClick = script.slice(idx, idx + 400);
    expect(afterClick).toMatch(
      /waitForFunction\(\s*`[^`]+`,\s*undefined,\s*\{\s*timeout:\s*8000\s*\}\s*\)/,
    );
    expect(afterClick).not.toMatch(
      /waitForFunction\(\s*`[^`]+`,\s*\{\s*timeout:\s*8000\s*\}\s*\)/,
    );
  });

  it("documents the Playwright arity pitfall near topic waits", () => {
    expect(script).toMatch(/options are the 3rd arg/);
    expect(script).toMatch(/\{ timeout \} as 2nd is treated as `arg`/);
  });
});
