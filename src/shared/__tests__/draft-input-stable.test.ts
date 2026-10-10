import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { shouldFreezeAppHeight } from "../viewport-height";

const draft = readFileSync(
  resolve(__dirname, "../../components/DraftPanel.tsx"),
  "utf8",
);
const noPull = readFileSync(
  resolve(__dirname, "../../components/NoPullToRefresh.tsx"),
  "utf8",
);
const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");
const webkitScript = readFileSync(
  resolve(__dirname, "../../../scripts/verify-draft-input-stable.ts"),
  "utf8",
);

describe("draft input keyboard stability contracts", () => {
  it("freezes --app-h for any focused editable (not only >150px shrink)", () => {
    expect(
      shouldFreezeAppHeight({
        innerHeight: 844,
        visualViewportHeight: 800,
        editableFocused: true,
      }),
    ).toBe(true);
    expect(
      shouldFreezeAppHeight({
        innerHeight: 844,
        visualViewportHeight: 800,
        editableFocused: false,
      }),
    ).toBe(false);
  });

  it("does not scroll or focus the field from NoPullToRefresh", () => {
    expect(noPull).not.toMatch(/scrollEditableIntoAppScroll/);
    expect(noPull).not.toMatch(/scrollIntoView\s*\(/);
    expect(noPull).not.toMatch(/\.focus\s*\(/);
    // scrollTo only at focus edges — never inside the vv resize path after freeze
    expect(noPull).toMatch(/focusin/);
    expect(noPull).toMatch(/While focused: leave --app-h alone/);
  });

  it("keeps draft pick input ≥16px and reserves status/tray space", () => {
    expect(draft).toMatch(/draft-pick-input/);
    expect(draft).toMatch(/draft-input-status/);
    expect(draft).toMatch(/draft-stash-tray/);
    expect(draft).toMatch(/className="field draft-pick-input w-full"/);
    expect(draft).not.toMatch(/draft-pick-input[^"]*text-base/);
    expect(css).toMatch(
      /\.draft-pick-input\s*\{[\s\S]*?font-size:\s*max\(\s*16px/,
    );
    const status =
      css.match(/\.draft-input-status\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(status).toMatch(/min-height:/);
    const tray = css.match(/\.draft-stash-tray\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(tray).toMatch(/min-height:/);
    expect(tray).toMatch(/max-height:/);
  });

  it("does not call scroll or focus on draft input change", () => {
    expect(draft).not.toMatch(/scrollIntoView/);
    expect(draft).not.toMatch(/\.focus\(/);
    expect(draft).toMatch(/onChange=\{\(e\) => setSelection\(e\.target\.value\)\}/);
  });

  it("ships a WebKit verify script at 390×844 with simulated keyboard", () => {
    expect(webkitScript).toMatch(/webkit\.launch/);
    expect(webkitScript).toMatch(/390/);
    expect(webkitScript).toMatch(/844/);
    expect(webkitScript).toMatch(/selected-pick/);
    expect(webkitScript).toMatch(/getBoundingClientRect\(\)\.top/);
    expect(webkitScript).toMatch(/scrollY/);
    expect(webkitScript).toMatch(/abcdefghij|typed/);
  });
});
