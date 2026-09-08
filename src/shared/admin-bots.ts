/** Max bots an admin can add in one tap. */
export const BOT_MAX_PER_ADD = 8;

/**
 * Parse add-bots input without clamping while the user is still typing.
 * Empty / non-numeric → null (UI stays empty; no snap to 1).
 */
export function parseBotCountDraft(raw: string, maxAdd: number): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1) return null;
  return Math.min(maxAdd, n);
}
