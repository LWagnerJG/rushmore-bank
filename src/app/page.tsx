"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { normalizeRoomCode, randomRoomCode } from "@/shared/types";
import { RULES } from "@/shared/rules";

const ADMIN_PIN = "8989";
const ADMIN_KEY = "beans:admin-unlocked";

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [adminUnlocked, setAdminUnlocked] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(ADMIN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const taps = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onLogoTap = useCallback(() => {
    if (adminUnlocked) return;
    taps.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      taps.current = 0;
    }, 1600);
    if (taps.current >= 5) {
      taps.current = 0;
      setPinOpen(true);
      setPin("");
      setPinError(null);
    }
  }, [adminUnlocked]);

  function unlockAdmin() {
    if (pin.trim() !== ADMIN_PIN) {
      setPinError("Incorrect");
      return;
    }
    try {
      window.sessionStorage.setItem(ADMIN_KEY, "1");
    } catch {
      /* ignore */
    }
    setAdminUnlocked(true);
    setPinOpen(false);
    setPin("");
  }

  function create() {
    const room = randomRoomCode();
    const q = name.trim() ? `?name=${encodeURIComponent(name.trim())}` : "";
    router.push(`/room/${room}${q}`);
  }

  function join() {
    const room = normalizeRoomCode(code);
    if (room.length < 4) {
      setJoinError("Enter the 4-letter room code");
      return;
    }
    setJoinError(null);
    const q = name.trim() ? `?name=${encodeURIComponent(name.trim())}` : "";
    router.push(`/room/${room}${q}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="animate-rise flex flex-1 flex-col justify-center gap-5">
        <header className="space-y-1.5 text-center">
          <div className="flex justify-center">
            <BrandMark large onLogoTap={onLogoTap} />
          </div>
          <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--text)]">
            {RULES.tagline}
          </p>
        </header>

        <section className="home-card space-y-2.5">
          <input
            id="home-name"
            className="field w-full !py-2.5"
            placeholder="Nickname"
            aria-label="Nickname"
            value={name}
            maxLength={18}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <button
            type="button"
            className="btn-primary w-full !min-h-12 text-base"
            onClick={create}
          >
            Create game
          </button>
          <div className="relative py-0.5 text-center text-[0.65rem] font-bold uppercase tracking-wide text-[var(--muted)]">
            <span className="relative z-10 bg-[rgba(255,255,255,0.72)] px-2">
              or join
            </span>
            <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[rgba(35,72,62,0.1)]" />
          </div>
          <div className="flex gap-2">
            <input
              className="field w-full !py-2.5 uppercase tracking-[0.22em]"
              placeholder="CODE"
              value={code}
              maxLength={4}
              aria-label="Room code"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && join()}
            />
            <button
              type="button"
              className="btn-secondary shrink-0 !min-h-12 px-4 text-sm"
              onClick={join}
            >
              Join
            </button>
          </div>
          {joinError && (
            <p className="text-sm font-semibold text-[var(--coral)]">
              {joinError}
            </p>
          )}
        </section>

        <nav className="flex flex-wrap justify-center gap-5 text-sm font-semibold">
          <Link
            className="text-[var(--coral)] underline-offset-2 hover:underline"
            href="/how-to-play"
          >
            How to play
          </Link>
          <Link
            className="text-[var(--muted)] underline-offset-2 hover:underline"
            href="/build-notes"
          >
            Build notes
          </Link>
        </nav>

        {adminUnlocked && (
          <p className="text-center text-[0.65rem] font-bold uppercase tracking-wide text-[var(--muted)]">
            Admin unlocked · open a room
          </p>
        )}
      </div>

      {pinOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Admin unlock"
        >
          <div className="home-card w-full max-w-sm space-y-2.5">
            <p className="text-sm font-bold text-[var(--text)]">Enter PIN</p>
            <input
              className="field w-full !py-2.5 tracking-[0.3em]"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={pin}
              maxLength={8}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && unlockAdmin()}
            />
            {pinError && (
              <p className="text-sm font-semibold text-[var(--coral)]">
                {pinError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary flex-1 !min-h-11"
                onClick={() => setPinOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary flex-1 !min-h-11"
                onClick={unlockAdmin}
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
