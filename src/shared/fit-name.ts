/**
 * Resolve a one-line shrink-to-fit font size for nicknames.
 * No hyphenation — caller keeps white-space: nowrap.
 * Ellipsis only after the floor size + tracking tighten still overflows.
 */
export function resolveFitNameStyle(
  basePx: number,
  /** Return true when the text overflows at the given size/tracking. */
  overflows: (fontPx: number, letterSpacing: string) => boolean,
): {
  fontSizePx: number;
  letterSpacing: string;
  textOverflow: "clip" | "ellipsis";
} {
  if (!(basePx > 0)) {
    return { fontSizePx: basePx, letterSpacing: "", textOverflow: "clip" };
  }

  const min = Math.max(8, Math.round(basePx * 0.58 * 10) / 10);

  if (!overflows(basePx, "")) {
    return { fontSizePx: basePx, letterSpacing: "", textOverflow: "clip" };
  }

  let lo = min;
  let hi = basePx;
  let best = min;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (!overflows(mid, "")) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  if (!overflows(best, "")) {
    return { fontSizePx: best, letterSpacing: "", textOverflow: "clip" };
  }
  if (!overflows(best, "-0.03em")) {
    return { fontSizePx: best, letterSpacing: "-0.03em", textOverflow: "clip" };
  }
  if (!overflows(best, "-0.05em")) {
    return { fontSizePx: best, letterSpacing: "-0.05em", textOverflow: "clip" };
  }

  return {
    fontSizePx: min,
    letterSpacing: "-0.05em",
    textOverflow: "ellipsis",
  };
}
