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
        Party-pace clocks → {RULES.productionUrl}
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
              <code>main</code>. <strong>PartyKit redeploy required</strong> —
              server alarms read <code>RULES</code> from{" "}
              <code>party/server.ts</code>.
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
            <strong>Party-pace clocks</strong>: draft pick{" "}
            {RULES.pickClockSeconds}s + {RULES.pickGraceSeconds}s grace (host
            +{RULES.hostExtendSeconds}s); review {RULES.reviewSeconds}s; vote{" "}
            {RULES.humanVoteSeconds}s; wager {RULES.wagerTimeoutSeconds}s; dice
            open {RULES.diceDecisionCountdownSeconds}s → idle bank{" "}
            {RULES.diceIdleBankSeconds}s; topic still no timer.
          </li>
          <li>
            Docs + how-to-play + tests aligned with{" "}
            <code>src/shared/rules.ts</code>.
          </li>
          <li>
            Preserved: topic bank ~{TOPIC_COUNT} + anti-repeat, dice
            scramble+settle, turn strip, Bank the Beans, personal BANK, Stash,
            admin, Beans branding.
          </li>
        </ul>
      </section>
    </main>
  );
}
