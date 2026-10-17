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
    const clickIdx = script.indexOf(`data-rounds="6"]').click`);
    expect(clickIdx).toBeGreaterThan(-1);
    const afterClick = script.slice(clickIdx, clickIdx + 400);
    const waitIdx = afterClick.indexOf("waitForFunction");
    expect(waitIdx).toBeGreaterThan(-1);
    const call = afterClick.slice(waitIdx, waitIdx + 280);
    expect(call).toContain("undefined");
    expect(call).toContain("{ timeout: 8000 }");
    expect(call.indexOf("undefined")).toBeLessThan(
      call.indexOf("{ timeout: 8000 }"),
    );
    // Broken form: options object immediately after the template string.
    expect(call).not.toMatch(/`\s*,\s*\{\s*timeout:\s*8000\s*\}/);
  });

  it("documents the Playwright arity pitfall near topic waits", () => {
    expect(script).toContain("options are the 3rd arg");
    expect(script).toContain("as 2nd is treated as `arg`");
  });
});
