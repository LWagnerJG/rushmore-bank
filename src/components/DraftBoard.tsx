"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientMessage, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";
import { currentUpPlayerId } from "@/shared/engine/up-seat";
import { readAdminUnlocked } from "@/lib/admin-session";

function densityFor(count: number): "cozy" | "snug" | "dense" {
  if (count >= 8) return "dense";
  if (count >= 5) return "snug";
  return "cozy";
}

function colWidthPx(count: number, density: "cozy" | "snug" | "dense"): number {
  if (density === "dense") return Math.max(58, Math.min(80, 500 / count));
  if (density === "snug") return Math.max(72, Math.min(96, 540 / count));
  return Math.max(92, Math.min(112, 600 / count));
}

export function DraftBoard({
  state,
  youId,
  isHost,
  send,
}: {
  state: PublicRoomState;
  youId: string;
  isHost: boolean;
  send: (m: ClientMessage) => void;
}) {
  const activeCell = useRef<HTMLTableCellElement>(null);
  const seats = state.draftOrder.slice(0, state.seatOrder.length);
  const density = densityFor(seats.length);
  const colW = colWidthPx(seats.length, density);
  const correcting = state.phase === "CORRECTION";
  const redoTurn = correcting
    ? Number(state.correctionTargetPickId)
    : null;
  const [hostFocusTurn, setHostFocusTurn] = useState<number | null>(null);
  const [adminMode, setAdminMode] = useState(false);
  const focusTurn = correcting ? null : hostFocusTurn;
  const upId = currentUpPlayerId(state);
  /** Host may correct; admin unlock only changes how loud the affordance is. */
  const canShowRedo = isHost && state.phase === "DRAFT" && !correcting;

  useEffect(() => {
    const sync = () => setAdminMode(readAdminUnlocked());
    sync();
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);

  useEffect(() => {
    const cell = activeCell.current;
    const scroller = cell?.closest(".draft-board-scroll");
    if (cell && scroller)
      scroller.scrollLeft = Math.max(
        0,
        cell.offsetLeft - scroller.clientWidth / 2 + cell.clientWidth / 2,
      );
  }, [state.draftCursor, redoTurn, density]);

  function requestRedo(turn: number, reason: "duplicate" | "invalid") {
    const pick = state.picks.find((p) => p.turnIndex === turn);
    if (!pick) return;
    const slot = pick.pickIndex + 1;
    if (
      !window.confirm(
        `Redo slot ${slot}/4 for this player?\n“${pick.text}” → ${reason}`,
      )
    )
      return;
    setHostFocusTurn(null);
    send({ type: "host_correct", turnIndex: turn, reason });
  }

  return (
    <div className="space-y-2">
      {canShowRedo && focusTurn != null && (
        <div className="draft-redo-bar" role="region" aria-label="Redo pick">
          <p className="text-sm font-extrabold">
            Redo slot{" "}
            {(state.picks.find((p) => p.turnIndex === focusTurn)
              ?.pickIndex ?? 0) + 1}
            /4
          </p>
          <p className="truncate text-xs text-[var(--muted)]">
            {state.picks.find((p) => p.turnIndex === focusTurn)?.text}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary flex-1 text-sm"
              onClick={() => requestRedo(focusTurn, "duplicate")}
            >
              Duplicate
            </button>
            <button
              type="button"
              className="btn-secondary flex-1 text-sm"
              onClick={() => requestRedo(focusTurn, "invalid")}
            >
              Invalid
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => setHostFocusTurn(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div
        className={`draft-board-scroll draft-board-scroll-${density}`}
        tabIndex={0}
        role="region"
        aria-label="Draft board"
      >
        <table
          className={`draft-board-table draft-board-density-${density}`}
          style={{ minWidth: Math.max(260, seats.length * colW) }}
        >
          <caption className="sr-only">
            Exactly four picks per player. Snake order.
          </caption>
          <thead>
            <tr>
              {seats.map((seat) => {
                const pid = state.seatOrder[seat];
                const player = state.players.find((p) => p.id === pid);
                const onClock = upId === pid;
                return (
                  <th
                    scope="col"
                    key={seat}
                    className={[
                      pid === youId ? "is-you" : "",
                      onClock ? "draft-board-on-clock" : "",
                      onClock ? "draft-board-col-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="block truncate font-extrabold">
                      {player?.name}
                    </span>
                    {pid === youId && (
                      <span className="draft-board-you-label block font-semibold uppercase tracking-wide text-[var(--muted)]">
                        You
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: RULES.picksPerPlayer }, (_, pass) => (
              <tr key={pass}>
                {seats.map((seat, column) => {
                  const turn =
                    pass * seats.length +
                    (pass % 2 === 0 ? column : seats.length - 1 - column);
                  const pick = state.picks.find((p) => p.turnIndex === turn);
                  const pid = state.seatOrder[seat];
                  const colActive = upId === pid;
                  const current =
                    state.draftCursor === turn &&
                    (state.phase === "DRAFT" || state.phase === "CORRECTION");
                  const isRedoTarget = redoTurn === turn;
                  const hostFocused = focusTurn === turn;
                  const dimForRedo =
                    correcting && !isRedoTarget && !current;
                  return (
                    <td
                      key={`${pass}-${seat}`}
                      ref={current || isRedoTarget ? activeCell : undefined}
                      data-turn={turn}
                      aria-current={current || isRedoTarget ? "step" : undefined}
                      className={[
                        "draft-board-cell",
                        colActive ? "draft-board-col-active" : "",
                        isRedoTarget || current
                          ? "draft-board-cell-live"
                          : hostFocused
                            ? "draft-board-cell-focus"
                            : pick
                              ? "draft-board-cell-filled"
                              : "draft-board-cell-empty",
                        dimForRedo ? "opacity-40" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <div className="draft-board-cell-inner">
                        {canShowRedo && pick ? (
                          <button
                            type="button"
                            className={[
                              "draft-board-pick-hit",
                              hostFocused ? "draft-board-pick-hit-on" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            aria-label={
                              hostFocused
                                ? "Deselect pick for redo"
                                : `Select ${pick.text} for redo`
                            }
                            aria-pressed={hostFocused}
                            onClick={() =>
                              setHostFocusTurn((t) =>
                                t === turn ? null : turn,
                              )
                            }
                          >
                            <span
                              className={`draft-board-cell-text font-bold`}
                            >
                              {pick.text}
                            </span>
                            {hostFocused && (
                              <span
                                className={
                                  adminMode
                                    ? "draft-board-redo draft-board-redo-admin"
                                    : "draft-board-redo draft-board-redo-host"
                                }
                              >
                                {adminMode ? "redo" : "↻"}
                              </span>
                            )}
                          </button>
                        ) : (
                          <p
                            className={`draft-board-cell-text ${
                              pick || current || isRedoTarget
                                ? "font-bold"
                                : "text-[var(--muted)]"
                            }`}
                          >
                            {pick?.text ??
                              (current || isRedoTarget ? "…" : "")}
                          </p>
                        )}
                        {isRedoTarget && (
                          <span className="draft-board-replacing">
                            replacing
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
