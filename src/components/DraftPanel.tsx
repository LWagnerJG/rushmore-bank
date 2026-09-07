"use client";

import { useEffect, useMemo, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { loadIdeas, saveIdeas } from "@/lib/party";
import { RULES } from "@/shared/rules";

function Countdown({ until }: { until: number | null }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!until) return;
    const tick = () =>
      setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [until]);
  if (!until) return null;
  return <span className="tabular-nums">{left}s</span>;
}

export function DraftPanel({
  state,
  you,
  youId,
  send,
}: {
  state: PublicRoomState;
  you: Player;
  youId: string;
  send: (m: ClientMessage) => void;
}) {
  const topicId = state.selectedTopic?.id ?? "none";
  const [text, setText] = useState("");
  const [ideaDraft, setIdeaDraft] = useState("");
  const [ideas, setIdeas] = useState<string[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      setIdeas(loadIdeas(state.code, youId, topicId));
    }, 0);
    return () => clearTimeout(t);
  }, [state.code, youId, topicId]);

  const turnSeat = state.draftOrder[state.draftCursor];
  const turnPlayerId =
    turnSeat !== undefined ? state.seatOrder[turnSeat] : null;
  const turnPlayer = state.players.find((p) => p.id === turnPlayerId);
  const myTurn = turnPlayerId === youId;
  const taken = new Set(state.takenNormalized);

  const nextTurnSeat = state.draftOrder[state.draftCursor + 1];
  const nextPlayerId =
    nextTurnSeat !== undefined ? state.seatOrder[nextTurnSeat] : null;
  const youreNext = nextPlayerId === youId && !myTurn;

  const pickRound = Math.floor(state.draftCursor / Math.max(1, state.seatOrder.length)) + 1;
  const totalRounds = RULES.picksPerPlayer;

  const myRoster = useMemo(
    () =>
      state.picks
        .filter((p) => p.playerId === youId)
        .sort((a, b) => a.pickIndex - b.pickIndex),
    [state.picks, youId],
  );

  /** Fantasy-style board: rows = snake rounds, cols = seats in display order */
  const boardRows = useMemo(() => {
    const n = state.seatOrder.length;
    if (n === 0) return [];
    const rows: {
      round: number;
      cells: {
        playerId: string;
        pick: string | null;
        isCurrent: boolean;
        pickIndex: number;
      }[];
    }[] = [];
    for (let round = 0; round < RULES.picksPerPlayer; round++) {
      const cells = state.seatOrder.map((playerId) => {
        const pick = state.picks.find(
          (pk) => pk.playerId === playerId && pk.pickIndex === round,
        );
        const turnIndex = state.draftOrder.findIndex(
          (s, i) =>
            Math.floor(i / n) === round && state.seatOrder[s] === playerId,
        );
        return {
          playerId,
          pick: pick?.text ?? null,
          isCurrent: turnIndex === state.draftCursor,
          pickIndex: round,
        };
      });
      rows.push({ round: round + 1, cells });
    }
    return rows;
  }, [state.seatOrder, state.picks, state.draftOrder, state.draftCursor]);

  const snakeOrderPreview = useMemo(() => {
    const n = state.seatOrder.length;
    if (n === 0) return [];
    return state.draftOrder.slice(0, Math.min(state.draftOrder.length, n * 2)).map((seat, i) => {
      const pid = state.seatOrder[seat]!;
      const p = state.players.find((x) => x.id === pid);
      return {
        i,
        name: p?.name ?? "?",
        you: pid === youId,
        done: i < state.draftCursor,
        current: i === state.draftCursor,
      };
    });
  }, [state.draftOrder, state.seatOrder, state.players, state.draftCursor, youId]);

  function persistIdeas(next: string[]) {
    setIdeas(next);
    saveIdeas(state.code, youId, topicId, next);
  }

  function lockIn(value: string) {
    const trimmed = value.trim();
    if (!trimmed || state.pickPaused) return;
    send({ type: "lock_in", text: trimmed });
    setText("");
  }

  return (
    <div className="space-y-4">
      <div className="panel space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
          {state.phase === "CORRECTION"
            ? `Fix · ${state.correctionReason}`
            : "Snake draft"}{" "}
          · Round {Math.min(pickRound, totalRounds)}/{totalRounds}
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold leading-tight">
          {state.selectedTopic?.text}
        </h2>
        <div
          className={
            "rounded-xl px-3 py-3 " +
            (myTurn
              ? "bg-[rgba(231,111,78,0.2)]"
              : youreNext
                ? "bg-[rgba(244,201,91,0.35)]"
                : "bg-[rgba(167,215,194,0.25)]")
          }
        >
          {myTurn ? (
            <p className="text-lg font-extrabold text-[var(--coral)]">
              You’re on the clock · <Countdown until={state.pickDeadlineAt} />
            </p>
          ) : (
            <p className="font-extrabold">
              On the clock: {turnPlayer?.name ?? "—"} ·{" "}
              <Countdown until={state.pickDeadlineAt} />
            </p>
          )}
          {youreNext && (
            <p className="mt-1 text-sm font-bold">You’re next</p>
          )}
          {state.pickPaused && (
            <p className="mt-1 text-sm font-semibold">Paused by host</p>
          )}
        </div>
      </div>

      {myTurn && you.role === "player" && (
        <section className="panel space-y-3">
          <input
            className="field w-full text-lg"
            value={text}
            placeholder="Type your pick"
            maxLength={48}
            autoFocus
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") lockIn(text);
            }}
          />
          <button
            type="button"
            className="btn-primary w-full pulse-soft text-xl"
            disabled={!text.trim() || state.pickPaused}
            onClick={() => lockIn(text)}
          >
            Lock In
          </button>
        </section>
      )}

      <section className="panel space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-extrabold">Draft board</h3>
          <span className="text-xs font-bold uppercase text-[var(--muted)]">
            Snake · → then ←
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[280px] border-separate border-spacing-1 text-left text-xs">
            <thead>
              <tr>
                <th className="px-1 py-1 font-bold text-[var(--muted)]">Rd</th>
                {state.seatOrder.map((pid) => {
                  const p = state.players.find((x) => x.id === pid);
                  return (
                    <th
                      key={pid}
                      className={
                        "truncate px-1 py-1 font-extrabold " +
                        (pid === youId ? "text-[var(--coral)]" : "")
                      }
                    >
                      {p?.name ?? "?"}
                      {pid === youId ? " · you" : ""}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {boardRows.map((row) => (
                <tr key={row.round}>
                  <td className="px-1 py-1 font-bold text-[var(--muted)]">
                    {row.round}
                    <span className="block text-[10px] font-semibold">
                      {row.round % 2 === 1 ? "→" : "←"}
                    </span>
                  </td>
                  {row.cells.map((cell) => (
                    <td
                      key={`${row.round}-${cell.playerId}`}
                      className={
                        "rounded-lg px-1.5 py-2 align-top font-semibold " +
                        (cell.isCurrent
                          ? "bg-[rgba(231,111,78,0.28)] ring-2 ring-[var(--coral)]"
                          : cell.pick
                            ? "bg-white/80"
                            : "bg-[rgba(35,72,62,0.06)]")
                      }
                    >
                      {cell.pick ?? (cell.isCurrent ? "…" : "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {snakeOrderPreview.map((slot) => (
            <span
              key={slot.i}
              className={
                "rounded-md px-2 py-1 text-[11px] font-bold " +
                (slot.current
                  ? "bg-[var(--coral)] text-white"
                  : slot.done
                    ? "bg-[rgba(35,72,62,0.08)] text-[var(--muted)] line-through"
                    : "bg-white/70")
              }
            >
              {slot.name}
              {slot.you ? "*" : ""}
            </span>
          ))}
          {state.draftOrder.length > snakeOrderPreview.length && (
            <span className="px-1 text-[11px] font-bold text-[var(--muted)]">
              …
            </span>
          )}
        </div>
      </section>

      <section className="panel space-y-2">
        <h3 className="font-extrabold">My Ideas · private</h3>
        <div className="flex gap-2">
          <input
            className="field w-full"
            value={ideaDraft}
            placeholder="Jot an idea"
            onChange={(e) => setIdeaDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && ideaDraft.trim()) {
                persistIdeas([...ideas, ideaDraft.trim()]);
                setIdeaDraft("");
              }
            }}
          />
          <button
            type="button"
            className="btn-secondary shrink-0"
            onClick={() => {
              if (!ideaDraft.trim()) return;
              persistIdeas([...ideas, ideaDraft.trim()]);
              setIdeaDraft("");
            }}
          >
            Save
          </button>
        </div>
        <ul className="space-y-1">
          {ideas.map((idea) => {
            const takenNow = taken.has(idea.trim().toLowerCase());
            return (
              <li
                key={idea}
                className="flex min-h-11 items-center justify-between gap-2 text-sm"
              >
                <span className={takenNow ? "line-through opacity-50" : ""}>
                  {idea}
                  {takenNow ? " · taken" : ""}
                </span>
                <button
                  type="button"
                  className="btn-secondary !min-h-10 !px-3 text-xs"
                  disabled={!myTurn || takenNow}
                  onClick={() => setText(idea)}
                >
                  Use
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel space-y-1">
        <h3 className="font-extrabold">
          Your four ({myRoster.length}/{RULES.picksPerPlayer})
        </h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm font-semibold">
          {myRoster.map((p) => (
            <li key={p.turnIndex}>{p.text}</li>
          ))}
        </ol>
      </section>

      {you.isHost && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() =>
                send({ type: state.pickPaused ? "host_resume" : "host_pause" })
              }
            >
              {state.pickPaused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => send({ type: "host_extend" })}
            >
              +{RULES.hostExtendSeconds}s
            </button>
          </div>
          {state.picks.length > 0 && (
            <details className="panel text-sm">
              <summary className="cursor-pointer font-bold">
                Host · fix a pick
              </summary>
              <ul className="mt-2 space-y-2">
                {state.picks.map((pk) => {
                  const p = state.players.find((x) => x.id === pk.playerId);
                  return (
                    <li
                      key={pk.turnIndex}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span>
                        {p?.name}: {pk.text}
                      </span>
                      <span className="flex gap-2">
                        <button
                          type="button"
                          className="text-xs font-bold text-[var(--coral)]"
                          onClick={() =>
                            send({
                              type: "host_correct",
                              turnIndex: pk.turnIndex,
                              reason: "duplicate",
                            })
                          }
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          className="text-xs font-bold text-[var(--coral)]"
                          onClick={() =>
                            send({
                              type: "host_correct",
                              turnIndex: pk.turnIndex,
                              reason: "invalid",
                            })
                          }
                        >
                          Invalid
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
