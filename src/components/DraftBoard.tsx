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
    // Scroll the board itself, never pull the page away from the pick controls.
    const cell = activeCell.current;
    const scroller = cell?.closest(".draft-board-scroll");
    if (cell && scroller) scroller.scrollLeft = Math.max(0, cell.offsetLeft - scroller.clientWidth / 2 + cell.clientWidth / 2);
  }, [state.draftCursor]);
  return <div className="draft-board-scroll overflow-x-auto rounded-xl border border-[var(--mint)]" tabIndex={0} role="region" aria-label="Draft board, scroll for all players">
    <table className="w-full table-fixed border-collapse text-left text-sm" style={{ minWidth: Math.max(320, seats.length * 132) }}>
      <caption className="sr-only">Four picks per player. Draft direction reverses each pass.</caption>
      <thead><tr>{seats.map((seat) => {
        const pid = state.seatOrder[seat];
        const player = state.players.find((p) => p.id === pid);
        return <th scope="col" key={seat} className={`border-b border-r border-[var(--mint)] px-3 py-3 ${pid === youId ? "bg-[var(--mint)]" : "bg-white/60"}`}>{player?.name}{pid === youId && <span className="block text-xs font-normal">You</span>}</th>;
      })}</tr></thead>
      <tbody>{Array.from({ length: RULES.picksPerPlayer }, (_, pass) => <tr key={pass}>{seats.map((seat, column) => {
        const turn = pass * seats.length + (pass % 2 === 0 ? column : seats.length - 1 - column);
        const pick = state.picks.find((p) => p.turnIndex === turn);
        const current = state.draftCursor === turn && (state.phase === "DRAFT" || state.phase === "CORRECTION");
        return <td key={seat} ref={current ? activeCell : undefined} data-turn={turn} aria-current={current ? "step" : undefined} className={`h-28 border-b border-r border-[var(--mint)] p-3 align-top ${current ? "bg-[var(--yellow)]" : pick ? "bg-white/80" : "bg-white/25"}`}>
          <div className="mb-2 flex items-center justify-between text-xs text-[var(--muted)]"><span>{pass + 1}.{String(turn % seats.length + 1).padStart(2, "0")}</span><span aria-label={pass % 2 === 0 ? "Left to right" : "Right to left"}>{pass % 2 === 0 ? "→" : "←"}</span></div>
          <p className="break-words font-bold">{pick?.text ?? (current ? "On the clock" : "—")}</p>
          {isHost && pick && state.phase === "DRAFT" && <details className="mt-1">
            <summary className="cursor-pointer py-2 text-xs text-[var(--muted)]">Edit pick</summary>
            {(["duplicate", "invalid"] as const).map((reason) => <button key={reason} type="button" className="block min-h-11 w-full text-left text-xs font-bold capitalize" onClick={() => {
              if (window.confirm(`Replace “${pick.text}” as ${reason}?`)) send({ type: "host_correct", turnIndex: turn, reason });
            }}>{reason}</button>)}
          </details>}
        </td>;
      })}</tr>)}</tbody>
    </table>
  </div>;
}
