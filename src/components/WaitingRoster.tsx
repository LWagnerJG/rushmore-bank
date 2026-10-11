"use client";

import type { Player, PublicRoomState } from "@/shared/types";
import { FitName } from "@/components/FitName";
import { profileInitials } from "@/lib/profile-initials";
import { nameWithYouSuffix } from "@/shared/you-label";

/**
 * Waiting UI: avatars + count. Done = green tint + check; waiting = neutral.
 * Leaderboard lives on PlayerRail — never listed here.
 * `compact` keeps only the one-line status + count (bottom action docks).
 */
export function WaitingRoster({
  state,
  youId,
  doneIds,
  label,
  compact = false,
}: {
  state: PublicRoomState;
  youId: string;
  /** Player ids who have already locked in / voted / readied. */
  doneIds: ReadonlySet<string> | readonly string[];
  label: string;
  compact?: boolean;
}) {
  const done = doneIds instanceof Set ? doneIds : new Set(doneIds);
  const seated = state.seatOrder
    .map((id) => state.players.find((p) => p.id === id))
    .filter((p): p is Player => !!p && p.role === "player");
  const waiting = seated.filter((p) => !done.has(p.id));
  const statusLine =
    waiting.length > 0
      ? `Waiting on ${waiting
          .map((p) => (p.id === youId ? "you" : p.name))
          .join(", ")}`
      : label === "Votes in" || label.endsWith("in")
        ? "Everyone’s in"
        : label;

  return (
    <section
      className={compact ? "waiting-roster waiting-roster-compact" : "waiting-roster"}
      aria-live="polite"
    >
      <div className="waiting-roster-head">
        <p className="waiting-roster-status">{statusLine}</p>
        <p className="waiting-roster-count tabular-nums">
          {done.size}/{seated.length}
        </p>
      </div>

      {compact ? null : (
        <ul className="waiting-roster-avatars" aria-label="Players">
          {seated.map((p) => {
            const locked = done.has(p.id);
            const name = p.id === youId ? nameWithYouSuffix(p.name) : p.name;
            return (
              <li
                key={p.id}
                className={[
                  "waiting-roster-person",
                  locked
                    ? "waiting-roster-person-done"
                    : "waiting-roster-person-wait",
                ].join(" ")}
                title={name}
              >
                <span className="waiting-roster-avatar" aria-hidden="true">
                  {locked ? (
                    <span className="waiting-roster-check">✓</span>
                  ) : (
                    profileInitials(p.name)
                  )}
                </span>
                <FitName
                  className="waiting-roster-name type-meta"
                  text={name}
                  title={name}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
