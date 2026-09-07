import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { RULES } from "@/shared/rules";

const COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA;
const COMMIT_MESSAGE = process.env.VERCEL_GIT_COMMIT_MESSAGE;

export default function BuildNotesPage() {
  const shortSha = COMMIT_SHA ? COMMIT_SHA.slice(0, 7) : null;
  const environment = process.env.NEXT_PUBLIC_APP_ENV || "development";

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8">
      <Link href="/" className="text-sm font-bold text-[var(--coral)]">
        ← Home
      </Link>
      <BrandMark />
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">
        Beans TEST build
      </h1>
      <p className="rounded-xl bg-[rgba(231,111,78,0.18)] px-3 py-2 text-sm font-bold">
        This is a test preview — not production. Production Quarry stays at{" "}
        <a
          href={RULES.productionUrl}
          className="underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {RULES.productionUrl}
        </a>
        .
      </p>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Version</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Environment: <code>{environment}</code>
          </li>
          {COMMIT_SHA ? (
            <>
              <li>
                Frontend SHA: <code className="break-all">{COMMIT_SHA}</code>{" "}
                ({shortSha})
              </li>
              {COMMIT_MESSAGE ? (
                <li>
                  Message: <span className="italic">{COMMIT_MESSAGE}</span>
                </li>
              ) : null}
            </>
          ) : (
            <li>
              Commit SHA appears on Vercel via{" "}
              <code>VERCEL_GIT_COMMIT_SHA</code>.
            </li>
          )}
          <li>
            Test PartyKit host: set{" "}
            <code>NEXT_PUBLIC_PARTYKIT_HOST</code> (never silently falls back to
            production when <code>NEXT_PUBLIC_APP_ENV</code> is{" "}
            <code>test</code>/<code>preview</code>).
          </li>
        </ul>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">What this TEST changes</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Beans rebrand</strong> — name, currency wording, bean icons;
            internal <code>stones</code> field names kept for compatibility.
          </li>
          <li>
            <strong>2–10 players</strong> — lobby Start gate and rules allow
            pairs; still individual competition.
          </li>
          <li>
            Simpler phone UI: plain entry, wager, bank, and score labels.
          </li>
          <li>
            Waiting-player bank preserves dice alarm /{" "}
            <code>phaseRevision</code> (no frozen cooldown).
          </li>
          <li>
            Paid judging requires <code>JUDGE_SECRET</code> (spoofed headers
            rejected).
          </li>
        </ul>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Preserved from production main</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Gemini-first AI judge</strong> — model{" "}
            <code>gemini-3.5-flash</code> via <code>GEMINI_API_KEY</code> (or{" "}
            <code>GOOGLE_GENERATIVE_AI_API_KEY</code>); OpenAI fallback; uniform
            neutral award if neither key is set.
          </li>
          <li>
            Server-authoritative judging, ballot privacy, synced dice, waiting
            Pull Out banking semantics.
          </li>
        </ul>
      </section>

      <section className="panel space-y-2 text-sm">
        <h2 className="font-extrabold">Do not merge yet</h2>
        <p>
          Side-by-side comparison only. Coordinator deploys a separate test
          alias after review. Do not promote this branch to{" "}
          <code>roundacats.vercel.app</code>.
        </p>
      </section>
    </main>
  );
}
