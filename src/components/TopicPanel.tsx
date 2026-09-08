"use client";

import { useEffect, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import type { TopicScope } from "@/shared/topics";

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

export function TopicPanel({
  state,
  you,
  send,
}: {
  state: PublicRoomState;
  you: Player;
  send: (m: ClientMessage) => void;
}) {
  const optionKey = state.topicOptions.map((t) => t.id).join(",");
  const [spinning, setSpinning] = useState(false);
  const [custom, setCustom] = useState("");
  const [scope, setScope] = useState<TopicScope>("everyday");
  const myVote = state.myTopicVote;
  const canReroll = you.role === "player";

  useEffect(() => {
    const t = setTimeout(() => setSpinning(true), 0);
    const t2 = setTimeout(() => setSpinning(false), 700);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [optionKey]);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold">
          Topic · {state.topicRound + 1}/{state.configuredTopicRounds}
        </h2>
        <span className="text-sm font-bold tabular-nums text-[var(--muted)]">
          <Countdown until={state.phaseDeadlineAt} />
        </span>
      </div>

      <div className={`space-y-2 ${spinning ? "topic-spinner" : ""}`}>
        {state.topicOptions.map((t) => {
          const votes = state.topicVoteCounts[t.id] ?? 0;
          const selected = myVote === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={`panel w-full min-h-[64px] text-left transition ${
                selected ? "ring-2 ring-[var(--coral)]" : ""
              }`}
              onClick={() => send({ type: "vote_topic", topicId: t.id })}
              disabled={you.role !== "player"}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-extrabold text-base leading-snug">{t.text}</p>
                <span className="shrink-0 rounded-full bg-[var(--mint)] px-2.5 py-1 text-xs font-bold tabular-nums">
                  {votes}
                </span>
              </div>
              {selected && t.scopeBoundary ? (
                <p className="mt-1.5 text-xs text-[var(--muted)]">{t.scopeBoundary}</p>
              ) : null}
            </button>
          );
        })}
      </div>

      {canReroll && (
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={() => send({ type: "majority_reroll" })}
        >
          Reroll topics
        </button>
      )}

      {you.isHost && (
        <details className="panel space-y-2">
          <summary className="min-h-11 cursor-pointer font-bold">Custom topic</summary>
          <input
            className="field w-full"
            value={custom}
            placeholder="Your topic"
            onChange={(e) => setCustom(e.target.value)}
          />
          <select
            className="field w-full"
            value={scope}
            onChange={(e) => setScope(e.target.value as TopicScope)}
          >
            <option value="sports">sports</option>
            <option value="food">food</option>
            <option value="everyday">everyday</option>
            <option value="entertainment">entertainment</option>
          </select>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() =>
              send({
                type: "custom_topic",
                text: custom,
                scope,
                scopeBoundary: "Host custom — agree boundaries as a group.",
              })
            }
          >
            Lock custom
          </button>
        </details>
      )}
    </div>
  );
}
