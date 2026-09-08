import Link from "next/link";
import { RULES } from "@/shared/rules";

const COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA;
const COMMIT_MESSAGE = process.env.VERCEL_GIT_COMMIT_MESSAGE;

export default function BuildNotesPage() {
  const shortSha = COMMIT_SHA ? COMMIT_SHA.slice(0, 7) : null;

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
      <Link href="/" className="text-sm font-bold text-[var(--coral)]">
        ← Home
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">
        Build notes
      </h1>
      <p className="rounded-xl bg-[rgba(167,215,194,0.45)] px-3 py-2 text-sm font-extrabold">
        Dice turn strip + failproof player rail + topic custom mix →{" "}
        {RULES.productionUrl}
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
              <code>main</code>. PartyKit host{" "}
              <code>rushmore-bank.lwagnerjg.partykit.dev</code>.
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
            <strong>BANK dice — no “TABLE”</strong>: removed the center circle
            hub. Layout choice: compact horizontal turn strip (UP / NEXT / In /
            Banked / Bust + pots). Hierarchy: strip → who’s up → timer → dice →
            pot/Bank. Scramble, hard-cut settle, 15s timer, tap-to-roll, BEAN
            BUSTER, personal BANK, green perimeter preserved.
          </li>
          <li>
            <strong>Failproof player rail</strong>: single-row horizontal scroll
            (never a clipped second wrap). Denser chips at 6+ players + edge
            fade affordance. Works for 2 and 10.
          </li>
          <li>
            <strong>Topic pick</strong>: “Write your own…” is a 5th choice in
            the same list as the four topics (host locks custom). Reroll still
            refreshes the generated four. Cleaner Topic · n/N hierarchy.
          </li>
          <li>
            UI-only — no <code>party/</code> or RULES changes; PartyKit
            redeploy not required for this polish.
          </li>
        </ul>
      </section>
    </main>
  );
}
