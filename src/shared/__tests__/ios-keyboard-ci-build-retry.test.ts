import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const iosKeyboard = readFileSync(
  resolve(__dirname, "../../../.github/workflows/ios-keyboard-e2e.yml"),
  "utf8",
);
const playtest = readFileSync(
  resolve(__dirname, "../../../.github/workflows/playtest-robustness.yml"),
  "utf8",
);

describe("iOS keyboard CI build retry", () => {
  it("retries next build like playtest (Turbopack google-font flake)", () => {
    expect(playtest).toMatch(/next build attempt/);
    expect(iosKeyboard).toMatch(/next build attempt/);
    expect(iosKeyboard).toMatch(/Turbopack next\/font\/google/);
    expect(iosKeyboard).toMatch(/failed after 3 attempts/);
    // Must not keep the bare one-shot build that flakes on gstatic.
    expect(iosKeyboard).not.toMatch(
      /^\s+- name: Build app against the local PartyServer\n\s+run: npx next build\s*$/m,
    );
  });
});
