"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientMessage, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";

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
  const correcting = state.phase === "CORRECTION";
  const redoTurn = correcting
    ? Number(state.correctionTargetPickId)
    : null;
  const [hostFocusTurn, setHostFocusTurn] = useState<number | null>(null);
  const focusTurn = correcting ? null : hostFocusTurn;

  useEffect(() => {
    const cell = activeCell.current;
    const scroller = cell?.closest(".draft-board-scroll");
    if (cell && scroller)
      scroller.scrollLeft = Math.max(
        0,
        cell.offsetLeft - scroller.clientWidth / 2 + cell.clientWidth / 2,
      );
  }, [state.draftCursor, redoTurn]);

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
      {isHost && !correcting && focusTurn != null && (
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
        className="draft-board-scroll overflow-x-auto rounded-2xl bg-white/50"
        tabIndex={0}
        role="region"
        aria-label="Draft board"
      >
        <table
          className="w-full table-fixed border-collapse text-left text-sm"
          style={{ minWidth: Math.max(280, seats.length * 118) }}
        >
          <caption className="sr-only">
            Exactly four picks per player. Snake order.
          </caption>
          <thead>
            <tr>
              {seats.map((seat) => {
                const pid = state.seatOrder[seat];
                const player = state.players.find((p) => p.id === pid);
                const onClock =
                  state.seatOrder[state.draftOrder[state.draftCursor]] ===
                    pid &&
                  (state.phase === "DRAFT" || state.phase === "CORRECTION");
                return (
                  <th
                    scope="col"
                    key={seat}
                    className={`border-b border-r border-[rgba(35,72,62,0.08)] px-2 py-2 text-sm last:border-r-0 ${
                      pid === youId ? "bg-[var(--mint)]" : "bg-transparent"
                    } ${onClock ? "shadow-[inset_0_-3px_0_0_var(--yellow)]" : ""}`}
                  >
                    <span className="block truncate font-extrabold">
                      {player?.name}
                    </span>
                    {pid === youId && (
                      <span className="block text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
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
                      className={`h-[4.5rem] border-b border-r border-[rgba(35,72,62,0.08)] p-2 align-top last:border-r-0 ${
                        isRedoTarget || current
                          ? "bg-[var(--yellow)]"
                          : hostFocused
                            ? "bg-[rgba(244,201,91,0.45)]"
                            : pick
                              ? "bg-white/70"
                              : "bg-transparent"
                      } ${dimForRedo ? "opacity-40" : ""}`}
                    >
                      <p
                        className={`break-words text-sm leading-snug ${
                          pick || current || isRedoTarget
                            ? "font-bold"
                            : "text-[var(--muted)]"
                        }`}
                      >
                        {pick?.text ??
                          (current || isRedoTarget ? "…" : "")}
                      </p>
                      {isHost &&
                        pick &&
                        state.phase === "DRAFT" &&
                        !correcting && (
                          <button
                            type="button"
                            className={`mt-1 text-[0.65rem] font-extrabold uppercase tracking-wide ${
                              hostFocused
                                ? "text-[var(--text)]"
                                : "text-[var(--muted)]"
                            }`}
                            aria-pressed={hostFocused}
                            onClick={() =>
                              setHostFocusTurn((t) =>
                                t === turn ? null : turn,
                              )
                            }
                          >
                            {hostFocused ? "Selected" : "Redo"}
                          </button>
                        )}
                      {isRedoTarget && (
                        <p className="mt-1 text-[0.65rem] font-extrabold uppercase tracking-wide">
                          Replacing
                        </p>
                      )}
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
