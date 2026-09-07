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
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold">
            Pick a topic
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Round {state.topicRound + 1} of {state.configuredTopicRounds} ·
            private vote
          </p>
        </div>
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
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-extrabold text-base">{t.text}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {t.scopeBoundary}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--mint)] px-2.5 py-1 text-xs font-bold">
                  {votes}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {you.isHost && (
        <div className="panel space-y-2">
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => send({ type: "majority_reroll" })}
            disabled={state.topicRerollsUsed >= 1}
          >
            Reroll shortlist ({1 - state.topicRerollsUsed} left)
          </button>
          <p className="text-xs font-bold">Custom topic</p>
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
        </div>
      )}
    </div>
  );
}
