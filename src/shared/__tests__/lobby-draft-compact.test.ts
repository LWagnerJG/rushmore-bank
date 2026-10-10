import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { draftStatusLine } from "@/lib/draft-status";

const lobby = readFileSync(
  resolve(__dirname, "../../components/LobbyPanel.tsx"),
  "utf8",
);
const draft = readFileSync(
  resolve(__dirname, "../../components/DraftPanel.tsx"),
  "utf8",
);
const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");

describe("lobby compact invite row", () => {
  it("puts code left and small QR right in one row", () => {
    expect(lobby).toMatch(/lobby-invite-row/);
    expect(lobby).toMatch(/size=\{108\}/);
    const rowIdx = lobby.indexOf("lobby-invite-row");
    const codeIdx = lobby.indexOf("lobby-room-code");
    const qrIdx = lobby.indexOf("lobby-qr");
    expect(rowIdx).toBeGreaterThan(-1);
    expect(codeIdx).toBeGreaterThan(rowIdx);
    expect(qrIdx).toBeGreaterThan(codeIdx);
    const qr = css.match(/\.lobby-qr\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(qr).toMatch(/width:\s*108px/);
    expect(qr).not.toMatch(/blur\s*\(/);
  });

  it("keeps a single Share under the row", () => {
    const shares = lobby.match(/>\s*\{copied \? "Copied" : "Share"\}\s*</g) ?? [];
    expect(shares.length).toBe(1);
    expect(lobby).toMatch(/lobby-share-btn/);
  });
});

describe("draft one status line", () => {
  it("formats your pick and queue position", () => {
    expect(
      draftStatusLine({
        phase: "DRAFT",
        myTurn: true,
        turnName: "Luke",
        turnsAway: 0,
        pickPaused: false,
      }),
    ).toBe("Your pick");
    expect(
      draftStatusLine({
        phase: "DRAFT",
        myTurn: false,
        turnName: "Pat",
        turnsAway: 2,
        pickPaused: false,
      }),
    ).toBe("Pat picking · you’re up in 2");
    expect(
      draftStatusLine({
        phase: "DRAFT",
        myTurn: false,
        turnName: "Pat",
        turnsAway: 1,
        pickPaused: false,
      }),
    ).toBe("Pat picking · you’re next");
  });

  it("wires a single line and drops WaitingRoster from draft", () => {
    expect(draft).toMatch(/draftStatusLine/);
    expect(draft).toMatch(/draft-turn-line/);
    expect(draft).not.toMatch(/WaitingRoster/);
    expect(draft).not.toMatch(/draft-turn-title/);
    expect(draft).not.toMatch(/draft-turn-hint/);
    expect(css).toMatch(/\.draft-turn-line\s*\{/);
    expect(css).not.toMatch(/\.draft-turn-title\s*\{/);
  });
});
