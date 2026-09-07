"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { normalizeRoomCode, randomRoomCode } from "@/shared/types";
import { RULES } from "@/shared/rules";
import { BrandMark } from "@/components/BrandMark";

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function enter() {
    if (busy) return;
    if (!name.trim()) { setError("What should we call you?"); return; }
    const room = mode === "create" ? randomRoomCode() : normalizeRoomCode(code);
    if (room.length !== 4) { setError("Enter the 4-character room code."); return; }
    setError(null);
    setBusy(true);
    router.push("/room/" + room + "?name=" + encodeURIComponent(name.trim()));
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-7 px-5 py-10">
      <header className="space-y-4 text-center">
        <BrandMark large />
        <h1 className="text-xl font-extrabold">{RULES.tagline}</h1>
        <p className="text-sm font-bold">2–10 friends · one phone each</p>
      </header>

      <section className="panel space-y-5" aria-label="Play Beans">
        <div className="grid grid-cols-2 gap-2" aria-label="How are you joining?">
          <button type="button" className={mode === "create" ? "btn-primary" : "btn-secondary"} aria-pressed={mode === "create"} onClick={() => { setMode("create"); setError(null); }}>New game</button>
          <button type="button" className={mode === "join" ? "btn-primary" : "btn-secondary"} aria-pressed={mode === "join"} onClick={() => { setMode("join"); setError(null); }}>Join friends</button>
        </div>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); enter(); }}>
          <div className="space-y-2">
            <label htmlFor="player-name" className="block text-sm font-extrabold">Your name</label>
            <input id="player-name" name="nickname" className="field w-full" autoComplete="nickname" placeholder="Nickname" value={name} maxLength={18} onChange={(e) => setName(e.target.value)} aria-describedby={error ? "entry-error" : undefined} />
          </div>
          {mode === "join" && <div className="space-y-2">
            <label htmlFor="room-code" className="block text-sm font-extrabold">Room code</label>
            <input id="room-code" className="field w-full uppercase tracking-[0.2em]" autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="ABCD" value={code} maxLength={4} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </div>}
          {error && <p id="entry-error" className="text-sm font-bold text-[var(--coral)]" role="alert">{error}</p>}
          <button type="submit" className="btn-danger w-full text-lg" disabled={busy}>{busy ? "Opening your room…" : mode === "create" ? "Make a room" : "Join the room"}</button>
        </form>
      </section>

      <nav className="flex justify-center gap-6 text-sm font-bold">
        <Link href="/how-to-play" className="underline underline-offset-4">How to play</Link>
      </nav>
    </main>
  );
}
