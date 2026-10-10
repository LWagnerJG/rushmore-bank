/**
 * Single concise draft turn line — replaces stacked title + hint + waiting roster.
 */
export function draftStatusLine(opts: {
  phase: string;
  myTurn: boolean;
  turnName: string | null | undefined;
  turnsAway: number;
  pickPaused: boolean;
  correctionPickIndex?: number | null;
  correctionReason?: string | null;
}): string {
  if (opts.phase === "CORRECTION") {
    const slot = (opts.correctionPickIndex ?? 0) + 1;
    const reason = opts.correctionReason ?? "redo";
    const base = `Replace slot ${slot}/4 (${reason})`;
    return opts.pickPaused ? `${base} · paused` : base;
  }

  if (opts.myTurn) {
    return opts.pickPaused ? "Your pick · paused" : "Your pick";
  }

  const name = (opts.turnName ?? "Player").trim() || "Player";
  let line = `${name} picking`;
  if (opts.turnsAway === 1) line += " · you’re next";
  else if (opts.turnsAway > 1) line += ` · you’re up in ${opts.turnsAway}`;
  else if (opts.turnsAway < 0) line += " · your four are in";
  if (opts.pickPaused) line += " · paused";
  return line;
}
