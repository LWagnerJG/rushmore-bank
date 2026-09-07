"use client";

import { useEffect, useMemo, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { loadIdeas, saveIdeas } from "@/lib/party";
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

  const myRoster = useMemo(
    () =>
      state.picks
        .filter((p) => p.playerId === youId)
        .sort((a, b) => a.pickIndex - b.pickIndex),
    [state.picks, youId],
  );

  function persistIdeas(next: string[]) {
    setIdeas(next);
    saveIdeas(state.code, youId, topicId, next);
  }

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
            className="field w-full"
            value={text}
            placeholder="Your pick"
            maxLength={48}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim()) {
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
            Lock In
          </button>
        </section>
      )}

      <section className="panel space-y-2">
        <h3 className="font-extrabold">My Ideas (private)</h3>
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
            className="btn-secondary"
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
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className={takenNow ? "line-through opacity-50" : ""}>
                  {idea}
                  {takenNow ? " · taken" : ""}
                </span>
                <button
                  type="button"
                  className="text-xs font-bold text-[var(--coral)]"
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

      <section className="panel space-y-2">
        <h3 className="font-extrabold">Your Mount ({myRoster.length}/{RULES.picksPerPlayer})</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm font-semibold">
          {myRoster.map((p) => (
            <li key={p.turnIndex}>{p.text}</li>
          ))}
        </ol>
      </section>

      <section className="panel space-y-2">
        <h3 className="font-extrabold">Board</h3>
        {state.seatOrder.map((pid) => {
          const p = state.players.find((x) => x.id === pid);
          const picks = state.picks
            .filter((pk) => pk.playerId === pid)
            .sort((a, b) => a.pickIndex - b.pickIndex);
          return (
            <div key={pid} className="text-sm">
              <p className="font-bold">{p?.name}</p>
              <p className="text-[var(--muted)]">
                {picks.map((pk) => pk.text).join(" · ") || "—"}
              </p>
              {you.isHost &&
                picks.map((pk) => (
                  <div key={pk.turnIndex} className="mt-1 flex gap-2">
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
                  </div>
                ))}
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
