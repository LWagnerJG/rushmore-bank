import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const topic = readFileSync(
  resolve(__dirname, "../../components/TopicPanel.tsx"),
  "utf8",
);
const results = readFileSync(
  resolve(__dirname, "../../components/ResultsPanel.tsx"),
  "utf8",
);
const settings = readFileSync(
  resolve(__dirname, "../../components/SettingsSheet.tsx"),
  "utf8",
);
const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");

describe("topic host Options tuck", () => {
  it("hides rounds + vibes behind a quiet Options control", () => {
    expect(topic).toMatch(/topic-options-toggle/);
    expect(topic).toMatch(/>\s*Options\s*</);
    expect(topic).toMatch(/optionsOpen/);
    expect(topic).toMatch(/topic-rounds-chip/);
    expect(topic).toMatch(/topic-vibe-chip/);
    // Collapsed by default — optionsOpen starts false
    expect(topic).toMatch(/useState\(false\)/);
    const toggle = css.match(/\.topic-options-toggle\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(toggle).toMatch(/min-height:\s*var\(--tap-min\)/);
    expect(toggle).not.toMatch(/blur\s*\(/);
  });

  it("keeps the muted AI judge line outside Options", () => {
    expect(topic).toMatch(/HostAiPreGameStatus/);
    const aiIdx = topic.indexOf("HostAiPreGameStatus");
    const optIdx = topic.indexOf("topic-options");
    expect(aiIdx).toBeGreaterThan(-1);
    expect(optIdx).toBeGreaterThan(aiIdx);
  });
});

describe("round results Party Mode home", () => {
  it("removes PartyModeSwitch from ResultsPanel; Settings keeps it", () => {
    expect(results).not.toMatch(/PartyModeSwitch/);
    expect(results).not.toMatch(/partyMode:\s*next/);
    expect(settings).toMatch(/Party Mode/);
    expect(settings).toMatch(/onPartyChange/);
  });

  it("still shows drink prompts when Party Mode fires", () => {
    expect(results).toMatch(/party-sip/);
    expect(results).toMatch(/lowest_drink/);
  });
});
