"use client";

import { useEffect, useRef } from "react";
import type { ClientMessage, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";

export function DraftBoard({ state, youId, isHost, send }: {
  state: PublicRoomState; youId: string; isHost: boolean; send: (m: ClientMessage) => void;
}) {
  const activeCell = useRef<HTMLTableCellElement>(null);
  const seats = state.draftOrder.slice(0, state.seatOrder.length);
  useEffect(() => {
    const cell = activeCell.current;
    const scroller = cell?.closest(".draft-board-scroll");
    if (cell && scroller) scroller.scrollLeft = Math.max(0, cell.offsetLeft - scroller.clientWidth / 2 + cell.clientWidth / 2);
  }, [state.draftCursor]);

  return (
    <div
      className="draft-board-scroll overflow-x-auto rounded-2xl border border-[var(--mint)] bg-white/40"
      tabIndex={0}
      role="region"
      aria-label="Draft board"
    >
      <table
        className="w-full table-fixed border-collapse text-left text-sm"
        style={{ minWidth: Math.max(280, seats.length * 118) }}
      >
        <caption className="sr-only">Four picks per player. Snake order.</caption>
        <thead>
          <tr>
            {seats.map((seat) => {
              const pid = state.seatOrder[seat];
              const player = state.players.find((p) => p.id === pid);
              const onClock = state.seatOrder[state.draftOrder[state.draftCursor]] === pid
                && (state.phase === "DRAFT" || state.phase === "CORRECTION");
              return (
                <th
                  scope="col"
                  key={seat}
                  className={`border-b border-r border-[var(--mint)] px-2 py-2.5 text-sm ${
                    pid === youId ? "bg-[var(--mint)]" : "bg-white/70"
                  } ${onClock ? "ring-inset ring-2 ring-[var(--yellow)]" : ""}`}
                >
                  <span className="block truncate font-extrabold">{player?.name}</span>
                  {pid === youId && <span className="block text-[0.65rem] font-semibold uppercase tracking-wide">You</span>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: RULES.picksPerPlayer }, (_, pass) => (
            <tr key={pass}>
              {seats.map((seat, column) => {
                const turn = pass * seats.length + (pass % 2 === 0 ? column : seats.length - 1 - column);
                const pick = state.picks.find((p) => p.turnIndex === turn);
                const current = state.draftCursor === turn && (state.phase === "DRAFT" || state.phase === "CORRECTION");
                return (
                  <td
                    key={seat}
                    ref={current ? activeCell : undefined}
                    data-turn={turn}
                    aria-current={current ? "step" : undefined}
                    className={`h-20 border-b border-r border-[var(--mint)] p-2 align-top ${
                      current ? "bg-[var(--yellow)]" : pick ? "bg-white/85" : "bg-white/20"
                    }`}
                  >
                    <p className={`break-words text-sm leading-snug ${pick || current ? "font-bold" : "text-[var(--muted)]"}`}>
                      {pick?.text ?? (current ? "…" : "—")}
                    </p>
                    {isHost && pick && state.phase === "DRAFT" && (
                      <details className="mt-1">
                        <summary className="cursor-pointer py-1 text-[0.65rem] font-bold uppercase tracking-wide text-[var(--muted)]">
                          Edit
                        </summary>
                        {(["duplicate", "invalid"] as const).map((reason) => (
                          <button
                            key={reason}
                            type="button"
                            className="block min-h-10 w-full text-left text-xs font-bold capitalize"
                            onClick={() => {
                              if (window.confirm(`Replace “${pick.text}” as ${reason}?`)) {
                                send({ type: "host_correct", turnIndex: turn, reason });
                              }
                            }}
                          >
                            {reason}
                          </button>
                        ))}
                      </details>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
