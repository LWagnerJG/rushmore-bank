"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { normalizeRoomCode, randomRoomCode } from "@/shared/types";
import { RULES } from "@/shared/rules";

function BrandMark() {
  return (
    <div className="flex items-center gap-2" aria-label="Quarry">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className="stone-tile">
            {n}
          </span>
        ))}
      </div>
      <span className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight brand-shimmer">
        {RULES.displayName}
      </span>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  function create() {
    const room = randomRoomCode();
    const q = name.trim() ? `?name=${encodeURIComponent(name.trim())}` : "";
    router.push(`/room/${room}${q}`);
  }

  function join() {
    const room = normalizeRoomCode(code);
    if (room.length < 4) return;
    const q = name.trim() ? `?name=${encodeURIComponent(name.trim())}` : "";
    router.push(`/room/${room}${q}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-10 pt-8">
      <div className="animate-rise flex flex-1 flex-col justify-center gap-8">
        <header className="space-y-3 text-center">
          <div className="flex justify-center">
            <BrandMark />
          </div>
          <p className="text-lg font-semibold text-[var(--muted)]">
            {RULES.tagline}
          </p>
          <p className="text-sm text-[var(--muted)]">
            3–10 friends. Phones as controllers. Currency:{" "}
            <strong>Stones</strong>.
          </p>
        </header>

        <section className="panel space-y-3">
          <label className="block text-sm font-bold">Nickname</label>
          <input
            className="field w-full"
            placeholder="Your name"
            value={name}
            maxLength={18}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="button" className="btn-primary w-full" onClick={create}>
            Create Game
          </button>
          <div className="flex gap-2">
            <input
              className="field w-full uppercase tracking-[0.2em]"
              placeholder="CODE"
              value={code}
              maxLength={4}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && join()}
            />
            <button type="button" className="btn-secondary shrink-0 px-5" onClick={join}>
              Join
            </button>
          </div>
        </section>

        <nav className="flex flex-wrap justify-center gap-4 text-sm font-semibold">
          <Link className="text-[var(--coral)] underline-offset-2 hover:underline" href="/how-to-play">
            How to Play
          </Link>
          <Link className="text-[var(--coral)] underline-offset-2 hover:underline" href="/how-to-play#homescreen">
            Home Screen help
          </Link>
          <Link className="text-[var(--muted)] underline-offset-2 hover:underline" href="/build-notes">
            Build notes
          </Link>
        </nav>
      </div>
    </main>
  );
}
