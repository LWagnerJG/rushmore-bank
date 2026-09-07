import Link from "next/link";
import { RULES } from "@/shared/rules";

const COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA;
const COMMIT_MESSAGE = process.env.VERCEL_GIT_COMMIT_MESSAGE;

export default function BuildNotesPage() {
  const shortSha = COMMIT_SHA ? COMMIT_SHA.slice(0, 7) : null;

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8">
      <Link href="/" className="text-sm font-bold text-[var(--coral)]">
        ← Home
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">
        Build notes
      </h1>
      <p className="rounded-xl bg-[rgba(244,201,91,0.35)] px-3 py-2 text-sm font-extrabold">
        Fudge polish candidate — Beans UX + per-player BANK. Not production
        yet. Do not confuse with the separate Beans TEST host
        (roundacats-test).
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
              Branch intent: Fudge polish → new separate Vercel/PartyKit test
              host (coordinator), then possible promote to{" "}
              <code>roundacats.vercel.app</code>.
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
        <h2 className="font-extrabold">What changed (this candidate)</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Per-player BANK</strong> — after wagers, each active player
            gets a full personal bank sequence (2 safe → risk → Bank/bust)
            before the seat advances. Waiting players can still Bank without
            clearing alarms or advancing the current banker.
          </li>
          <li>
            <strong>Wager slider</strong> — clear 0…max risk control; protected
            vs at-risk shown; presets Keep all / Half new / All new; same caps
            (E + min(25, B)).
          </li>
          <li>
            <strong>Snake draft board</strong> — fantasy-football style board,
            on-the-clock / you’re next, snake order chips, large Lock In.
          </li>
          <li>
            <strong>Dice polish</strong> — pip faces, improved tumble/settle,
            synced timestamps, reduced-motion + WebGL fallback.
          </li>
          <li>
            <strong>Beans naming</strong> · {RULES.minPlayers}–
            {RULES.maxPlayers} players · fluff cut. Protocol still uses{" "}
            <code>stones</code> fields.
          </li>
          <li>
            Preserved: Gemini-first <code>gemini-3.5-flash</code> judge,{" "}
            <code>JUDGE_SECRET</code>, ballot privacy, server-authoritative AI.
          </li>
        </ul>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Production (unchanged until promote)</h2>
        <p>
          <a
            href={RULES.productionUrl}
            className="font-bold text-[var(--coral)] underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {RULES.productionUrl}
          </a>{" "}
          remains Quarry branding on <code>main</code> until Luke approves
          promote.
        </p>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Known limits</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Soft bank budget is time-based (3 min); remaining pots auto-lock when
            it hits at a bank boundary.
          </li>
          <li>
            This PR must not deploy over <code>roundacats-test</code> /
            PartyKit <code>roundacats-test</code> — coordinator uses a new
            host.
          </li>
          <li>
            AI judging still needs <code>GEMINI_API_KEY</code> (preferred) or
            OpenAI fallback + matching <code>JUDGE_SECRET</code>.
          </li>
        </ul>
      </section>
    </main>
  );
}
