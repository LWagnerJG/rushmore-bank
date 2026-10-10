/** WCAG 2.x contrast ratio between two opaque `#rrggbb` colors. */
export function contrastRatio(fg: string, bg: string): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`expected #rrggbb, got "${hex}"`);
  const n = parseInt(m[1], 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Value of `--name` in the first `:root { … }` block of `css`. */
export function rootToken(css: string, name: string): string {
  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  const value = root.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim();
  if (!value) throw new Error(`--${name} not found in :root`);
  return value;
}

/** Declaration bodies of every rule whose selector mentions `cls`. */
export function rulesFor(css: string, cls: string): string[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: string[] = [];
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].includes(cls)) out.push(m[2]);
  }
  return out;
}
