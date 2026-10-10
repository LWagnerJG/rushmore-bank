import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const home = readFileSync(resolve(__dirname, "../../app/page.tsx"), "utf8");
const lobby = readFileSync(
  resolve(__dirname, "../../components/LobbyPanel.tsx"),
  "utf8",
);
const topic = readFileSync(
  resolve(__dirname, "../../components/TopicPanel.tsx"),
  "utf8",
);
const room = readFileSync(
  resolve(__dirname, "../../components/RoomClient.tsx"),
  "utf8",
);
const settings = readFileSync(
  resolve(__dirname, "../../components/SettingsSheet.tsx"),
  "utf8",
);
const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");

describe("cross-phase clutter-cut", () => {
  it("home has one join heading", () => {
    expect(home).toMatch(/Join a room/);
    expect(home).not.toMatch(/Have a code\?/);
  });

  it("lobby rows omit 0 beans", () => {
    expect(lobby).not.toMatch(/p\.stones.*currencyName|currencyName.*p\.stones/);
    expect(lobby).not.toMatch(/\{p\.stones\}/);
  });

  it("topic drops the Four from the bank helper", () => {
    expect(topic).not.toMatch(/Four from the bank/);
    expect(topic).not.toMatch(/topic-sub/);
  });

  it("PlayerRail is the score surface — chrome drops phase+beans outside lobby", () => {
    // Draft chrome keeps timer only (no Pause/+15s inline)
    expect(room).toMatch(/DraftBannerClock/);
    expect(room).not.toMatch(/host_pause|host_resume|host_extend/);
    // Pause/+15s moved into settings
    expect(settings).toMatch(/host_pause|host_resume/);
    expect(settings).toMatch(/host_extend/);
    expect(settings).toMatch(/Draft clock/);
    // Non-lobby chrome no longer prints beans beside phase
    expect(room).not.toMatch(/\{you\.stones\} \{RULES\.currencyName\}/);
  });

  it("turn-strip chips have no Risking/Safe CSS pseudo labels", () => {
    expect(css).toMatch(
      /\.dice-turn-chip-safe::before,\s*\n?\s*\.dice-turn-chip-pot::before\s*\{[\s\S]*?content:\s*none/,
    );
    expect(css).not.toMatch(/content:\s*"Risking"/);
  });
});
