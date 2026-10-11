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

  it("uses one soft composer surface — inset Lock in, no double borders", () => {
    expect(draft).toMatch(/className="draft-pick-input"/);
    expect(draft).not.toMatch(/className="field draft-pick-input"/);
    const composer = rule(".draft-composer");
    expect(composer).toMatch(/box-shadow:\s*none/);
    expect(composer).toMatch(/background:\s*transparent/);
    expect(composer).toMatch(/border:\s*none/);
    const row = rule(".draft-composer-row");
    expect(row).toMatch(/border-radius:\s*999px/);
    expect(row).toMatch(/box-shadow:\s*none/);
    expect(row).toMatch(/padding:\s*var\(--space-1\)/);
    expect(row).toMatch(/background:\s*#fff/);
    const input = rule(".draft-pick-input");
    expect(input).toMatch(/border:\s*0/);
    expect(input).toMatch(/-webkit-appearance:\s*none/);
    expect(input).toMatch(/height:\s*calc\(\s*var\(--tap-min\)/);
    const submit = rule(".draft-pick-submit");
    expect(submit).toMatch(/height:\s*calc\(\s*var\(--tap-min\)/);
    expect(submit).toMatch(/box-shadow:\s*none/);
  });

  it("keeps Lock in calm when empty and coral when ready", () => {
    const disabled = rule('.draft-pick-submit[aria-disabled="true"]');
    expect(disabled).toMatch(/rgba\(35,\s*72,\s*62,\s*0\.08\)/);
    expect(disabled).toMatch(/opacity:\s*1/);
    expect(disabled).not.toMatch(/opacity:\s*0\.5/);
    // Ready state: white on coral (clearly tappable)
    expect(css).toMatch(
      /\.draft-pick-submit\.btn-your-turn:not\(\[aria-disabled="true"\]\)[\s\S]*?background:\s*var\(--coral\)/,
    );
    expect(css).toMatch(
      /\.draft-pick-submit\.btn-your-turn:not\(\[aria-disabled="true"\]\)[\s\S]*?color:\s*#fff/,
    );
  });

  it("shows Pick N placeholder on the live empty cell — no fake caret", () => {
    expect(board).toMatch(/draft-board-cell-placeholder/);
    expect(board).toMatch(/Pick \$\{pass \+ 1\}/);
    expect(board).not.toMatch(/draft-board-cell-caret/);
    expect(board).not.toMatch(/"Your pick"/);
    expect(draft).not.toMatch(/>Your pick</);
    expect(css).not.toMatch(/draft-cell-caret/);
  });

  it("keeps the board flat — no drop-shadow band", () => {
    const scroll = rule(".draft-board-scroll");
    expect(scroll).toMatch(/box-shadow:\s*none/);
    expect(scroll).not.toMatch(/0 8px 22px/);
  });

  it("keeps compact rows and aligns gutters — board does not stretch", () => {
    const panel = rule(".draft-panel");
    expect(panel).toMatch(/flex:\s*0 0 auto/);
    expect(panel).not.toMatch(/min-height:\s*100%/);
    const boardRule = rule(".draft-board");
    expect(boardRule).toMatch(/flex:\s*0 0 auto/);
    const fitTd = rule(".draft-board-density-fit td,\n.draft-board-density-cozy td");
    // Compact ~44–48px tiles
    expect(css).toMatch(
      /\.draft-board-density-fit td,\s*\n\.draft-board-density-cozy td\s*\{[\s\S]*?height:\s*2\.85rem/,
    );
    expect(css).not.toMatch(
      /\.draft-board-scroll-fit \.draft-board-density-fit tbody tr\s*\{[\s\S]*?height:\s*25%/,
    );
    void fitTd;
    const table = rule(".draft-board-table");
    expect(table).toMatch(/width:\s*calc\(\s*100% \+ 2 \* var\(--space-2\)\s*\)/);
    expect(table).toMatch(/margin-inline:\s*calc\(\s*-1 \* var\(--space-2\)\s*\)/);
    // Inline width must match CSS so React style doesn't pin the table to 100%
    expect(board).toMatch(/calc\(100% \+ 2 \* var\(--space-2\)\)/);
    const th = rule(".draft-board-table thead th");
    expect(th).toMatch(/background:\s*transparent/);
    const you = rule(".draft-board-table thead th.is-you");
    expect(you).toMatch(/color-mix/);
    const empty = rule(".draft-board-cell-empty");
    expect(empty).toMatch(/0\.32/);
  });

  it("preserves #148 keyboard contracts on the composer row", () => {
    expect(draft.indexOf('className="draft-composer"')).toBeLessThan(
      draft.indexOf("draft-turn-line"),
    );
    expect(draft).toMatch(/onMouseDown=\{keepFieldFocus\}/);
    expect(draft).toMatch(/aria-disabled=\{!canPrimary\}/);
    const row = rule(".draft-composer-row");
    expect(row).toMatch(/min-height:\s*var\(--tap-min\)/);
  });

  it("keeps an airy composer→board gap when your-turn status is quiet", () => {
    const panel = rule(".draft-panel");
    expect(panel).toMatch(/gap:\s*var\(--space-5\)/);
    // Quiet your-turn omits the status node (no reserved blank line)
    expect(draft).toMatch(/turnLine \? \(/);
    expect(draft).toMatch(/: null/);
    expect(css).not.toMatch(/draft-turn-line-quiet/);
    const turn = rule(".draft-turn-line");
    expect(turn).not.toMatch(/min-height:/);
    // Draft chrome breathes under the topic hero
    expect(room).toMatch(/drafting \? "pb-\[var\(--space-4\)\]"/);
  });
});
