/**
 * verify-beans-web must require JUDGE_SECRET — party mark alone 401s in prod.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = readFileSync(
  join(__dirname, "../../../scripts/verify-beans-web.ts"),
  "utf8",
);

describe("verify-beans-web judge auth", () => {
  it("fails fast without JUDGE_SECRET instead of posting anonymously", () => {
    expect(script).toMatch(/JUDGE_SECRET is required/);
    expect(script).toMatch(/Authorization:\s*`Bearer \$\{process\.env\.JUDGE_SECRET\}`/);
  });
});
