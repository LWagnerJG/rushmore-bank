"use client";

/**
 * Route-level error boundary — keeps a crash from whitening the whole app.
 */
export default function AppError({
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
        Something went wrong
      </h1>
      <p className="text-sm text-[var(--muted)]">
        Try again, or reload the room if you were mid-game.
      </p>
      <button type="button" className="btn btn-primary" onClick={() => reset()}>
        Try again
      </button>
    </main>
  );
}
