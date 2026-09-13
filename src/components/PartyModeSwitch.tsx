"use client";

/**
 * Large touch-friendly Party Mode toggle.
 * When ON, expands exact drink rules (bust redo + lowest beans).
 */
export function PartyModeSwitch({
  on,
  disabled,
  onChange,
  compact = false,
}: {
  on: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={
        "party-switch-wrap " +
        (on ? "party-switch-wrap-on" : "") +
        (compact ? " party-switch-wrap-compact" : "")
      }
    >
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Party Mode"
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={
          "party-switch w-full text-left transition " +
          (on ? "party-switch-on" : "party-switch-off") +
          (compact ? " party-switch-compact" : "")
        }
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-extrabold tracking-tight">
              {on ? "Party Mode · ON" : "Party Mode"}
            </p>
            <p
              className={
                "mt-0.5 text-sm " +
                (on
                  ? "font-semibold text-[var(--text)]"
                  : "text-[var(--muted)]")
              }
            >
              {on
                ? "Drink rules active — Pass anytime"
                : "Optional drink rules for the table"}
            </p>
          </div>
          <span className="party-switch-track" aria-hidden="true">
            <span className="party-switch-knob" />
          </span>
        </div>
      </button>

      {on && !compact ? (
        <div className="party-rules" aria-live="polite">
          <p className="party-rules-title">When ON</p>
          <ul className="party-rules-list">
            <li>
              <strong>BEAN BUSTER redo (once per round):</strong> after a bust,
              finish a drink and tap{" "}
              <em>Finished drink · redo bust</em> for a one-time redo of that
              bust — or Pass and accept it. Can’t spam every bust.
            </li>
            <li>
              <strong>Lowest beans after each round:</strong> whoever ends with
              the fewest beans (ties share) takes a drink, then taps{" "}
              <em>I finished my drink</em> to continue. Pass anytime still ok.
            </li>
          </ul>
        </div>
      ) : null}

      {on && compact ? (
        <p className="party-rules-compact">
          Bust redo once/round · lowest beans drink after round · Pass ok
        </p>
      ) : null}
    </div>
  );
}
