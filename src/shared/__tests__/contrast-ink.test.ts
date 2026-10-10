import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, mixHex, rootToken, rulesFor } from "./contrast";

const srcDir = resolve(__dirname, "../..");
const css = readFileSync(resolve(srcDir, "app/globals.css"), "utf8");
const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Body of the rule whose comma-separated selector list includes `selector`. */
function rule(selector: string): string {
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const list = m[1].split(",").map((s) => s.trim());
    if (list.includes(selector)) return m[2];
  }
  return "";
}

function decl(body: string, prop: string): string {
  const m = body.match(new RegExp(`(?:^|[;{\\s])${prop}:\\s*([^;]+);`));
  return m?.[1].trim().replace(/\s+/g, " ") ?? "";
}

/** No opacity, or opacity 1 (a fade-out may still start from it). */
const opaque = (body: string) => {
  const opacity = decl(body, "opacity");
  return opacity === "" || Number(opacity) === 1;
};

const party = clean.match(/html\.party-on\s*\{([^}]*)\}/)?.[1] ?? "";
const partyToken = (name: string) =>
  party.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim() ?? "";

/** Resolves a hex, a `:root` var, or an sRGB color-mix of those to `#rrggbb`. */
function solid(value: string): string {
  const v = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  if (/^#fff$/i.test(v)) return "#ffffff";
  const ref = v.match(/^var\(--([a-z-]+)\)$/);
  if (ref) return solid(rootToken(css, ref[1]));
  const mix = v.match(/^color-mix\(in srgb, (.+?) (\d+)%, (.+)\)$/);
  if (mix) return mixHex(solid(mix[1]), solid(mix[3]), Number(mix[2]) / 100);
  throw new Error(`can't resolve "${v}"`);
}

/** An `rgba(r, g, b, a)` fill painted over an opaque `under`. */
function over(rgba: string, under: string): string {
  const m = rgba.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
  if (!m) throw new Error(`expected rgba, got "${rgba}"`);
  const hex = `#${[m[1], m[2], m[3]]
    .map((c) => Number(c).toString(16).padStart(2, "0"))
    .join("")}`;
  return mixHex(hex, under, Number(m[4]));
}

/** Every stop of the page gradient, normal and Party. */
const pageStops = [
  ...(rule("body::before").match(/linear-gradient\([^;]*/)?.[0] ?? "").matchAll(
    /#[0-9a-f]{6}/gi,
  ),
  ...(
    rule("html.party-on body::before").match(/linear-gradient\([^;]*/)?.[0] ?? ""
  ).matchAll(/#[0-9a-f]{6}/gi),
].map((m) => m[0]);
const bg = rootToken(css, "bg");
const partyMid = "#ffe8d4";
const surfaces: Record<string, string> = {
  white: "#ffffff",
  panel: over(rootToken(css, "panel"), bg),
  partyPanel: over(partyToken("panel"), partyMid),
  ...Object.fromEntries(pageStops.map((hex) => [`page ${hex}`, hex])),
};

function tsxUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxUnder(path);
    return name.endsWith(".tsx") ? [path] : [];
  });
}

describe("coral is decoration; coral ink is the text color", () => {
  it("reads the page gradient stops it checks against", () => {
    expect(pageStops.length).toBeGreaterThanOrEqual(4);
    expect(pageStops).toContain(partyMid);
  });

  it("no CSS rule sets text in plain coral", () => {
    expect(clean).not.toMatch(/(^|[;{\s])color:\s*var\(--(coral|accent)\)/);
    expect(clean).not.toMatch(/(^|[;{\s])color:\s*(#e76f4e|#ff6b4a)/i);
  });

  it("no component sets text in plain coral", () => {
    for (const file of tsxUnder(srcDir)) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toMatch(/text-\[var\(--coral\)\]/);
    }
  });

  it("coral ink and --muted hold 4.5:1 on every surface text sits on", () => {
    const ink = rootToken(css, "coral-ink");
    const muted = rootToken(css, "muted");
    for (const [name, surface] of Object.entries(surfaces)) {
      expect(contrastRatio(ink, surface), `coral ink on ${name}`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(muted, surface), `muted on ${name}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("totals, deltas, the wager stake, Home's Edit and the error toast use coral ink at full strength", () => {
    for (const sel of [
      ".earned-badge-num",
      ".results-reveal-total",
      ".dice-result-gain",
      ".player-chip-earned",
      ".player-chip-pot-hot",
      ".wager-stake-value",
      ".home-edit-name",
      ".a2hs-nudge-dismiss",
      ".error-toast",
    ]) {
      const body = rule(sel);
      expect(decl(body, "color"), sel).toBe("var(--coral-ink)");
      expect(opaque(body), sel).toBe(true);
    }
  });

  it("host notices are muted, not muted and faded", () => {
    const notice = rule(".room-notice");
    expect(decl(notice, "color")).toBe("var(--muted)");
    expect(opaque(notice)).toBe(true);
  });
});

describe("honest disabled buttons", () => {
  const disabledRules = [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(
    ([, sel]) =>
      /:disabled|\[aria-disabled="true"\]/.test(sel) &&
      /btn-|topic-custom-lock|dice-bank-cta/.test(sel),
  );

  it("never fades a disabled button with opacity", () => {
    expect(disabledRules.length).toBeGreaterThan(0);
    for (const [, sel, body] of disabledRules) {
      expect(opaque(body), sel.trim()).toBe(true);
    }
  });

  it("a disabled primary is a sand fill with a 4.5:1 label", () => {
    for (const sel of [".btn-primary:disabled", '.btn-primary[aria-disabled="true"]']) {
      const body = rule(sel);
      expect(decl(body, "background"), sel).toBe("var(--sand)");
      const label = solid(decl(body, "color"));
      expect(contrastRatio(label, rootToken(css, "sand")), sel).toBeGreaterThanOrEqual(4.5);
    }
    // Still reads as a button against the page and a panel
    const sand = rootToken(css, "sand");
    expect(contrastRatio(sand, bg)).toBeGreaterThanOrEqual(1.15);
    expect(contrastRatio(sand, surfaces.panel)).toBeGreaterThanOrEqual(1.25);
    expect(rule('html.party-on .btn-primary[aria-disabled="true"]')).toMatch(
      /box-shadow:\s*none/,
    );
  });

  it("a disabled secondary and a disabled Bank keep a 4.5:1 label", () => {
    const secondary = rule(".btn-secondary:disabled");
    expect(
      contrastRatio(solid(decl(secondary, "color")), over(decl(secondary, "background"), bg)),
    ).toBeGreaterThanOrEqual(4.5);
    const bank = rule(".dice-bank-cta:disabled");
    expect(
      contrastRatio(solid(decl(bank, "color")), over(decl(bank, "background"), surfaces.panel)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("the your-turn sweep lands on the AA primary fill, and waits while disabled", () => {
    expect(decl(rule(".btn-your-turn::before"), "background")).toBe("var(--btn-bg)");
    expect(contrastRatio("#ffffff", rootToken(css, "btn-bg"))).toBeGreaterThanOrEqual(4.5);
    expect(rule('.btn-your-turn[aria-disabled="true"]::before')).toMatch(/content:\s*none/);
  });
});

describe("rail chips recede by color, not opacity", () => {
  const other = rule(".player-chip-other");
  const chip = over(decl(other, "background"), bg);
  const partyChip = over(decl(other, "background"), partyMid);

  it("other players' chips carry no opacity", () => {
    for (const body of rulesFor(css, ".player-chip-other")) {
      expect(body).not.toMatch(/(^|[;\s])opacity:/);
    }
    expect(decl(rule(".player-chip-split-label"), "opacity")).toBe("");
  });

  it("names, scores and +N on other chips are 4.5:1, Party included", () => {
    const text = solid(decl(other, "color"));
    const ink = rootToken(css, "coral-ink");
    for (const surface of [chip, partyChip]) {
      expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(ink, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("+N and the hot pot on your own chip are white on --btn-bg", () => {
    expect(solid(decl(rule(".player-chip-earned-you"), "color"))).toBe("#ffffff");
    expect(solid(decl(rule(".player-chip-you .player-chip-pot-hot"), "color"))).toBe("#ffffff");
  });
});
