"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  normalizeRoomCode,
  randomRoomCode,
} from "@/shared/types";
import { rememberDisplayName } from "../lib/party";

export default function HomePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [name, setName] = useState("");

  function go(code: string) {
    const clean = normalizeRoomCode(code);
    if (!clean || clean.length < 4) return;
    if (name.trim()) rememberDisplayName(name.trim());
    router.push(`/room/${clean}`);
  }

  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-end overflow-hidden px-4 pb-10 pt-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e2b84a' fill-opacity='0.07'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <div className="animate-rise relative z-10 space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
            Phone party game
          </p>
          <h1 className="brand-shimmer font-[family-name:var(--font-display)] text-6xl leading-[0.95] tracking-tight sm:text-7xl">
            Rushmore Bank
          </h1>
          <p className="mt-4 max-w-[20rem] text-base leading-relaxed text-[var(--muted)]">
            Carve a Mount Rushmore with friends, roast the rankings, then roll
            the BANK.
          </p>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-[var(--muted)]">
              Display name
            </span>
            <input
              className="field w-full"
              value={name}
              maxLength={18}
              placeholder="Optional — set in lobby too"
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <button
            type="button"
            className="btn-primary w-full text-lg"
            onClick={() => go(randomRoomCode())}
          >
            Create room
          </button>

          <div className="flex gap-2">
            <input
              className="field flex-1 uppercase tracking-[0.2em]"
              placeholder="CODE"
              maxLength={4}
              value={joinCode}
              onChange={(e) => setJoinCode(normalizeRoomCode(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") go(joinCode);
              }}
            />
            <button
              type="button"
              className="btn-secondary shrink-0 px-5"
              onClick={() => go(joinCode)}
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
