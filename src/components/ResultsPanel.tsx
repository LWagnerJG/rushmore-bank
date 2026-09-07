"use client";

import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";

export function ResultsPanel({
  state,
  you,
  send,
}: {
  state: PublicRoomState;
  you: Player;
  send: (m: ClientMessage) => void;
}) {
  const ranked = [...state.players]
    .filter((p) => p.role === "player")
    .sort((a, b) => b.stones - a.stones);

  const final = state.phase === "GAME_RESULTS";

  return (
    <div className="space-y-4">
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
        {final ? "Final standings" : "Round results"}
      </h2>
      <p className="text-sm text-[var(--muted)]">
        {final
          ? `All ${state.configuredTopicRounds} rounds done — most banked beans wins.`
          : `Round ${state.topicRound} of ${state.configuredTopicRounds}`}
      </p>

      <ol className="space-y-2">
        {ranked.map((p, i) => (
          <li
            key={p.id}
            className="panel flex items-center justify-between font-extrabold"
          >
            <span>
              {i + 1}. {p.name}
            </span>
            <span className="text-[var(--coral)]">
              {p.stones} {RULES.currencyName}
            </span>
          </li>
        ))}
      </ol>

      {state.partyPrompt && !state.partyPrompt.resolved && (
        <div className="panel space-y-2">
          <p className="font-extrabold">Party Mode sip</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => send({ type: "party_resolve", choice: "done" })}
            >
              Done
            </button>
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => send({ type: "party_resolve", choice: "pass" })}
            >
              Pass
            </button>
          </div>
        </div>
      )}

      {you.isHost && !final && (
        <div className="space-y-2">
          <label className="flex items-center justify-between panel text-sm font-semibold">
            Party Mode
            <input
              type="checkbox"
              checked={state.settings.partyMode}
              onChange={(e) =>
                send({
                  type: "update_settings",
                  settings: { partyMode: e.target.checked },
                })
              }
            />
          </label>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => send({ type: "next_topic" })}
          >
            Next Topic
          </button>
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => send({ type: "end_game" })}
          >
            End game
          </button>
        </div>
      )}

      {you.isHost && final && (
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => send({ type: "play_again" })}
        >
          Play Again
        </button>
      )}
    </div>
  );
}
