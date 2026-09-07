"use client";

import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";
import { PartyModeSwitch } from "@/components/PartyModeSwitch";

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
      <header className="space-y-1">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
          {final ? "Final standings" : "Round results"}
        </h2>
        <p className="text-sm text-[var(--muted)]">
          {final
            ? `Most ${RULES.currencyName} wins.`
            : `Round ${state.topicRound} of ${state.configuredTopicRounds}`}
        </p>
      </header>

      <ol className="space-y-2">
        {ranked.map((p, i) => (
          <li key={p.id} className="player-row font-extrabold">
            <span>
              {i + 1}. {p.name}
              {p.id === you.id ? " (you)" : ""}
            </span>
            <span className="text-[var(--coral)]">
              {p.stones} {RULES.currencyName}
            </span>
          </li>
        ))}
      </ol>

      {state.partyPrompt && !state.partyPrompt.resolved && (
        <div className="panel party-sip space-y-3">
          <p className="font-[family-name:var(--font-display)] text-lg font-extrabold">
            {state.partyPrompt.kind === "bust_sip"
              ? "Bust sip (optional)"
              : "Winner sip (optional)"}
          </p>
          <p className="text-sm">One sip, or Pass — no score effect.</p>
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
        <div className="space-y-3">
          <PartyModeSwitch
            compact
            on={state.settings.partyMode}
            onChange={(next) =>
              send({
                type: "update_settings",
                settings: { partyMode: next },
              })
            }
          />
          <button
            type="button"
            className="btn-primary w-full text-lg"
            onClick={() => send({ type: "next_topic" })}
          >
            Next topic
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
          className="btn-primary w-full text-lg"
          onClick={() => send({ type: "play_again" })}
        >
          Play again
        </button>
      )}

      {!you.isHost && (
        <p className="text-center text-sm text-[var(--muted)]">
          Waiting for host…
        </p>
      )}
    </div>
  );
}
