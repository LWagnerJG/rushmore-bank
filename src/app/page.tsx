"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AddToHomeScreen } from "@/components/AddToHomeScreen";
import { BrandMark } from "@/components/BrandMark";
import { DiagPanel } from "@/components/DiagPanel";
import { MotionSettle } from "@/components/MotionSettle";
import { normalizeRoomCode, randomRoomCode } from "@/shared/types";
import { RULES } from "@/shared/rules";
import { ADMIN_UNLOCK_KEY } from "@/lib/admin-session";
import { recallDisplayName } from "@/lib/party";

const ADMIN_KEY = ADMIN_UNLOCK_KEY;
const ADMIN_DISPLAY_NAME = "Admin";

const adminListeners = new Set<() => void>();
function subscribeAdmin(cb: () => void) {
  adminListeners.add(cb);
  return () => {
    adminListeners.delete(cb);
  };
}
function getAdminSnapshot() {
  try {
    return window.sessionStorage.getItem(ADMIN_KEY) === "1";
  } catch {
    return false;
  }
}
function getAdminServerSnapshot() {
  return false;
}
function unlockAdminSession() {
  try {
    window.sessionStorage.setItem(ADMIN_KEY, "1");
  } catch {
    /* ignore */
  }
  for (const cb of adminListeners) cb();
}

function useDiagFromUrl() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("popstate", cb);
      return () => window.removeEventListener("popstate", cb);
    },
    () => {
      try {
        return new URLSearchParams(window.location.search).get("diag") === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );
}

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [nameReady, setNameReady] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  // useSyncExternalStore: server snapshot false, client reads sessionStorage —
  // avoids React #418 without a sync setState-in-effect.
  const adminUnlocked = useSyncExternalStore(
    subscribeAdmin,
    getAdminSnapshot,
    getAdminServerSnapshot,
  );
  const taps = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const diagFromUrl = useDiagFromUrl();
  const [diagClosed, setDiagClosed] = useState(false);
  const showDiag = diagFromUrl && !diagClosed;

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
      unlockAdminSession();
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

  async function create() {
    if (!canPlay) {
      setNameError("Enter a nickname first");
      return;
    }
    setJoinError(null);
    setJoining(true);
    try {
      let room = randomRoomCode();
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          const res = await fetch(`/api/room/${room}/exists`);
          if (res.ok) {
            const data = (await res.json()) as { exists: boolean };
            if (!data.exists) break;
          } else {
            break;
          }
        } catch {
          break;
        }
        room = randomRoomCode();
      }
      router.push(`/room/${room}?name=${encodeURIComponent(displayName)}`);
    } finally {
      setJoining(false);
    }
  }

  function join() {
    if (!canPlay) {
      setNameError("Enter a nickname first");
      return;
    }
    const room = normalizeRoomCode(code);
    if (room.length < 4) {
      setJoinError("Enter the 4-character room code");
      return;
    }
    setJoinError(null);
    void joinRoom(room);
  }

  async function joinRoom(room: string) {
    setJoining(true);
    try {
      const res = await fetch(`/api/room/${room}/exists`);
      if (res.ok) {
        const data = (await res.json()) as { exists: boolean };
        if (!data.exists) {
          setJoinError("Room not found — check the code");
          setJoining(false);
          return;
        }
      }
      // If the request failed (network, old PartyKit), allow join anyway.
    } catch {
      // Safe fallback: allow join when check is unavailable.
    }
    router.push(`/room/${room}?name=${encodeURIComponent(displayName)}`);
  }

  return (
    <main className="app-shell app-shell-lock mx-auto flex max-w-md flex-col pt-0">
      <div className="app-safe-top" aria-hidden="true" />
      <div className="app-shell-scroll flex min-h-0 flex-1 flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom),2.1rem)] pt-4">
        {/*
          Top-anchored (not centered): every field lands in the upper half,
          above where the iOS keyboard opens, so WebKit never pans the page.
        */}
        <MotionSettle
          motionClass="animate-rise"
          className="home-stack flex min-h-0 flex-1 flex-col gap-6"
        >
          <header className="space-y-2 text-center">
            <div className="flex justify-center">
              <BrandMark large onLogoTap={onLogoTap} />
            </div>
            <p className="type-body text-[var(--text)]">
              {RULES.tagline}
            </p>
          </header>

        {!canPlay ? (
          <section className="home-card home-card-step stack-sm">
            {/* BrandMark large above is the sole display hero on Home */}
            <h1 className="type-body text-center font-[family-name:var(--font-display)] font-extrabold tracking-tight">
              What’s your name?
            </h1>
            <div className="home-field-row">
              <input
                id="home-name"
                className="field home-field type-body"
                placeholder="Nickname"
                aria-label="Nickname"
                value={name}
                maxLength={18}
                autoComplete="nickname"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                autoFocus
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && confirmName()}
              />
              <button
                type="button"
                className="btn-primary home-field-go"
                onMouseDown={(e) => e.preventDefault()}
                onClick={confirmName}
              >
                Continue
              </button>
            </div>
            <p
              className={
                "type-meta text-center " +
                (nameError
                  ? "font-semibold text-[var(--coral)]"
                  : "text-[var(--muted)]")
              }
              aria-live="polite"
            >
              {nameError ?? "Pick a nickname to create or join a room."}
            </p>
          </section>
        ) : (
          <MotionSettle
            motionClass="animate-rise"
            as="section"
            className="home-play-stack stack-sm"
          >
            <button
              type="button"
              className="btn-primary w-full"
              onClick={create}
            >
              Create game
            </button>

            <div className="home-field-row" aria-label="Join a room">
              <input
                className="field home-field home-join-code uppercase tracking-[0.28em]"
                placeholder="CODE"
                value={code}
                maxLength={4}
                aria-label="Room code"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                enterKeyHint="go"
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setJoinError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && join()}
              />
              <button
                type="button"
                className="btn-secondary home-field-go home-join-go"
                disabled={joining}
                onMouseDown={(e) => e.preventDefault()}
                onClick={join}
              >
                {joining ? "…" : "Join"}
              </button>
            </div>
            {joinError && (
              <p className="type-meta text-center font-semibold text-[var(--coral)]">
                {joinError}
              </p>
            )}

            <div className="home-playing-as">
              <p className="type-meta text-[var(--muted)]">
                Playing as{" "}
                <span className="font-[family-name:var(--font-display)] font-extrabold text-[var(--text)]">
                  {displayName}
                </span>
              </p>
              <button
                type="button"
                className="home-edit-name"
                onClick={editName}
              >
                Edit
              </button>
            </div>
          </MotionSettle>
        )}

        {adminUnlocked && (
          <p className="text-center text-[0.65rem] font-bold uppercase tracking-wide text-[var(--muted)]">
            Admin unlocked · open a room
          </p>
        )}
        </MotionSettle>
      </div>

      {/* Outside MotionSettle so fixed/absolute children aren’t transform-clipped */}
      <AddToHomeScreen />
      {showDiag && <DiagPanel onClose={() => setDiagClosed(true)} />}
    </main>
  );
}
