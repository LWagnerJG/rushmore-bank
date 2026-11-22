"use client";

/**
 * Discreet host-only confirm for skipping a stalled seat's turn.
 * No always-visible Skip pill — opened by tapping the dimmed player.
 */
export function HostSkipSheet({
  open,
  playerName,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  playerName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="host-skip-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="host-skip-title"
      onClick={onCancel}
    >
      <div
        className="host-skip-sheet panel"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="host-skip-title" className="host-skip-sheet-title">
          Skip {playerName}&apos;s turn?
        </p>
        <p className="host-skip-sheet-hint type-meta">
          They stay seated for rejoin. Only this turn is skipped.
        </p>
        <div className="host-skip-sheet-actions">
          <button
            type="button"
            className="host-skip-sheet-confirm"
            onClick={onConfirm}
          >
            Skip this turn
          </button>
          <button
            type="button"
            className="host-skip-sheet-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
