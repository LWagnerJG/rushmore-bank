"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AddToHomeScreen } from "@/components/AddToHomeScreen";
import { BrandMark } from "@/components/BrandMark";
import { normalizeRoomCode, randomRoomCode } from "@/shared/types";
import { RULES } from "@/shared/rules";
import { ADMIN_UNLOCK_KEY } from "@/lib/admin-session";
import { recallDisplayName } from "@/lib/party";

const ADMIN_KEY = ADMIN_UNLOCK_KEY;
const ADMIN_DISPLAY_NAME = "Admin";

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [nameReady, setNameReady] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [adminUnlocked, setAdminUnlocked] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(ADMIN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const taps = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prefill last nickname on mount so returning players skip the name step.
  useEffect(() => {
    const saved = recallDisplayName().trim();
    if (saved) {
      setName(saved);
      setNameReady(true);
    }
  }, []);

  const displayName = name.trim() || (adminUnlocked ? ADMIN_DISPLAY_NAME : "");
  const canPlay = nameReady && displayName.length > 0;

  const onLogoTap = useCallback(() => {
    if (adminUnlocked) return;
    taps.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      taps.current = 0;
    }, 1600);
    if (taps.current >= 5) {
      taps.current = 0;
      try {
        window.sessionStorage.setItem(ADMIN_KEY, "1");
      } catch {
        /* ignore */
      }
      setAdminUnlocked(true);
      setName((prev) => (prev.trim() ? prev : ADMIN_DISPLAY_NAME));
      setNameReady(true);
      setNameError(null);
    }
  }, [adminUnlocked]);

  function confirmName() {
    const clean = name.trim() || (adminUnlocked ? ADMIN_DISPLAY_NAME : "");
    if (!clean) {
      setNameError("Enter a nickname first");
      return;
    }
    if (!name.trim() && adminUnlocked) setName(ADMIN_DISPLAY_NAME);
    setNameError(null);
    setNameReady(true);
  }

  function editName() {
    setNameReady(false);
    setJoinError(null);
  }

  function create() {
    if (!canPlay) {
      setNameError("Enter a nickname first");
      return;
    }
    const room = randomRoomCode();
    router.push(`/room/${room}?name=${encodeURIComponent(displayName)}`);
  }

  function join() {
    if (!canPlay) {
      setNameError("Enter a nickname first");
      return;
    }
    const room = normalizeRoomCode(code);
    if (room.length < 4) {
      setJoinError("Enter the 4-letter room code");
      return;
    }
    setJoinError(null);
    router.push(`/room/${room}?name=${encodeURIComponent(displayName)}`);
  }

  return (
    <main className="app-shell app-shell-lock mx-auto flex max-w-md flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="animate-rise flex min-h-0 flex-1 flex-col justify-center gap-6">
        <header className="space-y-2 text-center">
          <div className="flex justify-center">
            <BrandMark large onLogoTap={onLogoTap} />
          </div>
          <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--text)]">
            {RULES.tagline}
          </p>
        </header>

        {!canPlay ? (
          <section className="home-card home-card-step space-y-4">
            <div className="space-y-1 text-center">
              <h1 className="font-[family-name:var(--font-display)] text-xl font-extrabold tracking-tight">
                What’s your name?
              </h1>
              <p className="text-sm text-[var(--muted)]">
                Pick a nickname to create or join a room.
              </p>
            </div>
            <input
              id="home-name"
              className="field w-full !py-3 text-center text-base"
              placeholder="Nickname"
              aria-label="Nickname"
              value={name}
              maxLength={18}
              autoComplete="nickname"
              autoFocus
              onChange={(e) => {
                setName(e.target.value);
                setNameError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && confirmName()}
            />
            {nameError && (
              <p className="text-center text-sm font-semibold text-[var(--coral)]">
                {nameError}
              </p>
            )}
            <button
              type="button"
              className="btn-primary w-full !min-h-12 text-base"
              onClick={confirmName}
            >
              Continue
            </button>
          </section>
        ) : (
          <section className="home-play-stack space-y-4 animate-rise">
            <div className="home-playing-as">
              <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
                Playing as
              </p>
              <div className="mt-1 flex items-center justify-center gap-2">
                <p className="font-[family-name:var(--font-display)] text-lg font-extrabold tracking-tight">
                  {displayName}
                </p>
                <button
                  type="button"
                  className="home-edit-name"
                  onClick={editName}
                >
                  Edit
                </button>
              </div>
            </div>

            <button
              type="button"
              className="btn-primary w-full !min-h-12 text-base"
              onClick={create}
            >
              Create game
            </button>

            <div className="home-join-card">
              <p className="home-join-card-kicker">Have a code?</p>
              <p className="home-join-card-title">Join a room</p>
              <div className="mt-3 flex gap-2">
                <input
                  className="field home-join-code w-full !py-2.5 uppercase tracking-[0.28em]"
                  placeholder="CODE"
                  value={code}
                  maxLength={4}
                  aria-label="Room code"
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && join()}
                />
                <button
                  type="button"
                  className="btn-secondary home-join-go shrink-0 !min-h-12 px-4 text-sm"
                  onClick={join}
                >
                  Join
                </button>
              </div>
              {joinError && (
                <p className="mt-2 text-sm font-semibold text-[var(--coral)]">
                  {joinError}
                </p>
              )}
            </div>
          </section>
        )}

        {adminUnlocked && (
          <p className="text-center text-[0.65rem] font-bold uppercase tracking-wide text-[var(--muted)]">
            Admin unlocked · open a room
          </p>
        )}
      </div>

      {/* Outside animate-rise so fixed/absolute children aren’t transform-clipped */}
      <AddToHomeScreen />
    </main>
  );
}
