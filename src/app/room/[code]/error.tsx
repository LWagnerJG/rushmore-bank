"use client";

import Link from "next/link";

/** Room-scoped boundary so a Dice/panel throw does not blank the shell. */
export default function RoomError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-md flex-col items-start justify-center gap-3 px-4 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--text)]">
        Room hiccup
      </h1>
      <p className="text-sm text-[var(--muted)]">
        Reload this room to rejoin your seat.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => reset()}>
          Try again
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => window.location.reload()}
        >
          Reload room
        </button>
        <Link href="/" className="btn">
          Home
        </Link>
      </div>
    </main>
  );
}
