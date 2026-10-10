import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");
const draft = read("../../components/DraftPanel.tsx");
const board = read("../../components/DraftBoard.tsx");
const room = read("../../components/RoomClient.tsx");
const css = read("../../app/globals.css");

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    css.match(new RegExp(`(^|\\n)${escaped}\\s*\\{[\\s\\S]*?\\n\\}`))?.[0] ??
    ""
  );
}

describe("draft declutter (Luke iPhone DRAFT pass)", () => {
  it("hides PlayerRail during DRAFT/CORRECTION — board headers are the roster", () => {
    expect(room).toMatch(/phase !== "DRAFT"/);
    expect(room).toMatch(/phase !== "CORRECTION"/);
  });

  it("uses one soft composer surface — no outer card + bordered field", () => {
    expect(draft).toMatch(/className="draft-pick-input"/);
    expect(draft).not.toMatch(/className="field draft-pick-input"/);
    const composer = rule(".draft-composer");
    expect(composer).toMatch(/box-shadow:\s*none/);
    expect(composer).toMatch(/background:\s*transparent/);
    expect(composer).toMatch(/border:\s*none/);
    const row = rule(".draft-composer-row");
    expect(row).toMatch(/border-radius:\s*999px/);
    expect(row).toMatch(/box-shadow:\s*none/);
    const input = rule(".draft-pick-input");
    expect(input).toMatch(/border:\s*0/);
    expect(input).toMatch(/-webkit-appearance:\s*none/);
    expect(input).toMatch(/height:\s*var\(--tap-min\)/);
  });

  it("keeps Lock in calm when empty and coral when ready", () => {
    const disabled = rule('.draft-pick-submit[aria-disabled="true"]');
    expect(disabled).toMatch(/rgba\(35,\s*72,\s*62,\s*0\.08\)/);
    expect(disabled).toMatch(/opacity:\s*1/);
    expect(disabled).not.toMatch(/opacity:\s*0\.5/);
  });

  it("drops duplicated Your pick cell text for a caret", () => {
    expect(board).toMatch(/draft-board-cell-caret/);
    expect(board).not.toMatch(/"Your pick"/);
    expect(draft).not.toMatch(/>Your pick</);
  });

  it("keeps the board flat — no drop-shadow band", () => {
    const scroll = rule(".draft-board-scroll");
    expect(scroll).toMatch(/box-shadow:\s*none/);
    expect(scroll).not.toMatch(/0 8px 22px/);
  });

  it("preserves #148 keyboard contracts on the composer row", () => {
    expect(draft.indexOf('className="draft-composer"')).toBeLessThan(
      draft.indexOf("draft-turn-line"),
    );
    expect(draft).toMatch(/onMouseDown=\{keepFieldFocus\}/);
    expect(draft).toMatch(/aria-disabled=\{!canPrimary\}/);
    expect(rule(".draft-pick-submit")).toMatch(/height:\s*var\(--tap-min\)/);
  });

  it("keeps composer→board at one 12px gap when your-turn status is quiet", () => {
    const panel = rule(".draft-panel");
    expect(panel).toMatch(/gap:\s*var\(--space-3\)/);
    // Quiet your-turn omits the status node (no reserved blank line)
    expect(draft).toMatch(/turnLine \? \(/);
    expect(draft).toMatch(/: null/);
    expect(css).not.toMatch(/draft-turn-line-quiet/);
    const turn = rule(".draft-turn-line");
    expect(turn).not.toMatch(/min-height:/);
  });
});
