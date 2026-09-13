import Link from "next/link";
import { RULES } from "@/shared/rules";
import { TOPIC_COUNT } from "@/shared/topics";

const COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA;
const COMMIT_MESSAGE = process.env.VERCEL_GIT_COMMIT_MESSAGE;

export default function BuildNotesPage() {
  const shortSha = COMMIT_SHA ? COMMIT_SHA.slice(0, 7) : null;

  return (
    <main className="app-shell app-shell-scroll mx-auto max-w-md space-y-6 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <Link href="/" className="text-sm font-bold text-[var(--coral)]">
        ← Home
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">
        Build notes
      </h1>
      <p className="rounded-xl bg-[rgba(167,215,194,0.45)] px-3 py-2 text-sm font-extrabold">
        Vote → judge → wager polish → {RULES.productionUrl}
      </p>
      <p className="text-sm text-[var(--muted)]">
        Public handoff — no secrets, credentials, or private session data.
      </p>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">This build</h2>
        {COMMIT_SHA ? (
          <ul className="list-disc space-y-1 pl-5">
            <li>
              SHA: <code className="break-all">{COMMIT_SHA}</code> ({shortSha})
            </li>
            {COMMIT_MESSAGE ? (
              <li>
                Message: <span className="italic">{COMMIT_MESSAGE}</span>
              </li>
            ) : null}
            <li>
              Target: production <code>roundacats.vercel.app</code> via merge to{" "}
              <code>main</code>. PartyKit redeploy required when{" "}
              <code>src/shared</code> changes (topics are bundled into the party
              server) — also for reconnect/leave/rejoin and review+vote timers.
            </li>
          </ul>
        ) : (
          <p className="text-[var(--muted)]">
            Commit SHA appears on Vercel via{" "}
            <code>VERCEL_GIT_COMMIT_SHA</code>.
          </p>
        )}
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">What shipped</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Judge flow</strong>: rosters stay visible through vote → AI
            calculating → scored board (no blank/full-screen flip); discreet
            “AI is calculating…” on the same board.
          </li>
          <li>
            <strong>Earned split</strong>: under{" "}
            <code>+N</code> — <code>X from votes · Y from AI</code> (uses
            existing <code>votes</code> / <code>aiAward</code>).
          </li>
          <li>
            <strong>Ready to wager</strong>: primary CTA moved to sticky header
            top-right with a soft pulse after tallies (replaces bottom “Bank
            the Beans”).
          </li>
          <li>
            <strong>Safe / Risking</strong>: full words replace S/P on player
            rail + dice turn strip.
          </li>
          <li>
            Topics ({TOPIC_COUNT}), Party Mode, spectator, rematch, timers,
            Beans branding preserved. UI-only — no PartyKit host logic change.
          </li>
        </ul>
      </section>
    </main>
  );
}
