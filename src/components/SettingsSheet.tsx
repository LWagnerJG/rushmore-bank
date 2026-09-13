"use client";

import { useEffect, useState } from "react";
import {
  isSfxMuted,
  setSfxMuted,
  subscribeSfxMuted,
} from "@/lib/sound-prefs";

export function SettingsSheet({
  open,
  onClose,
  roomCode,
  isHost = false,
  partyOn = false,
  onPartyChange,
}: {
  open: boolean;
  onClose: () => void;
  roomCode?: string | null;
  isHost?: boolean;
  partyOn?: boolean;
  onPartyChange?: (next: boolean) => void;
}) {
  const [muted, setMuted] = useState(() =>
    typeof window !== "undefined" ? isSfxMuted() : false,
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    return subscribeSfxMuted(setMuted);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => setMuted(isSfxMuted()), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function copyCode() {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className="settings-sheet-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="settings-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-extrabold">
            Settings
          </h2>
          <button
            type="button"
            className="text-sm font-bold text-[var(--muted)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <label className="settings-row">
          <span className="settings-row-label">
            <span className="font-extrabold">Sound FX</span>
            <span className="text-xs text-[var(--muted)]">
              Roll, settle, bank, bust
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={!muted}
            className={`settings-toggle ${muted ? "" : "settings-toggle-on"}`}
            onClick={() => {
              const next = !muted;
              setMuted(next);
              setSfxMuted(next);
            }}
          >
            <span className="settings-toggle-knob" />
            <span className="sr-only">{muted ? "Off" : "On"}</span>
          </button>
        </label>

        {roomCode ? (
          <div className="settings-row">
            <span className="settings-row-label">
              <span className="font-extrabold">Room code</span>
              <span className="font-[family-name:var(--font-display)] text-xl font-extrabold tracking-[0.18em]">
                {roomCode}
              </span>
            </span>
            <button
              type="button"
              className="btn-secondary !min-h-10 shrink-0 px-3 text-sm"
              onClick={() => void copyCode()}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        ) : null}

        {isHost && onPartyChange ? (
          <label className="settings-row">
            <span className="settings-row-label">
              <span className="font-extrabold">Party Mode</span>
              <span className="text-xs text-[var(--muted)]">
                Drink prompts after bust &amp; low beans
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={partyOn}
              className={`settings-toggle ${partyOn ? "settings-toggle-on" : ""}`}
              onClick={() => onPartyChange(!partyOn)}
            >
              <span className="settings-toggle-knob" />
              <span className="sr-only">{partyOn ? "On" : "Off"}</span>
            </button>
          </label>
        ) : null}
      </div>
    </div>
  );
}
