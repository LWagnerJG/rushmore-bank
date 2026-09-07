"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { normalizeRoomCode, randomRoomCode } from "@/shared/types";
import { RULES } from "@/shared/rules";

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-10 pt-8">
      <div className="animate-rise flex flex-1 flex-col justify-center gap-7">
        <header className="space-y-2 text-center">
          <div className="flex justify-center">
            <BrandMark large />
          </div>
          <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--text)]">
            {RULES.tagline}
          </p>
          <p className="text-sm text-[var(--muted)]">
            {RULES.minPlayers}–{RULES.maxPlayers} players · phones only
          </p>
        </header>

        <section className="panel space-y-3">
          <label className="block text-sm font-bold" htmlFor="home-name">
            Your nickname
          </label>
          <input
            id="home-name"
            className="field w-full"
            placeholder="What friends call you"
            value={name}
            maxLength={18}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <button
            type="button"
            className="btn-primary w-full text-lg"
            onClick={create}
          >
            Create game
          </button>
          <div className="relative py-1 text-center text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
            <span className="bg-[var(--panel)] relative z-10 px-2">or join</span>
            <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[rgba(35,72,62,0.12)]" />
          </div>
          <div className="flex gap-2">
            <input
              className="field w-full uppercase tracking-[0.22em]"
              placeholder="CODE"
              value={code}
              maxLength={4}
              aria-label="Room code"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && join()}
            />
            <button
              type="button"
              className="btn-secondary shrink-0 px-5 text-base"
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
      </div>
    </main>
  );
}
