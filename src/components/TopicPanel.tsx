"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import type { TopicScope } from "@/shared/topics";

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
  const [refreshing, setRefreshing] = useState(false);
  const [custom, setCustom] = useState("");
  const [scope, setScope] = useState<TopicScope>("everyday");
  const [customOpen, setCustomOpen] = useState(false);
  const myVote = state.myTopicVote;
  const canReroll = you.role === "player";
  const seenKey = useRef<string | null>(null);

  // Animate only on reroll (options change after first paint) — never on land.
  useEffect(() => {
    if (seenKey.current === null) {
      seenKey.current = optionKey;
      return;
    }
    if (seenKey.current === optionKey) return;
    seenKey.current = optionKey;
    setRefreshing(true);
    const t = setTimeout(() => setRefreshing(false), 420);
    return () => clearTimeout(t);
  }, [optionKey]);

  function lockCustom() {
    const text = custom.trim();
    if (!text) return;
    send({
      type: "custom_topic",
      text,
      scope,
      scopeBoundary: "Host custom — agree boundaries as a group.",
    });
  }

  return (
    <div className="topic-layout">
      <header className="topic-head">
        <h2 className="topic-title">
          Topic · {state.topicRound + 1}/{state.configuredTopicRounds}
        </h2>
        <p className="topic-sub">
          Four from the bank — vote, write your own, or reroll
        </p>
      </header>

      <div
        className={`topic-choices ${refreshing ? "topic-refresh" : ""}`}
        aria-live="polite"
      >
        {state.topicOptions.map((t) => {
          const votes = state.topicVoteCounts[t.id] ?? 0;
          const selected = myVote === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={`topic-choice ${selected ? "topic-choice-selected" : ""}`}
              onClick={() => send({ type: "vote_topic", topicId: t.id })}
              disabled={you.role !== "player"}
            >
              <span className="topic-choice-text">{t.text}</span>
              <span className="topic-choice-votes tabular-nums">{votes}</span>
              {selected && t.scopeBoundary ? (
                <span className="topic-choice-scope">{t.scopeBoundary}</span>
              ) : null}
            </button>
          );
        })}

        {/* 5th choice — custom topic mixed into the same list */}
        {you.isHost ? (
          <div
            className={`topic-choice topic-choice-custom ${customOpen ? "topic-choice-custom-open" : ""}`}
          >
            {!customOpen ? (
              <button
                type="button"
                className="topic-choice-custom-toggle"
                onClick={() => setCustomOpen(true)}
              >
                <span className="topic-choice-text">Write your own…</span>
                <span className="topic-choice-hint">Custom</span>
              </button>
            ) : (
              <div className="topic-custom-form">
                <p className="topic-custom-label">Write your own</p>
                <input
                  className="field w-full !py-2.5"
                  value={custom}
                  placeholder="Your topic"
                  autoFocus
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") lockCustom();
                  }}
                />
                <div className="topic-custom-row">
                  <select
                    className="field flex-1 !py-2 text-sm"
                    value={scope}
                    aria-label="Topic scope"
                    onChange={(e) => setScope(e.target.value as TopicScope)}
                  >
                    <option value="sports">Sports</option>
                    <option value="food">Food</option>
                    <option value="everyday">Everyday</option>
                    <option value="entertainment">Entertainment</option>
                  </select>
                  <button
                    type="button"
                    className="btn-primary !min-h-11 shrink-0 px-4 text-sm"
                    disabled={!custom.trim()}
                    onClick={lockCustom}
                  >
                    Lock in
                  </button>
                </div>
                <button
                  type="button"
                  className="topic-custom-cancel"
                  onClick={() => setCustomOpen(false)}
                >
                  Back to picks
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="topic-choice topic-choice-custom topic-choice-custom-locked">
            <span className="topic-choice-text">Write your own…</span>
            <span className="topic-choice-hint">Host</span>
          </div>
        )}
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
    </div>
  );
}
