"use client";

/**
 * Large touch-friendly Party Mode toggle.
 * Off by default; optional sips only — no score effect.
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
              (on ? "font-semibold text-[var(--text)]" : "text-[var(--muted)]")
            }
          >
            {on
              ? "Optional sips — Pass anytime"
              : "Optional sip prompts"}
          </p>
        </div>
        <span className="party-switch-track" aria-hidden="true">
          <span className="party-switch-knob" />
        </span>
      </div>
    </button>
  );
}
