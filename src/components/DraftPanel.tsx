"use client";

import { useEffect, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { IdeasPanel } from "@/components/IdeasPanel";
import { RULES } from "@/shared/rules";

function Countdown({ until }: { until: number | null }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!until) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
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
  const turnSeat = state.draftOrder[state.draftCursor];
  const turnPlayerId =
    turnSeat !== undefined ? state.seatOrder[turnSeat] : null;
  const turnPlayer = state.players.find((p) => p.id === turnPlayerId);
  const myTurn = turnPlayerId === youId;

  return (
    <div className="space-y-4">
      <div className="panel space-y-1">
        <p className="text-xs font-bold uppercase text-[var(--muted)]">
          {state.phase === "CORRECTION"
            ? `Correction · ${state.correctionReason}`
            : "Snake draft"}{" "}
          · pick {state.draftCursor + 1}/{state.draftOrder.length}
        </p>
        <h2 className="font-extrabold">{state.selectedTopic?.text}</h2>
        <p className="text-sm">
          Turn:{" "}
          <strong className={myTurn ? "text-[var(--coral)]" : ""}>
            {turnPlayer?.name ?? "—"}
          </strong>{" "}
          · <Countdown until={state.pickDeadlineAt} />
          {state.pickPaused && " (paused)"}
        </p>
      </div>

      {myTurn && you.role === "player" && (
        <section className="panel space-y-2">
          <input
            aria-label="Your draft pick"
            className="field w-full"
            value={text}
            placeholder="Your pick"
            maxLength={48}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim() && !state.pickPaused) {
                send({ type: "lock_in", text });
                setText("");
              }
            }}
          />
          <button
            type="button"
            className="btn-primary w-full pulse-soft"
            disabled={!text.trim() || state.pickPaused}
            onClick={() => {
              send({ type: "lock_in", text });
              setText("");
            }}
          >
            Lock pick
          </button>
        </section>
      )}

      {you.role === "player" && <IdeasPanel key={topicId} room={state.code} playerId={youId} topicId={topicId} taken={state.takenNormalized} onUse={myTurn && !state.pickPaused ? setText : undefined} />}

      <section className="panel space-y-2">
        <h3 className="font-extrabold">Board</h3>
        {state.seatOrder.map((pid) => {
          const p = state.players.find((x) => x.id === pid);
          const picks = state.picks
            .filter((pk) => pk.playerId === pid)
            .sort((a, b) => a.pickIndex - b.pickIndex);
          return (
            <div key={pid} className="text-sm">
              <p className="font-bold">{p?.name}{pid === youId ? " (you)" : ""}</p>
              <p className="text-[var(--muted)]">
                {picks.map((pk) => pk.text).join(" · ") || "—"}
              </p>
              {you.isHost && state.phase === "DRAFT" && picks.length > 0 && <details className="mt-2">
                <summary className="cursor-pointer text-xs font-semibold text-[var(--muted)]">Correct a pick</summary>
                {picks.map((pk) => <div key={pk.turnIndex} className="mt-2 rounded-lg border border-[var(--mint)] p-2">
                  <p className="font-semibold">{pk.text}</p>
                  <div className="flex gap-4">{(["duplicate", "invalid"] as const).map((reason) => <button key={reason} type="button" className="min-h-11 text-xs font-bold capitalize" onClick={() => {
                    if (window.confirm(`Replace “${pk.text}” as ${reason}?`)) send({ type: "host_correct", turnIndex: pk.turnIndex, reason });
                  }}>{reason}</button>)}</div>
                </div>)}
              </details>}
            </div>
          );
        })}
      </section>

      {you.isHost && (
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
      )}
    </div>
  );
}

