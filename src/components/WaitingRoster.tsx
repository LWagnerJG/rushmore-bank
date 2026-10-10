"use client";

import type { Player, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

/**
 * Waiting UI: who you’re still waiting on (avatars/names dim as they lock in)
 * plus current standings. No tips.
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
  const standings = [...seated].sort((a, b) => b.stones - a.stones);

  return (
    <section className="waiting-roster stack-sm" aria-live="polite">
      <div className="waiting-roster-head">
        <p className="type-body font-extrabold">{label}</p>
        <p className="type-meta tabular-nums text-[var(--muted)]">
          {done.size}/{seated.length}
        </p>
      </div>

      <ul className="waiting-roster-avatars" aria-label="Players">
        {seated.map((p) => {
          const locked = done.has(p.id);
          return (
            <li
              key={p.id}
              className={[
                "waiting-roster-person",
                locked ? "waiting-roster-person-done" : "waiting-roster-person-wait",
              ].join(" ")}
              title={p.name}
            >
              <span className="waiting-roster-avatar" aria-hidden="true">
                {initials(p.name)}
              </span>
              <span className="waiting-roster-name type-meta">
                {p.name}
                {p.id === youId ? " (you)" : ""}
              </span>
            </li>
          );
        })}
      </ul>

      {waiting.length > 0 ? (
        <p className="type-meta text-[var(--muted)]">
          Waiting on{" "}
          {waiting
            .map((p) => (p.id === youId ? "you" : p.name))
            .join(", ")}
        </p>
      ) : (
        <p className="type-meta text-[var(--muted)]">Everyone’s in</p>
      )}

      <div className="waiting-roster-standings">
        <p className="type-meta font-extrabold uppercase tracking-wide text-[var(--muted)]">
          Standings
        </p>
        <ol className="stack-sm">
          {standings.map((p, i) => (
            <li key={p.id} className="waiting-roster-stand-row type-meta">
              <span>
                {i + 1}. {p.name}
                {p.id === youId ? " (you)" : ""}
              </span>
              <span className="tabular-nums text-[var(--coral)]">
                {p.stones} {RULES.currencyName}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
