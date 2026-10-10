"use client";

import type { Player, PublicRoomState } from "@/shared/types";
import { FitName } from "@/components/FitName";
import { nameWithYouSuffix } from "@/shared/you-label";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

/**
 * Waiting UI: avatars + count. Done = green tint + check; waiting = neutral.
 * Leaderboard lives on PlayerRail — never listed here.
 */
export function WaitingRoster({
  state,
  youId,
  doneIds,
  label,
}: {
  state: PublicRoomState;
  youId: string;
  /** Player ids who have already locked in / voted / readied. */
  doneIds: ReadonlySet<string> | readonly string[];
  label: string;
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
    <section className="waiting-roster" aria-live="polite">
      <div className="waiting-roster-head">
        <p className="waiting-roster-status">{statusLine}</p>
        <p className="waiting-roster-count tabular-nums">
          {done.size}/{seated.length}
        </p>
      </div>

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
                  initials(p.name)
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
    </section>
  );
}
