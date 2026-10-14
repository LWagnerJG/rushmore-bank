/**
 * SmokeClient.send must preserve a caller-supplied actionId so double-tap /
 * dedupe smokes can reuse one id (server seenAction).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const smokeLib = readFileSync(
  join(__dirname, "../../../scripts/smoke-lib.ts"),
  "utf8",
);

describe("SmokeClient actionId", () => {
  it("preserves caller actionId instead of always overwriting", () => {
    expect(smokeLib).toMatch(/incoming\.actionId\s*\?\?/);
    // Regression: the old helper always stamped a fresh id after the spread.
    expect(smokeLib).not.toMatch(
      /\.\.\.m,\s*\n\s*actionId:\s*`a-\$\{Date\.now\(\)\}/,
    );
  });
});
