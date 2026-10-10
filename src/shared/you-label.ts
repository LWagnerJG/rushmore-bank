/** Nickname is already a self-reference ("you" / "You"). */
export function isYouName(name: string): boolean {
  return /^you$/i.test(name.trim());
}

/**
 * Visible label for the local player's PlayerRail chip.
 * One word only: "You" — never "You · you" or "You (you)".
 */
export function railYouLabel(): string {
  return "You";
}

/**
 * Tooltip / title for a PlayerRail chip. When the seat is you and the
 * nickname is already "you", do not echo a second "you".
 */
export function railChipTip(
  name: string,
  opts: { you: boolean; up: boolean },
): string {
  const base =
    opts.you && isYouName(name) ? "You" : name.trim() || (opts.you ? "You" : "Player");
  return opts.up ? `${base} · on the clock` : base;
}

/**
 * Dice / roster inline marker for the local player.
 * Returns "" when the name is already "you" so we never render "You · you".
 */
export function youInlineSuffix(name: string): string {
  return isYouName(name) ? "" : " · you";
}

/**
 * "Ada (you)" style labels — collapses to a single "You" when the
 * nickname is already a you-reference.
 */
export function nameWithYouSuffix(name: string): string {
  const n = name.trim() || "You";
  if (isYouName(n)) return "You";
  return `${n} (you)`;
}
